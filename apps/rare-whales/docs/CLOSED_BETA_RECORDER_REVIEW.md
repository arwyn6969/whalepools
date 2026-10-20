# Closed paper beta: recorder and capacity review

Updated 20 October 2026. Implementation `ba2d82b`, isolated staging version `a3f8596a-c37a-4be4-8986-8463329b1f8a`, on the existing draft [PR #15](https://github.com/arwyn6969/whalepools/pull/15). Production remains the historical arcade. Real-holder acceptance and the seven-clean-day rehearsal remain open.

## Recorder recovery

The former recorder committed each company separately. An injected D1 failure after an early commit reproduces mixed actionable observations across the three references. The operational recorder now commits company states, event ledger and feed success in one transaction. Revision/Stop guards and a recorder-lease guard reject stale writes; uncertain responses recover from saved truth without repeating fills. Receipt insertion and event persistence use bounded JSON inputs. A 20-holder/12-whale fill tick uses 41 total D1 statements in the cloud rehearsal.

Saved history stays outside the frozen engine's repeated cloning. Regression comparisons prove identical state/event bytes at 3,800/4,032 saved points and twelve-close catch-up boundaries. Late data remains valuation-only; no historical fill is created.

The original hashed `paper-service.mjs`, engine/feed/DNA/ownership sources, Paper hash `e2a7f522…`, Tide hash `34d4bb34…` and dependency locks remain unchanged. New operational modules and the Git commit identify this implementation separately from frozen v1 provenance. Diagnostics record phase, close/delay and aggregate commit counts, not session or wallet contents.

This fixes a demonstrated failure mode. It does not establish the precise cause of the 20 October incident. The current OAuth grant cannot query historical observability logs; future phase logs and saved coverage must be correlated.

## Prospective reference renewal

Original 14-day watches retain their IDs, dates and history. Once all three have completed and expired, one guarded atomic statement creates a new dated prospective cohort. Concurrency, failure and lost acknowledgements cannot create a second cohort. Bootstrap/transition gaps remain visible. API reads select the newest cohort and expose bounded earlier metadata; original direct links remain valid. Coverage selects the cohort active at each close. Readiness now checks actual seven-day saved evidence rather than watch age.

## Capacity and read execution

Long-history dashboard reads had 7–24 ms HTTP CPU in the first cloud proof, despite successful responses. Compact SQL projections preserve exact public bodies/stats and reduce transferred history. Sixteen stateless `PaperReadExecutor` shards now execute the five paper GET routes, retaining the same authentication/origin checks. Responses stream through the HTTP Worker. Mutations use the existing service. No private cache, session storage, alarms or trading state is added to these readers.

Only `wrangler.paper.jsonc` adds `PAPER_READS`, `PAPER_READ_MODE=durable-object` and additive SQLite class migration `paper-reads-sqlite-v1`. Existing recorder namespace/migration, D1 ID, cron, routes, compatibility date and billing are preserved. Normal production configuration stays unchanged. Missing binding/unknown mode fails closed; direct mode is explicit.

A guarded disposable cloud Worker and separate synthetic D1 exercised 10 and 20 holders × 12 whales, 3,800 fractional points per watch, 120/240 fills, signed/anonymous/public reads, ten-watch archive pagination and concurrent clients. Largest state: 538,870 bytes, larger than the observed live reference state. Every client response/body check passed; 20-client p95 wall latency was 3.22 seconds. Two captured outer paper reads used at most 3 ms CPU. This is a bounded sample, not continuous capacity or account-wide daily quota proof. The larger computation uses the separate DO CPU budget; [current limits](https://developers.cloudflare.com/durable-objects/platform/limits/) and [pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) remain constraints.

Six read RPC traces were canceled without exceptions after full HTTP 200 body validation. Post-response context disposal is an inference supported by [RPC lifecycle documentation](https://developers.cloudflare.com/workers/runtime-apis/rpc/lifecycle/). Judge HTTP/body success, recorder phase completion and saved coverage separately.

## Validation and rollout

234 unit/HTTP tests, build/demo, five compiled workerd/D1/SQLite DO suites and both packaging dry runs pass. [CI passes](https://github.com/arwyn6969/whalepools/actions/runs/39440082170). Staging serves all 23 exact public asset hashes and rejects unauthorized/cross-origin operations. Original records and 831 overlapping saved points match the pre-release snapshot; the 15 October four late receipts/five valuation-only decisions remain visible. A real 14:40 UTC close committed all three references as actionable in one transaction; the bounded live window peaked at 43 ms recorder CPU. A settings comparison caught Wrangler defaulting query-string redaction off; it was restored to the saved baseline and pinned explicitly in staging configuration before handoff. Existing bindings and all observability settings now match the baseline, plus the intended reader binding/mode. No real wallet was connected or signed by this work.

Full cloud reports, sanitized CPU evidence, preservation and fresh readiness are in the planning workspace at `reviews/2026-10-20/closed-beta-recorder/`. Raw logs and generated secrets stay outside Git. Disposable cloud resources are removed after evidence preservation.

## Operator and wallet next steps

Keep the current bundle, both exported DO classes, bindings and migration history when pausing or reverting. To pause future recording, deploy this compatible candidate with `--config wrangler.paper.jsonc --var RECORDER_MODE:paused`. Do not roll back directly to a pre-reader-class bundle or restore/delete D1 to hide interruptions. Code rollback does not roll back data. Reverting implementation requires a separately verified compatible bundle.

MetaMask issue #303173 closed on 19 October with a resolved response; actual desktop/mobile retest remains required. Begin on the existing paper staging URL in desktop Chrome/MetaMask, chain 4663. The expected sign-in is wallet-control-only, with no gas, transfer or approval. Then observe inventory, Start/new close/recap, cancel/confirm Stop, follow-up/archive, Tide and actual sharing destination. Keep real acceptance worksheets private and tied to the deployed implementation.

After acceptance and reliability/quota review, run the ten-holder pilot: eight unaided starts, median under 180 seconds after inventory readiness, five interviews and five meaningful later-day returns, with every seven-day window elapsed. No invitations or pilot outcomes are claimed.
