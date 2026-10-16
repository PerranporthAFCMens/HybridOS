-- Rollback for 20261016160000_workout_level_and_movement_link.sql. Drops only what that migration added.
-- Note: this deletes the saved levels and movement links (they exist nowhere else).
begin;
drop trigger if exists workout_entries_movement_gym on public.workout_entries;
drop function if exists private.check_entry_movement_gym();
drop index if exists public.workout_entries_movement_idx;
alter table public.workout_entries drop column if exists movement_id;
alter table public.workout_sessions drop column if exists level;
commit;
