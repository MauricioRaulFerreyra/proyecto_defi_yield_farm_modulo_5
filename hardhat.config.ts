import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ignition";
import "@openzeppelin/hardhat-upgrades";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true, // Habilita el optimizador IR para mejor manejo de upgrades
    },
  },
  networks: {
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      accounts: [process.env.SEPOLIA_PRIVATE_KEY!],
      gasPrice: "auto", // Mejor manejo de fluctuaciones de gas
    },
    hardhat: {
      chainId: 1337,
      allowUnlimitedContractSize: false, // Importante para upgrades
    },
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY!,
    },
  },
  ignition: {
    strategyConfig: {
      create2: {
        salt: process.env.IGNITION_SALT || "0x1234", // Salt para deployments deterministas
      },
    },
    requiredConfirmations: 2, // Confirmaciones para transacciones importantes
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    ignition: "./ignition",
  },
};

export default config;
