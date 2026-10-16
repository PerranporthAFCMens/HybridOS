-- Programming library, part 3 of 3 (database): remember the level a member trained at, and which library movement an exercise was.
--
--   public.workout_sessions.level        'rx', 'scaled' or 'foundations' (or empty). Set when a member finishes a workout in the player.
--   public.workout_entries.movement_id   the library movement an exercise was, or empty. Old records stay empty and are still matched by name.
--
-- Nothing is deleted or rewritten. Existing workouts keep their names, and personal bests stay keyed by the lower-cased name, which is
-- exactly the movement's own key, so bests already line up with movements without any change.
-- A trigger refuses a link to a movement from another gym.
--
-- Rollback: supabase/rollback/20261016_drop_workout_level_and_movement_link.sql (drops the trigger, function and two columns).
begin;

alter table public.workout_sessions
  add column level text check (level is null or level in ('rx', 'scaled', 'foundations'));

alter table public.workout_entries
  add column movement_id uuid references public.movements(id) on delete set null;

create index workout_entries_movement_idx on public.workout_entries (movement_id) where movement_id is not null;

create function private.check_entry_movement_gym() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.movement_id is not null and not exists (
    select 1 from public.movements m where m.id = new.movement_id and m.gym_id = new.gym_id
  ) then
    raise exception 'That movement belongs to another gym' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.check_entry_movement_gym() from public, anon, authenticated;

create trigger workout_entries_movement_gym before insert or update of movement_id, gym_id on public.workout_entries
  for each row execute function private.check_entry_movement_gym();

commit;
