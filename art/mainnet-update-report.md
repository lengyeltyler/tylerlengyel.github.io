# Phil001 `/art` Mainnet Update Report

Generated: 2026-06-11

## Status

PASS. The `/art/` frontend now defaults to the Phil001 Ethereum Mainnet dress rehearsal and reads the live Mainnet deployment in read-only mode before wallet connection.

No contracts were changed, deployed, bid into, settled, or mutated. No seller proceeds were withdrawn. No frontend changes were pushed.

## Files Changed

- `art/data/platform-mainnet.json`
- `art/art.js`
- `art/index.html`
- `art/README.md`
- `art/abi/PhilAuction.json`

`art/data/platform-sepolia.json` was preserved as the Sepolia backup.

## Mainnet Addresses

- Network: Ethereum Mainnet
- chainId: `1`
- PhilSVGStorage: `0x2f0F4C49151a87a04Fc0f21fb86304Bf5EA20348`
- PhilRegistry: `0xD9Da242257df2E9BD8df4271880877D1252E17D5`
- PhilEdition: `0x0aA5F46d7d0A507125C255F4f065c18058d497d2`
- PhilAuction: `0x042C8C3242Cb2301AC145F8351682F089BE40877`
- Token ID: `1`
- Seller proceeds recipient: `0xBEBAD7a7549E12113cbaf365A01355f9033f2129`

## Frontend Changes

- `/art/` now loads `art/data/platform-mainnet.json`.
- Read-only calls use Ethereum Mainnet chainId `1`.
- Read-only fallback RPC is `https://ethereum-rpc.publicnode.com`.
- Wallet switching requests `wallet_switchEthereumChain` with chainId `0x1`.
- Main view copy now uses Ethereum Mainnet dress rehearsal language.
- Mainnet warning is visible: "Phil001 is live on Ethereum Mainnet. Transactions use real ETH."
- Sepolia wording was removed from the active Mainnet route files.
- The settle button is hidden while the auction has not ended.
- The auction ABI was updated for the live `PhilAuctionShortTest` contract, including `minBidIncrementWei()`.

## Etherscan Links

- Storage: https://etherscan.io/address/0x2f0F4C49151a87a04Fc0f21fb86304Bf5EA20348#code
- Registry: https://etherscan.io/address/0xD9Da242257df2E9BD8df4271880877D1252E17D5#code
- Edition: https://etherscan.io/address/0x0aA5F46d7d0A507125C255F4f065c18058d497d2#code
- Auction: https://etherscan.io/address/0x042C8C3242Cb2301AC145F8351682F089BE40877#code
- Token: https://etherscan.io/nft/0x0aA5F46d7d0A507125C255F4f065c18058d497d2/1

## Local Validation

- `node --check art/art.js`: PASS
- `curl -I http://localhost:8080/art/`: `200 OK`
- `curl -I http://localhost:8080/art/art.js`: `200 OK`
- `curl -I http://localhost:8080/art/data/platform-mainnet.json`: `200 OK`

## Read-Only Mainnet Validation

Provider: `https://ethereum-rpc.publicnode.com`

- chainId: `1`
- registry edition count: `1`
- edition name: `Phil001`
- edition artist: `Tyler Lengyel`
- edition active: `true`
- token owner: `0xF783995f54f8afD1DB3219bc3aE1622A782F51A3`
- tokenURI decodes: PASS
- preview image PNG valid: PASS
- preview PNG size: `31557` bytes
- reserve: `100000000000000` wei (`0.0001 ETH`)
- minimum increment: `100000000000000` wei (`0.0001 ETH`)
- current bid: `200000000000000` wei (`0.0002 ETH`)
- current bid is at least `0.0002 ETH`: PASS
- current bidder: `0x43cdfEe77C8095B1590F7b43a8d420b26a73F1d3`
- current bidder matches validation leader: PASS
- hasStarted: `true`
- hasEnded: `false`
- settled: `false`
- time remaining at validation: `243864` seconds

## Browser Validation

Local browser route: `http://localhost:8080/art/`

- Mainnet badge visible: PASS
- Mainnet warning visible: PASS
- edition count visible as `1 registered edition`: PASS
- edition title visible as `Phil001`: PASS
- preview image data URI loaded: PASS
- auction status visible as `Active`: PASS
- reserve visible as `0.0001 ETH`: PASS
- current bid visible as `0.0002 ETH`: PASS
- current bidder visible as `0x43cd...F1d3`: PASS
- minimum increment visible as `0.0001 ETH`: PASS
- settle button hidden while active: PASS

## Manual Wallet Testing Checklist

- Open `https://tylerlengyel.com/art/` after the update is published.
- Confirm the badge says `Ethereum Mainnet`.
- Confirm the warning says transactions use real ETH.
- Click `Connect wallet`.
- If wallet is not on Ethereum Mainnet, click `Switch to Ethereum Mainnet`.
- Confirm MetaMask network is Ethereum Mainnet before approving any transaction.
- Confirm the default bid is `currentBid + 0.0001 ETH`.
- Confirm `Withdraw refund` is available for wallets with a refund balance.
- Confirm `Settle auction` is not shown while `hasEnded` is false.
- Do not test seller proceeds withdrawal until the auction is settled and the correct recipient wallet is connected.

## Ready To Commit/Push

Ready to commit after review. Ready to push after Tyler approves publishing the Mainnet route. Manual wallet connection testing should be done after publishing or against the local server with MetaMask, but no bid, settlement, or seller withdrawal is required for this frontend update.
