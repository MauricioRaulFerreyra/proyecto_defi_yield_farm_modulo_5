import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import tokenFarmProxy from "./TokenFarmProxy";
import {
  getAdminAddress,
  getImplementationAddress,
} from "@openzeppelin/upgrades-core";

// Debugging Pattern - Verificaciones paso a paso
export const ProxyUpgradeDebugger = {
  /**
   * Diagnóstico completo del estado del proxy
   */
  async diagnoseProxyState(hre: any) {
    console.log("🔍 === DIAGNÓSTICO DEL PROXY ===");

    const addresses = {
      tokenFarmProxy: "0xFa011DA5464EA100DC65337d483c7518199c2196",
      tokenFarmImpl: "0xdb74B94fAAaE928FCB9741112A82847dB5146eFd",
      proxyAdmin: "0x24E2fCcb3d73B1268F248a9C4c0582af0aF51d2e",
    };

    try {
      // 1. Verificar que las direcciones sean contratos válidos
      console.log("1️⃣ Verificando contratos...");
      for (const [name, address] of Object.entries(addresses)) {
        const code = await hre.ethers.provider.getCode(address);
        console.log(
          `   ${name}: ${code === "0x" ? "❌ NO ES CONTRATO" : "✅ CONTRATO VÁLIDO"}`
        );
      }

      // 2. Verificar ownership del ProxyAdmin
      console.log("\n2️⃣ Verificando ownership...");
      const proxyAdmin = await hre.ethers.getContractAt(
        "MyProxyAdmin",
        addresses.proxyAdmin
      );
      const owner = await proxyAdmin.owner();
      const [signer] = await hre.ethers.getSigners();
      console.log(`   ProxyAdmin owner: ${owner}`);
      console.log(`   Current signer: ${signer.address}`);
      console.log(
        `   Is owner: ${owner.toLowerCase() === signer.address.toLowerCase() ? "✅ SÍ" : "❌ NO"}`
      );

      // 3. Verificar que el ProxyAdmin sea el admin del proxy
      console.log("\n3️⃣ Verificando admin del proxy...");
      try {
        const adminAddress = await getAdminAddress(
          hre.ethers.provider,
          addresses.tokenFarmProxy
        );
        console.log(`   Proxy admin: ${adminAddress}`);
        console.log(`   Expected admin: ${addresses.proxyAdmin}`);
        console.log(
          `   Admin matches: ${adminAddress.toLowerCase() === addresses.proxyAdmin.toLowerCase() ? "✅ SÍ" : "❌ NO"}`
        );
      } catch (error) {
        console.log(`   ⚠️  No se pudo verificar admin: ${error}`);
      }

      // 4. Verificar implementación actual
      console.log("\n4️⃣ Verificando implementación actual...");
      try {
        const currentImpl = await getImplementationAddress(
          hre.ethers.provider,
          addresses.tokenFarmProxy
        );
        console.log(`   Current implementation: ${currentImpl}`);
        console.log(`   Expected implementation: ${addresses.tokenFarmImpl}`);
        console.log(
          `   Implementation matches: ${currentImpl.toLowerCase() === addresses.tokenFarmImpl.toLowerCase() ? "✅ SÍ" : "❌ NO"}`
        );
      } catch (error) {
        console.log(`   ⚠️  No se pudo verificar implementación: ${error}`);
      }
    } catch (error) {
      console.error("❌ Error durante el diagnóstico:", error);
    }
  },

  /**
   * Prueba de upgrade en seco (sin ejecutar)
   */
  async testUpgradeCall(hre: any, newImplementationAddress: string) {
    console.log("\n🧪 === PRUEBA DE UPGRADE ===");

    const addresses = {
      tokenFarmProxy: "0xFa011DA5464EA100DC65337d483c7518199c2196",
      proxyAdmin: "0x24E2fCcb3d73B1268F248a9C4c0582af0aF51d2e",
    };

    try {
      const proxyAdmin = await hre.ethers.getContractAt(
        "MyProxyAdmin",
        addresses.proxyAdmin
      );

      // Simular la llamada sin ejecutar
      const data = proxyAdmin.interface.encodeFunctionData("upgradeProxy", [
        addresses.tokenFarmProxy,
        newImplementationAddress,
      ]);

      console.log("📋 Datos de la transacción:");
      console.log(`   To: ${addresses.proxyAdmin}`);
      console.log(`   Data: ${data}`);
      console.log(`   New Implementation: ${newImplementationAddress}`);

      // Intentar llamada estática
      try {
        await proxyAdmin.callStatic.upgradeProxy(
          addresses.tokenFarmProxy,
          newImplementationAddress
        );
        console.log("✅ Llamada estática exitosa - upgrade debería funcionar");
      } catch (error) {
        console.log("❌ Llamada estática falló:", error);

        if (error instanceof Error) {
          if (error.message.includes("Ownable: caller is not the owner")) {
            console.log("🔍 PROBLEMA: No eres el owner del ProxyAdmin");
          } else if (error.message.includes("not a contract")) {
            console.log(
              "🔍 PROBLEMA: La nueva implementación no es un contrato válido"
            );
          } else {
            console.log("🔍 PROBLEMA: Error desconocido -", error.message);
          }
        } else {
          console.log("🔍 PROBLEMA: Error inesperado -", error);
        }
      }
    } catch (error) {
      console.error("❌ Error durante la prueba:", error);
    }
  },
};

// Versión corregida del módulo de upgrade
export default buildModule("TokenFarmUpgrade", (m) => {
  console.log("🚀 Iniciando TokenFarmUpgrade...");

  // 1. Cargar dependencias
  const { proxy, proxyAdmin } = m.useModule(tokenFarmProxy);

  // 2. Crear referencia con ABI correcta
  const proxyAdminWithAbi = m.contractAt("MyProxyAdmin", proxyAdmin, {
    id: "ProxyAdmin_WithAbi",
  });

  // 3. Desplegar nueva implementación
  console.log("📦 Desplegando TokenFarmV2...");
  const tokenFarmV2Impl = m.contract("TokenFarmV2", [], {
    id: "TokenFarmV2_Implementation",
  });

  // 4. Agregar validación antes del upgrade
  console.log("🔍 Validando antes del upgrade...");

  // 5. Ejecutar upgrade con mejor manejo de errores
  const upgradeToV2 = m.call(
    proxyAdminWithAbi,
    "upgradeProxy",
    [proxy, tokenFarmV2Impl],
    {
      id: "upgradeToV2",
      // Agregar más contexto para debugging
      from: undefined, // Usará el signer por defecto
    }
  );

  // 6. Crear interfaz V2 del proxy
  const tokenFarmV2 = m.contractAt("TokenFarmV2", proxy, {
    id: "TokenFarmV2_ProxyInterface",
  });

  // 7. Inicializar V2 (solo si el upgrade fue exitoso)
  console.log("🔧 Inicializando V2...");
  const initializeV2 = m.call(
    tokenFarmV2,
    "initializeV2",
    [5, 1, "0x0Fb4A105aA08C2b86e52A9eB9BE7261B972cD8cC"],
    {
      id: "initializeV2",
      after: [upgradeToV2],
    }
  );

  console.log("✅ TokenFarmUpgrade configurado");

  return {
    tokenFarmV2,
    tokenFarmV2Implementation: tokenFarmV2Impl,
    proxyAdmin: proxyAdminWithAbi,
    proxy,
  };
});

// Script de diagnóstico para ejecutar por separado
export const createDiagnosticScript = () => `
// diagnostic-script.ts
import { ProxyUpgradeDebugger } from "./TokenFarmUpgrade";

async function main() {
  const hre = require("hardhat");
  
  console.log("🔍 Ejecutando diagnóstico del proxy...");
  await ProxyUpgradeDebugger.diagnoseProxyState(hre);
  
  // Si tienes la dirección de la nueva implementación, úsala aquí
  // const newImplAddress = "0x..."; // Dirección de TokenFarmV2
  // await ProxyUpgradeDebugger.testUpgradeCall(hre, newImplAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
`;

// Soluciones comunes por tipo de error
export const CommonSolutions = {
  ownershipIssue: {
    problem: "No eres el owner del ProxyAdmin",
    solutions: [
      "1. Verificar que estés usando la wallet correcta",
      "2. Verificar que la wallet tenga el ownership del ProxyAdmin",
      "3. Si es necesario, transferir ownership al address correcto",
    ],
  },

  implementationIssue: {
    problem: "La nueva implementación no es válida",
    solutions: [
      "1. Verificar que TokenFarmV2 se haya desplegado correctamente",
      "2. Verificar que la dirección de la implementación sea correcta",
      "3. Verificar que TokenFarmV2 sea compatible con TokenFarm",
    ],
  },

  proxyConfigIssue: {
    problem: "Configuración incorrecta del proxy",
    solutions: [
      "1. Verificar que el ProxyAdmin sea realmente el admin del proxy",
      "2. Verificar que las direcciones en el módulo sean correctas",
      "3. Verificar que el proxy esté configurado correctamente",
    ],
  },
};

// Comandos de Hardhat para debugging
export const HardhatCommands = {
  diagnose: "npx hardhat run diagnostic-script.ts --network sepolia",
  checkBalances: "npx hardhat run scripts/check-balances.ts --network sepolia",
  verifyContracts: "npx hardhat verify --network sepolia",
};
