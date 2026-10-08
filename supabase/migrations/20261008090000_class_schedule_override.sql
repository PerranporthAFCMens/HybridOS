-- Let an owner or admin schedule a class that fails the gym checks, on purpose, with a reason that is kept.
-- Backward compatible: the new parameter is optional, so every existing caller (11 named arguments) keeps
-- working and keeps being refused when a check fails. The checks themselves are unchanged
-- (public.validate_class_schedule is NOT touched).
--
-- What changes:
--  1. New table public.class_schedule_overrides: one row per class that was scheduled despite failing checks,
--     with who did it, why, and exactly which problems were overridden. Owners and admins of the gym can read it.
--     Nobody can write to it directly; it is only written by the function below.
--  2. public.create_validated_class_session gets an optional last parameter p_override_reason.
--     - Checks pass: nothing changes, no override row.
--     - Checks fail and no reason: refused as before; the result now also says can_override = true so the
--       screen can offer the override.
--     - Checks fail and a reason of at least 3 characters is given: the class is scheduled and an override row
--       is written in the same transaction.
--     - A class that would run across midnight is never overridable (calendars and feeds assume one day).
begin;

create table public.class_schedule_overrides (
  id uuid not null default gen_random_uuid(),
  gym_id uuid not null,
  session_id uuid not null,
  overridden_by uuid not null,
  reason text not null,
  problems jsonb not null,
  created_at timestamp with time zone not null default now(),
  constraint class_schedule_overrides_pkey primary key (id),
  constraint class_schedule_overrides_reason_check check (char_length(btrim(reason)) between 3 and 500),
  constraint class_schedule_overrides_problems_check check (jsonb_typeof(problems) = 'array'),
  constraint class_schedule_overrides_gym_id_fkey foreign key (gym_id) references public.gyms(id) on delete cascade,
  constraint class_schedule_overrides_session_id_fkey foreign key (session_id) references public.class_sessions(id) on delete cascade
);
create index class_schedule_overrides_gym_created_idx on public.class_schedule_overrides (gym_id, created_at desc);
create index class_schedule_overrides_session_idx on public.class_schedule_overrides (session_id);

alter table public.class_schedule_overrides enable row level security;

create policy "owners admins read class schedule overrides" on public.class_schedule_overrides
  for select to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));

revoke all on table public.class_schedule_overrides from public, anon, authenticated, service_role;
grant select on table public.class_schedule_overrides to authenticated;
grant select, insert, update, delete on table public.class_schedule_overrides to service_role;

drop function public.create_validated_class_session(uuid, uuid, text, text, timestamp with time zone, timestamp with time zone, integer, integer, integer, uuid[], uuid[]);

create function public.create_validated_class_session(
  p_gym_id uuid, p_class_type_id uuid, p_name text, p_description text,
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
  v_check jsonb;
  v_session_id uuid;
  v_uid uuid;
  v_i integer := 0;
  v_role text;
  v_drop_in integer;
  v_reason text := nullif(btrim(coalesce(p_override_reason, '')), '');
  v_problems jsonb := '[]'::jsonb;
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
  -- Never overridable: calendars and feeds assume a class sits inside one day.
  if (p_starts_at at time zone 'Europe/London')::date <> (p_ends_at at time zone 'Europe/London')::date then
    return jsonb_build_object('ok',false,'can_override',false,'errors',jsonb_build_array('Classes cannot currently run across midnight.'));
  end if;

  if p_class_type_id is not null then
    v_check:=public.validate_class_schedule(p_gym_id,p_class_type_id,p_starts_at,p_ends_at,p_capacity,coalesce(p_staff_ids,'{}'::uuid[]),null);
    if coalesce((v_check->>'ok')::boolean,false)=false then
      if v_reason is null then
        return v_check || jsonb_build_object('can_override',true);
      end if;
      if char_length(v_reason)<3 then
        return jsonb_build_object('ok',false,'can_override',true,'errors',coalesce(v_check->'errors','[]'::jsonb) || jsonb_build_array('Give a reason of at least 3 characters to schedule this class anyway.'));
      end if;
      v_problems:=coalesce(v_check->'errors','[]'::jsonb);
    end if;
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

  if jsonb_array_length(v_problems)>0 then
    insert into public.class_schedule_overrides(gym_id,session_id,overridden_by,reason,problems)
    values(p_gym_id,v_session_id,auth.uid(),v_reason,v_problems);
  end if;

  return jsonb_build_object('ok',true,'session_id',v_session_id,'overridden',jsonb_array_length(v_problems)>0);
end$function$;

revoke all on function public.create_validated_class_session(uuid, uuid, text, text, timestamp with time zone, timestamp with time zone, integer, integer, integer, uuid[], uuid[], text) from public, anon, authenticated, service_role;
grant execute on function public.create_validated_class_session(uuid, uuid, text, text, timestamp with time zone, timestamp with time zone, integer, integer, integer, uuid[], uuid[], text) to authenticated;

commit;
