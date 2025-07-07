# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a Hardhat Ignition module that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
# Levantar la red local de Hardhat
npx hardhat node
# Desplegar el contrato en la red local
npx hardhat run scripts/deploy.ts --network localhost
# Test en red local
npx hardhat test test/TokenFarm.ts --network localhost
npx hardhat ignition deploy ./ignition/modules/TokenFarmUpgrade.ts --network localhost
npx hardhat run scripts/diagnostic-script.ts --network sepolia
```
