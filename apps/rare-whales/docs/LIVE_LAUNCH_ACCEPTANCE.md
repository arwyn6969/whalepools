# Live beta acceptance worksheet

Prepared 7 October 2026. **Not a production release approval.** The current evidence uses synthetic fixtures for signing/ownership and disposable databases. No real eligible-holder acceptance or pilot participant has been observed.

Use the isolated paper staging app. Keep wallets, session material, volunteered reports and participant contact mappings outside Git. Record only browser/device, UTC time, pass/fail, public watch/round URLs and anonymised failure descriptions. Never paste a signature or credential into the worksheet.

| Owner/eligible holder check | Expected experience | Current evidence |
| --- | --- | --- |
| Desktop wallet sign-in and inventory | One owned whale is sufficient; no transaction, transfer or WWAX step | Fixture pass; real holder pending |
| Mobile wallet sign-in and inventory | Chosen wallet returns to the app; eligible crew loads and remains usable | Responsive fixture/native rendering pass; real wallet handoff pending |
| Historical publish → edit → withdraw | Server rechecks ownership; stale writes rejected; dated historical labels remain clear | Unit/workerd/fixture pass; real holder pending |
| Draft reload, wallet switch and visitor inspection | Holder draft restores only for that wallet/rules; visitors cannot overwrite it | Fixture pass; real holder pending |
| Paper Start → new candle → daily recap | Consent and actual ownership confirmed; queued/fill/wait reason and UTC coverage understandable | Fixture and public real-price reads pass; real holder Start pending |
| Stop → new crew → archive | Stop freezes last valuation; both dated watches remain accessible to the owner | Fixture pass; real holder pending |
| Daily Tide pick | Owned badge, next UTC start and locked choice understood; no private-company mutation | Fixture pass; real holder pending |
| Share direct link, PNG/SVG and visitor opening | Dated snapshot differs visibly from updating public watch; mobile copy/download works | Browser PNG/SVG and server metadata pass; real device/destination pending |
| Complete actual UTC round | 288 timely, gap-free observations before any final ranks | Accelerated fixture pass; actual round pending |
| Recorder reliability | Review 7–14 days of fresh observations, gaps/outages and recovery; verify rollback preserves new records | Startup/short observation pass; elapsed rehearsal pending |
| Maintenance, consent and production review | Separate PR stack reviewed; explicit production release decision | Pending |

Before and after the real-wallet session run:

```sh
node scripts/live-readiness.mjs https://whale-pools-paper-staging.mrarwyn.workers.dev/whalepools/ /private/tmp/whale-readiness.json
```

This is a cookie-free, read-only preflight. It checks current feed/rules, original public preset watches, a dated preview, recap, visible complete rounds and watch age. Age alone does not prove continuous operation. It cannot verify holder signing, ownership UX, delivery to social platforms, the private archive, elapsed reliability, pilot participation or production readiness. `launchReady` stays false until a human release review reconciles these gates.

Pilot after acceptance: ten eligible holders who have not started a live company, private P01–P10 assignments, five interviews, and seven-day return windows. Target eight unaided starts, median creation under 180 seconds after inventory is ready, and five meaningful later-day returns. Opening/updating an owner recap after a newer observation is an explicit review; empty, failed and visitor reads do not qualify. No invitations have been sent. Preserve Daily Tide v1; propose a separately versioned prospective challenge only after the pilot identifies an enjoyable objective.
