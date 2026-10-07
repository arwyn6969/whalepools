# Whale Pools current development status

Updated 7 October 2026. Production remains the free Historical Arcade v1 described in ARCADE.md. The new Live Whale Fleet beta and its stacked holder/sharing candidates are deployed only to isolated staging for review. WWAX remains deferred and undeployed. The original founding paper season remains draft; this new beta has separate rules, start times and records.

## Live Whale Fleet beta candidate

Implementation `3251b6a`, branch `codex/live-paper-beta`, [draft PR #4](https://github.com/arwyn6969/whalepools/pull/4), stacked on sharing/challenge PR #3 at `c1a1ab0`. Three simplified preset styles use real arriving Hyperliquid spot UBTC/USDC five-minute data with $1,000 simulated capital. The server recorder/executor continues independently of browser polling, persists observed candles and atomic fill/state commits, and prevents late/backfilled pretend fills. Eligible holders choose owned whales without publishing a historical company first; ownership is checked at one block, Start requires public consent, and crew/DNA/rules/dates lock for fourteen days. Public inspection keeps private historical drafts intact. Dashboard positions, queued orders, waiting reasons, costs, recent chart and captain's log make each company's progress inspectable. Stop freezes a dated record; a new crew starts a new record. No real orders or funds exist.

120 tests, the 21-asset frozen-integrity build, both actual workerd/D1 runtime checks and dry run pass. The full 20-holder × 12-whale fixture capacity creates 240 fills across two ticks without duplicate execution. Fourteen holder, eleven sharing/challenge/pilot and eleven paper desktop/mobile fixture browser scenarios pass with zero uncaught errors. A transport timeout race surfaced in the existing inventory journey and now consistently gives the holder the correct bounded timeout message. Fixtures use disposable signatures, simulated ownership and synthetic market observations; they do not establish real eligible-holder acceptance. Normal in-app browser checks load the three real preset portraits, with no captured warning/error logs.

The inspected development backtest spans 23 September 12:40 UTC to 7 October 12:40 UTC exclusive, with saved checksum/warmup and the same cost/fill rules. Current Surfer returned -3.743%, Cannonball -1.851%, Reef Reclaimer -0.275%; all lost money. No holdout, optimisation or profitable edge is claimed. High turnover/costs and periods of inactivity are remaining product/research weaknesses. Historical frozen score hash remains `b5069275d96baf712744ba2b1bd6739d99d0aa7f8cf19fa288c3e3b7c31faeaa`, practice bytes and DNA v1 are unchanged.

[Public isolated staging](https://whale-pools-paper-staging.mrarwyn.workers.dev/whalepools/#paper) uses Worker `whale-pools-paper-staging`, D1 `7e7532e6-891f-4b29-bd80-752a1e311642`, no custom/production routes and enabled logs/traces. All five migrations were applied; a Time Travel restore removed a disposable recovery probe while preserving migrations, with no holders present. All 21 served asset bytes and unsigned/cross-origin rejection checks pass. Scheduled recorder startup/observation receipts are recorded in the dated planning review; a short startup check is not the required 7–14-day operational rehearsal.

[Local real-market preview](http://127.0.0.1:48377/whalepools/#paper) and [disposable synthetic fixture](http://127.0.0.1:48378/#paper) must have their servers running. Read [LIVE_PAPER_REVIEW.md](docs/LIVE_PAPER_REVIEW.md) for exact execution assumptions, research results, restart commands, staging recovery and outstanding acceptance. Final heads, screenshots, CI and remote receipts live in the planning workspace's `reviews/2026-10-07/live-paper-beta/`.

Before holder launch: real desktop extension/mobile wallet-browser signing, inventory, historical publish/edit/withdraw and paper Start/Stop/new-run; elapsed operational rehearsal; maintenance reconciliation; public record retention/consent review; and the ten-holder/five-interview/seven-day pilot. No real participants have been observed. Existing optional pilot events measure historical/share/challenge activity; add separately versioned live activation/return events before using it for this beta. Following sprint: dated live sharing/archive, a common-start separately versioned forward challenge, and a measurable holder pilot. Production release remains a separate decision.

## Holder journey candidate

Branch `codex/holder-company-journey`, based on main `46945f8a73469299e1bf70e67dd7218025b9aca2`. WP-02 and WP-03 are implemented as a review candidate: private drafts per wallet/exact rules, bounded inventory reads and recovery, restored-provider wallet switching, a four-step builder and read-only rival inspection. Publication uses atomic revisions to prevent late requests overwriting newer work, including after withdrawal. Migration `0004_arcade_revisions.sql` is additive and must be applied before a paired frontend/server release. Ownership verification and frozen scoring/DNA/data/ranks are preserved.

Verification: 98 tests, build:demo, actual Cloudflare workerd runtime and deployment dry run pass. Fourteen fixture browser scenarios pass on desktop 1440×1000 and mobile 390×844 with zero uncaught JavaScript errors. Fixture publish/edit/withdraw, rejected signatures, wrong chain, no holdings, transfer, incomplete history, waiting bounds, cross-tab conflicts and stale wallet responses are covered. Browser fixtures use disposable keys and simulated holdings; they do not establish real eligible-wallet signing.

Normal local preview: `http://127.0.0.1:48374/whalepools/`. Playable fixture preview: `http://127.0.0.1:48373/`. Servers must be running. Commands, integrity details, migration/rollback and acceptance checklist are in [the holder review](docs/HOLDER_JOURNEY_REVIEW.md). The Rare WHALES planning workspace saves the draft PR, committed heads, screenshots and exact evidence in reviews/2026-10-06.

## Sharing, challenge and pilot candidate

Branch `codex/share-challenge-pilot`, based on holder candidate `ec7fa3d` and stacked for separate review. WP-04 adds stable public company destinations, local comparisons and dated SVG cards. WP-05 adds the independently versioned Tidal Trio game: exactly three loaners, two reset historical episodes, a 0.25% drawdown budget and a lower-episode-return objective. WP-01 adds optional local pilot reports and an aggregate readout CLI; the ten-holder pilot and five interviews have not run.

106 tests, 19-asset build, actual workerd/D1 runtime and dry run pass. Fourteen existing and eleven new fixture browser scenarios pass at desktop 1440×1000 and mobile 390×844, with no uncaught errors. Frozen scoring, practice bytes, DNA v1, ownership checks and WWAX deferral remain intact. The challenge enumerates 1,280 legal choices: 537 clear the brief, six best ties, no universal return/drawdown dominator, and no Vector Magnet in the top 50. This is a disclosed inspected-history prototype, not demonstrated balance or trading skill.

Current normal preview: `http://127.0.0.1:48375/whalepools/#challenge`. Current disposable fixture preview: `http://127.0.0.1:48376/`. Read [NEXT_SPRINT_REVIEW.md](docs/NEXT_SPRINT_REVIEW.md) and [HOLDER_PILOT.md](docs/HOLDER_PILOT.md). Saved screenshots/evidence and committed PR details are in the Rare WHALES planning workspace under reviews/2026-10-06/sharing-challenge-pilot. No new migration, remote database, Worker deployment, invitation or social post was made.

## Separate maintenance candidate

PR #1 remains an open draft at `2342a40`, branch `codex/maintain-arcade-toolchain`. It updates Wrangler/Miniflare/Undici and reports zero advisories. This product branch intentionally retains main's lockfile; `npm ci` reproduces its three reported advisories. Review/merge the separate dependency candidate before release. No package/contract locks were changed in this sprint.

## Remaining acceptance and next work

1. Deploy the paired candidate to an isolated staging Worker/database, rehearse migration/rollback, and have a real eligible holder sign, publish, edit and withdraw on the chosen desktop extension and mobile wallet-browser route. Record actual RPC inventory/ownership snapshots and score equality. WalletConnect is not implemented. Production remains a separate authorised step.
2. Review the stacked company-sharing/challenge/pilot candidate after PR #2. Check real-device SVG/clipboard support and share links on isolated staging.
3. Evaluate challenge usefulness, especially Vector Magnet and choices that encourage repeat play, with holder feedback; keep any rules change separately versioned.
4. Recruit ten eligible first-company testers, collect five interviews and voluntarily exported local reports, and wait for the seven-day return readout.

The collector homepage remains the verified 3 October release. Vector Desk research is separate and untouched.
