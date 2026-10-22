# Tide outcome sharing · 9 October 2026

Candidate `codex/tide-outcome-sharing`, stacked on return-story head `30fb96c`. A finished shared watch now explains what happened, whether its coverage qualifies for final ranks, and how to choose the next UTC Tide. Running, queued, paused and interrupted records have distinct plain-language stories. A holder's confirmed pick is shown as locked; ended rounds no longer show an expired pick form. Previous finished records remain discoverable.

Each round has a canonical `/tide/<id>` destination with dated server metadata and a readable no-JavaScript result. It loads the requested record even outside the seven recent rounds and stays on Tide while default company data arrives. Public reads use no holder identity and cannot change private historical/live drafts or return bookmarks. The existing server ownership and pick locks are unchanged.

Explicit sharing offers a native sheet with cancellation/copy/manual recovery, a selectable dated link, and PNG/SVG snapshots of all three actual saved balances, UTC dates, rules and coverage. Only qualified completed rounds show server ranks, preserving ties. Downloaded cards freeze the displayed snapshot; links can update while a round unfolds. Marked balances include modeled costs and open positions, with no invented closing fills or realized-profit claim. Metadata uses the existing generic live-paper cover, not an invented outcome image.

Wallet, route and round changes discard stale share feedback and optional measurements. A failed refresh keeps the last displayed record and retry controls. Sharing uses only the existing opt-in `live_shared` event after a successful action; it does not establish activation, meaningful review or a return. No new report fields or pilot version.

## Verification

211 unit tests, the frozen 23-asset build, four actual workerd/D1/SQLite Durable Object runtime suites, staging and production packaging dry runs, and all 143 desktop/mobile fixture browser scenarios pass. That is fifteen new Tide scenarios plus the previous 128 regressions: 14 holder journey, 11 historical sharing/challenge, 11 paper, 10 social, 12 recap, 15 onboarding, 14 recorder, 14 saved-day sharing, 13 holder controls and 14 return-story checks.

New coverage exercises direct and archived destinations, queued/partial/complete/tied/paused stories, expired-form hiding, next/previous discovery, public private-state isolation, actual card values/PNG bytes, share cancellation and permission failures, manual fallback, late navigation/wallet changes, refresh outage and no-JavaScript results. The compiled compressed Worker verifies GET/HEAD, method/ID/origin/error handling, metadata, prefix rewriting and unchanged records. Desktop 1440×1000/mobile 390×844 fit without overflow. Native browser confirms copy feedback and a PNG download; its clipboard API returned empty, so exact copied bytes are established by the browser fixture rather than native clipboard inspection. Native OS sharing is simulated; actual destination delivery remains open.

Fixtures use disposable signing/ownership/candles. The new Tide presentation fixture seeds saved synthetic snapshots, including a complete tie; that is UI coverage, not a real executed round. Existing executor/runtime tests separately cover the engine and 20 holders × 12 whales/240 fills/3,800 closes. The measured DO tick is local wall time, not Cloudflare CPU or remote Free capacity evidence. No real eligible-holder signing or pilot enjoyment is claimed.

Exact commit, PR, CI, staging receipts, screenshots and commands are recorded in planning `reviews/2026-10-09/tide-outcome-sharing/`. No frozen historical/paper/Tide/DNA/ownership/engine, dependency/contract lock, recorder configuration, migration, reset/restore, billing or production change. WWAX stays deferred; Vector Desk and concurrent REAL WHALES planning stay separate.

## Real rehearsal and remaining gates

At the initial 9 October 11:37 UTC read, the first real Tide (`tide-34d4bb34b041-2026-10-08`) had finished with partial coverage: 271/288 saved timely observations and thirteen counted gaps per preset, no final ranks. Separately, the reference-watch diary has 274 actionable and fourteen valuation-only closes; the receipt ledger contains 287 timely and one late receipt. These are distinct execution records. The full UTC window elapsed, but it is not a fully qualified complete round. Today had 139/139 actionable closes so far; feed health and a partial clean day do not close reliability acceptance. Original watch IDs/start dates and interruptions remain intact. Final remote observations are saved with their own timestamps.

Still required: real desktop extension/mobile wallet-browser signing and inventory; historical publish/edit/withdraw; paper Start/Stop/follow-up/archive/Tide pick; holder understanding of check-ins, locked picks and outcomes; actual share destination; maintenance/retention/consent review; deployed Free quotas/cohort capacity; consecutive clean full days, a qualified Tide and seven-to-fourteen-day rehearsal. Regenerate the eighteen-check acceptance template against this exact commit/environment; all checks begin pending. Zero real pilot participants, invitations or posts are claimed. Production remains a separate decision.

## Previews and rollback

Build with `npm run build:demo`.

Real-price local preview:

```sh
RW_PAPER=1 RW_TIDE=1 RW_PAPER_DB=tide-outcome-preview.sqlite RW_BASE_PATH=/whalepools RW_PORT=48393 node --experimental-sqlite scripts/serve.mjs
```

Disposable presentation preview:

```sh
RW_FIXTURE_PORT=48394 node --experimental-sqlite scripts/serve-tide-fixture.mjs
```

Open `http://127.0.0.1:48394/tide/tide-34d4bb34b041-2026-10-08`; the fixture toolbar identifies the simulation. Local Node scheduling is not Durable Object proof.

Only code is uploaded to existing Worker `whale-pools-paper-staging`, D1 `7e7532e6-891f-4b29-bd80-752a1e311642`, existing SQLite namespace/migration `recorder-sqlite-v1`, unchanged vars and minute cron. Verify original watches/dates, Tide windows, rules, coverage and exact served assets. Roll back code to PR #12 head `30fb96c` / staging version `be350e9e-8cce-4b45-be3f-e4f4eecfb318`, preserving D1/DO records and private local state. No new data migration accompanies this candidate.

Used project-local Wrangler 4.136.1 help and current official [deployment commands](https://developers.cloudflare.com/workers/wrangler/commands/workers/) and [Workers deployment roles](https://developers.cloudflare.com/workers/authorization/workers/#wrangler). Next: observe a real holder choosing, returning to and sharing a Tide; keep the separately versioned Safe Harbour challenge brief unenabled until its appeal is tested; then run the prepared ten-holder/five-interview/seven-day pilot with explicit consent and voluntary reports.
