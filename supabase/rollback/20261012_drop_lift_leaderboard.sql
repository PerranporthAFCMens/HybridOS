-- Undo 20261012200000_lift_leaderboard.sql. Removes the ticked lifts, the gym's default switch and members' own choices.
-- Personal bests are not touched.
begin;
drop function if exists public.get_lift_leaderboard(uuid, text);
drop table if exists public.member_lift_choice;
drop table if exists public.gym_lift_settings;
drop table if exists public.tracked_lifts;
commit;
