-- Lets the signed-in team read and save staff details and working hours.
--
-- This project removes table access from signed-in users on purpose (20260930000000_live_schema_baseline.sql leaves the
-- `authenticated` role only REFERENCES, TRIGGER and TRUNCATE on these two tables). The Staff screen, the class checks, the staff
-- reports and the old staff pages all read and write them straight from the browser, so every call failed with
-- "permission denied for table staff_profiles": the Staff screen said "Could not load the team" and "Add staff login" did nothing.
--
-- This grants only what those screens use: read, add and change (no delete). Row Level Security still decides WHICH rows:
--   staff_profiles       owners and admins manage them; a team member reads their own; a pending admin reads them (unchanged).
--   staff_working_hours  owners and admins manage them (unchanged). The read policy said "any active member of the gym", which would
--                        have let ordinary members read the team's hours the moment the table was readable at all; it now says the team.
-- Nothing is granted to the public (`anon`).
-- Undo: supabase/rollback/20261016_revoke_staff_tables_access.sql
grant select, insert, update on table public.staff_profiles to authenticated;
grant select, insert, update on table public.staff_working_hours to authenticated;

alter policy "staff view working hours" on public.staff_working_hours
  using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role]));
