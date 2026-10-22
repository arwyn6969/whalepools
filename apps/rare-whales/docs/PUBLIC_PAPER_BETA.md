# Public experimental paper beta · 22 October 2026

The owner requested a public release so people can try Whale Pools while real-wallet acceptance and longer recorder evidence are still incomplete. The public destination is https://arwyn.party/whalepools/. This supersedes the previous staging-only release decision; it does not certify investment performance or uninterrupted recording.

The first page is the live paper fleet. Everyone can inspect three neutral preset watches; an eligible Rare Whales or WhaleStreet holder can sign in and start a $1,000 simulated company. The existing limit is 20 active holder companies, each with up to 12 whales. The server records future observed five-minute UBTC/USDC candles and checks each minute with the browser closed. Missed/late observations remain visible and cannot create retrospective fills. Daily Tide queues the next midnight UTC round. Historical Arcade results remain separate and are retained.

## Deployment and preservation

Use the installed Wrangler and `wrangler.jsonc`. Production keeps Worker `whale-pools-demo`, D1 `whale-pools-arcade` (`4b6d5fb2-551f-4d19-9ead-299f6ab425f7`) and the four existing singular/plural routes. The production bundle is `build/paper-worker.mjs`, exporting both tested SQLite Durable Object classes. Production origin is `https://arwyn.party`; staging retains its own Worker, database and records. No staging results are imported into production. Paper and Tide rule identities remain unchanged.

A private SQL export and settings/routes snapshot are saved under ignored `work/public-beta/`. All six migration files are idempotent additions; production had no recorded migration history. The complete set was rehearsed against the SQL export with exact existing-row digests retained before applying remotely. This adds paper/Tide tables and the missing arcade revision table while preserving historical entries and sessions.

Validate the build, 234 unit/HTTP tests, all five workerd/D1/SQLite runtime suites and production dry run. The social runtime fixture controls its read and tick clocks, so its October sample does not expire according to the actual date. After deployment, compare settings/routes and historical row digests, then run:

```sh
node scripts/verify-public-beta.mjs https://arwyn.party/whalepools work/public-beta/production-verification.json --created-after=DEPLOY_ISO_TIME
```

The verifier requires three new production watches, a fresh recorder, a saved prospective observation, a queued UTC round, all 23 exact assets, production canonical links, public recap data and rejected unsigned/cross-origin/private reads. It does not simulate successful wallet acceptance. The first cron may take up to 15 minutes to propagate; inspect actual saved data rather than declaring success from a deployment response.

## Rollback

Do not roll directly to the former bundle that lacks the newly created Durable Object classes. Keep `build/paper-worker.mjs`, both class exports, bindings and migration tags. Set `PAPER_ENABLED=0`, `TIDE_ENABLED=0`, `RECORDER_MODE=paused` and redeploy. Plain landing then falls back to the historical arcade. Existing paper records and historical entries stay in D1. Do not reset/restore the database or erase recorded interruptions to make coverage look continuous.

## Remaining checks

Chrome with MetaMask desktop, then MetaMask mobile's in-app browser: sign in, inspect owned whales, Start a dated paper watch, observe a fresh saved close, Stop, begin a separate follow-up and inspect the private archive. Test a Daily Tide pick before midnight UTC. The signature proves wallet control; the application requests no transfer, approval or transaction. Do not bypass a wallet/browser security warning.

Real eligible-wallet and device acceptance remain unobserved. Seven consecutive clean completed UTC days and real pilot participation/returns remain unproven. The fresh 22 October staging check is healthy; its 20 October valuation-only close and 21 October renewal transition gap remain saved. Capacity was rehearsed at 20 holders × 12 whales × 3,800 history points; account-wide quota headroom and longer production load remain limited evidence. No paid plan change is part of this release.

## Verified public release

Production version `b7a9f644-50b9-4ada-aed9-07bcfa24a881`, source `1412f77ca6aba07cbbbd6f49392721208c2eac73`, is live. The new schedule began at 21:01:41 UTC (about six minutes after registration). All three new reference watches saved the 21:05 UTC close as actionable with zero gaps. The public verifier passes all 16 check groups, including 23 exact asset hashes, production previews/recaps, next UTC Tide queue and auth/origin guards. Exact historical/session row digests and every zone route are preserved. Release CI passed: https://github.com/arwyn6969/whalepools/actions/runs/39853191728. Browser inspection confirms the paper landing, persistent experimental label, connected feed, no desktop overflow and separate historical arcade. This short successful window does not establish continuous reliability or real-wallet acceptance.
