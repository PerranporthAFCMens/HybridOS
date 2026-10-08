-- Undo 20261010120000_workout_set_side.sql. Removes the column and any sides recorded in it.
begin;
alter table public.workout_sets drop constraint if exists workout_sets_side_check;
alter table public.workout_sets drop column if exists side;
commit;
