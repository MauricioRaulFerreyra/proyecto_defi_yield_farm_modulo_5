import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);
  console.log(
    "Account balance:",
    ethers.formatEther(await deployer.provider.getBalance(deployer.address))
  );

  // 1. Desplegar DappToken con deployer como owner inicial
  console.log("\n1. Deploying DappToken...");
  const DappTokenFactory = await ethers.getContractFactory("DappToken");
  const dappToken = await DappTokenFactory.deploy(deployer.address);
  await dappToken.waitForDeployment();
  console.log("✅ DappToken deployed at:", await dappToken.getAddress());

  // 2. Desplegar LPToken
  console.log("\n2. Deploying LPToken...");
  const LPTokenFactory = await ethers.getContractFactory("LPToken");
  const lpToken = await LPTokenFactory.deploy(deployer.address);
  await lpToken.waitForDeployment();
  console.log("✅ LPToken deployed at:", await lpToken.getAddress());

  // 3. Desplegar Estrategia
  console.log("\n3. Deploying Reward Strategy...");
  const RewardStrategyFactory = await ethers.getContractFactory(
    "ProportionalVariableStrategy"
  );
  const rewardStrategy = await RewardStrategyFactory.deploy();
  await rewardStrategy.waitForDeployment();
  console.log(
    "✅ RewardStrategy deployed at:",
    await rewardStrategy.getAddress()
  );

  // 4. Desplegar TokenFarm CON PROXY TRANSPARENTE
  console.log("\n4. Deploying TokenFarm with Transparent Proxy...");
  const TokenFarmFactory = await ethers.getContractFactory("TokenFarm");

  const tokenFarm = await upgrades.deployProxy(
    TokenFarmFactory,
    [
      await dappToken.getAddress(),
      await lpToken.getAddress(),
      await rewardStrategy.getAddress(),
      deployer.address, // Owner inicial
    ],
    {
      initializer: "initialize",
      kind: "transparent",
    }
  );

  await tokenFarm.waitForDeployment();
  console.log(
    "✅ TokenFarm (Proxy) deployed at:",
    await tokenFarm.getAddress()
  );
  console.log(
    "Implementation address:",
    await upgrades.erc1967.getImplementationAddress(
      await tokenFarm.getAddress()
    )
  );
  console.log(
    "ProxyAdmin address:",
    await upgrades.erc1967.getAdminAddress(await tokenFarm.getAddress())
  );

  // 5. Transferir ownership del DappToken al TokenFarm (al proxy)
  console.log("\n5. Transferring DappToken ownership to TokenFarm...");
  const transferTx = await dappToken
    .connect(deployer)
    .transferOwnership(await tokenFarm.getAddress());
  await transferTx.wait();
  console.log("✅ Ownership transferred");

  // 6. Configurar recompensas iniciales (ahora se hace mediante función separada)
  console.log("\n6. Setting initial configuration...");
  const configTx = await tokenFarm.connect(deployer).updateRewardConfig(
    ethers.parseEther("0.1"), // Min reward
    ethers.parseEther("1"), // Max reward
    2 // 2% fee
  );
  await configTx.wait();

  // 7. Mint inicial de tokens LP
  console.log("\n7. Minting initial LP tokens...");
  const mintTx = await lpToken
    .connect(deployer)
    .mint(deployer.address, ethers.parseEther("10000"));
  await mintTx.wait();

  // Resultados finales
  const addresses = {
    dappToken: await dappToken.getAddress(),
    lpToken: await lpToken.getAddress(),
    tokenFarmProxy: await tokenFarm.getAddress(),
    tokenFarmImplementation: await upgrades.erc1967.getImplementationAddress(
      await tokenFarm.getAddress()
    ),
    proxyAdmin: await upgrades.erc1967.getAdminAddress(
      await tokenFarm.getAddress()
    ),
    rewardStrategy: await rewardStrategy.getAddress(),
    deployer: deployer.address,
  };

  console.log("\n=== Deployment Results ===");
  console.log(JSON.stringify(addresses, null, 2));

  // Verificación adicional
  console.log("\nVerification:");
  console.log("DappToken owner:", await dappToken.owner());
  console.log("TokenFarm config:", await tokenFarm.rewardConfig());

  return addresses;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
