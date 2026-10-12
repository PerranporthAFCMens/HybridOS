-- Undo 20261012160000_training_notify_service_access.sql. The notify-training function stops working again.
begin;
revoke select on table public.workout_assignment_feedback from service_role;
revoke select (id, gym_id, member_user_id, title, assigned_by, source, created_at, workout_snapshot) on table public.workout_assignments from service_role;
commit;
