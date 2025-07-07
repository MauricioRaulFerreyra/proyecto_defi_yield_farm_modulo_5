// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract MyProxyAdmin is ProxyAdmin {
    constructor(address initialOwner) ProxyAdmin(initialOwner) {}

    function upgradeProxy(address proxy, address implementation) external onlyOwner {
        upgradeAndCall(
            ITransparentUpgradeableProxy(proxy),
            implementation,
            bytes("")
        );
    }

    function upgradeProxyAndInitialize(address proxy, address implementation) external onlyOwner {
        bytes memory data = abi.encodeWithSignature("initializeV2()");
        upgradeAndCall(
            ITransparentUpgradeableProxy(proxy),
            implementation,
            data
        );
    }
}
