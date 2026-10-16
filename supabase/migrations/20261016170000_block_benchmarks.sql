-- Benchmarks and progress, part 1 of 3: the database. No screen changes yet.
--
-- A benchmark is a movement a block tests twice: at the start and at the end ("1 km row, tested week 1 and week 6").
--
--   public.block_benchmarks   one row per block per movement, with the day the start test opens, the day the end test opens,
--                             and whether a higher or a lower result is better (time: lower; weight, reps, distance: higher).
--                             Owners and admins set them up; every member of the gym can read them.
--
-- There is no results table. A member's result is simply the workout they record with that movement (workout_entries), picked out by
-- name and date, so nothing is entered twice and every earlier workout already counts as history. Members only ever see their own.
--
-- Rollback: supabase/rollback/20261016_drop_block_benchmarks.sql (drops the table; nothing else depends on it).
begin;

create table public.block_benchmarks (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  block_id uuid not null references public.class_blocks(id) on delete cascade,
  movement_id uuid not null references public.movements(id) on delete restrict,
  test_start_on date not null,
  test_end_on date not null,
  better text not null default 'higher' check (better in ('higher', 'lower')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint block_benchmarks_block_movement_unique unique (block_id, movement_id),
  constraint block_benchmarks_dates_check check (test_end_on > test_start_on)
);
create index block_benchmarks_gym_idx on public.block_benchmarks (gym_id, block_id);

alter table public.block_benchmarks enable row level security;
-- A fresh local database hands new tables to every role; the live project does not. Say exactly what is wanted.
revoke all on table public.block_benchmarks from anon, authenticated, service_role;
grant select, insert, update, delete on table public.block_benchmarks to authenticated;

create policy "members read block benchmarks" on public.block_benchmarks for select to authenticated
  using (private.is_gym_member(gym_id));
-- The block and the movement must both belong to the benchmark's own gym, so one gym cannot write into another's.
create policy "owners admins manage block benchmarks" on public.block_benchmarks for all to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]))
  with check (
    private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role])
    and exists (select 1 from public.class_blocks b where b.id = block_id and b.gym_id = block_benchmarks.gym_id)
    and exists (select 1 from public.movements m where m.id = movement_id and m.gym_id = block_benchmarks.gym_id)
  );

commit;
