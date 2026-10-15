# PT clients: a PT sees only their own clients (2026-10-16)

Step 1 of the staff-login PT area (owner direction 15 October: simple, in the staff login, little burden on the PT). This step is the database only. The My clients screens come next.

## The rule
- A PT (a staff or coach login) sees, sets workouts for and replies to a member only if that member is **their client**. Owners and admins are unaffected; members are unaffected.
- A member is someone's client when the PT has them on their list (`pt_clients`), **or** the PT has a booked or completed personal training session with them (`pt_appointments`). So most lists fill themselves; a PT can also add or remove a client by hand.
- One gym switch, `gym_pt_settings.own_clients_only` (default on, and no row means on). Off = every PT sees every member, which is how it works today. Owners and admins change it.
- The rule lives in one place, `private.is_my_pt_client(gym, member)`, used by every staff rule below.

## What changes for staff and coach logins
Read of workout sessions, entries, sets and personal bests; setting workouts (`workout_assignments`); coach replies. Each was "any staff in the gym", now "my clients". Nothing else (classes, class workouts, leaderboard, members list) is touched.

## Effect when the SQL is run on a live gym
A staff or coach login stops seeing members' workouts unless the member is on their list or booked with them. Until the My clients screens exist, a PT cannot add a client by hand in the app, so run this together with, or just before, that screen, or switch `own_clients_only` off for the gym first.

## Files
- `supabase/migrations/20261016120000_pt_clients.sql` (tables, rule, session/entry/set/best/assignment rules) and `20261016121000_pt_clients_replies.sql` (reply rules; separate because the training rollback in CI rebuilds that table).
- `supabase/rollback/20261016_drop_pt_clients.sql` (restores the old staff rules exactly, drops both tables and the function).
- `supabase/verification/20261016_pt_clients_check.sql`, `supabase/tests/pt_clients.sql` (about 35 checks as owner, admin, staff, coach, members and another gym), CI step in `database-schema.yml`.
- `supabase/tests/training_feedback_loop.sql`: the two PT logins in its fixture are now m1's clients, since that test assumed any coach could see any member.

## Not done here
Personal bests are tightened the same way (a PT only sees their clients' bests); the lift leaderboard function is unchanged. The staff screens, the menu, and a settings control for the switch are later steps.
