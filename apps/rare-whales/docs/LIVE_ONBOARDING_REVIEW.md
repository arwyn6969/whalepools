# Live onboarding and return review

7 October 2026. `codex/live-onboarding-return`, stacked on recap head `1750cfcb3aae94c7f2340d14df428bd69d69e983`. Implementation `a7f617c78ebe723cbf5814b0f6a23c9889e937a7`. Isolated staging only; production remains Historical Arcade v1.

Signing in from the fleet or Daily Tide now keeps the holder in that live journey. Navigation during an asynchronous wallet prompt is respected. Both pages expose sign-in, verified inventory progress and inline refresh/retry. A failed or delayed inventory disables publication and retains choices; it cannot be interpreted as an empty wallet. Historical sign-in keeps its existing destination.

Unpublished live setups save company name, ready-made style and chosen whales under `whale-pools-paper-draft-v1:<normalised wallet>:<exact 64-hex paper hash>`. They restore in the same browser for the same holder and rules. This namespace is separate from historical drafts. Consent, signatures, sessions, mutation IDs, generated DNA and results are excluded. Reload clears consent. An intentionally empty selection remains empty. A fresh setup defaults to up to three owned whales only after completed verification.

Transferred selections are removed only after complete verified inventory while the holder is on their own live setup. Name/style stay intact, replacements are never silently selected and the reason is shown. Public watch inspection and other pages never rewrite that setup. Wallet changes clear the displayed identity and restore only the next wallet's choices; late inventory responses cannot cross the switch. Unavailable storage retains valid choices in memory and explains that they will not survive closing the page. This is browser-local persistence, not cross-device sync.

Verification: 155 unit tests, frozen-integrity 23-asset build, all three actual workerd/D1 suites and isolated staging dry run pass. 73 browser fixture scenarios pass: 14 holder, 11 historical sharing/challenge/pilot, 11 paper, 10 social, 12 recap/share and 15 new live onboarding. The new scenarios cover private restoration/consent, A/B wallets, failure and bounded waiting, late responses, transfers/visitors, intentional empty crews, historical separation, storage denial, empty wallets, rejected signing, navigation during signing, direct Tide sign-in and inventory recovery. Desktop 1440×1000 and mobile 390×844 fixture and native layouts have no horizontal overflow; native console warning/error lists are empty. Native restored setup confirms the name/style/selected whales and unchecked consent. Fixtures use disposable signatures, simulated holdings and synthetic candles; no real eligible-wallet acceptance is claimed.

Staging version `65dd83cf-3ced-4c2d-9ff2-0f1e41e0908c` serves all 23 exact built assets. Three original v1 watch IDs/start times and queued `tide-34d4bb34b041-2026-10-08` remain intact. Six migrations remain applied; no migration, database restore, contract/dependency change or production release occurred. Code rollback is to `40a9e4cd-125e-41bf-8089-c31dadcb8cf8`; preserve populated D1 records. At 19:34 UTC the read-only preflight saw 71/71 actionable closes, zero gaps and a healthy recorder, but only ~0.247 days elapsed and no actual complete Tide. Launch readiness remains false.

Paper `e2a7f52280106d1b0a97080f821fab64bf8a3568b13fb63ce54e77f7b03c1b97`, Tide `34d4bb34b041fec00555ae10678bda9ee285558d2e16908d993450125425ec52`, historical `b5069275d96baf712744ba2b1bd6739d99d0aa7f8cf19fa288c3e3b7c31faeaa`, practice bytes and DNA v1 are unchanged. Server-side ownership checks remain authoritative. WWAX stays deferred; maintenance PR #1 and Vector Desk stay separate.

Restart and verify from this app directory:

```sh
npm run build:demo
RW_PORT=48383 RW_BASE_PATH=/whalepools RW_PAPER=1 RW_TIDE=1 RW_PAPER_DB=onboarding-paper.sqlite npm run dev
RW_FIXTURE_PORT=48384 RW_PAPER_FIXTURE=1 node --experimental-sqlite scripts/serve-fixture.mjs
node --experimental-sqlite scripts/check-live-onboarding.mjs
```

[Staging fleet](https://whale-pools-paper-staging.mrarwyn.workers.dev/whalepools/#paper), [local real-market preview](http://127.0.0.1:48383/whalepools/#paper), [disposable holder preview](http://127.0.0.1:48384/#paper). Local servers must be running. Exact heads/PR/CI, receipts and screenshots are saved in the planning workspace at `reviews/2026-10-07/live-onboarding-return/`.

[Real-holder acceptance](LIVE_LAUNCH_ACCEPTANCE.md) remains pending on the chosen desktop extension/mobile wallet browser: sign-in/inventory, historical publish/edit/withdraw, live Start/Stop/follow-up/archive and Tide pick. Also pending: actual complete UTC round, 7–14-day recorder evidence, intended share destination, maintenance/consent review and the ten-holder pilot. No recruitment or social messages were sent.

Following sprint: complete eligible-holder acceptance, then observe ten first-live-company holders with five interviews. Measure eight unaided starts, median creation below 180 seconds after inventory and five meaningful later-day returns over actual seven-day windows. Improve share/open and recap usefulness from that evidence; any new prospective challenge objective gets a separate version and preserves Daily Tide v1 records.
