# Whale Pools current development status

Updated 6 October 2026. The deployed product is the free Historical Arcade v1 described in ARCADE.md. The holder journey and stacked sharing/challenge/pilot candidates are ready for draft review; neither has been deployed. WWAX remains deferred and undeployed. The founding paper season remains draft and requires a separate recorder/execution system.

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
