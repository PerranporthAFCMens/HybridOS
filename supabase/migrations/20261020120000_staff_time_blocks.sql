-- Staff time off: coaches and PTs block out their own time, owners add blocks and gym-wide closed days.
-- Gym touched: all gyms (the tables are per gym; Puffin Performance is the test gym, Hybrid Hub has no rows until someone adds one).
--
-- What this adds:
--   staff_time_blocks   one row per block: who, from, to, reason. A coach or PT adds and removes their OWN blocks with
--                       immediate effect (no approval). Owners and admins can add, change and remove anyone's.
--   gym_closed_days     whole days the gym is closed (bank holidays, events). Owners and admins manage; the team can read.
--   private.staff_time_off_reason(gym, user, from, to)   'closed' | 'blocked' | null. The one rule both checks below use.
-- What it changes:
--   public.validate_class_schedule  gets one extra check per selected staff member (closed day or blocked time). Everything
--                                   else in the function is unchanged, line for line.
--   pt_appointments                 a trigger refuses a BOOKED appointment that falls in a blocked time or closed day.
-- It does NOT cancel or move anything already booked. Members cannot see the new tables.
-- Not in this piece: repeating blocks, the calendar screen, the "classes affected" list (later pull requests).
-- Undo: supabase/rollback/20261020_drop_staff_time_blocks.sql

create table public.staff_time_blocks (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  kind text not null default 'blocked',
  reason text,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint staff_time_blocks_order check (ends_at > starts_at),
  constraint staff_time_blocks_kind check (kind in ('blocked', 'leave', 'sick', 'other')),
  constraint staff_time_blocks_reason_len check (reason is null or char_length(reason) <= 200)
);
create index staff_time_blocks_lookup on public.staff_time_blocks (gym_id, user_id, starts_at, ends_at);

create table public.gym_closed_days (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  closed_on date not null,
  reason text,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint gym_closed_days_one_per_day unique (gym_id, closed_on),
  constraint gym_closed_days_reason_len check (reason is null or char_length(reason) <= 200)
);

-- A fresh local database hands new tables to every role; the live project does not. Say exactly what is wanted.
revoke all on table public.staff_time_blocks from anon, authenticated;
revoke all on table public.gym_closed_days from anon, authenticated;
grant select, insert, update, delete on table public.staff_time_blocks to authenticated;
grant select, insert, delete on table public.gym_closed_days to authenticated;

alter table public.staff_time_blocks enable row level security;
alter table public.gym_closed_days enable row level security;

create policy "owners admins manage time blocks" on public.staff_time_blocks for all to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]))
  with check (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));
create policy "team manage own time blocks" on public.staff_time_blocks for all to authenticated
  using (user_id = (select auth.uid()) and private.has_gym_role(gym_id, array['staff'::public.gym_member_role, 'coach'::public.gym_member_role]))
  with check (user_id = (select auth.uid()) and private.has_gym_role(gym_id, array['staff'::public.gym_member_role, 'coach'::public.gym_member_role]));

create policy "owners admins manage closed days" on public.gym_closed_days for all to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]))
  with check (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));
create policy "team view closed days" on public.gym_closed_days for select to authenticated
  using (private.has_gym_role(gym_id, array['staff'::public.gym_member_role, 'coach'::public.gym_member_role]));

-- The shared rule. SECURITY DEFINER so a booking check can read the lists whoever is signed in; it only answers
-- 'closed', 'blocked' or nothing about a time and exposes nothing else. It is in the private schema, so the app cannot call it as an API.
create function private.staff_time_off_reason(p_gym_id uuid, p_user_id uuid, p_starts_at timestamptz, p_ends_at timestamptz)
  returns text language sql stable security definer set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.gym_closed_days d
      where d.gym_id = p_gym_id
        and d.closed_on >= (p_starts_at at time zone coalesce((select g.timezone from public.gyms g where g.id = p_gym_id), 'Europe/London'))::date
        and d.closed_on <= ((p_ends_at - interval '1 microsecond') at time zone coalesce((select g.timezone from public.gyms g where g.id = p_gym_id), 'Europe/London'))::date
    ) then 'closed'
    when exists (
      select 1 from public.staff_time_blocks b
      where b.gym_id = p_gym_id and b.user_id = p_user_id
        and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
    ) then 'blocked'
    else null
  end
$$;
revoke all on function private.staff_time_off_reason(uuid, uuid, timestamptz, timestamptz) from public, anon, authenticated, service_role;

-- PT appointments: refuse a booked appointment in a blocked time or closed day.
create function private.pt_appointment_time_off_guard() returns trigger
  language plpgsql security definer set search_path = ''
as $$
declare
  v_off text;
begin
  if new.status = 'booked' and (tg_op = 'INSERT' or new.status is distinct from old.status or new.starts_at is distinct from old.starts_at
       or new.ends_at is distinct from old.ends_at or new.staff_user_id is distinct from old.staff_user_id) then
    v_off := private.staff_time_off_reason(new.gym_id, new.staff_user_id, new.starts_at, new.ends_at);
    if v_off = 'closed' then
      raise exception 'The gym is closed at this time.';
    elsif v_off = 'blocked' then
      raise exception 'This coach is not available at this time.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.pt_appointment_time_off_guard() from public, anon, authenticated, service_role;
create trigger pt_appointments_time_off_guard before insert or update on public.pt_appointments
  for each row execute function private.pt_appointment_time_off_guard();

-- Class scheduler: the existing function with ONE added check (the "v_off" lines). Copied from the live baseline.
CREATE OR REPLACE FUNCTION public.validate_class_schedule(p_gym_id uuid, p_class_type_id uuid, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_capacity integer, p_staff_ids uuid[] DEFAULT '{}'::uuid[], p_exclude_session_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
declare
  v_local_start timestamp;
  v_local_end timestamp;
  v_weekday int;
  v_start_time time;
  v_end_time time;
  v_errors jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  r record;
  v_qualified boolean;
  v_working boolean;
  v_conflict boolean;
  v_room_cap integer;
  v_off text;
begin
  if not private.has_gym_role(p_gym_id, array['owner'::gym_member_role,'admin'::gym_member_role]) then
    raise exception 'Not authorised';
  end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    return jsonb_build_object('ok',false,'errors',jsonb_build_array('Choose a valid start time and duration.'),'warnings',v_warnings);
  end if;
  v_local_start := p_starts_at at time zone 'Europe/London';
  v_local_end := p_ends_at at time zone 'Europe/London';
  if v_local_start::date <> v_local_end::date then
    v_errors := v_errors || jsonb_build_array('Classes cannot currently run across midnight.');
  end if;
  v_weekday := extract(dow from v_local_start)::int;
  v_start_time := v_local_start::time;
  v_end_time := v_local_end::time;

  for r in
    select sr.capability_id, c.name
    from public.service_requirements sr
    join public.capabilities c on c.id=sr.capability_id
    where sr.gym_id=p_gym_id and sr.class_type_id=p_class_type_id and sr.capability_id is not null
  loop
    select exists(
      select 1 from public.staff_capabilities sc
      where sc.gym_id=p_gym_id and sc.user_id=any(coalesce(p_staff_ids,'{}'::uuid[]))
        and sc.capability_id=r.capability_id and sc.qualified=true
        and (sc.expires_on is null or sc.expires_on >= v_local_start::date)
    ) into v_qualified;
    if not v_qualified then
      v_errors := v_errors || jsonb_build_array('No selected staff member is currently qualified for '||r.name||'.');
    end if;
  end loop;

  for r in select unnest(coalesce(p_staff_ids,'{}'::uuid[])) as user_id loop
    select exists(
      select 1 from public.staff_working_hours wh
      where wh.gym_id=p_gym_id and wh.user_id=r.user_id and wh.weekday=v_weekday and wh.is_working=true
        and wh.start_time <= v_start_time and wh.end_time >= v_end_time
    ) into v_working;
    if not v_working then
      v_errors := v_errors || jsonb_build_array('A selected staff member is outside their configured working hours.');
    end if;
    select exists(
      select 1 from public.class_session_staff css
      join public.class_sessions cs on cs.id=css.session_id
      where css.gym_id=p_gym_id and css.user_id=r.user_id and cs.is_cancelled=false
        and (p_exclude_session_id is null or cs.id<>p_exclude_session_id)
        and tstzrange(cs.starts_at,cs.ends_at,'[)') && tstzrange(p_starts_at,p_ends_at,'[)')
    ) into v_conflict;
    if v_conflict then
      v_errors := v_errors || jsonb_build_array('A selected staff member is already assigned to another class at this time.');
    end if;
    v_off := private.staff_time_off_reason(p_gym_id, r.user_id, p_starts_at, p_ends_at);
    if v_off = 'closed' then
      v_errors := v_errors || jsonb_build_array('The gym is marked closed at this time.');
    elsif v_off = 'blocked' then
      v_errors := v_errors || jsonb_build_array('A selected staff member has blocked out this time.');
    end if;
  end loop;

  for r in
    select sr.resource_id, sr.quantity, res.name, res.resource_type, res.capacity, res.allow_overlap, res.is_bookable
    from public.service_requirements sr
    join public.resources res on res.id=sr.resource_id
    where sr.gym_id=p_gym_id and sr.class_type_id=p_class_type_id and sr.resource_id is not null and res.is_active=true
  loop
    if not r.is_bookable then
      v_errors := v_errors || jsonb_build_array(r.name||' is not currently bookable.');
    end if;
    if r.capacity is not null and r.resource_type in ('room','area') and p_capacity > r.capacity then
      v_errors := v_errors || jsonb_build_array('Class capacity exceeds the maximum occupancy of '||r.name||' ('||r.capacity||').');
    end if;
    if exists(select 1 from public.resource_availability ra where ra.resource_id=r.resource_id and ra.weekday=v_weekday) then
      if not exists(select 1 from public.resource_availability ra where ra.resource_id=r.resource_id and ra.weekday=v_weekday and ra.is_available=true and ra.start_time<=v_start_time and ra.end_time>=v_end_time) then
        v_errors := v_errors || jsonb_build_array(r.name||' is outside its configured available hours.');
      end if;
    end if;
    if not r.allow_overlap then
      select exists(
        select 1 from public.class_session_resources csr
        join public.class_sessions cs on cs.id=csr.session_id
        where csr.gym_id=p_gym_id and csr.resource_id=r.resource_id and cs.is_cancelled=false
          and (p_exclude_session_id is null or cs.id<>p_exclude_session_id)
          and tstzrange(cs.starts_at,cs.ends_at,'[)') && tstzrange(p_starts_at,p_ends_at,'[)')
      ) into v_conflict;
      if v_conflict then
        v_errors := v_errors || jsonb_build_array(r.name||' is already booked at this time.');
      end if;
    end if;
  end loop;

  return jsonb_build_object('ok',jsonb_array_length(v_errors)=0,'errors',v_errors,'warnings',v_warnings);
end;
$$;
