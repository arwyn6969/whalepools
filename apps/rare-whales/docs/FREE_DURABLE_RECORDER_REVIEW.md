# Free-plan Durable Object recorder review · 8 October 2026

The owner chose the Free-plan route before committing to a subscription and accepts labelled downtime during the proof. This candidate moves the existing market/preset/Tide execution into a SQLite-backed Durable Object. No strategy, scoring, receipt grace, ownership policy or historical record is rewritten.

## Execution boundary

The minute cron now makes one small private RPC call. One object coordinates this market and exact paper/Tide hashes; the object is not a gateway for holder requests. The unchanged engine reads/writes the same isolated D1 database. The object sleeps between calls: no repeating timer, alarm, polling browser or public execution endpoint is required.

Its only stored value is a compact checkpoint. Concurrent RPCs share a promise; a completed current minute suppresses later duplicate calls, including after eviction/restart. Failure/busy is never recorded as completion. Two attempts per current UTC minute are allowed; the next scheduled minute gets a fresh bounded budget. Trigger timestamps are diagnostics, never a replay clock. D1 leases, revisions and atomic ledgers remain authoritative if a process ends between its engine commit and checkpoint write. Late closes can value records but never create catch-up fills.

Missing Durable Object binding or unknown mode fails closed. `RECORDER_MODE=paused` stops future scheduled execution. Only an explicit `direct` mode (or a legacy configuration without the setting) uses the old ordinary Worker path. There is no automatic fall-back into the known 10 ms problem.

The normal production bundle/configuration remain separate. Only `build/paper-worker.mjs` exports PaperRecorder; `wrangler.paper.jsonc` binds it, selects durable-object mode and declares additive namespace migration `recorder-sqlite-v1` with `new_sqlite_classes`. This is not a D1 data migration or restore. The six D1 migrations, original watch IDs/dates and existing partial Tide records must remain intact.

## Verification and scope

172 unit tests, frozen 23-asset build and four workerd/D1 runtime suites are required. The new compiled staging suite exercises real SQLite-backed DO RPC, duplicate calls, 20 × 12 whale crews and 240 fills, 3,800 saved closes per holder, complete runtime restart, two failed retries, next-minute recovery and downtime without retrospective fills. Its market, wallet ownership and clock are fixtures. Its wall time does not establish deployed Free-plan CPU capacity or a real eligible holder's signing.

The planning review folder `reviews/2026-10-08/free-durable-recorder/` records exact committed PR/CI heads, deployment, Free-plan screenshot, native desktop/mobile, read-only preservation and real scheduled observation evidence. Short live verification is separate from seven consecutive clean UTC days, an actual complete Tide and real-holder acceptance.

## Cost and acceptance

The account was checked in the normal Cloudflare dashboard: Workers Free is current, $0. No subscription, billing setting, paid capacity or limit change is part of this candidate. Cloudflare supports SQLite-backed DOs on Free with a documented 30-second default CPU allowance; free usage limits fail rather than creating an automatic paid subscription. Confirm account-wide usage during the rehearsal before increasing holders.

Nominally the cron fires 1,440 times/day. Duplicate delivered calls still consume request quota; at most two engine attempts/current minute bounds execution to 2,880 daily attempts. We use one small checkpoint and existing D1. DO daily requests, active duration, row reads/writes and storage, D1's separate daily quotas, and ordinary API CPU remain launch constraints. This small proof does not establish unlimited free capacity.

Authoritative references: [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [DO CPU/limits](https://developers.cloudflare.com/durable-objects/platform/limits/), [RPC](https://developers.cloudflare.com/durable-objects/best-practices/create-durable-object-stubs-and-send-requests/), [class exports/migrations](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/) and [rollback limitations](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/).

## Restart and rollback

Run `npm run build:demo`, `npm test`, `npm run test:runtime` and `npx wrangler deploy --dry-run --config wrangler.paper.jsonc`. Real local market preview: `RW_PAPER=1 RW_TIDE=1 RW_PAPER_DB=durable-preview.sqlite RW_BASE_PATH=/whalepools RW_PORT=48387 node --experimental-sqlite scripts/serve.mjs`. This Node preview uses its local scheduler and separate SQLite file; it does not prove the DO runtime. Disposable holder fixture: `RW_PAPER_FIXTURE=1 RW_FIXTURE_PORT=48388 node --experimental-sqlite scripts/serve-fixture.mjs`.

Deploy only the named isolated staging configuration after verification. It has no production routes and D1 `7e7532e6-891f-4b29-bd80-752a1e311642`.

To pause staging safely, deploy the same bundle/bindings/migration with `npx wrangler deploy --config wrangler.paper.jsonc --var RECORDER_MODE:paused`. To test the old path explicitly, use `--var RECORDER_MODE:direct`; it retains the earlier CPU risk. Restore normal operation with the ordinary staging deployment. Keep the namespace/class export and migration while reverting logic. Do not roll back to the old pre-namespace deployment or delete the object/data to disguise interruption. Cloudflare code rollback does not restore connected data. Keep partial runs and inspect the saved-day evidence.

Production and billing require separate decisions. Real signing/inventory, historical publish/edit/withdraw, paper Start/Stop/follow-up/archive/Tide picks, device/share acceptance, maintenance/consent and measured ten-holder pilot remain open. No real pilot participants or invitations are claimed. WWAX is deferred and Vector Desk untouched.
