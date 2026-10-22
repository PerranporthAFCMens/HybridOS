# One list of reports, no Report library tab (22 October 2026)

Gym touched: none (reads existing report data only; no database change, no new SQL).

- The separate "Report library" tab is gone. Its 28 reports are now cards inside the tab they belong to: Memberships (Membership & growth), Members (Lifecycle & retention), Classes (Classes & attendance), Payments (Revenue & payments) and a new Workouts & PT tab.
- Every card has the quiet Export (CSV, Excel, PDF) and a Show/Hide button. Opened, a card shows its own question if it has one (for example "Show birthdays"), a bar chart when the report is a short list of names with numbers, and the table (first 25 rows; exports have every row). Long lists such as logs and registers show the table only.
- Cards are collapsed to start with, so each tab stays a short list and nothing is calculated until a card is opened. Export works without opening a card.
- The bar-chart choice is `web/src/reports/reportView.ts` (unit tested): two to twelve rows, a name in the first column, first column of numbers.
- The file-format picker and "sheet of paper" preview of the old library are removed (the Report builder keeps its own).
- `browser/reports-library.mjs` was rewritten for the cards: all 28 present, bars, the options, 25-row preview, CSV/Excel/PDF exports, pence and formula protection, empty report.

Rollback: revert the PR.
