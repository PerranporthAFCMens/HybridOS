-- Undo 20261012190000_class_blocks_and_leaderboard.sql. Removes blocks (and which classes were in them), the score choice
-- on class workouts, the per-workout and per-member "show my score" choices, and the leaderboard function. Recorded sets are not touched.
begin;
drop function if exists public.get_class_leaderboard(uuid);
drop table if exists public.member_score_settings;
alter table public.workout_sessions drop column if exists share_score;
alter table public.class_session_workouts drop constraint if exists class_session_workouts_score_pair;
alter table public.class_session_workouts drop column if exists score_metric;
alter table public.class_session_workouts drop column if exists score_exercise;
drop trigger if exists class_block_session_in_range on public.class_block_sessions;
drop function if exists private.enforce_block_session();
drop table if exists public.class_block_sessions;
drop table if exists public.class_blocks;
commit;
