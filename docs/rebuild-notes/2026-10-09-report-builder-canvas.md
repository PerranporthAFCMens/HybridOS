# Report builder: canvas, ready-made reports, click-to-dig, staff metrics (9 October 2026)

**Branch `builder-canvas`. New `/next/` app only; reads only; no database changes. Status: on a branch (PR open). Changes existing browser checks and test helpers (new data fields), so the owner merges.**

Owner feedback on the first version: "a little underwhelming" (it felt like a form). Asked for: drag fields onto it, ready-made starting points, dashboards, click a bar to dig in and a bolder look; and staff metrics (working hours, clients seen, classes delivered). Done in this pull request: everything except dashboards (the next step).

- **Canvas:** a list of fields down the side; drag a field (or tap it and choose where it goes) into **Group by**, **Values**, **Columns** and **Filters**. The visual redraws as you go. Headline figure tiles sit above a big chart; the sheet of paper and the download are below.
- **Twelve ready-made reports** (one click): money in by month, failed payments, members by plan, monthly value by plan, busiest days, attendance by class, new members by month, booking outcomes, classes delivered by coach, hours delivered by coach, clients seen by coach, scheduled working hours. A test checks every one only uses fields that exist.
- **Click a bar, column, line point or ring slice** to see the rows behind it, and **Filter the report to this** to narrow the whole report down to it.
- **Staff datasets:** *Staff* (role, days and scheduled hours a week from their working-hours setup, hourly pay marked personal), *Classes delivered* (one row per class per coach: hours, lead or assistant, how many came) and *Clients seen* (each attended class booking for each coach on it, plus personal training sessions). New figure **Different values** so "clients seen" counts different people, not visits.
- The Reports data load now also reads the team list, staff profiles, working hours and which staff are on each class (read only).

**Not possible yet, and said plainly:** *hours actually worked* (clock in and out, timesheets) does not exist in HybridOne, so "working hours" here are the hours each person is **scheduled** to work plus the class and PT hours they **delivered**. Real worked hours would need a new feature (a database table for time records). **Dashboards** (several saved reports on one page) are next. Reports saved for the whole gym still need a new table and the owner's approval of exact SQL.

Checked: type check, lint, 345 unit tests, build, all browser checks at 390px and 1280px including drag and drop, real downloads and saved reports, layout audit at 320px.
