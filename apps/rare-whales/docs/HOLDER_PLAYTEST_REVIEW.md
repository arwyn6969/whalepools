# Holder playtest desk

Prepared 9 October 2026. This sprint prepares observed sessions; it does not claim that a session, interview or pilot has happened. Safe Harbour stays an unenabled concept. Production, frozen rules, ownership, recorder resources and dependency locks are unchanged.

The loopback-only desk shows Daily Tide and the separately versioned `safe-harbour-concept-v1` invitation side by side. Odd/even assigned codes alternate their order. It explains live data, simulated money, one day versus three, fees/spot assumptions, partial coverage, the proposed 1% fall-from-peak budget and no-qualifier outcome. No score, challenge executor, join form or extra public asset is added.

Use the exact application candidate currently served by staging. Build first, then start the private desk:

```sh
npm run build
node scripts/serve-playtest.mjs a7c2175f49484a8023fc49d54483602f6e7ae698 https://whale-pools-paper-staging.mrarwyn.workers.dev/whalepools/
```

Open `http://127.0.0.1:48395/`. The desk binds only `127.0.0.1`, rejects foreign Host headers, serves a small explicit allowlist, permits only GET/HEAD, uses no-store/CSP, and has no upload, analytics, wallet or API write route. Its context is the supplied forty-character application commit and built paper/Tide hashes. A kit-only commit does not require a new staging application deployment: the application candidate remains PR #13 at the head above. Recheck staged bytes and health before observing people.

Begin a rehearsal to exercise the form. Start a fresh session with an assigned anonymous code before observing a person. Obtain voluntary consent, mark an observed session, and record the actual chosen device/browser and actions. Completed rehearsal checks cannot be relabelled as a holder session. Only that device's eight acceptance journeys can be marked; the other device and operator review stay pending. A sharing pass requires inspecting delivery in the chosen destination, beyond the share sheet/download. A failure needs a bounded anonymous theme. Ask about preference, reason to return and confusion without coaching; record `undecided` or `neither` honestly.

The form lives only in memory and refresh clears it. Explicit downloads export the private session and/or the existing-format acceptance worksheet. No existing draft, bookmark or live pilot report is touched. Keep exports, contact mappings and detailed interviews outside Git. Exports contain code, device, plain browser/version, times, bounded themes and manual checks; private extra fields are rejected by the readout. Delete exports thirty days after collection. The validator enforces thirty-day expiry, but cannot erase downloaded files or establish that a declaration is true.

Aggregate one latest private interview session per assigned holder (maximum ten):

```sh
node scripts/playtest-readout.mjs a7c2175f49484a8023fc49d54483602f6e7ae698 https://whale-pools-paper-staging.mrarwyn.workers.dev/whalepools/ /private/path/P01-private-playtest.json
```

No input files produces a truthful zero-session readout. Rehearsals never count as observed interviews, deliveries or real acceptance. Duplicate codes, wrong context/version, future dates, expired reports and extra private fields are rejected. Counts are manual observations, not verified identity or delivery. Preference does not count as seven-day retention and never automatically enables a challenge or approves launch. Desktop/mobile worksheets for one person can be reviewed independently with `scripts/holder-acceptance.mjs`; they are not duplicate interview participants.

Before the ten-holder pilot: finish real desktop/mobile signing, verified inventory, historical publish/edit/withdraw and score equality, private draft isolation, paper Start/new close/recap/Stop/follow-up/archive, Tide pick understanding and destination sharing. Operator maintenance/consent, deployed Free capacity, an actual qualified Tide and 7–14 days of recorder evidence remain separate. See [organiser pack](LIVE_PILOT_ORGANISER_PACK.md), [acceptance](LIVE_LAUNCH_ACCEPTANCE.md), [prospective brief](PROSPECTIVE_CHALLENGE_BRIEF.md) and [return measurement](LIVE_HOLDER_PILOT.md).

Choose the next implementation from five observed interviews plus actual sharing/return behaviour. If Safe Harbour wins a defensible product decision, lock a new prospective rules version, test full/partial/tie/no-qualifier cases and use future-only joins after reliability and real-holder gates. The 1% budget remains proposed game design, not a tuned or demonstrated trading objective.

Rollback for the kit: stop the local process or return to the previous commit. No remote deployment, database migration/reset, subscription or public record change is required.
