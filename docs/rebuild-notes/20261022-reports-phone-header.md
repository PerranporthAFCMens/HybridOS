# Reports header on phones (22 October 2026)

Gym touched: none (screen layout only; no database change).

- The Reporting title, date range and Refresh button were squeezed into the top corner on a phone. Under 600px the title now has the full width and the date range and Refresh share one row beneath it.
- The hint now says "Tap or click".
- `web/browser/audit.mjs` now also opens every Reports tab, Payments, Training, Lifts, Class setup and three member pages (15 new screens) at 320, 390 and 1280px. All pass.

Noticed, not changed: nine report tabs sit behind one dropdown on phones; the shared `.page-top` header (in `today.css`) may cramp other screens the same way, to be checked next.

Rollback: revert the PR.
