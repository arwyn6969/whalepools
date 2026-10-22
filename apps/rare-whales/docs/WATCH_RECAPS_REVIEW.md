# Watch recaps and launch acceptance review

7 October 2026. Branch `codex/watch-recaps-preview`, stacked on `codex/live-fleet-social` at `6ddff97`. Isolated staging only; production remains the published Historical Arcade v1.

Holders can open a dated UTC day to understand what their crew bought/sold or why no fills were recorded, see balance change and saved fees/slippage, and revisit earlier days. A recap is a presentation of the saved ledger, not a replay or new scoring system. Full-day counts/costs use a bounded indexed read of at most 3,456 fills; the twelve most recent explanations are displayed. Candle closes after 00:00 through the next 00:00 belong to the ending UTC day. A completed window still counts missing final closes; Stop uses the last frozen valuation because the existing record has no separate stop timestamp. No observation means no invented recap balance/change. Older hashes freeze the recap window and do not reinterpret modeled slippage.

Recaps are loaded on demand, cached in a bounded twenty-watch view and clearly labelled snapshots. Failed reads retain the prior recap and offer Update. Existing requests have twenty-second bounds; stale navigation/wallet responses are discarded. Owner reads of a newer saved observation can emit the same opt-in `live_reviewed` event as the review button. Failed, waiting, duplicate and visitor reads do not qualify. The pilot definition/version and private data whitelist remain unchanged.

Sharing uses `/whalepools/watch/<uuid>` with dated server-rendered Open Graph text, a generic 1200×630 illustrative cover, a canonical URL and a readable no-JavaScript fallback. Absolute shell asset paths preserve the strict CSP without `<base>`. Existing hash links still work. Download PNG and SVG use the displayed snapshot, full rules hash and valuation date. PNG draws the locally generated card’s text/rectangles to canvas with a five-second export bound; no remote image or extra CSP permission. Server metadata/static cover does not prove a particular social platform has fetched/refreshed its cache; check the intended destination with the holder.

149 unit tests, all 23 embedded asset bytes/prefix isolation, three actual workerd/D1 runtime suites and Wrangler staging dry run pass. 58 browser fixture scenarios pass: 14 holder, 11 prior sharing/challenge/pilot, 11 paper, 10 fleet social and 12 recap/share scenarios. Runtime tests include the full 20×12 whale cohort and 240 synthetic fills, compressed-shell share rendering, recap mutation isolation and cross-site refusal. Fixtures use disposable signatures, simulated NFT ownership, synthetic candles and accelerated UTC time; no real eligible-holder acceptance is claimed.

Native staging 1440×1000 desktop and 390×844 mobile layouts have no horizontal overflow or warning/error logs. Native copy and PNG download pass. Staging deployment `40a9e4cd-125e-41bf-8089-c31dadcb8cf8` serves all 23 exact built asset bytes and real-price daily recaps. Public watch IDs/start times and the queued 8 October UTC round are identical before/after; migration count remains six. No migration or database restore was performed. Code rollback is to `6ced9889-7d75-45a5-8870-dcd32a041676`; preserve populated D1 records and never restore over new holders without owner review.

Paper hash `e2a7f52280106d1b0a97080f821fab64bf8a3568b13fb63ce54e77f7b03c1b97`, Tide hash `34d4bb34b041fec00555ae10678bda9ee285558d2e16908d993450125425ec52`, historical hash `b5069275d96baf712744ba2b1bd6739d99d0aa7f8cf19fa288c3e3b7c31faeaa`, and practice bytes `edf506d2fdb2b353866c99672bf75573b6e6eab561f0fc0138bab5d273a9821d` remain unchanged. DNA v1, ownership checks, all contracts/dependency locks, maintenance PR #1, WWAX deferral and Vector Desk remain separate.

Restart commands, from this app directory:

```sh
npm run build:demo
RW_PORT=48381 RW_BASE_PATH=/whalepools RW_PAPER=1 RW_TIDE=1 RW_PAPER_DB=recaps-paper.sqlite npm run dev
RW_FIXTURE_PORT=48382 RW_PAPER_FIXTURE=1 node --experimental-sqlite scripts/serve-fixture.mjs
npm run test:recap:browser
node scripts/live-readiness.mjs https://whale-pools-paper-staging.mrarwyn.workers.dev/whalepools/ /private/tmp/whale-readiness.json
```

Local real-market preview: `http://127.0.0.1:48381/whalepools/#paper`. Disposable holder fixture: `http://127.0.0.1:48382/#paper`. Servers must be running. Canonical staging watch: https://whale-pools-paper-staging.mrarwyn.workers.dev/whalepools/watch/e2a7f522-8010-4d1b-8a97-000000000001.

Read [LIVE_LAUNCH_ACCEPTANCE.md](LIVE_LAUNCH_ACCEPTANCE.md). At the captured preflight, 53/53 closes were actionable and the feed was healthy, but there was no completed actual Tide and only ~0.18 days elapsed. Real holder desktop/mobile sign-in, historical publish/edit/withdraw, paper Start/Stop/follow-up/archive/Tide pick, real-device sharing/destination, 7–14-day reliability, maintenance/consent review and ten-holder/five-interview/seven-day pilot remain. No invitations or posts were sent.

Following sprint: complete real-holder acceptance first, then improve share/open and recap usefulness from ten-holder pilot evidence. Keep Daily Tide v1; give any new challenge objective/execution a separate version with a prospective start and no rewriting of old records. Measure eight unaided starts, median creation below 180 seconds after inventory, five meaningful later-day returns and five interviews, using elapsed windows and missing participants honestly.
