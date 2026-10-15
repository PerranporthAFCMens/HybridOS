# Estate view, step A (15 October 2026)

For anyone who is **owner or admin of two or more gyms**: a new **Estate** line in the side menu (hidden for everyone else) opens `/estate`.

- A total across all their gyms, then a card per gym: members, active memberships, estimated monthly income, new members (last 30 days) and team headcount. "Open <gym>" switches to that gym's normal admin, where any change is made.
- Download the overview as CSV, Excel or PDF.
- Only gyms where the person is owner or admin are counted. Coaches and staff of a gym are not included.

**No database change.** Plain reads of `gym_members`, `memberships` and `membership_plans` under the person's own access in each gym, so nothing new can leak. Monthly income uses the same weekly/quarterly/annual-to-month rule as Today and Reports.

**Not in this step (still to do from the plan):** class fill and attendance, income collected and failed payments, coach teaching hours, comparison over time. Enterprise manager role (step B) needs new tables and the owner's approval of the exact SQL first.

Files: `web/src/estate/` (calc, screen, css), `web/src/data/estate.ts`, `web/tests/estate.test.ts`, route in `App.tsx`, menu line in `Shell.tsx`, one state in `web/browser/audit.mjs` (the audit user has one gym, so it shows the "two or more gyms" message; the populated view is covered by unit tests only).
