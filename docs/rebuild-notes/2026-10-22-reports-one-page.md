# Reports: one summary and one list

Gym touched: none specifically (screen change only; tested with Puffin Performance data). No database change.

## What changed
- The Reports page is now ONE page: a plain-English story sentence, four figure tiles, the charts, a "Needs a look" box, then ONE list of all 35 reports in five groups (Money, Members, Classes, Coaches and training, Your own).
- Gone: the section dropdown, the Overview, the separate Business summary tab, the Report library idea.
- Period is a row of buttons (30 days, 90 days, 12 months, all time) kept in the web address (`?p=`), so it can be bookmarked.
- Opening a report swaps the page for that report (`?r=<report>`), with "← All reports" at the top. Old links (`?tab=owed` etc.) still land on the right report.
- Each of the 28 library reports has its own page: chart first, table second, small Export (CSV, Excel, PDF).
- The story sentence is worked out from the figures: failed payments and members leaving first, then big moves against the period before. Wording is fixed, the numbers are real; blank when there is no data.
- Tiles show change against the period before ("▲ 12% on the 30 days before"), by loading twice the period.

## Not done here (next PRs)
- The shared "run a report" layout (story, comparison chart, breakdown) for each report.
- Targets for the business and for staff (needs a new table; SQL to be run by Adam).

## Tests
- `summary.test.ts`: story sentence, comparison and earlier-range figures.
- Browser: `reports`, `reports-library`, `reports-drill`, `builder`, `owed`, and the layout audit now use the one list (helper `browser/reportNav.mjs`). The drill-down/export checks moved from the removed Overview to the summary's plan ring.
