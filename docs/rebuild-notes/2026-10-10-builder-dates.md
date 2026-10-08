# Report builder: dates (2026-10-10)

- The builder has its own dates, separate from the page's date box (which is hidden on the builder tab). It loads all the gym's data and filters here.
- "for [Last 30 days ▾]" in the sentence opens "Choose dates": quick choices (Today, This week, Last week, This month, Last month, Last 30/90 days, Last 12 months, This year, Last year, All time), two dates (From and To, checked), and Compare with (the period before, or the same time last year).
- Comparing draws both periods on the chart (month 1 against month 1 for date groups, by name otherwise) and the headline figure shows the change against the earlier period. Not offered for lists, or when no dates are set. The ring is not offered when comparing.
- Each dataset says which date field it filters on (Members: Joined; Memberships: Starts; Payments: Charge date; Classes: Date; Bookings: Class date; Classes delivered and Clients seen: Date). Staff has no dates so no date choice.
- Ready-made reports open with sensible dates (income and joiners: last 12 months; others: last 90 days or all time).
- Saved reports keep their dates and comparison.
- Logic: `src/builder/period.ts` and `src/builder/compare.ts`, with tests. Weeks start on Monday; all dates are gym (UK) calendar days.
- Before this, the builder did not filter by the page's date range for most datasets; now what the sentence says is what is applied.
