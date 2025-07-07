// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "./DappToken.sol";
import "./LPToken.sol";

enum FarmState { ACTIVE, PAUSED, EMERGENCY_STOP }

interface IRewardStrategy {
    function calculateReward(
        uint256 blocks,
        uint256 userBalance,
        uint256 totalBalance,
        uint256 minReward,
        uint256 maxReward,
        address user
    ) external view returns (uint256);
}

contract ProportionalVariableStrategy is IRewardStrategy {
    function calculateReward(
        uint256 blocks,
        uint256 userBalance,
        uint256 totalBalance,
        uint256 minReward,
        uint256 maxReward,
        address /* user */
    ) external pure returns (uint256) {
        if (totalBalance == 0 || userBalance == 0) return 0;
        
        if (blocks > 1e6) blocks = 1e6;
        
        uint256 share = (userBalance * 1e18) / totalBalance;
        uint256 averageReward = (minReward + maxReward) / 2;
        
        return (averageReward * blocks * share) / 1e18;
    }
}

/**
 * @title TokenFarm
 * @dev Contrato de farming de tokens con sistema de recompensas configurable
 * @author Mauricio R Ferreyra
 */
contract TokenFarm is Initializable, OwnableUpgradeable, PausableUpgradeable {
    using SafeMath for uint256;
    
    string public constant name = "Proportional Token Farm";
        
    // === ESTADO PRINCIPAL ===
    FarmState public farmState;
    // address public owner; // Eliminado immutable
    DappToken public dappToken; // Eliminado immutable
    LPToken public lpToken; // Eliminado immutable
    IRewardStrategy public rewardStrategy;

    // === CONFIGURACIÓN ===
    struct RewardConfig {
        uint256 minPerBlock;
        uint256 maxPerBlock;
        uint256 feePercent;
        uint256 lastUpdate;
    }
    
    RewardConfig public rewardConfig;
    uint256 public totalStakingBalance;
    uint256 public collectedFees;
    uint256 public totalRewardsDistributed;
    uint256 public farmStartBlock;

    // === STAKERS ===
    struct Staker {
        uint256 balance;
        uint256 checkpoint;
        uint256 pendingRewards;
        uint256 totalClaimed;
        uint256 depositTimestamp;
        bool hasStaked;
        bool isStaking;
    }

    address[] public stakers;
    mapping(address => Staker) public stakersData;
    mapping(address => uint256) public stakerIndex;
    
    // === CONSTANTES ===
    uint256 public constant MAX_STAKERS = 10000;
    uint256 public constant MIN_DEPOSIT = 1e15;
    uint256 public constant MAX_FEE_PERCENT = 50;
    uint256 public lockPeriod;
    bool public emergencyWithdrawEnabled;

    // === EVENTOS ===
    event Deposit(address indexed user, uint256 amount, uint256 timestamp);
    event Withdraw(address indexed user, uint256 amount, uint256 timestamp);
    event RewardsClaimed(address indexed user, uint256 netAmount, uint256 fee);
    event RewardsDistributed(uint256 totalUsers, uint256 totalAmount, uint256 timestamp);
    event FeesWithdrawn(uint256 amount, uint256 timestamp);
    event RewardConfigUpdated(uint256 min, uint256 max, uint256 fee);
    event StateChanged(FarmState oldState, FarmState newState);
    event StrategyUpdated(address oldStrategy, address newStrategy);
    event EmergencyStop(uint256 timestamp);
    event LockPeriodUpdated(uint256 oldPeriod, uint256 newPeriod);

    // === ERRORES ===
    error TokenFarm__OnlyOwner();
    error TokenFarm__NotStaking();
    error TokenFarm__FarmStopped();
    error TokenFarm__EmergencyStop();
    error TokenFarm__InvalidAmount();
    error TokenFarm__NoRewards();
    error TokenFarm__NoFees();
    error TokenFarm__TransferFailed();
    error TokenFarm__MaxStakersReached();
    error TokenFarm__StillLocked();
    error TokenFarm__InvalidConfiguration();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function __TokenFarm_init(address _owner) internal onlyInitializing {
        __Ownable_init(_owner); 
        __Pausable_init();
        __TokenFarm_init_unchained();
    }

    function __TokenFarm_init_unchained() internal onlyInitializing {
        // Inicialización básica sin los parámetros
        farmState = FarmState.ACTIVE;
        farmStartBlock = block.number;
        emergencyWithdrawEnabled = true;
        
        rewardConfig = RewardConfig({
            minPerBlock: 1e17,
            maxPerBlock: 1e18,
            feePercent: 2,
            lastUpdate: block.timestamp
        });
    }

    // Modifica la función initialize existente para que llame a la nueva función
    function initialize(
        address _dappToken,
        address _lpToken,
        address _strategy,
        address _owner
    ) public initializer {
        __TokenFarm_init(_owner); // Llama al inicializador interno
        dappToken = DappToken(_dappToken);
        lpToken = LPToken(_lpToken);
        rewardStrategy = IRewardStrategy(_strategy);
        _transferOwnership(_owner); // Usa la función de OwnableUpgradeable
    }

    // === MODIFICADORES ===

    modifier whenActive() {
        if (farmState != FarmState.ACTIVE) revert TokenFarm__FarmStopped();
        _;
    }

    modifier whenNotEmergency() {
        if (farmState == FarmState.EMERGENCY_STOP) revert TokenFarm__EmergencyStop();
        _;
    }

    // === MODIFICADOR SOLO STAKER ===

    modifier onlyStaker() {
        if (!stakersData[msg.sender].isStaking || stakersData[msg.sender].balance == 0) {
            revert TokenFarm__NotStaking();
        }
        _;
    }

    // === FUNCIONES PRINCIPALES ===

    function getVersion() public pure virtual returns (string memory) {
        return "1.0.0";
    }

    /**
     * @dev Deposita tokens LP para comenzar a farmear
     * @param _amount Cantidad de tokens LP a depositar
     */
    function deposit(uint256 _amount) 
        external 
        virtual
        whenActive 
        whenNotEmergency
    {
        if (_amount < MIN_DEPOSIT) {
            revert TokenFarm__InvalidAmount();
        }
        if (stakers.length >= MAX_STAKERS && !stakersData[msg.sender].hasStaked) {
            revert TokenFarm__MaxStakersReached();
        }
        
        _beforeDeposit(msg.sender, _amount);
        _executeDeposit(msg.sender, _amount);
        _afterDeposit(msg.sender, _amount);
    }

    function _beforeDeposit(address user, uint256 amount) internal virtual {
        if (!lpToken.transferFrom(user, address(this), amount)) {
            revert TokenFarm__TransferFailed();
        }
        // _updateRewards(user);
    }

    function _executeDeposit(address user, uint256 amount) private {
        Staker storage staker = stakersData[user];
        
        if (!staker.hasStaked) {
            _addStaker(user);
            staker.hasStaked = true;
            staker.depositTimestamp = block.timestamp;
            staker.checkpoint = block.number; // Inicializar checkpoint aquí
        }

        staker.balance += amount;
        staker.isStaking = true;
        totalStakingBalance += amount;

        // if (staker.checkpoint == 0) {
        //     staker.checkpoint = block.number;
        // }
    }

    function _afterDeposit(address user, uint256 amount) internal virtual {
        emit Deposit(user, amount, block.timestamp);
    }

    /**
     * @dev Retira todos los tokens depositados
     */
    function withdraw() external virtual onlyStaker {
        // En emergencia, siempre permitir retiro si está habilitado
        if (farmState == FarmState.EMERGENCY_STOP && !emergencyWithdrawEnabled) {
            revert TokenFarm__EmergencyStop();
        }
        
        Staker storage staker = stakersData[msg.sender];
        uint256 balance = staker.balance;

        if (balance == 0) revert TokenFarm__InvalidAmount();
        
        // Verificar período de bloqueo (excepto en emergencia)
        if (farmState != FarmState.EMERGENCY_STOP && lockPeriod > 0) {
            if (block.timestamp < staker.depositTimestamp + lockPeriod) {
                revert TokenFarm__StillLocked();
            }
        }

        // Solo actualizar recompensas si no estamos en emergencia
        if (farmState != FarmState.EMERGENCY_STOP) {
            _updateRewards(msg.sender);
        }

        staker.balance = 0;
        staker.isStaking = false;
        totalStakingBalance -= balance;

        if (!lpToken.transfer(msg.sender, balance)) {
            revert TokenFarm__TransferFailed();
        }
        
        emit Withdraw(msg.sender, balance, block.timestamp);
    }

    /**
     * @dev Reclama las recompensas pendientes
     */
    function claimRewards() external virtual 
        whenNotEmergency
        whenActive
        onlyStaker
    {
        _updateRewards(msg.sender);
        Staker storage staker = stakersData[msg.sender];
        uint256 reward = staker.pendingRewards;

        if (reward == 0) revert TokenFarm__NoRewards();
        
        uint256 fee = (reward * rewardConfig.feePercent) / 100;
        uint256 netReward = reward - fee;

        staker.pendingRewards = 0;
        staker.totalClaimed += netReward;
        collectedFees += fee;
        totalRewardsDistributed += reward;

        dappToken.mint(msg.sender, netReward);
        emit RewardsClaimed(msg.sender, netReward, fee);
    }

    /**
     * @dev Distribuye recompensas a todos los stakers activos
     */
    function distributeRewardsAll() external onlyOwner whenActive whenNotEmergency {
        uint256 stakersCount = 0;
        uint256 totalDistributed = 0;
        
        for (uint256 i = 0; i < stakers.length; i++) {
            address userAddr = stakers[i];
            if (stakersData[userAddr].isStaking) {
                uint256 oldRewards = stakersData[userAddr].pendingRewards;
                _updateRewards(userAddr);
                uint256 newRewards = stakersData[userAddr].pendingRewards;
                totalDistributed += (newRewards - oldRewards);
                stakersCount++;
            }
        }
        
        emit RewardsDistributed(stakersCount, totalDistributed, block.timestamp);
    }

    /**
     * @dev Actualiza las recompensas pendientes de un usuario
     */
    function _updateRewards(address beneficiary) internal {
        Staker storage staker = stakersData[beneficiary];
        
        if (block.number <= staker.checkpoint || totalStakingBalance == 0 || staker.balance == 0) {
            return;
        }

        uint256 blocksPassed = block.number - staker.checkpoint;
        uint256 reward = rewardStrategy.calculateReward(
            blocksPassed,
            staker.balance,
            totalStakingBalance,
            rewardConfig.minPerBlock,
            rewardConfig.maxPerBlock,
            beneficiary
        );

        staker.pendingRewards += reward;
        staker.checkpoint = block.number;
    }

    function _addStaker(address user) private {
        stakerIndex[user] = stakers.length;
        stakers.push(user);
    }

    // === FUNCIONES DE ADMINISTRACIÓN ===

    /**
     * @dev Pausa el farm (no permite nuevos depósitos ni claims)
     */
    function pauseFarm() external virtual onlyOwner {
        if (farmState == FarmState.PAUSED) return;
        FarmState oldState = farmState;
        farmState = FarmState.PAUSED;
        emit StateChanged(oldState, farmState);
    }

    /**
     * @dev Reanuda el farm
     */
    function resumeFarm() external virtual onlyOwner {
        if (farmState == FarmState.ACTIVE) return;
        if (farmState == FarmState.EMERGENCY_STOP) revert TokenFarm__EmergencyStop();
        
        FarmState oldState = farmState;
        farmState = FarmState.ACTIVE;
        emit StateChanged(oldState, farmState);
    }

    /**
     * @dev Activa el modo de emergencia
     */
    function emergencyStop() external virtual onlyOwner {
        if (farmState == FarmState.EMERGENCY_STOP) return;
        
        FarmState oldState = farmState;
        farmState = FarmState.EMERGENCY_STOP;
        emit StateChanged(oldState, farmState);
        emit EmergencyStop(block.timestamp);
    }

    /**
     * @dev Actualiza la estrategia de recompensas
     */
    function updateRewardStrategy(IRewardStrategy _newStrategy) external onlyOwner {
        if (address(_newStrategy) == address(0)) revert TokenFarm__InvalidConfiguration();
        
        address oldStrategy = address(rewardStrategy);
        rewardStrategy = _newStrategy;
        emit StrategyUpdated(oldStrategy, address(_newStrategy));
    }

    /**
     * @dev Actualiza la configuración de recompensas
     */
    function updateRewardConfig(
        uint256 _min,
        uint256 _max,
        uint256 _feePercent
    ) external onlyOwner {
        if (_min > _max) revert TokenFarm__InvalidConfiguration();
        if (_feePercent > MAX_FEE_PERCENT) revert TokenFarm__InvalidConfiguration();
        
        rewardConfig.minPerBlock = _min;
        rewardConfig.maxPerBlock = _max;
        rewardConfig.feePercent = _feePercent;
        rewardConfig.lastUpdate = block.timestamp;
        
        emit RewardConfigUpdated(_min, _max, _feePercent);
    }

    /**
     * @dev Actualiza el período de bloqueo
     */
    function updateLockPeriod(uint256 _newPeriod) external onlyOwner {
        uint256 oldPeriod = lockPeriod;
        lockPeriod = _newPeriod;
        emit LockPeriodUpdated(oldPeriod, _newPeriod);
    }

    /**
     * @dev Habilita/deshabilita retiros de emergencia
     */
    function setEmergencyWithdrawEnabled(bool _enabled) external onlyOwner {
        emergencyWithdrawEnabled = _enabled;
    }

    /**
     * @dev Retira las comisiones acumuladas
     */
    function withdrawFees() external virtual onlyOwner {
        if (collectedFees == 0) revert TokenFarm__NoFees();
        
        uint256 amount = collectedFees;
        collectedFees = 0;
        
        // Verificar que somos el owner del DappToken
        if (dappToken.owner() != address(this)) revert TokenFarm__InvalidConfiguration();
        
        dappToken.mint(owner(), amount);
        emit FeesWithdrawn(amount, block.timestamp);
    }

    // === FUNCIONES DE VISTA ===

    /**
     * @dev Obtiene información completa de un usuario
     */
    function getUserInfo(address userAddr) external view returns (Staker memory) {
        return stakersData[userAddr];
    }

    /**
     * @dev Obtiene estadísticas del contrato
     */
    function getContractStats() external view returns (
        uint256 totalStakers,
        uint256 totalStaked,
        uint256 totalFees,
        uint256 totalRewards,
        FarmState state,
        uint256 activeStakers
    ) {
        uint256 active = 0;
        for (uint256 i = 0; i < stakers.length; i++) {
            if (stakersData[stakers[i]].isStaking) {
                active++;
            }
        }
        
        return (
            stakers.length,
            totalStakingBalance,
            collectedFees,
            totalRewardsDistributed,
            farmState,
            active
        );
    }

    /**
     * @dev Simula las recompensas actuales y proyectadas
     */
    function simulateRewards(address user) external view returns (
        uint256 pendingRewards,
        uint256 projectedRewards
    ) {
        Staker memory staker = stakersData[user];
        if (!staker.isStaking || totalStakingBalance == 0) {
            return (staker.pendingRewards, 0);
        }

        uint256 blocksPassed = block.number - staker.checkpoint;
        uint256 projected = rewardStrategy.calculateReward(
            blocksPassed,
            staker.balance,
            totalStakingBalance,
            rewardConfig.minPerBlock,
            rewardConfig.maxPerBlock,
            user
        );

        return (staker.pendingRewards, projected);
    }

    /**
     * @dev Calcula la APY estimada basada en la configuración actual
     */
    function getEstimatedAPY() external view returns (uint256) {
        if (totalStakingBalance == 0) return 0;
        
        // Asumiendo ~6000 bloques por día en Ethereum
        uint256 avgRewardPerBlock = (rewardConfig.minPerBlock + rewardConfig.maxPerBlock) / 2;
        uint256 dailyRewards = avgRewardPerBlock * 6000;
        uint256 yearlyRewards = dailyRewards * 365;
        
        // APY = (yearly rewards / total staked) * 100
        return (yearlyRewards * 100) / totalStakingBalance;
    }

    /**
     * @dev Verifica si un usuario puede retirar
     */
    function canWithdraw(address user) external view returns (bool canWithdrawNow, uint256 unlockTime) {
        Staker memory staker = stakersData[user];
        
        if (!staker.isStaking || staker.balance == 0) {
            return (false, 0);
        }
        
        if (farmState == FarmState.EMERGENCY_STOP) {
            return (emergencyWithdrawEnabled, 0);
        }
        
        if (lockPeriod == 0) {
            return (true, 0);
        }
        
        uint256 unlockTimestamp = staker.depositTimestamp + lockPeriod;
        return (block.timestamp >= unlockTimestamp, unlockTimestamp);
    }

    /**
     * @dev Obtiene la lista de todos los stakers activos
     */
    function getActiveStakers() external view returns (address[] memory activeStakersList) {
        uint256 activeCount = 0;
        
        // Contar stakers activos
        for (uint256 i = 0; i < stakers.length; i++) {
            if (stakersData[stakers[i]].isStaking) {
                activeCount++;
            }
        }
        
        // Crear array con tamaño exacto
        activeStakersList = new address[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < stakers.length; i++) {
            if (stakersData[stakers[i]].isStaking) {
                activeStakersList[index] = stakers[i];
                index++;
            }
        }
        
        return activeStakersList;
    }
}
// === LIBRERÍAS AUXILIARES ===

library SafeMath {
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");
        return c;
    }

    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b <= a, "SafeMath: subtraction overflow");
        return a - b;
    }

    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) return 0;
        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");
        return c;
    }

    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b > 0, "SafeMath: division by zero");
        return a / b;
    }
}