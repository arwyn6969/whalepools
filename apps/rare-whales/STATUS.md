# Whale Pools current development status

Updated 6 October 2026. The deployed product is the free Historical Arcade v1 described in ARCADE.md. The holder journey candidate is ready for draft review; it has not been deployed. WWAX remains deferred and undeployed. The founding paper season remains draft and requires a separate recorder/execution system.

## Holder journey candidate

Branch `codex/holder-company-journey`, based on main `46945f8a73469299e1bf70e67dd7218025b9aca2`. WP-02 and WP-03 are implemented as a review candidate: private drafts per wallet/exact rules, bounded inventory reads and recovery, restored-provider wallet switching, a four-step builder and read-only rival inspection. Publication uses atomic revisions to prevent late requests overwriting newer work, including after withdrawal. Migration `0004_arcade_revisions.sql` is additive and must be applied before a paired frontend/server release. Ownership verification and frozen scoring/DNA/data/ranks are preserved.

Verification: 98 tests, build:demo, actual Cloudflare workerd runtime and deployment dry run pass. Fourteen fixture browser scenarios pass on desktop 1440×1000 and mobile 390×844 with zero uncaught JavaScript errors. Fixture publish/edit/withdraw, rejected signatures, wrong chain, no holdings, transfer, incomplete history, waiting bounds, cross-tab conflicts and stale wallet responses are covered. Browser fixtures use disposable keys and simulated holdings; they do not establish real eligible-wallet signing.

Normal local preview: `http://127.0.0.1:48374/whalepools/`. Playable fixture preview: `http://127.0.0.1:48373/`. Servers must be running. Commands, integrity details, migration/rollback and acceptance checklist are in [the holder review](docs/HOLDER_JOURNEY_REVIEW.md). The Rare WHALES planning workspace saves the draft PR, committed heads, screenshots and exact evidence in reviews/2026-10-06.

## Separate maintenance candidate

PR #1 remains an open draft at `2342a40`, branch `codex/maintain-arcade-toolchain`. It updates Wrangler/Miniflare/Undici and reports zero advisories. This product branch intentionally retains main's lockfile; `npm ci` reproduces its three reported advisories. Review/merge the separate dependency candidate before release. No package/contract locks were changed in this sprint.

## Remaining acceptance and next work

1. Deploy the paired candidate to an isolated staging Worker/database, rehearse migration/rollback, and have a real eligible holder sign, publish, edit and withdraw on the chosen desktop extension and mobile wallet-browser route. Record actual RPC inventory/ownership snapshots and score equality. WalletConnect is not implemented. Production remains a separate authorised step.
2. Add stable public company links and a share card, preserving unpublished drafts and historical labels.
3. Prototype a separately versioned challenge with contrasting historical episodes and an explicit risk objective; leave the v1 board and DNA intact.
4. Define minimal activation/error/return measurement and run a ten-holder pilot with five interviews and an elapsed seven-day return readout.

The collector homepage remains the verified 3 October release. Vector Desk research is separate and untouched.
