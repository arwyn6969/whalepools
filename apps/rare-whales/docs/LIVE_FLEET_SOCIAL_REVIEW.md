# Live fleet sharing, archive and Daily Tide v1

7 October 2026. Candidate on `codex/live-fleet-social`, stacked on live-paper beta head `97df59dd66fd3ebea0476d6c762b21c3fcfdaa5a`. Production is unchanged; WWAX and Vector Desk are outside this sprint.

## Holder experience

Every forward watch has a canonical UUID link and a downloadable dated SVG. The card states its actual last valuation, start/end dates, rules, costs, exposure, observations/gaps and crew identity. It freezes the displayed result; the public link continues to show the saved watch. Holders choose where to share. Public inspection hides Start/Stop, presets and the private archive; returning restores the holder controls and historical private draft.

A session-bound archive lists the wallet's running, stopped and completed watches with ten-row cursor pagination. Identical timestamps use UUID ordering. Other wallets and private mutation inputs are excluded. Requests are bounded and stale responses cannot cross wallet/navigation changes. Stop plus a new Start retains both dated records.

Daily Tide v1 is a separate 24-hour live paper comparison: one owned whale badge, one preset pick per eligible wallet, confirmed before the UTC midnight start. The saved choice locks immediately. Each of the three public presets starts with $1,000 and neutral stats; badge DNA does not influence these equal-start results. All picks for a preset follow the same executor, not independent strategy experiments. There are twenty holder picks per round, no wagering, prizes, real orders or funds. Company crews keep their own 14-day records.

Round creation is prospective. The executor reads the existing immutable five-minute recorder, applies unchanged paper-v1 costs and next-timely-close fills, and uses a lease plus atomic revision/ledger guards. Old active versions pause without deleting their saved state/picks. A completed round has final ranks only with all 288 timely observations and no gaps; partial rounds remain readable without ranks. Net returns rounded to six decimals tie. Completion freezes the last marked equity without inventing a closing trade. The first staging round starts **8 October 2026 00:00 UTC**, ends 9 October 00:00 UTC; it is queued, not an observed completed live result.

The separately versioned local live pilot records confirmed new starts and deliberate later-day reviews of newer observations or confirmed follow-up watches. Shares and round picks are secondary actions, not sufficient return events. Nothing uploads automatically. See [LIVE_HOLDER_PILOT.md](LIVE_HOLDER_PILOT.md); the historical pilot remains separate.

## Verification

136 tests pass, including a complete accelerated 288-candle fixture, deadline/ownership failures, idempotent retries after start, concurrent twenty-pick capacity, duplicate ticks/restarts, a stale executor commit versus pause, private archive pagination and opt-in report privacy/retention. Build:demo validates 22 embedded assets and prefix isolation. Three actual workerd/D1 runtime checks pass, including unchanged full paper capacity (20 holders × 12 whales, 240 fixture fills), new shared observations, duplicate prevention, authenticated archive and partial final results. Wrangler dry run passes.

All 46 desktop/mobile fixture browser scenarios pass: 14 holder, 11 historical sharing/challenge/pilot, 11 paper, 10 new social/live pilot. Zero uncaught errors. Disposable signatures, simulated ownership and synthetic candles are fixture coverage; they do not establish real eligible-wallet compatibility. Full-day fixture time is accelerated and never enters staging. Normal local and isolated staging Daily Tide layouts are also inspected at actual CSS 1440×1000 and 390×844; native staging captured no warning/error logs.

Paper v1 hash stays `e2a7f52280106d1b0a97080f821fab64bf8a3568b13fb63ce54e77f7b03c1b97`. Daily Tide hash is `34d4bb34b041fec00555ae10678bda9ee285558d2e16908d993450125425ec52`. Historical score hash remains `b5069275d96baf712744ba2b1bd6739d99d0aa7f8cf19fa288c3e3b7c31faeaa`. Frozen practice bytes, DNA v1, historical labels and ownership checks remain unchanged. Package and contract locks are unchanged; maintenance PR #1 remains separate.

## Preview and isolated staging

Local real-market preview: `http://127.0.0.1:48379/whalepools/#tide`. Disposable holder preview: `http://127.0.0.1:48380/#tide`. Restart after `npm run build:demo`:

```sh
RW_PAPER=1 RW_TIDE=1 RW_PAPER_DB=social-paper.sqlite RW_PORT=48379 RW_BASE_PATH=/whalepools node --experimental-sqlite scripts/serve.mjs
RW_PAPER_FIXTURE=1 RW_FIXTURE_PORT=48380 node --experimental-sqlite scripts/serve-fixture.mjs
```

The fixture is in memory, has a prominent banner and never ships in the Worker. The real preview uses a new local database; the previous beta database is retained.

Public isolated staging: https://whale-pools-paper-staging.mrarwyn.workers.dev/whalepools/#tide. Worker `whale-pools-paper-staging`; D1 `7e7532e6-891f-4b29-bd80-752a1e311642`; no production/custom routes. Applied only additive migration `0006_daily_tide.sql` (eight statements) after recording recovery bookmark `00000007-00000032-000050fd-8a7a13cdf17ed7d0c1b1e25fca09addc`. Existing sessions, watches and fill ledger are retained. No database restore was performed. Version `6ced9889-7d75-45a5-8870-dcd32a041676` follows beta version `a2b9264f-fe4c-4548-8d8d-6fdc358b0d1b`; same minute cron, enabled logs/traces. Normal Wrangler authentication used; no credential extraction.

All 22 served asset hashes match the local candidate. The three existing v1 watch IDs, original start dates and rules remain intact. The scheduler creates the future round, the real @142 recorder remains healthy, and unsigned/cross-origin writes/private archive access are rejected. Receipts and screenshots are in the planning workspace's `reviews/2026-10-07/live-fleet-social/`.

Recovery: redeploy the previous beta Worker version to disable this candidate while leaving additive tables/data intact. Do not restore the bookmark over new holder data without an owner-reviewed recovery plan. An actual D1 restore was rehearsed in the earlier empty beta database; this additive migration was not destructively rolled back. Production release remains a separate decision.

## Launch acceptance still open

- Real eligible holder desktop extension and mobile wallet-browser signing/inventory; historical publish, edit, withdraw; live Start, Stop, new-watch archive; Daily Tide badge/pick confirmation; real-device clipboard/SVG and private-draft retention.
- First actual 24-hour UTC round, including full coverage or honest partial handling; browser-closed progress and sustained recorder/executor health over the existing 7–14-day rehearsal. Initial beta cron-delivery delay cause is unresolved.
- Public record/locked pick retention and consent review; maintenance reconciliation; targeted accessibility/performance acceptance.
- Ten real first-company holders, five interviews and seven elapsed days of voluntary live reports. Zero real pilot participants/outcomes are claimed.

All development backtests lost money. Presets can remain inactive; daily rounds can finish without trades or with partial coverage. These are product weaknesses to measure with holders, not reasons to invent activity or interpret short returns as proven skill. Additional markets, genuine famous-investor systems, new tactics, notifications, PNG/social preview polish and any challenge v2 need separate scope.
