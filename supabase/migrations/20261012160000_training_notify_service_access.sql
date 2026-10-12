-- Lets the notify-training Edge Function read what it needs to email a client about their workouts.
--
-- This project removes the service role's table access on purpose (20260930000000_live_schema_baseline.sql leaves it only
-- REFERENCES, TRIGGER and TRUNCATE, plus SELECT on a few tables). The function runs as the service role, so without this every
-- call would fail with "permission denied", as finalise-signature did before 20261011210000. It grants only what the function
-- reads, and nothing is written:
--   workout_assignments: id, gym_id, member_user_id, title, assigned_by, source, created_at, workout_snapshot (for the coach's note)
--   workout_assignment_feedback: everything (id, gym_id, assignment_id, author_id, body, created_at)
-- (it already reads gym_members, profiles, gym_communication_settings and the id and name of gyms)
-- Undo: supabase/rollback/20261012_revoke_training_notify_service_access.sql
grant select (id, gym_id, member_user_id, title, assigned_by, source, created_at, workout_snapshot) on table public.workout_assignments to service_role;
grant select on table public.workout_assignment_feedback to service_role;
