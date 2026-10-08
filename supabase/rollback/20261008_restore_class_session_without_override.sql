-- Rollback for 20261008090000_class_schedule_override.sql.
-- Restores the original 11-argument create_validated_class_session exactly as in the baseline migration and
-- removes the override table. Any override rows are lost (take a copy first if they matter:
--   select * from public.class_schedule_overrides;).
begin;

drop function if exists public.create_validated_class_session(uuid, uuid, text, text, timestamp with time zone, timestamp with time zone, integer, integer, integer, uuid[], uuid[], text);

CREATE OR REPLACE FUNCTION public.create_validated_class_session(p_gym_id uuid, p_class_type_id uuid, p_name text, p_description text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_capacity integer, p_reserved_capacity integer DEFAULT 0, p_reserved_release_minutes_before integer DEFAULT NULL::integer, p_staff_ids uuid[] DEFAULT '{}'::uuid[], p_plan_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
declare
  v_check jsonb;
  v_session_id uuid;
  v_uid uuid;
  v_i integer := 0;
  v_role text;
  v_drop_in integer;
begin
  if not private.has_gym_role(p_gym_id, array['owner'::gym_member_role,'admin'::gym_member_role]) then
    raise exception 'Not authorised';
  end if;
  if coalesce(trim(p_name),'')='' or p_starts_at is null or p_ends_at is null or p_ends_at<=p_starts_at then
    return jsonb_build_object('ok',false,'errors',jsonb_build_array('Check the class name, date, start time and duration.'));
  end if;
  if p_capacity is null or p_capacity<1 or coalesce(p_reserved_capacity,0)<0 or coalesce(p_reserved_capacity,0)>p_capacity then
    return jsonb_build_object('ok',false,'errors',jsonb_build_array('Check the class capacity and reserved spaces.'));
  end if;

  if p_class_type_id is not null then
    v_check:=public.validate_class_schedule(p_gym_id,p_class_type_id,p_starts_at,p_ends_at,p_capacity,coalesce(p_staff_ids,'{}'::uuid[]),null);
    if coalesce((v_check->>'ok')::boolean,false)=false then return v_check; end if;
    select drop_in_price_pence into v_drop_in from public.class_types where id=p_class_type_id and gym_id=p_gym_id;
  end if;

  insert into public.class_sessions(
    gym_id,class_type_id,name,description,starts_at,ends_at,capacity,reserved_capacity,reserved_release_minutes_before,drop_in_price_pence,created_by
  ) values(
    p_gym_id,p_class_type_id,trim(p_name),nullif(trim(coalesce(p_description,'')),''),p_starts_at,p_ends_at,p_capacity,
    coalesce(p_reserved_capacity,0),p_reserved_release_minutes_before,v_drop_in,auth.uid()
  ) returning id into v_session_id;

  if coalesce(array_length(p_plan_ids,1),0)>0 and coalesce(p_reserved_capacity,0)>0 then
    insert into public.class_session_reserved_plans(session_id,plan_id)
    select v_session_id,x from unnest(p_plan_ids)x
    where exists(select 1 from public.membership_plans mp where mp.id=x and mp.gym_id=p_gym_id and mp.is_active=true)
    on conflict do nothing;
  end if;

  if coalesce(array_length(p_staff_ids,1),0)>0 then
    foreach v_uid in array p_staff_ids loop
      v_i:=v_i+1;
      select case when gm.role='coach'::gym_member_role then 'coach' else 'staff' end into v_role
      from public.gym_members gm
      where gm.gym_id=p_gym_id and gm.user_id=v_uid and gm.is_active=true
        and gm.role in ('owner'::gym_member_role,'admin'::gym_member_role,'staff'::gym_member_role,'coach'::gym_member_role)
      limit 1;
      if v_role is not null then
        insert into public.class_session_staff(session_id,gym_id,user_id,assignment_role,is_lead)
        values(v_session_id,p_gym_id,v_uid,v_role,v_i=1) on conflict do nothing;
      end if;
    end loop;
  end if;

  if p_class_type_id is not null then
    insert into public.class_session_resources(gym_id,session_id,resource_id,quantity)
    select p_gym_id,v_session_id,sr.resource_id,greatest(coalesce(sr.quantity,1),1)
    from public.service_requirements sr join public.resources r on r.id=sr.resource_id
    where sr.gym_id=p_gym_id and sr.class_type_id=p_class_type_id and sr.resource_id is not null and r.is_active=true
    on conflict(session_id,resource_id) do update set quantity=excluded.quantity;
  end if;

  return jsonb_build_object('ok',true,'session_id',v_session_id);
end$$;

revoke all on function public.create_validated_class_session(p_gym_id uuid, p_class_type_id uuid, p_name text, p_description text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_capacity integer, p_reserved_capacity integer, p_reserved_release_minutes_before integer, p_staff_ids uuid[], p_plan_ids uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.create_validated_class_session(p_gym_id uuid, p_class_type_id uuid, p_name text, p_description text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_capacity integer, p_reserved_capacity integer, p_reserved_release_minutes_before integer, p_staff_ids uuid[], p_plan_ids uuid[]) to "authenticated";

drop table if exists public.class_schedule_overrides;

commit;
