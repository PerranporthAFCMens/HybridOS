-- Undo 20261016100000_staff_tables_access.sql. The Staff screen can no longer load the team again.
begin;
alter policy "staff view working hours" on public.staff_working_hours using (private.is_gym_member(gym_id));
revoke select, insert, update on table public.staff_working_hours from authenticated;
revoke select, insert, update on table public.staff_profiles from authenticated;
commit;
