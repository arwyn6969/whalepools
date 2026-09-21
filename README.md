# Whale Pools

Build a company of NFT whale traders. Pick your whales, inspect their fixed DNA and explore historical paper results.

**[Play the demo](https://arwyn.party/whalepools/)** · **[Whale Wax concept review](apps/rare-whales/ECONOMY.md)** · **[Technical guide](apps/rare-whales/README.md)**

This is a playable demo, not a live investment product. No token, NFT staking, claim fees, deposits, live orders or wallet registration are enabled. The Wax Lab previews proposed equipment. Fixed-supply WWAX contracts and a local wallet launch desk are prepared; see [claim launch guide](apps/rare-whales/CLAIMS.md). On-chain deployment is still pending.

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
- A visual equipment workshop and a clearly labelled future roadmap.
- Immutable engine modules and public UBTC/USDC historical candles for reproduction. Historical results do not establish a profitable edge.

This is a scoped export from the Vector Desk research project. No private journals, wallet sessions, databases, credentials or unrelated application files are included. Artwork and font retain their existing ownership/licensing; see the app guide and bundled font license.
