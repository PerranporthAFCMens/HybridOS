# Report builder, first version (9 October 2026)

**Branch `report-builder`. New `/next/` app only; reads only; no database changes. Status: on a branch (PR open). Adds a tab to Reports, changes the existing `reports-library.mjs` check (eight tabs) and the layout audit, so the owner merges.**

Owner request: "a bit like Power BI / Salesforce reports: pull reports and let you build them", shown on a sheet of paper with a download.

New tab **Reports > Report builder**:
1. **What do you want to look at?** Members, Memberships, Payments, Classes, Bookings and attendance (five datasets made from the data the Reports already load).
2. **How to show it:** *List the rows* (choose and order the columns) or *Summarise* (group by a field, and work out figures: number of rows, total, average, lowest, highest; up to four figures; dates can be grouped by month or by day).
3. **Only include rows where…** any number of filters (text: is / is not / contains / empty; numbers and money (typed in pounds): equals / more than / less than; dates: on or after / on or before).
4. **Show as:** Table, Columns, Bars, Line or Ring (for a grouped summary).
5. The result is shown as **a chart and a sheet of paper** (the table that will be downloaded), then **Download** as CSV, Excel or PDF (every row, not just the 25 on the paper; charts are not part of the file).
6. **Save** a report with a name; saved reports stay on this device (per gym) and come back after a reload.

**Safety:** the owner can only pick from the fixed list of fields each dataset offers; nothing typed is ever run as a database command. Personal details (age band, gender) are marked "personal" and are only in the Members dataset (the Reports are owner and admin only). Same protection as the other downloads against spreadsheet formulas in names. Dates are the gym's UK calendar day; money is in pence internally and shown in pounds.

**Not yet (agreed order):** reports saved for the whole gym (needs a new table and the owner's approval of exact SQL); drag and drop on desktop (tap to add works everywhere); coaches' own cut-down version (owners and admins only for now); PT sessions and workout datasets; clicking a chart bar to see its rows.

Checked: type check, lint, 338 unit tests (20 new for the builder rules), build, all browser checks at 390px and 1280px including real CSV, Excel and PDF downloads and saved reports surviving a reload, layout audit at 320px.
