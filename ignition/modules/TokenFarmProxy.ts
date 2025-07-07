import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Configuration Pattern - Centralized addresses
interface ProxyConfiguration {
  tokenFarmProxy: string;
  tokenFarmImpl: string;
  proxyAdmin: string;
}

// Strategy Pattern - Different network configurations
const NETWORK_CONFIGS: Record<string, ProxyConfiguration> = {
  sepolia: {
    tokenFarmProxy: "0xFa011DA5464EA100DC65337d483c7518199c2196",
    tokenFarmImpl: "0xdb74B94fAAaE928FCB9741112A82847dB5146eFd",
    proxyAdmin: "0x24E2fCcb3d73B1268F248a9C4c0582af0aF51d2e",
  },
  mainnet: {
    tokenFarmProxy: "0x0000000000000000000000000000000000000000", // TODO: Add mainnet addresses
    tokenFarmImpl: "0x0000000000000000000000000000000000000000",
    proxyAdmin: "0x0000000000000000000000000000000000000000",
  },
};

// Validation Pattern - Address validation
const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

// Factory Pattern - Module creation with validation
export default buildModule("TokenFarmProxy", (m) => {
  // Get network configuration (defaulting to sepolia)
  const network = process.env.HARDHAT_NETWORK || "sepolia";
  const config = NETWORK_CONFIGS[network];

  if (!config) {
    throw new Error(`Network configuration not found for: ${network}`);
  }

  // Validation Pattern - Ensure all addresses are valid
  const addresses = [
    config.tokenFarmProxy,
    config.tokenFarmImpl,
    config.proxyAdmin,
  ];
  addresses.forEach((addr, index) => {
    if (!isValidAddress(addr)) {
      const names = ["tokenFarmProxy", "tokenFarmImpl", "proxyAdmin"];
      throw new Error(`Invalid address for ${names[index]}: ${addr}`);
    }
  });

  // Builder Pattern - Construct contract references
  const contractReferences = {
    // Implementation contract reference
    tokenFarmImplementation: m.contractAt("TokenFarm", config.tokenFarmImpl, {
      id: "TokenFarm_Implementation_At",
    }),

    // Proxy contract reference (as TokenFarm interface)
    tokenFarm: m.contractAt("TokenFarm", config.tokenFarmProxy, {
      id: "TokenFarm_Proxy_At",
    }),

    // ProxyAdmin reference
    proxyAdmin: m.contractAt("MyProxyAdmin", config.proxyAdmin, {
      id: "ProxyAdmin_At",
    }),

    // Raw proxy reference (as TransparentUpgradeableProxy)
    proxy: m.contractAt("TransparentUpgradeableProxy", config.tokenFarmProxy, {
      id: "TransparentProxy_At",
    }),
  };

  // Observer Pattern - Log configuration for debugging
  console.log(`TokenFarmProxy Module Configuration for ${network}:`);
  console.log(`- Proxy Address: ${config.tokenFarmProxy}`);
  console.log(`- Implementation: ${config.tokenFarmImpl}`);
  console.log(`- ProxyAdmin: ${config.proxyAdmin}`);

  return contractReferences;
});

// Export types for better TypeScript support
export type TokenFarmProxyModule = ReturnType<typeof buildModule>;

// Utility functions for interacting with the proxy
export const ProxyUtils = {
  /**
   * Command Pattern - Encapsulate upgrade operations
   */
  async upgradeProxy(
    proxyAdmin: any,
    proxyAddress: string,
    newImplementation: string
  ): Promise<void> {
    try {
      const tx = await proxyAdmin.upgradeProxy(proxyAddress, newImplementation);
      await tx.wait();
      console.log(`✅ Proxy upgraded successfully to: ${newImplementation}`);
    } catch (error) {
      console.error(`❌ Proxy upgrade failed:`, error);
      throw error;
    }
  },

  /**
   * Template Method Pattern - Upgrade with initialization
   */
  async upgradeProxyAndInitialize(
    proxyAdmin: any,
    proxyAddress: string,
    newImplementation: string
  ): Promise<void> {
    try {
      const tx = await proxyAdmin.upgradeProxyAndInitialize(
        proxyAddress,
        newImplementation
      );
      await tx.wait();
      console.log(
        `✅ Proxy upgraded and initialized successfully to: ${newImplementation}`
      );
    } catch (error) {
      console.error(`❌ Proxy upgrade with initialization failed:`, error);
      throw error;
    }
  },

  /**
   * Strategy Pattern - Get current implementation
   */
  async getCurrentImplementation(proxy: any): Promise<string> {
    try {
      // This would need to be called from an admin context
      const implementation = await proxy.implementation();
      return implementation;
    } catch (error) {
      console.error(`❌ Failed to get current implementation:`, error);
      throw error;
    }
  },
};
