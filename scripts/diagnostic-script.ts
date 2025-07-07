import { ProxyUpgradeDebugger } from "../ignition/modules/TokenFarmUpgrade";

async function main() {
  const hre = require("hardhat");

  console.log("🔍 Ejecutando diagnóstico del proxy...");
  await ProxyUpgradeDebugger.diagnoseProxyState(hre);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
