-- Undo 20261012180000_class_workouts.sql. Removes the class workouts table (and every class workout in it), the two
-- triggers, and the class link on finished workouts. People's own recorded sets are not touched.
begin;
drop trigger if exists class_workout_available_notification on public.class_session_workouts;
drop trigger if exists workout_session_class_member on public.workout_sessions;
drop function if exists private.notify_class_workout_available();
drop function if exists private.enforce_session_class();
drop index if exists public.workout_sessions_class_idx;
alter table public.workout_sessions drop column if exists class_session_id;
drop table if exists public.class_session_workouts;
delete from public.member_notifications where notification_type = 'class_workout';
commit;
