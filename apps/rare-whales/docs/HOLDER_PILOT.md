# Holder pilot v1

Prepared 6 October 2026. No holders have been recruited or observed by this sprint. Fixture reports are software verification, not pilot results.

The organiser recruits ten eligible holders who will create their first company on the chosen isolated staging release. Assign P01–P10 privately; keep any contact/code mapping outside this repository. Give each person the preview and task brief, then observe without coaching. Five short interviews and an elapsed seven-day follow-up are required. Invitations and publication remain owner actions.

## Task brief for participants

Open the pilot page in the browser you will keep using. Select your assigned code and start a local report before creating your company. Use one holder wallet for this report. Sign in, choose whales and tactics, read the historical result, name your company, and publish. Explain what the return and drawdown mean in your own words. Inspect another company and return to your private crew. Download your public card or copy your link if you want to share it. Try the separate Tidal Trio challenge.

After at least one UTC calendar day, and within seven days of first publication, return and do something you find useful: export/copy your public share, complete a challenge attempt, or publish a company edit. Repeating page views alone does not qualify. A share event means obtaining a copy or card; it does not prove the link was posted or opened by anyone else. A completed challenge means running both episodes; it does not need to clear the brief.

Mark “I needed help” if anyone assisted your first company creation/publication. Export the JSON report and voluntarily send it through your usual contact with the organiser. Export again after the return visit; the organiser retains only the latest report for each code. Stop recording or erase the local report at any time. Local records expire after 30 days, have a 500-event cap and do not sync across browsers. No automatic invitation, upload or server analytics is involved.

## Readout and gates

Run `node scripts/pilot-readout.mjs /path/to/P01.json … /path/to/P10.json`. It validates and whitelists the report, refuses duplicate codes, and prints participant rows plus aggregate counts. Do not include fixture reports in the real readout. Store volunteered reports outside the public export and Git; delete them 30 days after collection. Record only aggregates and anonymised interview themes in the sprint review. Reports are client-side self-reports, not independently verified identity or attribution data.

| Measure | Definition | Proposed gate |
| --- | --- | --- |
| First activation | New-company inventory-ready event followed by confirmed first publication; no assistance flag | At least 8 of 10 unaided publishes |
| Creation time | First confirmed create minus first complete eligible inventory readiness; existing public companies excluded | Median unaided creation below 180,000 ms |
| Meaningful return | Sharing output, challenge completion or edit publication on a later UTC date, no later than seven days after first publication | At least 5 distinct holders |
| Recoverable errors | Inventory and public-write error events in volunteered reports | Explain causes and recovery; no invented target |
| Interviews | Five observed conversations after use | Five interviews with recurring reasons to return and points of confusion |

Missing reports remain missing participants. Do not calculate a ten-holder success rate from a smaller convenient sample. Allow the full return window before a final verdict. Starting a report after publishing does not establish first activation. One person using several codes, clearing storage or changing wallet/browser cannot be detected by this privacy-preserving recorder; resolve these cases through the organiser's voluntary observation.

Ask: “What made the company feel yours?”, “What did the historical result tell you?”, “When would you come back?”, “Which challenge choice was interesting?”, and “What confused you or required help?” Record participants' meaning, avoid prompts suggesting a preferred answer, and do not solicit trading/financial promises.

## Operator worksheet

Fill with observed facts only. Keep contact details and wallets elsewhere.

| Code | First task observed | Latest report received | Unaided | Seven-day window complete | Meaningful return | Interview |
| --- | --- | --- | --- | --- | --- | --- |
| P01 | | | | | | |
| P02 | | | | | | |
| P03 | | | | | | |
| P04 | | | | | | |
| P05 | | | | | | |
| P06 | | | | | | |
| P07 | | | | | | |
| P08 | | | | | | |
| P09 | | | | | | |
| P10 | | | | | | |

Before invitations, complete the real eligible-holder desktop/mobile acceptance and isolated migration/rollback rehearsal in [HOLDER_JOURNEY_REVIEW.md](HOLDER_JOURNEY_REVIEW.md). Production release is a separate decision.
