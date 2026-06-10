# Frontend Wallet Debug Report

## Issue
The `/art` page read-only contract calls worked, but `Connect wallet` could appear inert when multiple wallet extensions injected providers. Console noise included:

- `Cannot redefine property: ethereum`
- `ObjectMultiplex orphaned data`
- MetaMask/Phantom content script warnings

## Changes Made
- Added EIP-6963 provider discovery.
- Added injected provider list handling via `window.ethereum.providers`.
- Prefer MetaMask provider when available.
- Fall back to a single injected `window.ethereum` provider.
- Stop assuming `window.ethereum` is MetaMask.
- Use the selected provider for `ethers.BrowserProvider`.
- Use the selected provider for `eth_requestAccounts`, `eth_accounts`, `wallet_switchEthereumChain`, and `wallet_addEthereumChain`.
- Added Sepolia add-chain fallback with:
  - `chainId: 0xaa36a7`
  - `chainName: Sepolia`
  - `nativeCurrency: ETH`
  - `rpcUrls: https://ethereum-sepolia-rpc.publicnode.com`
  - `blockExplorerUrls: https://sepolia.etherscan.io`
- Added visible Activity log entries for:
  - connect button click
  - provider found/missing
  - account request start
  - account request rejection
  - account connected
  - wrong network detected
  - provider debug state

## Provider Debug Output
The Activity log now reports:

- provider type
- selected provider label
- chainId
- account

## Validation
- `node --check art/art.js`: PASS
- `python3 -m http.server 8080`: started successfully
- `curl -I http://localhost:8080/art/`: `200 OK`
- Local server was stopped after validation.

## Notes
- Read-only public RPC flow is unchanged.
- MetaMask transaction flow still requires manual browser testing because wallet prompts cannot be completed from this terminal session.
- Existing contract addresses were not changed.
