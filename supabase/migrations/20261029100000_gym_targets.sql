-- Targets: monthly goals for the whole gym and for each staff member.
-- Gym touched: all gyms (per-gym table; Puffin Performance is the test gym, Hybrid Hub has no rows until an owner sets one).
--
-- What this adds:
--   gym_targets   one row per goal. user_id is empty for a gym-wide goal, or a staff member for their own goal.
--                 metric says what is counted, target_value is the monthly amount (income is in pence).
--                 Gym-wide metrics: income_pence, members_joined, active_members.
--                 Staff metrics:    classes_taught, pt_sessions.
--                 One value per gym/person/metric; it applies to every month until changed.
-- Who can do what: owners and admins read and change every target. A coach or staff member can read their OWN targets only.
--   Members cannot see this table at all.
-- It changes nothing else.
-- Undo: supabase/rollback/20261029_drop_gym_targets.sql

create table public.gym_targets (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  metric text not null,
  target_value integer not null,
  updated_by uuid default auth.uid() references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint gym_targets_metric check (metric in ('income_pence', 'members_joined', 'active_members', 'classes_taught', 'pt_sessions')),
  constraint gym_targets_value check (target_value >= 0 and target_value <= 100000000),
  constraint gym_targets_who check (
    (user_id is null and metric in ('income_pence', 'members_joined', 'active_members'))
    or (user_id is not null and metric in ('classes_taught', 'pt_sessions'))
  ),
  constraint gym_targets_one_each unique nulls not distinct (gym_id, user_id, metric)
);

-- A fresh local database hands new tables to every role; the live project does not. Say exactly what is wanted.
revoke all on table public.gym_targets from anon, authenticated;
grant select, insert, update, delete on table public.gym_targets to authenticated;

alter table public.gym_targets enable row level security;

create policy "owners admins manage targets" on public.gym_targets for all to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]))
  with check (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));
create policy "team read own targets" on public.gym_targets for select to authenticated
  using (user_id = (select auth.uid()) and private.has_gym_role(gym_id, array['staff'::public.gym_member_role, 'coach'::public.gym_member_role]));
