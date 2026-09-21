# Whale Pools — Rare Whales trading companies

RW-009, 21 September 2026. A **public paper-trading demo**: the wallet is the owner, a pool is its company, and the NFTs it owns are its trading agents. This supersedes RW-001's one-agent desk model while retaining the same access routes. No token, live trader, company season or pooled deposits have launched.

**Free arcade launch:** wallet sign-in, fresh NFT ownership checks, server-calculated historical scores, editable public company entries and withdrawal are implemented. The public game requires one Rare Whales or WhaleStreet NFT to publish; anyone can use the sandbox. The original founding-season membership rules are preserved separately. Wax and payments are deferred; prepared contracts remain undeployed. See [ARCADE.md](ARCADE.md) for current rules, data, transfer policy and operations.

## Run

From `apps/rare-whales`, with Node 22.5+:

```sh
npm ci
npm test
npm run build:demo
npm run dev
```

Open `http://127.0.0.1:48372/`. The server binds only to loopback. `RW_PORT` changes the port. Rebuild/restart after server or season edits; reload after static edits. The default preview uses the same wallet/arcade handler as production, backed by a separate local work/arcade.sqlite file. Set `RW_LOCAL_AUTH=1` only to test the archived local founding-membership prototype; its state is in ignored `work/club.sqlite`. Never commit/export user sessions or member records into test fixtures. Sandbox rosters are stored in browser localStorage under `whale-pools-sandbox-v1`; these are unverified preview choices, not registered companies.

## Owner → company → agents

One qualifying wallet controls one pool per season, with up to 12 NFT agents. The pool starts with **$1,000 total**, split equally across its active roster. Owners can add/remove agents and assign Current Surfer, Reef Reclaimer, Cannonball Breakout or Vector Magnet to each. Each NFT has a fixed DNA profile. Adding agents divides the same capital; it does not multiply the starting balance. An empty sandbox stays in paper cash. Publishing an arcade score requires at least one owned NFT.

Historical practice works without a wallet. The initial example roster is Rare Whales #245, #246, WhaleStreet #1 and Rare Whales #248, one on each tactic in display order. Existing saved browser rosters are retained. These are real collection illustrations, not claimed user holdings or invented registered participants. Other valid collection/token combinations can be previewed; their existence and ownership are not asserted. Five example portraits are bundled. Other NFTs resolve their current on-chain tokenURI and IPFS image through gateway.pinata.cloud, with at most three metadata requests in progress, a bounded session cache, timeouts and a Retry portraits control. Failures show an explicit unavailable portrait; neither a picture nor adding an ID verifies ownership. The gateway is an external availability dependency; no paid indexer is required. Use your own token numbers before attempting registration.

The company chart sums simultaneous agent equity. Its default-stats comparison uses identical NFTs, tactics, capital split and costs, with neutral modifiers. The agent view inspects one trader. Both show every completed trade and preserve losses. Roster/tactic changes replay the entire inspected historical period; these are not actions in a running season. Agents share one market, so their trades can be highly correlated; aggregate trade counts are not independent research observations.

## Fixed DNA: `whale-dna-v1`

The seed is exactly:

```text
whale-dna-v1:4663:<lower-case configured collection address>:<canonical decimal token ID>
```

SHA-256 bytes 0, 1 and 2 modulo 3 select these values:

| Stat | Low / neutral / high | Effect |
| --- | --- | --- |
| Nerve | 0.225% / 0.25% / 0.275% | Risk budget per trade, relative to the agent's equity |
| Reach | 0.95 / 1 / 1.05 | Multiplies the original signal-entry-to-target distance |
| Cargo | 22.5% / 25% / 27.5% | Maximum position allocation of the agent's equity |

There are 27 possible builds; multiple NFTs can share one. Nerve labels are Anchor, Cruiser and Cannonball. The full hash is retained in stored profiles. A known vector independently checked with Python hashlib is Rare Whales #245 → `4771ada311ddf4d9880fb2543d1ac3d9562c2c754e497def7bdc6d71d99f12db`.

Wallet, ownership, nickname, rarity, price, metadata traits and time do not affect DNA. There is no reroll endpoint or rarity performance bonus. These are deliberately arbitrary, bounded gameplay variations, not price predictors or a claim of superior returns. A new mapping needs a new modifier/season version. Profiles can help or hurt.

## Access and ownership

A wallet qualifies through an approved Rare Whales promotional 1/1 selected as its company captain; the configured founder wallet; or 10+ NFTs **combined across Rare Whales and WhaleStreet in the same wallet**. A non-founder must own its captain and all its agents. Choose the approved 1/1 as captain when using that route.

The local membership prototype (not enabled on the public demo) uses expiring single-use SIWE challenges, public-client signature verification, opaque HttpOnly sessions, origin checks and bounded inputs/rates. Saving a company freshly verifies its captain, access route and every agent at the same Robinhood block (two blocks behind head). The server derives all DNA itself and ignores submitted modifiers. One NFT cannot belong to two registered pools in the same season, even after transfer. Company and roster writes are one transaction; collisions preserve the prior company. Withdrawal cascades to its agents. Rule digests and the registration cutoff lock season choices.

The public pool directory includes the company name, NFTs, tactics, access route and persisted DNA. It omits the owner address directly, although an NFT can identify its wallet. Publication requires explicit form consent. Private profile/session fields are not projected. Only real registered companies appear; there are no fake competitors or live standings.

This is a wallet limit, not proof of one person. Current membership is checked on save, not continuously revoked after transfers. A final snapshot/transfer/person-level policy is still needed before any consequential season. There are no prizes or financial entitlements. Authentication currently uses injected EIP-1193 extensions; WalletConnect/mobile deep links and real smart-contract-wallet integration remain untested.

## Version and research boundaries

`season.json` is now `rare-whales-founding-v3`, with tactic version, modifier version and pool rules included in the policy digest. `season-v1.json` and `season-v2.json` preserve the earlier drafts; existing rows are not rewritten. The local database applies `0001_club.sql` and the additive `0002_pool_agents.sql`; a future D1 deployment must apply both, to its own database.

Registration remains closed: `status: draft`, `access.confirmed: false`, empty promotional IDs/founder list and null dates. The owner must supply the approved 1/1 IDs and public wallet. No private keys are needed.

The frozen engine is imported unchanged. Build verifies its original three module hashes and both UBTC dataset hashes. Baseline and neutral replays reproduce every original fill and equity point. The original no-entry-volume-filter controls remain in generated historical data; the company chart instead compares the same roster with and without DNA. DNA is recorded as RC-004; the two additional signal arms are RC-005 / `whale-tactics-v1`. See [TACTICS.md](TACTICS.md) for their complete specification. No new forward window has been started, and no original hypothesis, recorded data, protocol or verdict changes.

Data: inspected UBTC/USDC Hyperliquid spot candles, 1h with 4h signal context, **24 July 2026 10:00 UTC–19 September 2026 22:00 UTC exclusive**, including prior warmup. Fees 0.08% and slippage 0.05% each side. The original two strategies retain their signals and stops. Two new arms define their own signals and stops in a separate module; next-bar checks, conservative ambiguous exits, cash-limited spot sizing and timeouts remain unchanged. Reach changes targets before those execution checks, so it can change later trade paths. The 25%-invested/75%-cash holding comparison includes entry and estimated exit costs and is descriptive only. Gaps can exceed planned loss. No mapping was chosen by optimizing these historical outcomes.

## Hosting and next milestone

The demo targets [arwyn.party/whalepools](https://arwyn.party/whalepools/) through the separate `whale-pools-demo` Worker with main routes `/whalepools` and `/whalepools/*`, plus aliases `/whalepool` and `/whalepool/*` which redirect to the plural form, preserving query and path. It has no bindings, secrets, database, authentication or server transaction endpoints. Once a verified deployment is configured, the browser reads Robinhood RPC and requests claims directly through the holder’s wallet; current configuration has no deployment. Sixteen explicitly allowed static files are embedded as gzip data in its small bundle. No existing owner API, DB, schedule or paid service is changed.

`npm run build:demo` generates `build/cloudflare-worker.mjs`; `npm run deploy:check` validates the Wrangler candidate and `npm run deploy` publishes it using an authenticated Cloudflare CLI. The initial deployment can also use the Cloudflare API plugin with the same ES module and metadata. `wrangler.jsonc` is the reproducible deployment configuration. The original authenticated prototype remains in `src/worker.mjs` and is not imported into the demo bundle.

Before a season opens: finalize identities and snapshot behavior; implement a prospective market recorder, incremental paper execution, missing-data status and dated pool outcomes; freeze a separate specification and genuinely future dates; and test real wallet sign-in plus hosted D1 on a separate candidate. The current app has **no running season or automated live trader**. Editing the season status does not create those missing records. It supports historical exploration only.

## Art, font and references

- Rare Whales ERC721: `0xcafa6d08ac4ed305c15f8d41d155499118c5f605`. [Collection](https://opensea.io/collection/rarewhales).
- WhaleStreet ERC721: `0x01f33271d74a9dcc91798c7232d3d788da93a1f6`. [Collection](https://opensea.io/collection/whalestreet).
- Real item media for [#245](https://opensea.io/item/robinhood/0xcafa6d08ac4ed305c15f8d41d155499118c5f605/245), [#246](https://opensea.io/item/robinhood/0xcafa6d08ac4ed305c15f8d41d155499118c5f605/246), [#247](https://opensea.io/item/robinhood/0xcafa6d08ac4ed305c15f8d41d155499118c5f605/247) and [#248](https://opensea.io/item/robinhood/0xcafa6d08ac4ed305c15f8d41d155499118c5f605/248), verified on OpenSea 21 September 2026 and stored locally as AVIF. `public/art/sources.json` records their additional CDN sources. Public tokenURI reads confirmed those IDs; IPFS gateways returned 429, so no trait metadata was used to assign stats.
- WhaleStreet [#1](https://opensea.io/item/robinhood/0x01f33271d74a9dcc91798c7232d3d788da93a1f6/1) was independently verified on OpenSea and by a public tokenURI read on 21 September. Its AVIF image is bundled locally for the cover and roster, avoiding a runtime CDN dependency. Source and tokenURI are recorded in `public/art/sources.json`; traits have no performance bonus.
- Press Start 2P from the official [Google Fonts repository](https://github.com/google/fonts/tree/main/ofl/pressstart2p), self-hosted with its SIL OFL at `public/art/OFL.txt`. Platform-game-inspired CSS scenery; no Nintendo assets. Reduced-motion preference disables character bobbing.
- Robinhood RPC `https://rpc.mainnet.chain.robinhood.com`, chain 4663, previously verified read-only for both collection contracts.
- [EIP-4361](https://eips.ethereum.org/EIPS/eip-4361), [Viem public-client verification](https://viem.sh/docs/actions/public/verifyMessage), [D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/).

The original private research repository retains the dated RW-001/RW-002 research evidence; the public export contains only this companion, immutable engine modules and the two public historical UBTC fixtures needed to reproduce it.

## Interaction and roadmap

Select a PFP or the scoreboard selector to view an agent; choose Whole company to restore aggregated results. Net P/L, completed trades, win rate and drawdown use the existing replay outputs. Expanded stats describe average/best/worst trade, profit factor and skipped entries. The time slider reads the historical curve; turning off the holding comparison changes chart scale only. Reduced-motion preferences disable decorative animation.

The Tactic Arcade compares all four tactics for the selected whale, using the same DNA, capital share and historical dates. Assign a card to update that agent. It shows net return, drawdown, count and the return difference versus neutral DNA. It neither chooses a winner automatically nor changes the NFT hash. Leverage and a prospective trading passport remain proposals, explained in the interface.

The Wax Lab uses original SVG pixel illustrations for a 90s-inspired Whale Wax surf tub, upright surfboard, neon-green Holy Brick of Kek and gemmed crown. Rebuild the art with `node scripts/draw-wax-art.mjs`. These are original game illustrations, not copied surf-wax packaging.

RW-009 removes the Wax Lab from the public game. Its earlier fit check was an ephemeral visual preview of Surfboard, Holy Brick of Kek and Captain’s Drip. None is purchasable or minted. A historical arcade leaderboard is available; prospective season and ENS displays remain planned. Public owners are verified wallet addresses, never guessed ENS names. See [ECONOMY.md](ECONOMY.md) for the staking review, weak spots, build order and effort estimates.
