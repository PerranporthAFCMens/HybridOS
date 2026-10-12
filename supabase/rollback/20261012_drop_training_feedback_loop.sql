-- Undo 20261012140000_training_feedback_loop.sql. Removes the feedback table, the two notification triggers and the new
-- columns (with whatever was recorded in them), and the ownership check on workout sessions.
begin;
drop trigger if exists workout_feedback_notification on public.workout_assignment_feedback;
drop trigger if exists workout_assigned_notification on public.workout_assignments;
drop function if exists private.notify_workout_feedback();
drop function if exists private.notify_workout_assigned();
revoke update (read_at) on table public.member_notifications from authenticated;
revoke select on table public.member_notifications from authenticated;
alter table public.member_notifications drop column if exists related_assignment_id;
drop table if exists public.workout_assignment_feedback;
alter table public.workout_assignments drop constraint if exists workout_assignments_result_check;
alter table public.workout_assignments drop column if exists feedback_seen_at;
alter table public.workout_assignments drop column if exists result;
drop trigger if exists workout_session_assignment_owner on public.workout_sessions;
drop function if exists private.enforce_session_assignment();
drop index if exists public.workout_sessions_assignment_idx;
alter table public.workout_sessions drop column if exists assignment_id;
commit;
