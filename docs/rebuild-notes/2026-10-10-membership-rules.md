# Membership rules (database step, 2026-10-10)

Owner asks: members can change their name, email and password on the Me tab (done, separate PR); gym-software membership rules for pause, cancel and increase, set per gym by an owner or admin. Decisions: each of pause, cancel and change plan can be automatic or need an admin (owner's choice per rule); first version includes pause (length, notice, limit per year), cancel (notice, minimum term, offer a pause first), upgrade and downgrade between chosen plans, and fees on pause or early cancellation.

## What the SQL does
Files: `supabase/migrations/20261010150000_membership_rules.sql` (rollback `supabase/rollback/20261010_drop_membership_rules.sql`, check `supabase/verification/20261010_membership_rules_check.sql`, tests `supabase/tests/membership_rules.sql`, optional daily job `supabase/verification/20261010_membership_rules_schedule.sql`). NOT applied to the live database; the owner runs it.

- `membership_rules`: one row per gym. Everything starts OFF (a gym with no row can do nothing new). Owners and admins read and write it; members read the effects through a function.
- `membership_plans.members_can_switch_to`: set per plan; only ticked plans can be switched to.
- `membership_requests`: every pause, cancel and plan change, with dates, reason, fee, the rules as they were at the time, who decided and when. Members read their own; owners and admins read their gym's; nobody writes directly.
- Functions (checked in the database, so the screen cannot bypass a rule): `get_my_membership_options`, `request_membership_pause`, `request_membership_cancel`, `request_membership_change`, `withdraw_membership_request`, `decide_membership_request`, and `apply_due_membership_requests` (scheduler only).
- Rules: pause needs notice days, a length between min and max weeks, and at most N a year; cancel needs notice, and a minimum term (leave when the term ends, or leave after notice and pay a fee: owner's choice); plan changes only between ticked plans, up or down as allowed, from now or the first of next month, with a minimum time between changes. Each can be automatic or wait for an admin.
- Approved requests start on their date (pause: status paused, then active again; cancel: cancelled with the last day recorded; change: the plan moves). This happens whenever a member opens their options or an admin decides, and daily if the owner switches on pg_cron (optional file).

## Honest limits
- Payments are collected by GoCardless and are not connected: a pause or cancellation changes the membership and access here, but someone at the gym still stops, restarts or changes the direct debit. Fees are recorded on the request; collecting them is the gym's.
- "Next billing date" is not known to the app, so "next month" means the first of the next calendar month.
- Rolling back removes the request history but does not undo memberships already paused or cancelled.

## Checks
Run on a scratch Postgres with the whole migration history: migration applies, re-applies cleanly after rollback, rollback leaves nothing behind, 10 verification rows all ok, 95 persona checks pass (owner, admin, staff, members, another gym's admin, anonymous). The CI workflow's expected counts are updated to 65 tables, 102 functions, 173 policies, 26 triggers, and it runs the verification, the tests and a rollback/re-apply proof.

## Next (after the owner runs the SQL)
Admin: Settings › Membership rules, a "members can switch to this plan" box on each plan, a Requests list with Approve and Decline. Member: Me › Membership with Pause, Change plan, Cancel as in the approved design.
