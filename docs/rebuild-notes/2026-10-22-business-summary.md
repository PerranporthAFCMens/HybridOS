# Business summary report (22 October 2026)

Gym touched: none (reads existing report data only; no database change, no new SQL).

- New first tab on the Reporting page, "Business summary", and the page now opens on it. The old Overview is still there as its own tab.
- Top: income collected, monthly income expected (from today's memberships), active members, and member growth (joined minus left). Then a "Needs a look" list (failed payments and the money not collected, more members leaving than joining, classes under a third full). Then four charts (income, members over time, joined and left, memberships by plan), each opening the rows behind it. Class figures (fill, attendances, no-show rate) are at the bottom on purpose.
- Export (CSV, Excel, PDF) gives one row per measure.
- Figures live in `web/src/reports/summary.ts` with unit tests in `web/tests/summary.test.ts`.
- Browser checks that assumed Overview was the first tab now open `?tab=overview`; the "nine tabs" check now expects ten.

Not done: comparison with the previous period (the report library only loads the chosen range, so it cannot see the period before).

Rollback: revert the PR.
