import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { TokenFarmV2, DappToken, LPToken } from "../typechain-types";

// ===== PATRÓN: CONSTANTS OBJECT =====
const TEST_CONSTANTS = {
  TOKEN_AMOUNT: ethers.parseEther("1000"),
  REWARD_AMOUNT: ethers.parseEther("0.1"),
  FEES: {
    WITHDRAW: 500, // 5%
    CLAIM: 500, // 5% - Corregido para que coincida con el contrato
    INVALID_HIGH: 1500, // 15%
    UPDATED_WITHDRAW: 200, // 2%
    UPDATED_CLAIM: 100, // 1%
  },
  BASIS_POINTS: 10000,
  MAX_FEES: {
    WITHDRAW: 1000, // 10%
    CLAIM: 1000, // 10%
  },
  REWARD_PER_BLOCK: ethers.parseEther("0.1"),
} as const;

// ===== PATRÓN: CHAIN OF RESPONSIBILITY PARA VALIDACIÓN =====
abstract class ValidationHandler {
  private nextHandler: ValidationHandler | null = null;

  setNext(handler: ValidationHandler): ValidationHandler {
    this.nextHandler = handler;
    return handler;
  }

  async handle(context: any): Promise<void> {
    await this.validate(context);
    if (this.nextHandler) {
      await this.nextHandler.handle(context);
    }
  }

  protected abstract validate(context: any): Promise<void>;
}

class ContractDeploymentValidator extends ValidationHandler {
  protected async validate(context: any): Promise<void> {
    const { contract, name } = context;
    if (!contract) {
      throw new Error(`${name} deployment failed: contract is undefined`);
    }

    // Verificar que el contrato tiene una dirección válida
    try {
      const address = await contract.getAddress();
      if (!address || address === ethers.ZeroAddress) {
        throw new Error(`${name} deployment failed: invalid address`);
      }
    } catch (error) {
      throw new Error(`${name} deployment failed: ${error}`);
    }
  }
}

class ContractFunctionValidator extends ValidationHandler {
  protected async validate(context: any): Promise<void> {
    const { contract, name, expectedFunctions } = context;
    if (expectedFunctions) {
      for (const func of expectedFunctions) {
        if (typeof contract[func] !== "function") {
          throw new Error(`${name} missing required function: ${func}`);
        }
      }
    }
  }
}

class BalanceValidator extends ValidationHandler {
  protected async validate(context: any): Promise<void> {
    const { token, account, requiredAmount, name } = context;
    if (token && account && requiredAmount) {
      const balance = await token.balanceOf(account);
      if (balance < requiredAmount) {
        throw new Error(
          `${name} insufficient balance: required ${requiredAmount}, got ${balance}`
        );
      }
    }
  }
}

// ===== PATRÓN: FACTORY PATTERN MEJORADO =====
class TestEnvironmentFactory {
  private static validator = new ContractDeploymentValidator()
    .setNext(new ContractFunctionValidator())
    .setNext(new BalanceValidator());

  static async createTokens(): Promise<{
    dappToken: DappToken;
    lpToken: LPToken;
  }> {
    try {
      const DappTokenFactory = await ethers.getContractFactory("DappToken");
      const LPTokenFactory = await ethers.getContractFactory("LPToken");
      const [deployer] = await ethers.getSigners();

      // Deploy DappToken
      const dappToken = await DappTokenFactory.deploy(deployer.address);
      await dappToken.waitForDeployment();

      // Validar DappToken
      await this.validator.handle({
        contract: dappToken,
        name: "DappToken",
        expectedFunctions: ["mint", "balanceOf", "getAddress"],
      });

      // Deploy LPToken
      const lpToken = await LPTokenFactory.deploy(deployer.address);
      await lpToken.waitForDeployment();

      // Validar LPToken
      await this.validator.handle({
        contract: lpToken,
        name: "LPToken",
        expectedFunctions: ["mint", "balanceOf", "approve", "getAddress"],
      });

      return { dappToken, lpToken };
    } catch (error) {
      console.error("Error creating tokens:", error);
      throw error;
    }
  }

  static async deployV1Farm(
    dappToken: DappToken,
    lpToken: LPToken,
    owner: HardhatEthersSigner
  ): Promise<any> {
    try {
      const TokenFarmV1Factory = await ethers.getContractFactory("TokenFarm");

      const tokenFarmV1 = await upgrades.deployProxy(TokenFarmV1Factory, [
        await dappToken.getAddress(),
        await lpToken.getAddress(),
        owner.address,
        owner.address,
      ]);

      await tokenFarmV1.waitForDeployment();

      await this.validator.handle({
        contract: tokenFarmV1,
        name: "TokenFarmV1",
        expectedFunctions: ["getAddress"],
      });

      return tokenFarmV1;
    } catch (error) {
      console.error("Error deploying V1 farm:", error);
      throw error;
    }
  }

  static async upgradeToV2(
    tokenFarmV1: any,
    feeCollector: HardhatEthersSigner
  ): Promise<TokenFarmV2> {
    try {
      const TokenFarmV2Factory = await ethers.getContractFactory("TokenFarmV2");

      const tokenFarmV2 = (await upgrades.upgradeProxy(
        await tokenFarmV1.getAddress(),
        TokenFarmV2Factory
      )) as TokenFarmV2;

      await tokenFarmV2.waitForDeployment();

      await this.validator.handle({
        contract: tokenFarmV2,
        name: "TokenFarmV2",
        expectedFunctions: ["initializeV2", "getVersion", "getFeeInfo"],
      });

      // Inicializar V2 con fees válidas
      await tokenFarmV2.initializeV2(
        TEST_CONSTANTS.FEES.WITHDRAW,
        TEST_CONSTANTS.FEES.CLAIM,
        feeCollector.address
      );

      return tokenFarmV2;
    } catch (error) {
      console.error("Error upgrading to V2:", error);
      throw error;
    }
  }
}

// ===== PATRÓN: BUILDER PATTERN MEJORADO =====
class TestScenarioBuilder {
  private users: HardhatEthersSigner[] = [];
  private tokenAmounts: Map<string, bigint> = new Map();
  private approvals: Map<string, boolean> = new Map();

  withUser(
    user: HardhatEthersSigner,
    tokenAmount = TEST_CONSTANTS.TOKEN_AMOUNT
  ): this {
    this.users.push(user);
    this.tokenAmounts.set(user.address, tokenAmount);
    return this;
  }

  withApproval(user: HardhatEthersSigner, approved = true): this {
    this.approvals.set(user.address, approved);
    return this;
  }

  async build(lpToken: LPToken, tokenFarmV2: TokenFarmV2): Promise<void> {
    for (const user of this.users) {
      const amount =
        this.tokenAmounts.get(user.address) || TEST_CONSTANTS.TOKEN_AMOUNT;

      await lpToken.mint(user.address, amount);

      if (this.approvals.get(user.address) !== false) {
        await lpToken
          .connect(user)
          .approve(await tokenFarmV2.getAddress(), amount);
      }
    }
  }
}

// ===== PATRÓN: COMMAND PATTERN PARA OPERACIONES =====
interface TestCommand {
  execute(): Promise<void>;
  undo?(): Promise<void>;
}

class DepositCommand implements TestCommand {
  constructor(
    private tokenFarm: TokenFarmV2,
    private user: HardhatEthersSigner,
    private amount: bigint
  ) {}

  async execute(): Promise<void> {
    await this.tokenFarm.connect(this.user).deposit(this.amount);
  }
}

class WithdrawCommand implements TestCommand {
  constructor(
    private tokenFarm: TokenFarmV2,
    private user: HardhatEthersSigner
  ) {}

  async execute(): Promise<void> {
    await this.tokenFarm.connect(this.user).withdraw();
  }
}

class ClaimRewardsCommand implements TestCommand {
  constructor(
    private tokenFarm: TokenFarmV2,
    private user: HardhatEthersSigner
  ) {}

  async execute(): Promise<void> {
    await this.tokenFarm.connect(this.user).claimRewards();
  }
}

// ===== PATRÓN: SINGLETON PARA MANEJO DE RECOMPENSAS =====
class RewardManager {
  private static instance: RewardManager;
  private setupComplete: boolean = false;

  private constructor() {}

  static getInstance(): RewardManager {
    if (!RewardManager.instance) {
      RewardManager.instance = new RewardManager();
    }
    return RewardManager.instance;
  }

  async setupRewards(
    dappToken: DappToken,
    tokenFarmV2: TokenFarmV2,
    owner: HardhatEthersSigner
  ): Promise<void> {
    if (this.setupComplete) return;

    const farmAddress = await tokenFarmV2.getAddress();
    const requiredAmount = ethers.parseEther("10000"); // 10,000 tokens

    // Verificar y transferir tokens si es necesario
    const currentBalance = await dappToken.balanceOf(farmAddress);
    if (currentBalance < requiredAmount) {
      await dappToken
        .connect(owner)
        .transfer(farmAddress, requiredAmount - currentBalance);
    }

    // Configurar rewardPerBlock a un valor que genere recompensas predecibles
    const currentReward = await tokenFarmV2.rewardPerBlock();
    if (currentReward === 0n) {
      await tokenFarmV2
        .connect(owner)
        .setRewardPerBlock(ethers.parseEther("0.01"));
    }

    this.setupComplete = true;
  }
}

// ===== PATRÓN: STRATEGY PATTERN PARA CÁLCULOS =====
interface FeeCalculationStrategy {
  calculate(amount: bigint, feeRate: number): bigint;
}

class StandardFeeCalculation implements FeeCalculationStrategy {
  calculate(amount: bigint, feeRate: number): bigint {
    return (amount * BigInt(feeRate)) / BigInt(TEST_CONSTANTS.BASIS_POINTS);
  }
}

class EmergencyFeeCalculation implements FeeCalculationStrategy {
  calculate(amount: bigint, feeRate: number): bigint {
    return 0n; // No fees during emergency
  }
}

// ===== PATRÓN: HELPER UTILITIES MEJORADO =====
class TestHelpers {
  private static feeCalculator: FeeCalculationStrategy =
    new StandardFeeCalculation();

  static setFeeCalculationStrategy(strategy: FeeCalculationStrategy): void {
    this.feeCalculator = strategy;
  }

  static async mineBlocks(count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      await ethers.provider.send("evm_mine", []);
    }
  }

  static calculateFee(amount: bigint, feeRate: number): bigint {
    return this.feeCalculator.calculate(amount, feeRate);
  }

  static async getBlockNumber(): Promise<number> {
    return await ethers.provider.getBlockNumber();
  }

  static async debugContractState(
    tokenFarmV2: TokenFarmV2,
    userAddress: string
  ): Promise<void> {
    console.log("=== CONTRACT STATE DEBUG ===");
    console.log("Current block:", await this.getBlockNumber());
    console.log("Reward per block:", await tokenFarmV2.rewardPerBlock());

    const userInfo = await tokenFarmV2.getUserInfo(userAddress);
    console.log("User deposit amount:", userInfo.balance);
    console.log("User pending rewards:", userInfo.pendingRewards);

    const farmAddress = await tokenFarmV2.getAddress();
    console.log("Farm contract address:", farmAddress);
    console.log("================================");
  }
}

// ===== PATRÓN: ASSERTION HELPERS MEJORADO =====
class AssertionHelpers {
  static async expectRevert(
    promise: Promise<any>,
    expectedError: string
  ): Promise<void> {
    await expect(promise).to.be.revertedWith(expectedError);
  }

  static async expectCustomRevert(
    promise: Promise<any>,
    contract: any,
    errorName: string
  ): Promise<void> {
    await expect(promise).to.be.revertedWithCustomError(contract, errorName);
  }

  static async expectEmitEvent(
    contract: any,
    eventName: string,
    transaction: Promise<any>
  ): Promise<void> {
    await expect(transaction).to.emit(contract, eventName);
  }

  static async expectEmitWithArgs(
    contract: any,
    eventName: string,
    args: any[],
    transaction: Promise<any>
  ): Promise<void> {
    await expect(transaction)
      .to.emit(contract, eventName)
      .withArgs(...args);
  }
}

// ===== HELPER PARA SETUP DE TESTS =====
class TestSetupHelper {
  static async setupRewardsAndDeposit(
    tokenFarmV2: TokenFarmV2,
    dappToken: DappToken,
    user: HardhatEthersSigner,
    amount: bigint,
    owner: HardhatEthersSigner
  ): Promise<void> {
    const rewardManager = RewardManager.getInstance();
    await rewardManager.setupRewards(dappToken, tokenFarmV2, owner);

    await new DepositCommand(tokenFarmV2, user, amount).execute();
    await TestHelpers.mineBlocks(10);
  }

  static async verifyMintCapability(
    dappToken: DappToken,
    tokenFarmV2: TokenFarmV2
  ): Promise<{ method: string; canMint: boolean }> {
    try {
      const testAmount = ethers.parseEther("1");
      const farmAddress = await tokenFarmV2.getAddress();

      await dappToken.mint(farmAddress, testAmount);
      return { method: "mint", canMint: true };
    } catch (error) {
      return { method: "unknown", canMint: false };
    }
  }
}

// ===== TESTS CORREGIDOS =====
describe("TokenFarmV2 - Improved with Design Patterns", () => {
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let feeCollector: HardhatEthersSigner;
  let dappToken: DappToken;
  let lpToken: LPToken;
  let tokenFarmV1: any;
  let tokenFarmV2: TokenFarmV2;
  let rewardManager: RewardManager;

  before(async () => {
    [owner, user1, user2, feeCollector] = await ethers.getSigners();
    rewardManager = RewardManager.getInstance();
  });

  beforeEach(async () => {
    rewardManager.setupRewards;

    const tokens = await TestEnvironmentFactory.createTokens();
    dappToken = tokens.dappToken;
    lpToken = tokens.lpToken;

    // Mint tokens iniciales al owner (1 millón)
    const largeAmount = ethers.parseEther("1000000");
    await dappToken.connect(owner).mint(owner.address, largeAmount);
    await lpToken.connect(owner).mint(owner.address, largeAmount);

    // Primero deploy V1 y upgrade a V2
    tokenFarmV1 = await TestEnvironmentFactory.deployV1Farm(
      dappToken,
      lpToken,
      owner
    );

    tokenFarmV2 = await TestEnvironmentFactory.upgradeToV2(
      tokenFarmV1,
      feeCollector
    );

    // Transferir 500k tokens al contrato farm
    await dappToken
      .connect(owner)
      .transfer(await tokenFarmV2.getAddress(), ethers.parseEther("10"));

    // Configurar recompensas conservadoras (0.01 tokens/block)
    await tokenFarmV2
      .connect(owner)
      .setRewardPerBlock(ethers.parseEther("0.01"));

    // Configurar usuarios
    await new TestScenarioBuilder()
      .withUser(user1)
      .withUser(user2)
      .build(lpToken, tokenFarmV2);
  });

  describe("Initialization", () => {
    it("should set correct version", async () => {
      expect(await tokenFarmV2.getVersion()).to.equal("2.0.0");
    });

    it("should initialize fees correctly", async () => {
      const feeInfo = await tokenFarmV2.getFeeInfo();
      expect(feeInfo._withdrawFee).to.equal(TEST_CONSTANTS.FEES.WITHDRAW);
      expect(feeInfo._claimFee).to.equal(TEST_CONSTANTS.FEES.CLAIM);
      expect(feeInfo._feeCollector).to.equal(feeCollector.address);
    });

    it("should reject invalid fee values during initialization", async () => {
      const TokenFarmV1Factory = await ethers.getContractFactory("TokenFarm");
      const tempV1 = await upgrades.deployProxy(TokenFarmV1Factory, [
        await dappToken.getAddress(),
        await lpToken.getAddress(),
        owner.address,
        owner.address,
      ]);
      const TokenFarmV2Factory = await ethers.getContractFactory("TokenFarmV2");
      const tempV2 = await upgrades.upgradeProxy(
        await tempV1.getAddress(),
        TokenFarmV2Factory
      );

      await AssertionHelpers.expectCustomRevert(
        tempV2.initializeV2(
          TEST_CONSTANTS.FEES.INVALID_HIGH,
          TEST_CONSTANTS.FEES.CLAIM,
          feeCollector.address
        ),
        tempV2,
        "InvalidFeeValue"
      );
    });

    it("should prevent double initialization", async () => {
      await AssertionHelpers.expectCustomRevert(
        tokenFarmV2.initializeV2(
          TEST_CONSTANTS.FEES.WITHDRAW,
          TEST_CONSTANTS.FEES.CLAIM,
          feeCollector.address
        ),
        tokenFarmV2,
        "InvalidInitialization"
      );
    });
  });

  describe("Fee System - Enhanced Tests", () => {
    const amount = ethers.parseEther("100");

    beforeEach(async () => {
      await TestSetupHelper.setupRewardsAndDeposit(
        tokenFarmV2,
        dappToken,
        user1,
        amount,
        owner
      );
    });

    it("should charge claim fee when claiming rewards", async () => {
      const preBalance = await dappToken.balanceOf(user1.address);
      // console.log("Pre-claim balance:", preBalance.toString());
      const collectedBefore = await tokenFarmV2.collectedDappFees();
      // console.log("Collected fees before claim:", collectedBefore.toString());
      await new ClaimRewardsCommand(tokenFarmV2, user1).execute();

      const postBalance = await dappToken.balanceOf(user1.address);
      // console.log("Post-claim balance:", postBalance.toString());
      const collectedAfter = await tokenFarmV2.collectedDappFees();
      // console.log("Collected fees after claim:", collectedAfter.toString());
      const rewardReceived = postBalance - preBalance;
      const feeCharged = collectedAfter - collectedBefore;
      // console.log("Reward received:", rewardReceived.toString());
      const fullReward = rewardReceived + feeCharged;
      // console.log("Full reward received:", fullReward.toString());
      const expectedFee =
        (fullReward * BigInt(TEST_CONSTANTS.FEES.CLAIM)) / BigInt(10000); // BASIS_POINTS = 10000
      // console.log("Expected fee:", expectedFee.toString());
      expect(feeCharged).to.equal(expectedFee);
      expect(postBalance).to.equal(preBalance + fullReward - expectedFee);
    });

    it("should charge withdraw fee when withdrawing LP tokens", async () => {
      await dappToken
        .connect(owner)
        .mint(await tokenFarmV2.getAddress(), TEST_CONSTANTS.TOKEN_AMOUNT);

      const preBalance = await lpToken.balanceOf(user1.address);

      await new WithdrawCommand(tokenFarmV2, user1).execute();

      const expectedFee = TestHelpers.calculateFee(
        amount,
        TEST_CONSTANTS.FEES.WITHDRAW
      );
      const postBalance = await lpToken.balanceOf(user1.address);
      const collected = await tokenFarmV2.collectedLpFees();

      expect(collected).to.equal(expectedFee);
      expect(postBalance).to.equal(preBalance + amount - expectedFee);
    });

    it("should handle zero balance gracefully", async () => {
      await AssertionHelpers.expectCustomRevert(
        tokenFarmV2.connect(user2).withdraw(),
        tokenFarmV2,
        "TokenFarm__NotStaking"
      );
    });

    it("should handle maximum fee values", async () => {
      await tokenFarmV2
        .connect(owner)
        .updateFees(
          TEST_CONSTANTS.MAX_FEES.WITHDRAW,
          TEST_CONSTANTS.MAX_FEES.CLAIM
        );

      await new WithdrawCommand(tokenFarmV2, user1).execute();

      const expectedMaxFee = TestHelpers.calculateFee(
        amount,
        TEST_CONSTANTS.MAX_FEES.WITHDRAW
      );
      const collected = await tokenFarmV2.collectedLpFees();

      expect(collected).to.equal(expectedMaxFee);
    });

    it("should verify mint capability", async () => {
      const capability = await TestSetupHelper.verifyMintCapability(
        dappToken,
        tokenFarmV2
      );

      expect(capability.method).to.not.equal("unknown");

      if (capability.method === "mint") {
        expect(capability.canMint).to.be.true;
      }
    });
  });

  describe("Emergency Features - Enhanced", () => {
    it("should allow emergency withdraw without fees", async () => {
      await new DepositCommand(
        tokenFarmV2,
        user1,
        TEST_CONSTANTS.TOKEN_AMOUNT
      ).execute();

      await tokenFarmV2.emergencyStop();
      TestHelpers.setFeeCalculationStrategy(new EmergencyFeeCalculation());

      await AssertionHelpers.expectEmitEvent(
        tokenFarmV2,
        "Withdraw",
        tokenFarmV2.connect(user1).withdraw()
      );

      const collected = await tokenFarmV2.collectedLpFees();
      expect(collected).to.equal(0n);
    });
  });

  describe("Command Pattern Operations", () => {
    it("should execute deposit command successfully", async () => {
      const depositCommand = new DepositCommand(
        tokenFarmV2,
        user1,
        TEST_CONSTANTS.TOKEN_AMOUNT
      );

      await depositCommand.execute();

      const userInfo = await tokenFarmV2.getUserInfo(user1.address);
      expect(userInfo.balance).to.equal(TEST_CONSTANTS.TOKEN_AMOUNT);
      expect(userInfo.hasStaked).to.be.true;
    });

    it("should execute withdraw command successfully", async () => {
      await new DepositCommand(
        tokenFarmV2,
        user1,
        TEST_CONSTANTS.TOKEN_AMOUNT
      ).execute();

      const withdrawCommand = new WithdrawCommand(tokenFarmV2, user1);
      await withdrawCommand.execute();

      const userInfo = await tokenFarmV2.getUserInfo(user1.address);
      expect(userInfo.balance).to.equal(0);
      expect(userInfo.hasStaked).to.be.true;
    });
  });
});
