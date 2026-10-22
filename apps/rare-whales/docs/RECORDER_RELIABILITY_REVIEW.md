# Recorder coverage and runtime reliability review

8 October 2026. Candidate branch `codex/recorder-reliability`, stacked on PR #7 head `2bfa1af08953205cc6a32d0fad92e55023f0027c`. Production is unchanged; the maintained source is `public/` and `src/`.

## Why this sprint

At 06:24 UTC the real staging feed was healthy, but each original public watch had 13 unusable closes. Saved candle metadata showed timely receipts. A successful read or recent connection cannot establish an uninterrupted strategy record.

Two inspected Cloudflare scheduled invocation records on version `65dd83cf-3ced-4c2d-9ff2-0f1e41e0908c` show `outcome: exceededCpu`: 04:08:45.144 UTC (15 ms CPU, 4,300 ms wall time) and 05:20:42.458 UTC (10 ms CPU, 1,380 ms wall time). The dashboard identifies Workers Free. This confirms CPU termination for those invocations; it does not identify the cause of every individual unusable close. The full diagnostic query may be sampled/incomplete. The earlier initial trigger-delivery delay remains separately unresolved.

[Cloudflare's limits](https://developers.cloudflare.com/workers/platform/limits/) specify a 10 ms free cron CPU limit; paid minute cron has a 30-second default. [Workers Paid pricing](https://developers.cloudflare.com/workers/platform/pricing/) starts at $5 USD/month per account, with usage charges beyond included allowances. Changing subscription/billing needs an owner decision. No subscription, credential, plan or runtime-capacity setting was changed here. Read-only D1 access initially returned 7403, then recovered through the existing normal CLI/dashboard sessions; no stored credentials were read.

## Delivered behaviour

- “Was the market watch uninterrupted?” reads a saved UTC day on demand: on-time/late/missing/waiting receipt counts and whether all three neutral preset watches saved an actionable decision. Timely receipt and usable execution are separate. Details show the last twelve affected closes; the full public projection has at most 288 close records.
- A 90-second grace distinguishes pending delivery/decisions from missing records. Ending-midnight attribution matches recaps; initial warmup is excluded. Comparable execution becomes unavailable outside the public watch window or retained history; no coverage is assumed.
- An indexed, read-only API filters public decision flags in D1 and returns no holder names, wallets, agents, authentication or private input. It never retries execution, fabricates fills, changes records or determines Tide ranks. Existing origin/method/cross-site guards apply.
- Failed reads keep a labelled snapshot; retry/day selection recovers. Wallet and route changes discard in-flight replies. Public inspection never becomes a meaningful holder pilot return.
- A running Daily Tide with saved gaps now immediately explains that results will remain partial without final ranks.
- The source and compiled deployment share one scheduled handler. Structured start/finish summaries contain schedule lag, duration and bounded result counts. Caught `{error}` results reject `waitUntil`, making the invocation fail. Hard CPU termination can prevent a finish log: inspect platform outcomes alongside the summaries. No automatic retry or execution-policy change.
- `scripts/recorder-diary.mjs` exports up to fourteen saved days with at most three parallel reads. Seven-day coverage requires consecutive full clean UTC days; failed reads, missing days, partial bootstrap, absent execution evidence and older hashes cannot qualify. This is saved-data evidence, not proof of continuous scheduler uptime or real-holder acceptance.

## Verification

165 unit tests; frozen-integrity 23-asset build; three actual workerd/D1 suites; staging dry run; 87 browser fixture scenarios (14 holder, 11 historical sharing/challenge/pilot, 11 paper, 10 social, 12 recap, 15 live onboarding, 14 recorder). Runtime exercises the actual scheduled success/failure outcome and bounded coverage SQL. The full 20-holder × 12-whale fixture also advances with 3,800 saved closes per holder. Local runtime wall time is not Cloudflare billed CPU or proof of free-plan capacity.

Desktop 1440×1000 and mobile 390×844 cover receipts, execution interruptions, outage recovery, prior days, stale route/wallet reads, private drafts, bounded waiting and no pilot inflation. Fixtures use synthetic candles, accelerated time, disposable signatures and simulated ownership. Native preview checks/screenshots and exact deployed asset receipts are saved separately in planning `reviews/2026-10-08/recorder-reliability/`.

Paper v1 `e2a7f52280106d1b0a97080f821fab64bf8a3568b13fb63ce54e77f7b03c1b97`, Daily Tide v1 `34d4bb34b041fec00555ae10678bda9ee285558d2e16908d993450125425ec52`, historical score/practice bytes, DNA v1 and ownership checks are unchanged. No new migration, recovery restore, contract/dependency lock, WWAX, Vector Desk or production edit.

## Preview and restart

```sh
npm run build:demo
RW_PAPER=1 RW_TIDE=1 RW_PAPER_DB=recorder-paper.sqlite RW_BASE_PATH=/whalepools RW_PORT=48385 node --experimental-sqlite scripts/serve.mjs
```

[Local real-market preview](http://127.0.0.1:48385/whalepools/#paper) uses its own new SQLite database. Do not use `RW_LOCAL_AUTH=1` for a paper preview. [Disposable holder preview](http://127.0.0.1:48386/#paper):

```sh
RW_PAPER_FIXTURE=1 RW_FIXTURE_PORT=48386 node --experimental-sqlite scripts/serve-fixture.mjs
node --experimental-sqlite scripts/check-recorder.mjs
node scripts/recorder-diary.mjs https://whale-pools-paper-staging.mrarwyn.workers.dev/whalepools/ work/recorder-diary.json
node scripts/live-readiness.mjs https://whale-pools-paper-staging.mrarwyn.workers.dev/whalepools/ work/launch-readiness.json
```

[Isolated public staging](https://whale-pools-paper-staging.mrarwyn.workers.dev/whalepools/#paper) uses `whale-pools-paper-staging`, D1 `7e7532e6-891f-4b29-bd80-752a1e311642`, zero production routes, the existing six migrations and original watch dates. This is a code-only deployment. Before reverting, confirm the desired version with `wrangler deployments list --config wrangler.paper.jsonc`; `wrangler rollback 65dd83cf-3ced-4c2d-9ff2-0f1e41e0908c --config wrangler.paper.jsonc` restores the prior code, retaining D1 records. Reverting does not fix free CPU capacity or rewrite partial rounds.

## Remaining launch decisions and acceptance

The free runtime has demonstrated CPU terminations. Obtain the owner's Workers Paid decision, set a scoped staging CPU cap after measuring long-history/full-cohort CPU, and observe fresh scheduled closes with browser tabs closed. If paid capacity is declined, separately design/version a cheaper execution architecture; do not silently change frozen v1 to make this rehearsal pass. Keep original records and label the interruption in the reliability diary. Require at least seven consecutive full clean days (prefer fourteen), platform outcome review, and an actual complete 288-close Tide; no old gap can be repaired with a retrospective fill.

Real eligible-holder signing and inventory on desktop/mobile; historical publish/edit/withdraw; live Start/Stop/follow-up/archive/Tide pick; real sharing destination/device; maintenance reconciliation and consent/retention review remain in [LIVE_LAUNCH_ACCEPTANCE.md](LIVE_LAUNCH_ACCEPTANCE.md). No real participants or elapsed seven-day pilot outcomes are claimed. Production release remains an owner-approved separate step.

Then improve sharing from holder/device feedback, brief any new prospective challenge under a separate version, and run ten first-live-company holders plus five interviews. Targets: eight unaided starts, median under three minutes after inventory, and five distinct meaningful later-day returns over actual seven-day windows. Sharing and picks remain secondary measures; no invitations or social posts were sent.
