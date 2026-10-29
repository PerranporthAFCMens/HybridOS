-- Undo 20261029100000_gym_targets.sql. Removes the targets table (any targets saved since are lost). Nothing else is touched.
begin;
drop table if exists public.gym_targets;
commit;
