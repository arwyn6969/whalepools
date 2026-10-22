# Holder control and acceptance sprint · 8 October 2026

Candidate `codex/holder-acceptance-ready`, stacked on saved-day head `992024c`. Production remains separate. Stop now opens a named review of the latest saved balance, UTC valuation, open paper positions and queued orders. Keep watching receives initial focus; Escape/cancel send no write. The two actions retain keyboard focus. Navigation, wallet change or an updated non-running/different watch discard the intent. Confirm sends the existing authenticated Stop with that reviewed ID. An uncertain response reads saved status before confirming that Stop applied. No server, execution, score, DNA, ownership or rules changes.

Acknowledging a Start, including recovery through the owner read after a lost response, clears its request ID and publication consent. An unchanged follow-up therefore starts a new record instead of idempotently returning the old stopped one. Each new record requires fresh consent. Stopped/completed watches explain how to choose the next crew/style and create a separate fourteen-day record with a fresh simulated budget. Open positions remain part of the frozen record; Stop never invents a closing trade. Both records remain in the private owner archive, with public inspection preserving personal drafts. The recorder can save another valuation before Stop completes.

## Real-holder session

Use [the acceptance worksheet](LIVE_LAUNCH_ACCEPTANCE.md). A real eligible holder must approve the actual wallet prompts on desktop and the chosen mobile wallet-browser route. WalletConnect is not implemented. Keep personal contact mappings, wallet addresses, signatures, session data and raw participant reports outside Git. No real acceptance, invitations, posts or pilot participation is claimed by the tooling.

After checking out the tested candidate, build it, then create a private template. Substitute the exact tested commit from the sprint receipt (the checkout must match it):

```sh
node scripts/holder-acceptance.mjs template TESTED_COMMIT https://whale-pools-paper-staging.mrarwyn.workers.dev/whalepools/ /private/tmp/whale-holder-acceptance.json
```

The eighteen checks start pending: eight journeys on each of desktop/mobile, plus maintenance/consent and Free quota/cohort reviews. For an observed pass/fail set `source` to `real-holder` (holder checks) or `operator-review` (operator checks), `observedAt` to the actual canonical UTC time such as `2026-10-08T14:05:00.000Z`, and `browser` to a plain device/browser/version or operator tool label. A failure also needs one of `wallet`, `network`, `inventory`, `privacy`, `clarity`, `execution`, `sharing`, `other`. Do not enter private identifiers in the browser label. Pending fields keep `source`, `observedAt` and `failureTheme` null. Synthetic evidence uses `fixture`; it never closes a real check.

```sh
node scripts/holder-acceptance.mjs readout /private/tmp/whale-holder-acceptance.json TESTED_COMMIT https://whale-pools-paper-staging.mrarwyn.workers.dev/whalepools/ /private/tmp/whale-holder-acceptance-readout.json
node scripts/live-readiness.mjs https://whale-pools-paper-staging.mrarwyn.workers.dev/whalepools/ /private/tmp/whale-readiness.json
node scripts/recorder-diary.mjs https://whale-pools-paper-staging.mrarwyn.workers.dev/whalepools/ /private/tmp/whale-recorder-diary.json
```

The readout rejects other commits/environments/rules, invalid/future dates, duplicate/missing checks, wrong sources and extra identity fields. Input is bounded to 32 KiB. Reports are manually declared observations; they cannot prove identity, signatures, social delivery or deployed bytes. `launchReady` remains false even if all manual checks pass. Reconcile the exact deployed asset receipt, fresh read-only health/diary, actual complete Tide/elapsed reliability, Free quotas/cohort, maintenance/consent and the owner's production decision separately. This is not a pilot report and never counts participants or returns.

At the pre-sprint 12:49 UTC read: healthy feed, 153 timely/140 actionable closes today, with all 13 earlier valuation-only interruptions preserved; zero full clean days, no actual complete Tide. This dated partial-day observation does not establish seven-day reliability or remote twenty-holder capacity. The owner accepts visible downtime for the Free proof; no paid plan is required by this sprint.

## Preview and recovery

Build `npm run build:demo`. Run `RW_PAPER=1 RW_TIDE=1 RW_PAPER_DB=holder-acceptance-preview.sqlite RW_BASE_PATH=/whalepools RW_PORT=48389 node --experimental-sqlite scripts/serve.mjs` for a separate local real-market preview. Run `RW_PAPER_FIXTURE=1 RW_FIXTURE_PORT=48390 node --experimental-sqlite scripts/serve-fixture.mjs` for disposable keys/ownership and synthetic candles. Local Node scheduling does not establish DO operation. The actual compiled runtime and existing isolated staging establish the latter.

Only upload the code bundle to existing `whale-pools-paper-staging`, with `wrangler.paper.jsonc`, D1 `7e7532e6-891f-4b29-bd80-752a1e311642` and the existing SQLite namespace/migration `recorder-sqlite-v1`. No D1/DO migration, restore, seed/reset, subscription or recorder configuration change. Verify original watch IDs/dates, running/queued Tide and exact served assets. Roll back the code to saved-day head `992024c` if needed; preserve all current data. That older UI Stops immediately, so retest before choosing it for acceptance.

Verification receipts, exact tested head, draft PR, CI, final staging version and desktop/mobile screenshots are saved in planning `reviews/2026-10-08/holder-acceptance-ready/`. The new control suite covers explicit cancellation, navigation/wallet changes, keyboard/mobile fit, explicit failure, uncertain response, unchanged follow-up/renewed consent, lost Start acknowledgement, archive and spectator isolation. Signing/ownership/candles are fixtures, not actual eligible-holder acceptance.

Reviewed [native modal semantics](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal), project-local Wrangler 4.136.1 help and [deployment command guidance](https://developers.cloudflare.com/workers/wrangler/commands/workers/). Frozen historical/paper/Tide/DNA and dependency/contract locks remain intact. WWAX is deferred; Vector Desk is separate. Safe Harbour remains an unenabled future brief. Next: real-holder acceptance and actual-device sharing feedback, then the ten-holder/five-interview/seven-day pilot and a decision on the separately versioned challenge.
