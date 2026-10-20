-- Undo 20261020133000_class_pack_booking.sql. Puts the five booking functions back exactly as they were, and removes the pack path.
-- Bookings and packs are not deleted. Pack classes already used for booked classes stay used, and cancelling a booking no longer gives one back.
begin;

drop trigger if exists class_pack_refund_on_session_change on public.class_sessions;

CREATE OR REPLACE FUNCTION public.book_class_session(p_session_id uuid)
 RETURNS class_bookings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
declare
  v_session public.class_sessions%rowtype;
  v_existing public.class_bookings%rowtype;
  v_plan_id uuid;
  v_is_reserved_eligible boolean := false;
  v_total_booked integer := 0;
  v_general_booked integer := 0;
  v_reserved_released boolean := false;
  v_booking public.class_bookings%rowtype;
  v_included boolean;
  v_paid boolean;
  v_held integer := 0;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into v_session from public.class_sessions where id = p_session_id for update;
  if not found then raise exception 'Class session not found'; end if;
  if not private.can_write_gym(v_session.gym_id) then raise exception 'Not a member of this gym'; end if;
  -- Status gate BEFORE any paid-drop-in check: a paid drop-in never lets a non-active member book.
  if not private.member_status_allows(v_session.gym_id, array['active']) then raise exception 'Your membership is not active. Contact your gym to book classes.'; end if;
  if v_session.is_cancelled then raise exception 'This class has been cancelled'; end if;
  if v_session.starts_at <= now() then raise exception 'This class has already started'; end if;

  select * into v_existing from public.class_bookings
  where session_id = p_session_id and user_id = auth.uid();
  if found and v_existing.status = 'booked' then raise exception 'You are already booked into this class'; end if;

  v_included:=private.member_has_class_access(v_session.gym_id,auth.uid());
  v_paid:=private.member_has_paid_class(v_session.id,auth.uid());
  if not v_included and not v_paid then
    if v_session.drop_in_price_pence is null then
      raise exception 'Your membership does not include classes. Upgrade to a class-inclusive membership to book this class.';
    else
      raise exception 'Your membership does not include classes. This class costs £% as a drop-in, or you can upgrade your membership.',to_char(v_session.drop_in_price_pence/100.0,'FM999999990.00');
    end if;
  end if;

  select m.plan_id into v_plan_id
  from (
    select ms.plan_id, ms.starts_on
    from public.memberships ms
    where ms.gym_id = v_session.gym_id and ms.user_id = auth.uid()
    order by ms.created_at desc, ms.id desc
    limit 1
  ) m
  where private.current_membership_status(v_session.gym_id, auth.uid()) = 'active'
    and (m.starts_on is null or m.starts_on <= current_date);

  if v_plan_id is not null then
    select exists(select 1 from public.class_session_reserved_plans rp where rp.session_id = p_session_id and rp.plan_id = v_plan_id)
    into v_is_reserved_eligible;
  end if;

  if v_session.reserved_capacity > 0 and v_session.reserved_release_minutes_before is not null then
    v_reserved_released := now() >= (v_session.starts_at - make_interval(mins => v_session.reserved_release_minutes_before));
  end if;

  select count(*) into v_total_booked from public.class_bookings b
  where b.session_id = p_session_id and b.status = 'booked';
  perform private.advance_waitlist(p_session_id);
  select count(*) into v_total_booked from public.class_bookings b
  where b.session_id = p_session_id and b.status = 'booked';
  select count(*) into v_held from public.class_waitlist w
    where w.session_id = p_session_id and w.status = 'offered' and w.offer_expires_at > now() and w.user_id <> auth.uid();
  if v_total_booked + v_held >= v_session.capacity then raise exception 'This class is full'; end if;

  if v_session.reserved_capacity > 0 and not v_reserved_released and not v_is_reserved_eligible then
    select count(*) into v_general_booked
    from public.class_bookings b
    where b.session_id = p_session_id and b.status = 'booked'
      and not exists (
        select 1 from public.memberships m
        join public.class_session_reserved_plans rp on rp.plan_id = m.plan_id and rp.session_id = p_session_id
        where m.gym_id = v_session.gym_id and m.user_id = b.user_id and m.status = 'active'
          and (m.starts_on is null or m.starts_on <= current_date)
          and (m.ends_on is null or m.ends_on >= current_date)
      );
    if v_general_booked >= (v_session.capacity - v_session.reserved_capacity) then
      raise exception 'General spaces are full. Remaining spaces are reserved for eligible memberships';
    end if;
  end if;

  if v_existing.id is not null then
    update public.class_bookings set status='booked', booked_at=now(), cancelled_at=null, updated_at=now()
    where id=v_existing.id returning * into v_booking;
  else
    insert into public.class_bookings(gym_id,session_id,user_id,status)
    values(v_session.gym_id,p_session_id,auth.uid(),'booked') returning * into v_booking;
  end if;
  update public.class_waitlist set status='booked', updated_at=now()
  where session_id=p_session_id and user_id=auth.uid() and status in ('waiting','offered');
  return v_booking;
end$$;

CREATE OR REPLACE FUNCTION public.member_book_class(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
declare
  s public.class_sessions%rowtype;
  v_count integer;
  v_id uuid;
  v_included boolean;
  v_paid boolean;
  v_held integer;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into s from public.class_sessions where id=p_session_id for update;
  if not found then raise exception 'Class session not found'; end if;
  if not private.can_write_gym(s.gym_id) then
    raise exception 'Not an active gym member';
  end if;
  -- Status gate BEFORE any paid-drop-in check: a paid drop-in never lets a non-active member book.
  if not private.member_status_allows(s.gym_id, array['active']) then
    raise exception 'Your membership is not active. Contact your gym to book classes.';
  end if;
  if coalesce(s.is_cancelled,false) then raise exception 'This class has been cancelled'; end if;
  if s.starts_at<=now() then raise exception 'This class has already started'; end if;

  if exists(select 1 from public.class_bookings b where b.session_id=p_session_id and b.user_id=auth.uid() and b.status='booked') then
    return jsonb_build_object('status','booked','already_booked',true);
  end if;

  v_included:=private.member_has_class_access(s.gym_id,auth.uid());
  v_paid:=private.member_has_paid_class(s.id,auth.uid());
  if not v_included and not v_paid then
    if s.drop_in_price_pence is null then
      raise exception 'Your membership does not include classes. Upgrade to a class-inclusive membership to book this class.';
    else
      raise exception 'Your membership does not include classes. This class costs £% as a drop-in, or you can upgrade your membership.',to_char(s.drop_in_price_pence/100.0,'FM999999990.00');
    end if;
  end if;

  -- Waitlist: settle expired offers first, then count places held for other people's offers as taken.
  perform private.advance_waitlist(p_session_id);
  select count(*) into v_count from public.class_bookings b where b.session_id=p_session_id and b.status='booked';
  select count(*) into v_held from public.class_waitlist w
    where w.session_id=p_session_id and w.status='offered' and w.offer_expires_at>now() and w.user_id<>auth.uid();
  if s.capacity is not null and v_count+v_held>=s.capacity then raise exception 'This class is full'; end if;

  insert into public.class_bookings(gym_id,session_id,user_id,status,booked_at,cancelled_at)
  values(s.gym_id,p_session_id,auth.uid(),'booked',now(),null)
  on conflict(session_id,user_id) do update set status='booked',booked_at=now(),cancelled_at=null,updated_at=now()
  returning id into v_id;

  update public.class_waitlist set status='booked', updated_at=now()
  where session_id=p_session_id and user_id=auth.uid() and status in ('waiting','offered');

  return jsonb_build_object('status','booked','booking_id',v_id);
end$$;

CREATE OR REPLACE FUNCTION public.member_cancel_class(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
declare
  s public.class_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into s from public.class_sessions where id=p_session_id;
  if not found then raise exception 'Class session not found'; end if;
  if not private.can_write_gym(s.gym_id) then raise exception 'Read-only access'; end if;
  if s.starts_at<=now() then raise exception 'This class has already started'; end if;

  delete from public.class_bookings where session_id=p_session_id and user_id=auth.uid();
  return jsonb_build_object('status','cancelled');
end;
$$;

CREATE OR REPLACE FUNCTION public.cancel_class_booking(p_session_id uuid)
 RETURNS class_bookings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
declare
  v_booking public.class_bookings%rowtype;
  v_gym_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select gym_id into v_gym_id from public.class_sessions where id=p_session_id;
  if v_gym_id is null then raise exception 'Class session not found'; end if;
  if not private.can_write_gym(v_gym_id) then raise exception 'Read-only access'; end if;

  update public.class_bookings
  set status='cancelled',cancelled_at=now(),updated_at=now()
  where session_id=p_session_id and user_id=auth.uid() and status='booked'
  returning * into v_booking;

  if not found then raise exception 'Active booking not found'; end if;
  return v_booking;
end;
$$;

create or replace function public.admin_manage_class_booking(
  p_gym_id uuid, p_session_id uuid, p_user_id uuid, p_action text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_session public.class_sessions%rowtype;
  v_booking public.class_bookings%rowtype;
  v_count integer;
  v_warnings jsonb := '[]'::jsonb;
begin
  if not private.has_gym_role(p_gym_id, array['owner'::gym_member_role,'admin'::gym_member_role]) then
    raise exception 'Not authorised';
  end if;
  if p_action is null or p_action not in ('attended','no_show','booked','cancel','add') then
    raise exception 'Unknown action';
  end if;
  select * into v_session from public.class_sessions where id=p_session_id and gym_id=p_gym_id for update;
  if not found then raise exception 'Class not found'; end if;

  select * into v_booking from public.class_bookings where session_id=p_session_id and user_id=p_user_id;

  if p_action = 'add' then
    if v_session.is_cancelled then
      return jsonb_build_object('ok',false,'errors',jsonb_build_array('This class has been cancelled.'));
    end if;
    if not exists (select 1 from public.gym_members gm where gm.gym_id=p_gym_id and gm.user_id=p_user_id and gm.is_active=true and gm.access_status='active') then
      return jsonb_build_object('ok',false,'errors',jsonb_build_array('That person is not an active member of this gym.'));
    end if;
    if v_booking.id is not null and v_booking.status in ('booked','attended','no_show') then
      return jsonb_build_object('ok',false,'errors',jsonb_build_array('That person is already on the list.'));
    end if;
    select count(*) into v_count from public.class_bookings where session_id=p_session_id and status in ('booked','attended','no_show');
    if v_count >= v_session.capacity then
      return jsonb_build_object('ok',false,'errors',jsonb_build_array('This class is full ('||v_session.capacity||'). Raise the capacity first if you want to add someone.'));
    end if;
    if v_session.starts_at <= now() then
      v_warnings := v_warnings || jsonb_build_array('This class has already started.');
    end if;
    if not private.member_has_class_access(p_gym_id,p_user_id) then
      v_warnings := v_warnings || jsonb_build_array('Their membership does not include classes.');
    end if;
    if v_booking.id is not null then
      update public.class_bookings set status='booked', booked_at=now(), cancelled_at=null, updated_at=now() where id=v_booking.id;
    else
      insert into public.class_bookings(gym_id,session_id,user_id,status) values(p_gym_id,p_session_id,p_user_id,'booked');
    end if;
    return jsonb_build_object('ok',true,'warnings',v_warnings);
  end if;

  if v_booking.id is null or v_booking.status not in ('booked','attended','no_show') then
    return jsonb_build_object('ok',false,'errors',jsonb_build_array('That person is not on the list.'));
  end if;
  if p_action = 'cancel' then
    update public.class_bookings set status='cancelled', cancelled_at=now(), updated_at=now() where id=v_booking.id;
  else
    update public.class_bookings set status=p_action, updated_at=now() where id=v_booking.id;
  end if;
  return jsonb_build_object('ok',true,'warnings',v_warnings);
end$function$;

drop function if exists private.refund_session_packs();
drop function if exists private.refund_pack_credit(uuid);
drop function if exists private.spend_pack_credit(uuid, uuid);
drop function if exists private.member_has_usable_pack(uuid, uuid);
drop function if exists private.pack_cancel_window();
alter table public.class_bookings drop column if exists class_pack_id;

commit;
