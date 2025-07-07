// upgrade.ts
import { ignition } from "hardhat";
import TokenFarmUpgrade from "../ignition/modules/TokenFarmUpgrade";
import upgradeConfig from "../scripts/tokenfarm-upgrade.config";

async function main() {
  // Ensure feeCollector is defined
  if (!upgradeConfig.feeCollector) {
    throw new Error("feeCollector address must be defined in upgradeConfig");
  }

  const result = await ignition.deploy(TokenFarmUpgrade, {
    parameters: {
      upgradeConfig: {
        ...upgradeConfig,
        feeCollector: upgradeConfig.feeCollector as string,
      },
    },
  });

  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║          TOKEN FARM UPGRADE COMPLETED            ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log(
    `║ New Implementation: ${result.tokenFarmV2Implementation.address}`
  );
  console.log(`║ Proxy Address:      ${result.proxy.address}`);
  console.log(`║ Fee Collector:      ${upgradeConfig.feeCollector}`);
  console.log(`║ Performance Fee:    ${upgradeConfig.performanceFee}%`);
  console.log(`║ Withdraw Fee:       ${upgradeConfig.withdrawFee}%`);
  console.log("╚══════════════════════════════════════════════════╝");
}

main().catch(console.error);
