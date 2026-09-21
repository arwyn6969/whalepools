# Whale Pools · free historical arcade

RW-009 launches a free game at **https://arwyn.party/whalepools/** (singular `/whalepool/` redirects). Wax, payments and token deployment are deferred. This is wallet-authenticated play with server-calculated historical rankings, not on-chain execution or a live paper season.

## Play and publish

1. Try the example crew in Pool HQ. Add/remove whales and choose one of the four tactics for each.
2. Signing in clears the example crew. Use My Company’s owned-whale dropdown to add your NFTs; the first added whale becomes captain, and the captain selector switches between crew members. One Rare Whales or WhaleStreet NFT qualifies for the free arcade; up to 12 owned agents share $1,000 equally.
3. Open My Company in a browser with an injected wallet extension or inside the wallet's browser. Select Robinhood Chain, connect and sign the login message. No NFT approval, transfer, transaction or gas fee is requested.
4. Choose whales from your wallet, a company name and captain, consent to public display, then publish. The server checks every NFT at one Robinhood block and calculates the score itself. Submitted browser balances or modified DNA are ignored.
5. View Leaderboard. Each wallet has one current entry. Changing the sandbox does not change that entry until publishing again. Load a saved roster, resubmit an improved crew, or remove the public entry.

The owner's original 1/1 / founder / ten-combined-NFT gate remains in the draft founding season. The free arcade uses separate `arcade.json`, season ID `whale-pools-arcade-v1` and separate entries. The founder wallet and promo list still need confirmation before a prospective founding season opens.

## What the score means

All companies replay the same inspected UBTC/USDC Hyperliquid spot candles, 24 July 2026 10:00 UTC–19 September 2026 22:00 UTC, end exclusive. Same $1,000 total, equal agent shares, unchanged DNA v1 and tactics v1, modeled fee 0.08% and slippage 0.05% per side, unchanged spot execution. No leverage. Ranking uses net return rounded to 0.000001 percentage points; equal scores share the competition rank, with earlier update time then ID as stable display order. The visible return is rounded to two decimals; drawdown and trade count are alongside it.

Players can inspect the sample and optimise their crew after seeing results. Rank is an arcade achievement, not evidence of future profits or superior trading skill. There are no prizes, deposits, reward allocations or real fills. A future prospective season needs its own locked rosters, future dates, recorder and coverage policy. Multiple NFTs may share DNA and trades are correlated; wallets are not unique humans.

The server uses an immutable build-generated lookup covering all 27 DNA profiles × four tactics × twelve crew budget splits. It preserves each equity change and trade accounting input from the original replay engine. It combines the chosen runs in canonical collection/token order. Regression checks compare every reconstructed path and representative company statistics to direct replay. The lookup and scoring source are hash-bound to the version; changing published rules requires a new arcade ID. Frozen Vector Desk evidence is untouched.

## Ownership and public identity

Ownership is a snapshot when publishing, at two blocks behind the verified Robinhood head. It is not continuous ownership or an identity proof. A whale transferred later may appear in a new owner's entry without deleting the earlier owner's historical submission. All NFTs are rechecked when resubmitting. This rule is suitable for a free historical game, not proof of exclusive future-season membership or eligibility for rewards.

With explicit submission consent, the board publishes company name, wallet address, NFT roster, tactics, DNA, statistics, ownership block and update time. Owner links point to the Robinhood explorer; no unverified ENS names are invented. The owner can remove the public entry. Signed challenges and session hashes are private server data; raw session tokens are sent only in HttpOnly, Secure, SameSite=Strict cookies scoped to `/whalepools/`. Signatures are not published or stored in the entry. Logging out revokes the current session. Sessions last twelve hours; challenges last five minutes and are single-use. Authentication and mutation requests are rate-limited and reject cross-origin writes.

## Operations

Worker `whale-pools-demo`, dedicated D1 `whale-pools-arcade`. No other project database, Worker, routes, cron or access boundary is changed. No new subscription was enabled; the app uses existing Cloudflare hosting and included D1 capacity. Quota exhaustion can make login/board temporarily unavailable; the browser must show an error, never invented standings.

Hosted ownership reads use dRPC's documented public Robinhood endpoint (`https://robinhood.drpc.org`), with two bounded retries and no JSON-RPC batching. The official public RPC throttled hosted `eth_call` requests during release verification. Both providers are availability dependencies; this free launch has no RPC SLA. Before promotion beyond a small beta, configure an authenticated production RPC as a Worker secret named `RPC_URL` and remove the public URL variable. Never put keyed URLs in the repository or browser bundle. See [Robinhood network guidance](https://docs.robinhood.com/chain/connecting/) and [dRPC endpoints](https://drpc.org/chainlist/robinhood-mainnet-rpc).

Schema: migrations 0001–0003, applied to the dedicated database. Statements are idempotent. Read-only board queries return the top 100 and total count. New versions should preserve earlier records rather than rewriting their scores. Claims configuration remains null; operator assets are not publicly served. The old launch desk was stopped for this release; do not start or deploy it as a side effect of game maintenance.

Local `npm run dev` serves the arcade on 127.0.0.1:48372 with `work/arcade.sqlite`. `RW_LOCAL_AUTH=1` selects the earlier draft membership prototype in separate `work/club.sqlite`. Do not publish synthetic UI fixtures or test identities. Real extension signing plus an actual NFT-owning user's first submission remains an important first-player check; automated tests cover signature verification, ownership rejection, scoring, update and withdrawal.

Primary references: [Sign-In with Ethereum](https://eips.ethereum.org/EIPS/eip-4361), [Cloudflare D1 database API](https://developers.cloudflare.com/d1/worker-api/d1-database/), [D1 included usage and limits](https://developers.cloudflare.com/d1/platform/pricing/).

## Wallet inventory (RW-011)

The authenticated `/api/whales` endpoint uses the session wallet only. These collections do not support ERC-721 owner enumeration. The server reads incoming/outgoing Transfer logs from the official Robinhood RPC, orders the most recent event per token, and requires the resulting count to equal each on-chain balance at the same block (head minus two). Balance reads use the configured dRPC endpoint; both chain IDs must be 4663. This avoids a paid indexer. The public log endpoint is an availability dependency: errors, incomplete history or more than 20,000 combined transfer records per collection show a retry state, never a fabricated empty inventory. Publishing still independently checks every `ownerOf`.

Initial or restored sign-in clears browser examples and loads the signed-in wallet’s whales. Previously published entries remain saved and can be loaded explicitly, filtered against the current inventory. Wallet change/sign-out clears the local crew and invalidates pending inventory responses. Pool HQ offers the same owned-whale dropdown while signed in; manual token-number previews remain available when signed out. Refresh rechecks holdings; an unsuccessful refresh preserves the drafted and published crew but disables new inventory additions.
