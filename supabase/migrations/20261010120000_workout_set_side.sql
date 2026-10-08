-- Left / Right / Both for a set (single-side exercises such as a one-arm row).
-- Adds one optional column. Nothing existing changes: every existing set has no side (null), the live front end
-- never mentions the column, and the existing row-level security on workout_sets applies to it unchanged.
begin;

alter table public.workout_sets
  add column if not exists side text;

alter table public.workout_sets
  drop constraint if exists workout_sets_side_check;
alter table public.workout_sets
  add constraint workout_sets_side_check check (side is null or side in ('left', 'right', 'both'));

commit;
