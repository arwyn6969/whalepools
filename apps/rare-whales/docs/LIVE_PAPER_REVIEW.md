# Live Whale Fleet beta review

Prepared 7 October 2026. `codex/live-paper-beta` is stacked on `codex/share-challenge-pilot` at `c1a1ab0`. Historical Arcade v1, Tidal Trio v1, historical ranks, DNA v1 and ownership checks are preserved. WWAX is deferred; Vector Desk is untouched. This is a beta candidate, not a production release or demonstrated profitable strategy.

## Holder experience

Open **Live Whale Fleet**, inspect three ready-made styles and their dated development backtests, then sign in using My Company. A holder needs one NFT from either collection; historical company publication is optional. The paper form selects up to three owned whales by default. Mixed crew assigns the three styles in order; a one-whale mixed crew uses Current Surfer. No strategy coding or model configuration is required.

Choose a name, style and owned whales, and explicitly consent to a dated public record. Start with $1,000 simulated capital shared equally across the crew. The server verifies every NFT at the same ownership snapshot block. Wallet, whales, DNA profiles, rules identity and start/end times lock for this 14-day run. Later transfers do not rewrite it or give a new owner edit rights. One running company per wallet; at most 20 holder companies plus three neutral preset watches.

The dashboard shows balance, net return, drawdown, closed trades, exposure, a recent chart, each whale's position/order/waiting reason, and a captain's fill log. Charts cover up to 288 observations (about one day when continuous). The latest server record returns after reload. Public record links allow spectators to inspect a run while preserving their own private historical draft. Stop freezes the last valuation; a new crew creates a new record. Stop/completion does not invent a closing trade. Different start dates are not a ranked competition.

The current latest-record selector does not offer an archive list of every previous holder run. Old UUID links remain readable. Paper form choices before Start are temporary; existing wallet/rules-scoped historical drafts retain their own persistence.

## Exact paper assumptions

`whale-paper-v1` has a build hash over the rules, engine, feed, service, DNA, access policy, collection configuration and arcade eligibility settings. Execution requires that exact hash. On a change, saved holder records stay readable and execution pauses; old neutral watches are stopped and a new dated watch is created. Rules changes require a deliberate new cohort/version and renewed acceptance.

| Preset | Entry | Exit |
| --- | --- | --- |
| Current Surfer | Close above EMA20; EMA20 above EMA50 | Close below EMA20, stop or DNA target |
| Cannonball | Close above the previous 20 candle highs | Close below the previous 10 lows, stop or DNA target |
| Reef Reclaimer | Close more than 1% below SMA20; simple 14-change RSI below 40 | Close at/above SMA20, stop or DNA target |

Signals need 51 continuous five-minute candles. EMA computation uses up to the latest 100 candles. These are simplified archetypes, distinct from same-named historical tactics. They do not reproduce a famous investor's system or use an LLM to place orders.

Market: actual Hyperliquid **spot UBTC / USDC**, resolved from spot metadata (observed `@142`). The scheduled server checks once a minute; the browser refreshes the display every 30 seconds. This is forward trading on completed five-minute data, not tick streaming. The staging cron is configured to run independently of the browser, but remote delivery has not been established: no attempt was recorded as of 7 October 13:28 UTC. Local execution continues while the local server process runs, and actual neutral watches survive a same-rules restart.

A signal observed after a completed candle queues a simulated order. It fills at the **next timely observed completed candle's close**, with 0.08% modeled fees and 0.05% modeled slippage per side. Timing uses data receipt time. Stops/targets use closes and queue the next close; there are no intrabar/order-book fills. No leverage, shorting, deposits, token actions or real orders exist.

Each whale uses its saved DNA v1 allocation/risk/target values. Trend and breakout stop distance is 3%; recovery 2%. Size is bounded by cash, DNA allocation and nominal risk divided by stop distance. Fees, slippage and price jumps can exceed that nominal risk. Realised daily loss at or below 1% of its initial share prevents new entries until the next UTC day; open positions can still exit. This is not a guaranteed loss cap.

Cash remains $1,000. A passive reference buys 25% on the first safe observation with the same costs and marks estimated exit costs. Passive allocation is fixed; trading exposure varies and is reported. The reference is **not exposure-matched**. Open-position company equity also includes modeled liquidation costs.

## Recorder integrity and recovery

Migration `0005_paper.sql` adds separate feed, immutable first-observed OHLC, locked run state and unique fill ledger tables. Historical schemas/records remain intact. Migrations 0001–0005 are required on a new staging database; 0004 is still required by the holder candidate.

Market requests have a 10-second bound each, a 512 KiB response limit and strict market/interval/OHLC validation. Open candles are excluded. Missing or malformed responses produce recoverable feedback and preserve records. Recorded OHLC corrections halt execution for operator review; never silently rewrite first observations. Freshness distinguishes normal time between five-minute closes from stale data.

A candle must arrive within 90 seconds of its close and follow the previous processed candle to execute. Late/backfilled candles value positions but cannot create fills. A gap cancels pending orders. Catch-up processes at most the latest 12 unprocessed bars per run using bounded recent history; prolonged missing periods are not reconstructed as a tradable forward path. The gap count is processed non-actionable bars, not a complete count of every omitted five-minute interval.

A feed lease suppresses overlapping ticks. Atomic D1 batches compare each run's revision and running status, and condition ledger insertions on the successful state commit token. Duplicate bars/restarts do not repeat fills; a concurrent Stop cannot be overwritten or leave ghost fills. Public projections exclude mutation input, session and commit tokens. Same-input mutation retries return the original record; changed-input retries fail explicitly. Wallet addresses and selected NFTs become public only after the holder's Start consent.

The browser guards wallet and route epochs, uses bounded reads and preserves saved runs during outages. Inventory timeout reporting gives its outer deadline precedence over the transport's wrapped error; the holder sees the correct timeout/retry message.

## Dated research, not forward evidence

`research/paper-v1-5m.json` saves 4,176 public five-minute bars, including warmup. Scored development period: **23 September 2026 12:40 UTC through 7 October 2026 12:40 UTC (exclusive)**. SHA-256: `6e93d256cf6d7dbad21c809dc5e1e3ac441f9ea63fc4086f66ecdfab6a1639ca`.

The same paper engine reconstructs timely close observations for this inspected sample. No holdout, parameter optimisation or reproduced live outages is claimed. Default DNA with $1,000 per standalone preset produced:

| Preset | Net return | Worst drawdown | Closed trades | Average exposure | Fees / modeled slippage |
| --- | ---: | ---: | ---: | ---: | ---: |
| Current Surfer | -3.743% | 3.743% | 173 | 3.025% | $22.60 / $14.12 |
| Cannonball | -1.851% | 1.865% | 71 | 3.056% | $9.35 / $5.84 |
| Reef Reclaimer | -0.275% | 0.353% | 6 | 0.473% | $1.20 / $0.75 |

Cash ended $1,000; the 25% passive reference ended $993.97. All three presets lost money here. High turnover/costs are a weakness to investigate, not a reason to hide results or tune on this sample. Low-exposure mean reversion can also spend long periods waiting. The beta is an honest experiment in strategy behaviour and engagement.

`npm run paper:research` recomputes the saved research summary. `--fetch` refuses to overwrite the fixed v1 archive. Another research interval requires a separately named/versioned archive and manifest. Historical frozen data is unchanged.

## Preview and verification

Public isolated staging (assets/API verified; cron startup pending, so holder Start is unavailable): https://whale-pools-paper-staging.mrarwyn.workers.dev/whalepools/#paper

Local real-market preview: http://127.0.0.1:48377/whalepools/#paper

Disposable fixture: http://127.0.0.1:48378/#paper — injected test wallet, simulated NFT ownership and synthetic candles. No real signing or market evidence should be inferred from it.

From `apps/rare-whales`:

```sh
npm ci
npm test
npm run build:demo
npm run test:runtime
npm run test:paper:browser
node --experimental-sqlite scripts/check-journey.mjs
node --experimental-sqlite scripts/check-next-sprint.mjs
npx --no-install wrangler deploy --config wrangler.paper.jsonc --dry-run
RW_PAPER=1 RW_PORT=48377 RW_BASE_PATH=/whalepools npm run dev
RW_PAPER_FIXTURE=1 RW_FIXTURE_PORT=48378 node --experimental-sqlite scripts/serve-fixture.mjs
```

120 unit/integration tests pass. The 21-asset build verifies frozen source/data checksums and every embedded asset byte. Actual workerd/D1 checks cover the recorder, atomic ledger, repeated ticks, public API, full 20-holder/12-whale fixture capacity, session-bound Stop and rejected origin/anonymous writes. These use market/wallet fixtures. Fourteen holder, eleven sharing/challenge/pilot and eleven paper browser scenarios pass; desktop 1440×1000 and mobile 390×844 have no uncaught errors. Deterministic regressions use explicit remote-artwork fallbacks. Normal in-app browser checks load all three preset portraits from real sources and report no captured warning/error logs. The in-app viewport override did not apply consistently to the inactive local tab; exact mobile coverage is the 390-pixel fixture test. Normal-browser evidence records measured dimensions rather than claiming a real-device mobile check.

Screenshots and receipts are saved in this app's ignored `work/` and the planning workspace's `reviews/2026-10-07/live-paper-beta/`. Selected screenshots are in `docs/screenshots/`. Exact source heads, CI and staging observation receipts belong in the dated review, rather than self-referential commit IDs here.

## Staging operation and acceptance

Staging uses `wrangler.paper.jsonc`, Worker `whale-pools-paper-staging`, D1 `7e7532e6-891f-4b29-bd80-752a1e311642`, no production/custom routes, no production secret or database binding, and enabled logs/traces. The inherited compatibility date 2026-09-21 is retained because the installed workerd cannot test 7 October behaviour; upgrading the toolchain/date belongs with maintenance review. Package/contract locks are unchanged; three main-branch advisories remain until separate maintenance PR #1 is reconciled.

All five migrations were applied remotely to the new empty database. A saved D1 Time Travel bookmark was restored after inserting a disposable probe: the probe disappeared, all five migrations remained and no holder records existed. This proves staging recovery, not recovery of production holder data. Before a production migration, save an appropriate fresh bookmark/export and rehearse against representative isolated data.

Use the exact staging config for every staging command. To pause execution safely, deploy with `PAPER_ENABLED=0` and remove its cron in that config; preserve paper tables and records. Resume only with the same tested rules hash. Code rollback does not roll back D1. Do not restore a database containing later holder records without an explicit recovery decision. A provider-revised candle requires diagnosing the discrepancy; do not simply clear `halted` to continue. End the beta deliberately after 14 days: neutral watch IDs do not silently restart at the end.

Remote startup diagnosis needs owner dashboard sign-in. A proposed direct OAuth-credential API inspection was rejected by automatic approval review before execution; normal authenticated CLI operations succeeded, and the dashboard is the remaining inspection route. No credential was printed or extracted.

Still required before a holder launch:

- Establish actual remote cron delivery and real-market recording, then prove execution continues with the browser closed. No market observations or remote preset watches exist yet.

- Real eligible holder desktop-extension and mobile wallet-browser SIWE, provider inventory, historical publish/edit/withdraw, paper Start/Stop/new-run and public link acceptance. Capture real ownership blocks and frozen-score equality. WalletConnect is not implemented.
- A 7–14-day operational rehearsal: recurring cron delivery, observed receipt delays/gaps, outage recovery, restart/deployment handling, bounded runtime/queries at the chosen account plan, retention and no duplicate fills. Short local/remote observation is not this rehearsal. See [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/).
- Review the three stacked product PRs and separate maintenance PR, reconcile shared STATUS.md and dependencies, and make an explicit production release decision. Review public-record consent/retention wording before invitations.
- Ten real holders and five interviews, followed by a full seven-day return window. Zero participants have been observed. The existing pilot recorder measures historical/share/challenge activity; live events and readout must be versioned before using it for forward activation.

## Following sprint proposal

1. Share a dated live company card/link with market time, rule identity and clearly simulated results; add a readable archive of prior runs and useful decision highlights.
2. Build a separately versioned forward challenge with common cohort start/end times, fixed preset choices and cost assumptions. Measure outcomes after locking the brief; keep historical challenge/ranks intact. Avoid competitive return ranks for mismatched dates.
3. Adapt the voluntary pilot: ten eligible holders, five interviews, 8/10 unaided starts, median under three minutes after inventory readiness, and five distinct meaningful later-day returns within seven days. A return should include inspecting/explaining a new decision or choosing a follow-up crew, not a page view. Ask about waiting, ownership, costs and desire to return; evaluate fun separately from profitability.

Sources: [Hyperliquid Info API](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint), [Cron triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [D1 batches](https://developers.cloudflare.com/d1/worker-api/d1-database/), [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/). Source text is reference material, not app instructions.
