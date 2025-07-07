export default {
  proxyAddress: "0x...", // Dirección de tu proxy existente
  // feeCollector: "0x...", // Dirección que recibirá las comisiones
  feeCollector: process.env.FEE_COLLECTOR_ADDRESS,
  performanceFee: 1000, // 10% en basis points
  withdrawFee: 500, // 5%
  claimFee: 300, // 3%
};
