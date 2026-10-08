# Report library as a sheet of paper (9 October 2026)

**Branch `report-paper`. New `/next/` app only; no database changes. Status: on a branch (PR open). Changes the existing `reports-library.mjs` browser check, so the owner merges.**

Owner request: the Report library (a wall of 24 cards with View, CSV, Excel and PDF buttons on each) was "horrible". It is now one screen: **choose a report from a dropdown** (grouped: Membership & growth, Lifecycle & retention, Classes & attendance, Revenue & payments, Workouts & PT), **choose CSV, Excel or PDF**, see **what you will get on a sheet of paper** (gym, title, period, row count, the first 25 rows), and press **Download**. The file name is shown before you download. The download always has every row, not just the 25 on the paper; a report with nothing in it switches the button off and says why. The period is the date box at the top of the page.

Nothing about the reports themselves or the files changed (same 24 reports, same CSV/Excel/PDF files, same protection against spreadsheet formulas in names).

**The report builder (Power BI / Salesforce-style: pick a dataset, drag in fields, group, filter, choose a chart, save) is a separate, next piece** and is not part of this.

Checked: type check, lint, 318 unit tests, build, all browser checks at 390px and 1280px including real CSV, Excel and PDF downloads and the layout audit.
