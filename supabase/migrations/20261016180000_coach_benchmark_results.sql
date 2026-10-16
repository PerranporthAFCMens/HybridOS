-- Block benchmarks, part 3 (database): an owner/admin switch for coaches seeing members' results, and the function behind the coach view.
--
--   public.gym_benchmark_settings         one row per gym. coaches_see_results is false until an owner or admin turns it on (no row = off).
--                                         Members can read it, so the member screen can say when coaches can see their results.
--   public.get_block_benchmark_results    for one block, the exercises its booked members recorded inside the test weeks of the block's benchmarks,
--                                         one row per set. The app works out start, end and change from them with the same rules the member sees.
--                                         Returns nothing unless the switch is on and the caller is an owner, admin, staff or coach of that gym.
--                                         Members are the people with a booking (not cancelled) on a class in the block.
-- Members still cannot read each other's workouts directly; this function is the only way and it is switched off by default.
-- Rollback: supabase/rollback/20261016_drop_coach_benchmark_results.sql
begin;

create table public.gym_benchmark_settings (
  gym_id uuid primary key references public.gyms(id) on delete cascade,
  coaches_see_results boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references public.profiles(id) on delete set null
);
alter table public.gym_benchmark_settings enable row level security;
revoke all on table public.gym_benchmark_settings from anon, authenticated, service_role;
grant select, insert, update on table public.gym_benchmark_settings to authenticated;

create policy "owners admins manage benchmark settings" on public.gym_benchmark_settings for all to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]))
  with check (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));
create policy "members read benchmark settings" on public.gym_benchmark_settings for select to authenticated
  using (private.is_gym_member(gym_id));

create function public.get_block_benchmark_results(p_block_id uuid)
returns table (
  user_id uuid, display_name text, benchmark_id uuid, exercise_name text, movement_id uuid, tracking_type text, day date,
  weight_kg numeric, reps integer, duration_seconds integer, distance_m numeric, calories numeric
)
  language plpgsql stable security definer set search_path = ''
as $$
declare me uuid := auth.uid(); g uuid;
begin
  if me is null then raise exception 'Sign in first'; end if;
  select b.gym_id into g from public.class_blocks b where b.id = p_block_id;
  if g is null then return; end if;
  if not private.has_gym_role(g, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role, 'staff'::public.gym_member_role, 'coach'::public.gym_member_role]) then return; end if;
  if not coalesce((select s.coaches_see_results from public.gym_benchmark_settings s where s.gym_id = g), false) then return; end if;
  return query
  with people as (
    select distinct cb.user_id
      from public.class_bookings cb
      join public.class_block_sessions cbs on cbs.session_id = cb.session_id and cbs.block_id = p_block_id
     where cb.gym_id = g and cb.status <> 'cancelled'
  )
  select p.user_id,
         coalesce(nullif(btrim(coalesce(nullif(btrim(pr.first_name), ''), '') || ' ' || coalesce(left(nullif(btrim(pr.last_name), ''), 1) || '.', '')), ''), nullif(btrim(pr.display_name), ''), 'Member'),
         bm.id, e.exercise_name, e.movement_id, e.tracking_type, (ws.performed_at at time zone 'Europe/London')::date,
         st.weight_kg, st.reps, st.duration_seconds, st.distance_m, st.calories
    from people p
    join public.profiles pr on pr.id = p.user_id
    join public.block_benchmarks bm on bm.block_id = p_block_id
    join public.movements mv on mv.id = bm.movement_id
    join public.workout_sessions ws on ws.user_id = p.user_id and ws.gym_id = g
    join public.workout_entries e on e.session_id = ws.id
    join public.workout_sets st on st.entry_id = e.id
   where (e.movement_id = bm.movement_id or lower(btrim(e.exercise_name)) = lower(btrim(mv.name)))
     and (
       (ws.performed_at at time zone 'Europe/London')::date between bm.test_start_on and bm.test_start_on + 6
       or (ws.performed_at at time zone 'Europe/London')::date between bm.test_end_on and bm.test_end_on + 6
     )
   order by 2, 1, 7;
end $$;
revoke all on function public.get_block_benchmark_results(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_block_benchmark_results(uuid) to authenticated;

commit;
