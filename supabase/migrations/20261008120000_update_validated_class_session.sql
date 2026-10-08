-- Edit an existing class safely: one database call that runs the same gym checks as creating a class
-- (qualified coach, working hours, room, equipment, clashes), IGNORING the class being edited so it does not
-- clash with itself, and then changes the class, its coaches and its reserved plans together or not at all.
-- Additive: a new function only. Nothing existing is changed (validate_class_schedule and
-- create_validated_class_session are NOT touched).
--
-- Rules:
--  * Owners and admins of the gym only.
--  * The class type cannot be changed (its rooms and equipment were assigned from it). Cancelling or
--    reinstating stays a separate action.
--  * Capacity cannot go below the number of people already booked.
--  * A class that would run across midnight is never allowed.
--  * Same override as creating: if the checks fail, a reason of 3 or more characters schedules the change
--    anyway and writes a row to public.class_schedule_overrides (who, why, which problems).
--  * People who have already booked keep their booking. Nobody is notified automatically.
begin;

create function public.update_validated_class_session(
  p_gym_id uuid, p_session_id uuid, p_name text, p_description text,
  p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_capacity integer,
  p_reserved_capacity integer default 0, p_reserved_release_minutes_before integer default null::integer,
  p_staff_ids uuid[] default '{}'::uuid[], p_plan_ids uuid[] default '{}'::uuid[],
  p_override_reason text default null::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_session public.class_sessions%rowtype;
  v_check jsonb;
  v_uid uuid;
  v_i integer := 0;
  v_role text;
  v_booked integer;
  v_reason text := nullif(btrim(coalesce(p_override_reason, '')), '');
  v_problems jsonb := '[]'::jsonb;
begin
  if not private.has_gym_role(p_gym_id, array['owner'::gym_member_role,'admin'::gym_member_role]) then
    raise exception 'Not authorised';
  end if;
  select * into v_session from public.class_sessions where id=p_session_id and gym_id=p_gym_id for update;
  if not found then
    raise exception 'Class not found';
  end if;
  if coalesce(trim(p_name),'')='' or p_starts_at is null or p_ends_at is null or p_ends_at<=p_starts_at then
    return jsonb_build_object('ok',false,'errors',jsonb_build_array('Check the class name, date, start time and duration.'));
  end if;
  if p_capacity is null or p_capacity<1 or coalesce(p_reserved_capacity,0)<0 or coalesce(p_reserved_capacity,0)>p_capacity then
    return jsonb_build_object('ok',false,'errors',jsonb_build_array('Check the class capacity and reserved spaces.'));
  end if;
  select count(*) into v_booked from public.class_bookings where session_id=p_session_id and status<>'cancelled';
  if p_capacity<v_booked then
    return jsonb_build_object('ok',false,'can_override',false,'errors',jsonb_build_array('Capacity cannot be lower than the '||v_booked||' people already booked.'));
  end if;
  if (p_starts_at at time zone 'Europe/London')::date <> (p_ends_at at time zone 'Europe/London')::date then
    return jsonb_build_object('ok',false,'can_override',false,'errors',jsonb_build_array('Classes cannot currently run across midnight.'));
  end if;

  if v_session.class_type_id is not null then
    v_check:=public.validate_class_schedule(p_gym_id,v_session.class_type_id,p_starts_at,p_ends_at,p_capacity,coalesce(p_staff_ids,'{}'::uuid[]),p_session_id);
    if coalesce((v_check->>'ok')::boolean,false)=false then
      if v_reason is null then
        return v_check || jsonb_build_object('can_override',true);
      end if;
      if char_length(v_reason)<3 then
        return jsonb_build_object('ok',false,'can_override',true,'errors',coalesce(v_check->'errors','[]'::jsonb) || jsonb_build_array('Give a reason of at least 3 characters to save this change anyway.'));
      end if;
      v_problems:=coalesce(v_check->'errors','[]'::jsonb);
    end if;
  end if;

  update public.class_sessions set
    name=trim(p_name),
    description=nullif(trim(coalesce(p_description,'')),''),
    starts_at=p_starts_at,
    ends_at=p_ends_at,
    capacity=p_capacity,
    reserved_capacity=coalesce(p_reserved_capacity,0),
    reserved_release_minutes_before=p_reserved_release_minutes_before,
    updated_at=now()
  where id=p_session_id and gym_id=p_gym_id;

  delete from public.class_session_reserved_plans where session_id=p_session_id;
  if coalesce(array_length(p_plan_ids,1),0)>0 and coalesce(p_reserved_capacity,0)>0 then
    insert into public.class_session_reserved_plans(session_id,plan_id)
    select p_session_id,x from unnest(p_plan_ids)x
    where exists(select 1 from public.membership_plans mp where mp.id=x and mp.gym_id=p_gym_id and mp.is_active=true)
    on conflict do nothing;
  end if;

  delete from public.class_session_staff where session_id=p_session_id and gym_id=p_gym_id;
  if coalesce(array_length(p_staff_ids,1),0)>0 then
    foreach v_uid in array p_staff_ids loop
      v_i:=v_i+1;
      v_role:=null;
      select case when gm.role='coach'::gym_member_role then 'coach' else 'staff' end into v_role
      from public.gym_members gm
      where gm.gym_id=p_gym_id and gm.user_id=v_uid and gm.is_active=true
        and gm.role in ('owner'::gym_member_role,'admin'::gym_member_role,'staff'::gym_member_role,'coach'::gym_member_role)
      limit 1;
      if v_role is not null then
        insert into public.class_session_staff(session_id,gym_id,user_id,assignment_role,is_lead)
        values(p_session_id,p_gym_id,v_uid,v_role,v_i=1) on conflict do nothing;
      end if;
    end loop;
  end if;

  if jsonb_array_length(v_problems)>0 then
    insert into public.class_schedule_overrides(gym_id,session_id,overridden_by,reason,problems)
    values(p_gym_id,p_session_id,auth.uid(),v_reason,v_problems);
  end if;

  return jsonb_build_object('ok',true,'session_id',p_session_id,'overridden',jsonb_array_length(v_problems)>0);
end$function$;

revoke all on function public.update_validated_class_session(uuid, uuid, text, text, timestamp with time zone, timestamp with time zone, integer, integer, integer, uuid[], uuid[], text) from public, anon, authenticated, service_role;
grant execute on function public.update_validated_class_session(uuid, uuid, text, text, timestamp with time zone, timestamp with time zone, integer, integer, integer, uuid[], uuid[], text) to authenticated;

commit;
