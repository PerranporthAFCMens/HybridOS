-- PT clients: a PT (staff or coach) sees and sets workouts only for their own clients.
-- Applies to Puffin Performance and Hybrid Hub alike (the rule is per gym).
--
-- What this adds:
--   pt_clients          a PT's list of clients (one row per PT and member). Owners and admins can edit anyone's list; a PT
--                       edits only their own rows. A member is ALSO a client of a PT automatically while that PT has a
--                       booked or completed personal training session with them (pt_appointments), so most lists fill themselves.
--   gym_pt_settings    one row per gym with ONE switch: own_clients_only. true = a PT sees only their own clients (the default,
--                       and what no row means); false = every PT sees every member (how it works today). Owners and admins set it.
--   private.is_my_pt_client(gym, member)   the one rule everything below uses: true for owners and admins of the gym; for a staff
--                       or coach login true if the switch is off, or the member is on their list, or they have a session booked/done.
-- What it changes (staff and coach only; owners, admins and the members themselves keep exactly what they have):
--   the staff read rules on workout_sessions, workout_entries, workout_sets and personal_bests, and the staff rule on
--   workout_assignments, now ask is_my_pt_client for that member. (The coach replies get the same rule in the next file,
--   20261016121000_pt_clients_replies.sql, kept apart because that table can be dropped and rebuilt by its own rollback.)
-- Effect on the live gyms once run: a staff or coach login stops seeing members' workouts unless the member is their client.
-- Rollback: supabase/rollback/20261016_drop_pt_clients.sql (puts the old staff rules back exactly).

create table public.pt_clients (
  gym_id uuid not null references public.gyms(id) on delete cascade,
  staff_user_id uuid not null references public.profiles(id) on delete cascade,
  client_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  primary key (gym_id, staff_user_id, client_user_id),
  constraint pt_clients_not_self check (staff_user_id <> client_user_id)
);
create index pt_clients_client_idx on public.pt_clients (gym_id, client_user_id);

create table public.gym_pt_settings (
  gym_id uuid primary key references public.gyms(id) on delete cascade,
  own_clients_only boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references public.profiles(id) on delete set null
);

-- A fresh local database hands new tables to every role; the live project does not. Say exactly what is wanted.
revoke all on table public.pt_clients from anon, authenticated;
revoke all on table public.gym_pt_settings from anon, authenticated;
grant select, insert, delete on table public.pt_clients to authenticated;
grant select, insert, update on table public.gym_pt_settings to authenticated;

alter table public.pt_clients enable row level security;
alter table public.gym_pt_settings enable row level security;

-- The rule. SECURITY DEFINER so it can read the lists; it only ever answers for the signed-in person.
create function private.is_my_pt_client(p_gym_id uuid, p_member_id uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select case
    when private.has_gym_role(p_gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]) then true
    when not private.has_gym_role(p_gym_id, array['staff'::public.gym_member_role, 'coach'::public.gym_member_role]) then false
    when not coalesce((select s.own_clients_only from public.gym_pt_settings s where s.gym_id = p_gym_id), true) then true
    else exists (select 1 from public.pt_clients c where c.gym_id = p_gym_id and c.staff_user_id = (select auth.uid()) and c.client_user_id = p_member_id)
      or exists (select 1 from public.pt_appointments a where a.gym_id = p_gym_id and a.staff_user_id = (select auth.uid())
                 and a.member_user_id = p_member_id and a.status in ('booked', 'completed'))
  end
$$;
revoke all on function private.is_my_pt_client(uuid, uuid) from public, anon, authenticated, service_role;
-- Row rules run as the signed-in person, so they need to be able to call it (like private.has_gym_role); it is in the private schema, so the app cannot call it as an API.
grant execute on function private.is_my_pt_client(uuid, uuid) to authenticated;

-- pt_clients: owners and admins manage everyone's; a PT reads and manages their own rows, for active members of the gym.
create policy "pt clients read" on public.pt_clients for select to authenticated
  using (
    private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role])
    or (staff_user_id = (select auth.uid()) and private.has_gym_role(gym_id, array['staff'::public.gym_member_role, 'coach'::public.gym_member_role]))
    or client_user_id = (select auth.uid())
  );
create policy "pt clients add" on public.pt_clients for insert to authenticated
  with check (
    (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role])
      or (staff_user_id = (select auth.uid()) and private.has_gym_role(gym_id, array['staff'::public.gym_member_role, 'coach'::public.gym_member_role])))
    and exists (select 1 from public.gym_members gm where gm.gym_id = pt_clients.gym_id and gm.user_id = pt_clients.client_user_id and gm.is_active)
    and exists (select 1 from public.gym_members gm where gm.gym_id = pt_clients.gym_id and gm.user_id = pt_clients.staff_user_id and gm.is_active
                and gm.role in ('owner', 'admin', 'staff', 'coach'))
  );
create policy "pt clients remove" on public.pt_clients for delete to authenticated
  using (
    private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role])
    or (staff_user_id = (select auth.uid()) and private.has_gym_role(gym_id, array['staff'::public.gym_member_role, 'coach'::public.gym_member_role]))
  );

-- The switch: staff and coaches can read it (so the app can word things), only owners and admins change it.
create policy "pt settings read" on public.gym_pt_settings for select to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role, 'staff'::public.gym_member_role, 'coach'::public.gym_member_role]));
create policy "pt settings add" on public.gym_pt_settings for insert to authenticated
  with check (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));
create policy "pt settings change" on public.gym_pt_settings for update to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]))
  with check (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));

-- Tighten the staff rules. Each old rule is dropped and rewritten asking is_my_pt_client; the member rules are untouched.
drop policy "staff_view_gym_workout_sessions" on public.workout_sessions;
create policy "staff_view_gym_workout_sessions" on public.workout_sessions for select to authenticated
  using (private.is_my_pt_client(gym_id, user_id));

drop policy "staff_view_gym_workout_entries" on public.workout_entries;
create policy "staff_view_gym_workout_entries" on public.workout_entries for select to authenticated
  using (private.is_my_pt_client(gym_id, user_id));

drop policy "staff_view_sets_for_gym_entries" on public.workout_sets;
create policy "staff_view_sets_for_gym_entries" on public.workout_sets for select to authenticated
  using (exists (select 1 from public.workout_entries we where we.id = workout_sets.entry_id and private.is_my_pt_client(we.gym_id, we.user_id)));

drop policy "staff_view_gym_personal_bests" on public.personal_bests;
create policy "staff_view_gym_personal_bests" on public.personal_bests for select to authenticated
  using (private.is_my_pt_client(gym_id, user_id));

drop policy "staff manage member workout assignments" on public.workout_assignments;
create policy "staff manage member workout assignments" on public.workout_assignments for all to authenticated
  using (private.is_my_pt_client(gym_id, member_user_id))
  with check (
    private.is_my_pt_client(gym_id, member_user_id)
    and exists (select 1 from public.gym_members gm where gm.gym_id = workout_assignments.gym_id and gm.user_id = workout_assignments.member_user_id and gm.is_active)
  );
