# Phil `/art` Frontend

Static GitHub Pages route for the Sepolia Phil platform.

## Run Locally

From the repository root:

```bash
python3 -m http.server 8080
```

Open:

```text
http://localhost:8080/art/
```

## Test Wallet Connection

1. Install or open MetaMask.
2. Connect a Sepolia wallet.
3. Use the `Connect wallet` button.
4. If the wallet is not on Sepolia, use `Switch to Sepolia`.

No private keys are stored or loaded by the frontend.

## Test Sepolia Reads

- Confirm the gallery loads one registry edition.
- Confirm preview image renders.
- Confirm owner, reserve, current bid, countdown, and seller proceeds fields populate.
- Click `Load Full On-Chain SVG`.

## Test Bidding

- Before submitting, confirm the bid amount is correct.
- If auction has not started, default bid is `0.0369`.
- If auction has started, default bid is `currentBid + 0.0369`.
- MetaMask should show the transaction request. Rejecting it should display an error in Activity.

## Deploy To GitHub Pages

Commit the `/art` files and push to the GitHub Pages branch for `lengyeltyler/tylerlengyel.github.io`.
