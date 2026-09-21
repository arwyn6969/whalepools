# Whale Pools

Build a company of NFT whale traders. Pick your whales, inspect their fixed DNA and explore historical paper results.

**[Play the demo](https://arwyn.party/whalepools/)** · **[Arcade rules](apps/rare-whales/ARCADE.md)** · **[Technical guide](apps/rare-whales/README.md)**

This is a free historical arcade with wallet login and server-verified company scores. Own one NFT from either collection to publish a crew; anyone can try the sandbox. Scores use inspected historical data and do not prove trading skill. There are no payments, token rewards, staking, deposits or live orders. WWAX is deferred and undeployed.

## Run locally

Node.js 22.5+ is required.

```sh
cd apps/rare-whales
npm ci
npm test
npm run build:demo
npm run dev
```

Open http://127.0.0.1:48372/. `npm run deploy:check` validates the Cloudflare Worker; authenticated maintainers can use `npm run deploy`. The main demo stays at /whalepools/; /whalepool/ redirects there. Routes are limited to those two exact prefixes.

## What is here

- Mixed Rare Whales + WhaleStreet rosters with one shared simulated budget.
- Individual agent and company scoreboards, historical curve inspection and transparent trade data.
- Wallet signatures, NFT ownership checks, editable public companies and a historical leaderboard.
- A separate D1 database for arcade entries; no player private keys or transaction signing.
- Immutable engine modules and public UBTC/USDC historical candles for reproduction. Historical results do not establish a profitable edge.

This is a scoped export from the Vector Desk research project. No private journals, wallet sessions, databases, credentials or unrelated application files are included. Artwork and font retain their existing ownership/licensing; see the app guide and bundled font license.
