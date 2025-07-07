// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./TokenFarm.sol";

// Custom errors
error InvalidFeeValue();
error Unauthorized();
error InvalidAddress();
error FundsLocked();
error AlreadyInitialized();

interface ITokenFarm {
    function deposit(uint256 _amount) external;
}

contract TokenFarmV2 is TokenFarm {


    // V2 state variables - Añadidas al FINAL del storage layout
    uint256 public withdrawFee;
    uint256 public claimFee;
    address public feeCollector;
    uint256 public collectedLpFees;  // Renombrado para LP token fees
    uint256 public collectedDappFees; // Fees en DAPP tokens
    uint256 public rewardPerBlock; // Recompensas por bloque

    // Constants
    uint256 public constant MAX_WITHDRAW_FEE = 1000;    // 10%
    uint256 public constant MAX_CLAIM_FEE = 1000;       // 10%
    uint256 public constant BASIS_POINTS = 10000;       // 100%

    // Events
    event RewardsClaimedV2(address indexed user, uint256 amount, uint256 fee);
    event FeesWithdrawnV2(uint256 amount, address indexed collector);
    event LpFeesWithdrawn(uint256 amount, address indexed collector);
    event FeesUpdated(uint256 newWithdrawFee, uint256 newClaimFee);
    event FeeCollectorUpdated(address newCollector);
    event RewardPerBlockUpdated(uint256 newReward);
    event LockPeriodUpdated(uint256 newLockPeriod);


    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @custom:oz-upgrades-validate-as-initializer
    function initializeV2(
        uint256 _withdrawFee,
        uint256 _claimFee,
        address _feeCollector
    ) public reinitializer(2) {
        
        // Luego validar parámetros
        if (_withdrawFee > MAX_WITHDRAW_FEE) revert InvalidFeeValue();
        if (_claimFee > MAX_CLAIM_FEE) revert InvalidFeeValue();
        if (_feeCollector == address(0)) revert InvalidAddress();

        withdrawFee = _withdrawFee;
        claimFee = _claimFee;
        feeCollector = _feeCollector;
    }

    function getVersion() public pure override returns (string memory) {
        return "2.0.0";
    }

    // Internal helper to update user rewards
    function _updateUserRewards(address user) internal {
        Staker storage staker = stakersData[user];
        if (block.number > staker.checkpoint && staker.balance > 0) {
            uint256 blocksPassed = block.number - staker.checkpoint;
            // Calculo preciso manteniendo decimales
            uint256 reward = (blocksPassed * rewardPerBlock * staker.balance) / totalStakingBalance;
            
            staker.pendingRewards += reward;
            staker.checkpoint = block.number;
        }
    }

    function setRewardPerBlock(uint256 _rewardPerBlock) external onlyOwner {
        rewardPerBlock = _rewardPerBlock;
    }

    function deposit(uint256 amount) public override {
        _updateUserRewards(msg.sender);
        
        // Ejecutar lógica de depósito manualmente
        require(amount >= MIN_DEPOSIT, "Invalid amount");
        if (stakers.length >= MAX_STAKERS && !stakersData[msg.sender].hasStaked) {
            revert TokenFarm__MaxStakersReached();
        }
        
        _beforeDeposit(msg.sender, amount);
        
        // Copiar lógica de _executeDeposit
        Staker storage staker = stakersData[msg.sender];
        if (!staker.hasStaked) {
            stakers.push(msg.sender);
            staker.hasStaked = true;
            staker.depositTimestamp = block.timestamp;
        }
        
        staker.balance += amount;
        staker.isStaking = true;
        totalStakingBalance += amount;
        
        _afterDeposit(msg.sender, amount);
        
        // Actualizar checkpoint
        staker.checkpoint = block.number;
    }

    // Sobrescribir _beforeDeposit con la misma visibilidad (internal)
    function _beforeDeposit(address user, uint256 amount) internal override {
        super._beforeDeposit(user, amount); // Llamar a la versión del padre
    }

    function claimRewards() public override whenActive {
        _updateUserRewards(msg.sender);

        Staker storage staker = stakersData[msg.sender];
        uint256 rewards = staker.pendingRewards;
        require(rewards > 0, "No rewards");

        uint256 fee = (rewards * claimFee) / BASIS_POINTS;
        uint256 claimAmount = rewards - fee;

        // Verificación exhaustiva de balances
        uint256 availableBalance = dappToken.balanceOf(address(this));
        require(availableBalance >= claimAmount, "Insufficient contract balance");

        staker.pendingRewards = 0;
        staker.totalClaimed += claimAmount;
        collectedDappFees += fee;
        totalRewardsDistributed += rewards;

        bool success = dappToken.transfer(msg.sender, claimAmount);
        require(success, "Transfer failed");
    
        emit RewardsClaimedV2(msg.sender, claimAmount, fee);
    }

    function withdraw() public override onlyStaker {
        if (farmState == FarmState.EMERGENCY_STOP && !emergencyWithdrawEnabled) {
            revert TokenFarm__EmergencyStop();
        }

        Staker storage staker = stakersData[msg.sender];
        uint256 balance = staker.balance;
        if (balance == 0) revert TokenFarm__InvalidAmount();

        if (farmState != FarmState.EMERGENCY_STOP && lockPeriod > 0) {
            if (block.timestamp < staker.depositTimestamp + lockPeriod) {
                revert TokenFarm__StillLocked();
            }
        }

        if (farmState != FarmState.EMERGENCY_STOP) {
            _updateUserRewards(msg.sender);
            if (staker.pendingRewards > 0) {
                uint256 rewards = staker.pendingRewards;
                uint256 claimFeeAmount = (rewards * claimFee) / BASIS_POINTS;
                uint256 claimAmount = rewards - claimFeeAmount;

                staker.pendingRewards = 0;
                staker.totalClaimed += claimAmount;
                collectedDappFees += claimFeeAmount;
                totalRewardsDistributed += rewards;

                // dappToken.mint(msg.sender, claimAmount);
                require(dappToken.transfer(msg.sender, claimAmount), "Transfer failed");
                emit RewardsClaimedV2(msg.sender, claimAmount, claimFeeAmount);
            }
        }

        staker.balance = 0;
        staker.isStaking = false;
        totalStakingBalance -= balance;

        uint256 fee = 0;
        uint256 withdrawAmount = balance;
        if (farmState != FarmState.EMERGENCY_STOP && withdrawFee > 0) {
            fee = (balance * withdrawFee) / BASIS_POINTS;
            withdrawAmount = balance - fee;
            collectedLpFees += fee;
        }

        require(lpToken.transfer(msg.sender, withdrawAmount), "Transfer failed");
        emit Withdraw(msg.sender, withdrawAmount, block.timestamp);
    }

    function withdrawFees() external override onlyOwner {
        require(collectedDappFees > 0, "No fees");
        uint256 amount = collectedDappFees;
        collectedDappFees = 0;
        // dappToken.mint(feeCollector, amount);
        require(dappToken.transfer(feeCollector, amount), "Transfer failed");
        emit FeesWithdrawnV2(amount, feeCollector);
    }

    function withdrawLpFees() external onlyOwner {
        require(collectedLpFees > 0, "No fees");
        uint256 amount = collectedLpFees;
        collectedLpFees = 0;
        require(lpToken.transfer(feeCollector, amount), "Transfer failed");
        emit LpFeesWithdrawn(amount, feeCollector);
    }

    function updateFeeCollector(address newCollector) external {
        if (msg.sender != owner()) revert Unauthorized();
        if (newCollector == address(0)) revert InvalidAddress();
        feeCollector = newCollector;
        emit FeeCollectorUpdated(newCollector);
    }

    function updateFees(
        uint256 _withdrawFee,
        uint256 _claimFee
    ) external {
        if (msg.sender != owner()) revert Unauthorized();
        if (_withdrawFee > MAX_WITHDRAW_FEE) revert InvalidFeeValue();
        if (_claimFee > MAX_CLAIM_FEE) revert InvalidFeeValue();

        withdrawFee = _withdrawFee;
        claimFee = _claimFee;

        emit FeesUpdated(_withdrawFee, _claimFee);
    }

    function setLockPeriod(uint256 _lockPeriod) external {
        if (msg.sender != owner()) revert Unauthorized();
        lockPeriod = _lockPeriod;
    }

    function getFeeInfo()
        external
        view
        returns (
            uint256 _withdrawFee,
            uint256 _claimFee,
            uint256 _collectedLpFees,
            uint256 _collectedDappFees,
            address _feeCollector
        )
    {
        return (
            withdrawFee,
            claimFee,
            collectedLpFees,
            collectedDappFees,
            feeCollector
        );
    }
}