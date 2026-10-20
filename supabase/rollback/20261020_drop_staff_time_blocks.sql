-- Undo 20261020110000_staff_time_blocks.sql. Puts validate_class_schedule back exactly as it was and removes the new lists
-- (any blocks and closed days saved since are lost). Bookings are not touched.
begin;
drop trigger if exists pt_appointments_time_off_guard on public.pt_appointments;
drop function if exists private.pt_appointment_time_off_guard();
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
drop function if exists private.staff_time_off_reason(uuid, uuid, timestamptz, timestamptz);
drop table if exists public.gym_closed_days;
drop table if exists public.staff_time_blocks;
commit;
