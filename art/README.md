# Phil `/art` Frontend

Static GitHub Pages route for the Phil001 Ethereum Mainnet dress rehearsal.

Live route:

```text
https://tylerlengyel.com/art/
```

## Run Locally

From the repository root:

```bash
python3 -m http.server 8080
```

Open:

```text
http://localhost:8080/art/
```

## Connect Wallet

1. Install or open MetaMask.
2. Connect the wallet you intend to use on Ethereum Mainnet.
3. Use the `Connect wallet` button.
4. If the wallet is not on Ethereum Mainnet, use `Switch to Ethereum Mainnet`.

No private keys are stored or loaded by the frontend.

## Mainnet Reads

- Confirm the gallery loads one registry edition.
- Confirm preview image renders.
- Confirm owner, reserve, current bid, countdown, and seller proceeds fields populate.
- Click `Load Full On-Chain SVG`.

## Bid

- Before submitting, confirm the bid amount is correct.
- If the auction has not started, the default bid is the `0.0001 ETH` reserve.
- If the auction has started, the default bid is `currentBid + 0.0001 ETH`.
- MetaMask should show the transaction request. Rejecting it should display an error in Activity.

Warning: this route uses Ethereum Mainnet. Bids, refunds, settlement, and seller withdrawals use real ETH.

## Phil001 Mainnet Contracts

- PhilSVGStorage: `0x2f0F4C49151a87a04Fc0f21fb86304Bf5EA20348`
- PhilRegistry: `0xD9Da242257df2E9BD8df4271880877D1252E17D5`
- PhilEdition: `0x0aA5F46d7d0A507125C255F4f065c18058d497d2`
- PhilAuction: `0x042C8C3242Cb2301AC145F8351682F089BE40877`
- Token ID: `1`

## Deploy To GitHub Pages

Commit the `/art` files and push to the GitHub Pages branch for `lengyeltyler/tylerlengyel.github.io`.
