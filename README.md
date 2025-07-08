# 🧱 TokenFarm - Sistema de Staking DeFi con Arquitectura Avanzada

Este proyecto implementa un **sistema de staking de tokens** robusto y extensible usando **patrones de diseño avanzados** y **arquitectura upgradeable**. La implementación incluye múltiples estrategias de recompensa, gestión de estados, y un sistema de observadores para integración con otros protocolos DeFi.

---

## 🚀 Características Principales

### 🔧 Funcionalidades Core

- **Staking flexible**: Depósito y retiro de tokens LP con rewards en DAPP tokens
- **Sistema upgradeable**: Migración sin pérdida de estado usando Transparent Proxy
- **Múltiples estrategias**: Algoritmos de recompensa intercambiables
- **Gestión de estados**: Control granular del farm (Activo, Pausado, Emergencia)
- **Comisiones configurables**: Fees ajustables para claims y withdrawals

---

## ⚙️ Stack Tecnológico

- **Framework**: [Hardhat](https://hardhat.org/) + TypeScript
- **Contratos**: Solidity `^0.8.28` con OpenZeppelin
- **Testing**: Chai + Mocha + Hardhat Network Helpers
- **Deployment**: Hardhat Ignition modules
- **Upgrades**: OpenZeppelin Upgrades Plugin
- **Networks**: Ethereum, Sepolia, Hardhat Network

---

## 📦 Instalación y Configuración

```bash
# Clonar el repositorio
git clone https://github.com/tuusuario/tokenfarm-defi
cd tokenfarm-defi

# Instalar dependencias
npm install

# Compilar contratos
npx hardhat compile

# Ejecutar tests
npx hardhat test

# Verificar cobertura
npx hardhat coverage
```

### 🌐 Variables de Entorno

```env
# .env
PRIVATE_KEY=your_private_key_here
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_key
ETHERSCAN_API_KEY=your_etherscan_api_key
FEE_COLLECTOR_ADDRESS=your_cmc_api_key
```

---

## 🛠️ Scripts y Comandos

### 🚀 Despliegue

```bash
# Desplegar en Sepolia
npx hardhat run scripts/diagnostic-script.ts --network sepolia

# Verificar contratos
npx hardhat verify --network sepolia DEPLOYED_ADDRESS
```

## 🏗️ Arquitectura del Sistema

### 📁 Estructura del Proyecto

```bash

├── contracts/
│ ├── TokenFarm.sol # Contrato principal v1
│ ├── TokenFarmV2.sol # Versión actualizada
│ ├── MyProxyAdmin.sol # Administrador de proxy
│ ├── strategies/
│ │ ├── IRewardStrategy.sol # Interface de estrategias
│ │ ├── ProportionalStrategy.sol
│ │ └── BonusStrategy.sol
│ ├── observers
│ ├── tokens/
│ │ ├── DappToken.sol # Token de recompensa
│ │ └── LPToken.sol # Token LP para staking
│ └── interfaces/
├── ignition/
│ └── modules/
│ ├── DeployTokenFarm.ts
│ ├── DeployStrategies.ts
│ └── DeployObservers.ts
├── scripts/
│ ├── deploy/
│ ├── upgrade/
│ ├── management/
│ └── analytics/
├── test/
│ ├── unit/
│ ├── integration/
│ └── e2e/

```

## 🆕 TokenFarm V2 - Características Avanzadas

### 🎯 Nuevas Funcionalidades V2

TokenFarm V2 introduce un sistema de **comisiones dinámicas** y **recompensas por bloque**, implementando patrones de diseño avanzados para máxima eficiencia y flexibilidad.

#### 💰 Sistema de Comisiones

```solidity
// Configuración de comisiones
uint256 public constant MAX_WITHDRAW_FEE = 1000;    // 10% máximo
uint256 public constant MAX_CLAIM_FEE = 1000;       // 10% máximo
uint256 public constant BASIS_POINTS = 10000;       // 100% base

// Comisiones separadas por tipo de token
uint256 public collectedLpFees;    // Comisiones en LP tokens
uint256 public collectedDappFees;  // Comisiones en DAPP tokens
```

#### ⚡ Recompensas por Bloque

```solidity
// Sistema de recompensas continuas
uint256 public rewardPerBlock;

// Cálculo preciso manteniendo decimales
uint256 reward = (blocksPassed * rewardPerBlock * staker.balance) / totalStakingBalance;
```

### 🛡️ Seguridad Mejorada

#### ✅ Validaciones Exhaustivas

```solidity
// Custom errors para gas efficiency
error InvalidFeeValue();
error Unauthorized();
error InvalidAddress();
error FundsLocked();
error AlreadyInitialized();

// Validaciones de entrada
if (_withdrawFee > MAX_WITHDRAW_FEE) revert InvalidFeeValue();
if (_claimFee > MAX_CLAIM_FEE) revert InvalidFeeValue();
if (_feeCollector == address(0)) revert InvalidAddress();
```

#### 🔒 Protección de Upgrade

```solidity
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
    // Inicialización segura V2
}
```

### 📊 Métricas Avanzadas V2

```typescript
// Obtener información completa de comisiones
const feeInfo = await tokenFarmV2.getFeeInfo();
console.log({
  withdrawFee: feeInfo._withdrawFee,
  claimFee: feeInfo._claimFee,
  collectedLpFees: feeInfo._collectedLpFees,
  collectedDappFees: feeInfo._collectedDappFees,
  feeCollector: feeInfo._feeCollector,
});

// Configurar recompensas por bloque
await tokenFarmV2.setRewardPerBlock(ethers.utils.parseEther("0.1"));
```

### 🚀 Uso de TokenFarm V2

#### 💼 Gestión de Comisiones

```typescript
// Actualizar comisiones (solo owner)
await tokenFarmV2.updateFees(
  500, // 5% withdraw fee
  200 // 2% claim fee
);

// Cambiar colector de comisiones
await tokenFarmV2.updateFeeCollector(newCollectorAddress);

// Retirar comisiones acumuladas
await tokenFarmV2.withdrawFees(); // DAPP tokens
await tokenFarmV2.withdrawLpFees(); // LP tokens
```

#### ⚡ Configuración de Recompensas

```typescript
// Configurar recompensas por bloque
await tokenFarmV2.setRewardPerBlock(ethers.utils.parseEther("0.1"));

// Actualizar período de bloqueo
await tokenFarmV2.setLockPeriod(7 * 24 * 60 * 60); // 7 días
```

#### 📈 Monitoreo Avanzado

```typescript
// Obtener versión del contrato
const version = await tokenFarmV2.getVersion(); // "2.0.0"

// Monitorear comisiones en tiempo real
const feeData = await tokenFarmV2.getFeeInfo();
console.log(`LP Fees: ${feeData._collectedLpFees}`);
console.log(`DAPP Fees: ${feeData._collectedDappFees}`);
```

### 📋 Eventos V2

```solidity
// Eventos específicos de V2
event RewardsClaimedV2(address indexed user, uint256 amount, uint256 fee);
event FeesWithdrawnV2(uint256 amount, address indexed collector);
event LpFeesWithdrawn(uint256 amount, address indexed collector);
event FeesUpdated(uint256 newWithdrawFee, uint256 newClaimFee);
event FeeCollectorUpdated(address newCollector);
event RewardPerBlockUpdated(uint256 newReward);
```

### 🔄 Compatibilidad con V1

TokenFarm V2 mantiene **total compatibilidad** con V1 mientras añade nuevas funcionalidades:

- ✅ Todas las funciones V1 siguen funcionando
- ✅ Storage layout preservado
- ✅ Migración automática sin pérdida de datos
- ✅ Nuevas funciones disponibles inmediatamente

---

## 🌐 Direcciones de Contratos

### Sepolia Testnet

| Contrato            | Dirección                                    | Verificado |
| ------------------- | -------------------------------------------- | ---------- |
| **TokenFarm Proxy** | `0xFa011DA5464EA100DC...`                    | ✅         |
| **TokenFarm V2**    | `0x742d35Cc6634C0532925a3b8D29287fEa4E8BFF9` | ✅         |
| **ProxyAdmin**      | `0x8b5f3b4d2E8c9A7B1234567890abcdef12345678` | ✅         |
| **DappToken**       | `0x1234567890abcdef1234567890abcdef12345678` | ✅         |
| **LPToken**         | `0xabcdef1234567890abcdef1234567890abcdef12` | ✅         |

---

## 🔧 Uso del Sistema

### 💰 Staking Básico

```typescript
// Conectar con el contrato
const tokenFarm = await ethers.getContractAt("TokenFarm", PROXY_ADDRESS);

// Aprobar tokens LP
await lpToken.approve(tokenFarm.address, amount);

// Stake tokens
await tokenFarm.stakeTokens(amount);

// Consultar balance
const balance = await tokenFarm.stakingBalance(userAddress);

// Claim rewards
await tokenFarm.claimRewards();

// Unstake
await tokenFarm.unstakeTokens(amount);
```

### 🔄 Gestión de Estrategias

```typescript
// Cambiar estrategia de recompensas
await tokenFarm.setRewardStrategy(newStrategyAddress);

// Consultar estrategia actual
const currentStrategy = await tokenFarm.rewardStrategy();

// Configurar parámetros de estrategia
await strategy.setParameter("bonusMultiplier", newValue);
```

## 🧪 Testing

### 📋 Suites de Pruebas

```bash
# Tests unitarios
npx hardhat test test/unit/

# Tests de integración
npx hardhat test test/integration/

# Tests end-to-end
npx hardhat test test/e2e/

# Test específico
npx hardhat test test/unit/TokenFarm.test.ts
```

### 📊 Cobertura de Código

```bash
# Generar reporte de cobertura
npx hardhat coverage

# Ver reporte en navegador
open coverage/index.html
```

### 🔍 Análisis de Gas

```bash
# Análisis detallado de gas
REPORT_GAS=true npx hardhat test

# Comparar versiones
npx hardhat run scripts/gas-comparison.ts
```

---

## 🔄 Arquitectura de Upgrades

### 🏗️ Patrón Proxy Transparente

El sistema utiliza el **Transparent Proxy Pattern** de OpenZeppelin para upgrades seguros:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User/DApp     │───▶│  Proxy Contract │───▶│ Implementation  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │                        │
                               │                   ┌─────────────────┐
                               └──────────────────▶│ TokenFarm V2    │
                                                  └─────────────────┘
```

### 🔐 Storage Layout Seguro

```solidity
// V1 Storage (NUNCA cambiar el orden)
mapping(address => Staker) public stakersData;
address[] public stakers;
uint256 public totalStakingBalance;
// ... más variables V1

// V2 Storage (SIEMPRE al final)
uint256 public withdrawFee;
uint256 public claimFee;
address public feeCollector;
uint256 public collectedLpFees;
uint256 public collectedDappFees;
uint256 public rewardPerBlock;
```

### 🛡️ Principios de Seguridad

1. **Storage Gap**: Reserva espacio para futuras variables
2. **Inicialización**: Uso de `reinitializer` para versiones
3. **Validación**: Verificación exhaustiva de parámetros
4. **Rollback**: Posibilidad de revertir upgrades

### 📝 Proceso de Upgrade

```typescript
// 1. Desplegar nueva implementación
const TokenFarmV2 = await ethers.getContractFactory("TokenFarmV2");
const newImplementation = await TokenFarmV2.deploy();

// 2. Upgrade a través del ProxyAdmin
await proxyAdmin.upgradeAndCall(
  proxyAddress,
  newImplementation.address,
  initializeV2CallData
);

// 3. Verificar upgrade exitoso
const version = await proxy.getVersion();
console.log(`Upgraded to version: ${version}`);
```

---

## 🧪 Testing Avanzado

### 🔬 Estrategia de Testing

```typescript
// Test de compatibilidad V1 -> V2
describe("TokenFarm V2 Upgrade", () => {
  it("should maintain V1 functionality after upgrade", async () => {
    // Configurar estado V1
    await tokenFarmV1.deposit(depositAmount);

    // Upgrade to V2
    await upgradeToV2();

    // Verificar que V1 functions siguen funcionando
    const balance = await tokenFarmV2.getStakingBalance(user.address);
    expect(balance).to.equal(depositAmount);
  });

  it("should handle V2 fee system correctly", async () => {
    await tokenFarmV2.updateFees(500, 200); // 5% withdraw, 2% claim

    const claimAmount = ethers.utils.parseEther("100");
    await tokenFarmV2.claimRewards();

    const feeCollected = await tokenFarmV2.collectedDappFees();
    expect(feeCollected).to.equal(claimAmount.mul(200).div(10000));
  });
});
```

### 📊 Test Coverage V2

```bash
# Tests específicos V2
npx hardhat test test/v2/TokenFarmV2.test.ts
npx hardhat test test/v2/UpgradeTest.test.ts
npx hardhat test test/v2/FeeSystem.test.ts

# Coverage específico
npx hardhat coverage --testfiles "test/v2/**/*.ts"
```

---

## 💻 Mejores Prácticas de Desarrollo

### 🚀 Optimización de Gas

```solidity
// ✅ Uso de Custom Errors (más eficiente en gas)
error InvalidFeeValue();
error Unauthorized();

// ✅ Packed structs para optimizar storage
struct Staker {
    uint128 balance;        // 16 bytes
    uint128 pendingRewards; // 16 bytes
    uint64 depositTimestamp; // 8 bytes
    uint64 checkpoint;      // 8 bytes
    bool isStaking;         // 1 byte
    bool hasStaked;         // 1 byte
    // Total: 50 bytes = 2 storage slots
}

// ✅ Batch operations para reducir gas
function batchClaim(address[] calldata users) external onlyOwner {
    for (uint256 i = 0; i < users.length; i++) {
        _updateUserRewards(users[i]);
    }
}
```

### 🔒 Patrones de Seguridad

```solidity
// ✅ Checks-Effects-Interactions Pattern
function withdraw() public override onlyStaker {
    // 1. Checks
    Staker storage staker = stakersData[msg.sender];
    require(staker.balance > 0, "No balance");

    // 2. Effects
    uint256 amount = staker.balance;
    staker.balance = 0;
    totalStakingBalance -= amount;

    // 3. Interactions
    require(lpToken.transfer(msg.sender, amount), "Transfer failed");
}

// ✅ Reentrancy Protection
function claimRewards() public override whenActive nonReentrant {
    // Función protegida contra reentrancy
}
```

### 🧪 Testing Strategies

```typescript
// ✅ Test de invariantes
describe("Invariant Tests", () => {
  it("total staking balance should equal sum of individual balances", async () => {
    const totalFromContract = await tokenFarm.totalStakingBalance();
    let calculatedTotal = BigNumber.from(0);

    for (const staker of stakers) {
      const balance = await tokenFarm.getStakingBalance(staker.address);
      calculatedTotal = calculatedTotal.add(balance);
    }

    expect(totalFromContract).to.equal(calculatedTotal);
  });
});

// ✅ Property-based testing
describe("Property Tests", () => {
  it("fees should never exceed maximum allowed", async () => {
    const maxFee = await tokenFarm.MAX_WITHDRAW_FEE();

    // Test con valores aleatorios
    for (let i = 0; i < 100; i++) {
      const randomFee = Math.floor(Math.random() * 2000); // 0-20%

      if (randomFee <= maxFee) {
        await expect(tokenFarm.updateFees(randomFee, 0)).to.not.be.reverted;
      } else {
        await expect(tokenFarm.updateFees(randomFee, 0)).to.be.revertedWith(
          "InvalidFeeValue"
        );
      }
    }
  });
});
```

### 🔄 Upgrade Patterns

```solidity
// ✅ Patrón de Storage Gap
contract TokenFarmV2 {
    // Variables V2
    uint256 public withdrawFee;
    uint256 public claimFee;

    // Reservar espacio para futuras versiones
    uint256[48] private __gap;
}

// ✅ Versioning Pattern
function getVersion() public pure virtual returns (string memory) {
    return "2.0.0";
}

// ✅ Backward Compatibility
function deposit(uint256 amount) public override {
    _updateUserRewards(msg.sender); // V2 functionality
    super.deposit(amount);           // V1 functionality
}
```

---

## 🔐 Seguridad y Auditoría

### 🛡️ Características de Seguridad

- **Reentrancy Protection**: Uso de `ReentrancyGuard` en funciones críticas
- **Access Control**: Roles granulares con OpenZeppelin
- **Input Validation**: Validaciones exhaustivas en todos los endpoints
- **Emergency Controls**: Pausa y modo emergencia para situaciones críticas
- **Overflow Protection**: Uso de SafeMath y Solidity 0.8+

### 📋 Checklist de Seguridad

- [x] Protección contra reentrancy
- [x] Validación de inputs
- [x] Control de acceso
- [x] Manejo de errores
- [x] Tests de seguridad
- [x] Análisis estático
- [x] Revisión de código
- [ ] Auditoría externa (planificada)

### 🔍 Herramientas de Análisis

```bash
# Análisis estático con Slither
pip install slither-analyzer
slither contracts/

# Verificación formal (opcional)
npm install --save-dev @openzeppelin/test-helpers
```

---

## 📈 Métricas y Analytics

### 📊 KPIs del Sistema

- **TVL (Total Value Locked)**: Valor total en staking
- **APY**: Rendimiento anual para stakers
- **Active Stakers**: Usuarios activos en el farm
- **Reward Distribution**: Distribución de recompensas
- **Gas Efficiency**: Optimización de costos

### 📈 Dashboard de Métricas

```typescript
// Script para métricas en tiempo real
const metrics = {
  totalStaked: await tokenFarm.totalStaked(),
  activeStakers: await tokenFarm.getActiveStakersCount(),
  rewardRate: await tokenFarm.rewardRate(),
  apy: await calculateAPY(),
  tvl: await calculateTVL(),
};
```

---

## 🚀 Roadmap

### 🎯 Versión 2.0 (Actual)

- [x] Sistema upgradeable
- [x] Múltiples estrategias
- [x] Observer pattern
- [x] Emergency controls

### 🔮 Versión 3.0 (Planificada)

- [ ] Multi-token staking
- [ ] Yield farming automático
- [ ] Integración con protocolo de lending
- [ ] Governance token

### 🌟 Versión 4.0 (Futuro)

- [ ] Cross-chain staking
- [ ] AI-powered strategies
- [ ] NFT rewards
- [ ] Mobile app integration

---

## 🤝 Contribución

### 📝 Guías de Contribución

1. **Fork** el repositorio
2. **Crea** una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. **Commit** tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. **Push** a la rama (`git push origin feature/AmazingFeature`)
5. **Abre** un Pull Request

### 🔧 Desarrollo Local

```bash
# Configurar hooks de pre-commit
npm install husky --save-dev
npx husky install

# Ejecutar linter
npm run lint

# Formatear código
npm run format

# Ejecutar tests antes de commit
npm run test:pre-commit
```

### 🔧 Desarrollo Sepolia

```bash
# Ejecutar deploy
npx hardhat run scripts/deploy.ts --network sepolia

# Ejecutar script
npx hardhat run scripts/diagnostic-script.ts --network sepolia
```

---

## 📚 Recursos Adicionales

### 📖 Documentación

- [Guía de Arquitectura](./docs/architecture.md)
- [Manual de Upgrade](./docs/upgrade-guide.md)
- [API Reference](./docs/api-reference.md)
- [Troubleshooting](./docs/troubleshooting.md)

### 🔗 Enlaces Útiles

- [OpenZeppelin Upgrades](https://docs.openzeppelin.com/upgrades-plugins/1.x/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html)
- [DeFi Security Best Practices](https://consensys.github.io/smart-contract-best-practices/)

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

---

## 🙏 Agradecimientos

- OpenZeppelin por las librerías de seguridad
- Hardhat team por el framework de desarrollo
- Comunidad DeFi por la inspiración y feedback
- Contribuidores que han hecho posible este proyecto

---

## 💬 Contacto

- **Email**: mauricioraulferreyra0@gmail.com

---

**¿Encontraste un bug?** [Reporta un issue](https://github.com/tuusuario/tokenfarm-defi/issues)

**¿Tienes una idea?** [Comparte tu propuesta](https://github.com/tuusuario/tokenfarm-defi/discussions)

---

_Construido con ❤️ para la comunidad DeFi_

---
