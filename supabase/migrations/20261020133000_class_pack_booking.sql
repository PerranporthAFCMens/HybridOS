-- Class packs, part 3: booking spends a pack class, and a cancel in time gives it back.
--
-- Rules (plain English):
--   * A member whose plan includes classes, or who paid for a class as a drop-in, books exactly as before. No pack class is used.
--   * A member whose plan does NOT include classes, and who holds a pack that is not cancelled, not used up and not expired, books
--     with one class from that pack (the one that runs out soonest is used first). Their membership must still be active.
--   * Cancelling at least 12 hours before the class starts gives the class back. Cancelling later does not.
--   * The gym cancelling or deleting a class, or an owner or admin taking someone off the list, gives the class back.
--   * A cancelled pack never gets a class back. A pack never holds more than it started with.
--
-- Changes:
--   public.class_bookings.class_pack_id   which pack paid for this booking (null = none)
--   private.pack_cancel_window()           the 12 hours, in one place
--   private.member_has_usable_pack()       can this member book with a pack?
--   private.spend_pack_credit()            takes one class from the member's pack
--   private.refund_pack_credit()           puts one class back (only once per booking)
--   private.refund_session_packs()         trigger: a cancelled or deleted class gives every booked pack class back
--   public.book_class_session / public.member_book_class     as 20261016140000 plus the pack path
--   public.member_cancel_class / public.cancel_class_booking  as the baseline plus the give-back
--   public.admin_manage_class_booking                          as 20261008150000 plus the give-back on cancel
-- No new public functions. Grants on the replaced functions are unchanged.
-- Safe to run twice. Rollback: supabase/rollback/20261020_drop_class_pack_booking.sql
begin;

alter table public.class_bookings add column if not exists class_pack_id uuid references public.class_packs(id) on delete set null;

create or replace function private.pack_cancel_window() returns interval
 language sql immutable
 set search_path to ''
as $$ select interval '12 hours' $$;

create or replace function private.member_has_usable_pack(p_gym_id uuid, p_user_id uuid) returns boolean
 language sql stable security definer
 set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.class_packs p
    where p.gym_id = p_gym_id and p.user_id = p_user_id and p.voided_at is null and p.credits_left > 0
      and (p.expires_at is null or p.expires_at > now())
  )
$$;

create or replace function private.spend_pack_credit(p_gym_id uuid, p_user_id uuid) returns uuid
 language plpgsql security definer
 set search_path to 'public', 'pg_temp'
as $$
declare
  v_id uuid;
begin
  select p.id into v_id from public.class_packs p
  where p.gym_id = p_gym_id and p.user_id = p_user_id and p.voided_at is null and p.credits_left > 0
    and (p.expires_at is null or p.expires_at > now())
  order by p.expires_at asc nulls last, p.created_at, p.id
  limit 1
  for update;
  if v_id is null then return null; end if;
  update public.class_packs set credits_left = credits_left - 1 where id = v_id;
  return v_id;
end
$$;

create or replace function private.refund_pack_credit(p_booking_id uuid) returns void
 language plpgsql security definer
 set search_path to 'public', 'pg_temp'
as $$
begin
  update public.class_packs p set credits_left = least(p.credits_total, p.credits_left + 1)
  from public.class_bookings b
  where b.id = p_booking_id and b.class_pack_id = p.id and p.voided_at is null;
  -- Forget the link either way, so the same booking can never give a class back twice.
  update public.class_bookings set class_pack_id = null where id = p_booking_id and class_pack_id is not null;
end
$$;

create or replace function private.refund_session_packs() returns trigger
 language plpgsql security definer
 set search_path to 'public', 'pg_temp'
as $$
begin
  if tg_op = 'UPDATE' and not (new.is_cancelled and not old.is_cancelled) then
    return new;
  end if;
  perform private.refund_pack_credit(b.id)
  from public.class_bookings b
  where b.session_id = old.id and b.status = 'booked' and b.class_pack_id is not null;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

drop trigger if exists class_pack_refund_on_session_change on public.class_sessions;
create trigger class_pack_refund_on_session_change before update of is_cancelled or delete on public.class_sessions
  for each row execute function private.refund_session_packs();

revoke all on function private.pack_cancel_window(), private.member_has_usable_pack(uuid, uuid), private.spend_pack_credit(uuid, uuid),
  private.refund_pack_credit(uuid), private.refund_session_packs() from public, anon, authenticated, service_role;

-- The two booking functions, as in 20261016140000 plus the pack path. Their existing grants stay as they are.
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
  v_use_pack boolean := false;
  v_pack_id uuid;
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
    -- A class pack covers a member whose plan does not include classes and who has not paid for this class.
    if private.member_has_usable_pack(v_session.gym_id,auth.uid()) then
      v_use_pack:=true;
    elsif v_session.drop_in_price_pence is null then
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

  if v_use_pack then
    v_pack_id:=private.spend_pack_credit(v_session.gym_id,auth.uid());
    if v_pack_id is null then raise exception 'Your class pack has no classes left.'; end if;
  end if;

  if v_existing.id is not null then
    update public.class_bookings set status='booked', booked_at=now(), cancelled_at=null, class_pack_id=v_pack_id, updated_at=now()
    where id=v_existing.id returning * into v_booking;
  else
    insert into public.class_bookings(gym_id,session_id,user_id,status,class_pack_id)
    values(v_session.gym_id,p_session_id,auth.uid(),'booked',v_pack_id) returning * into v_booking;
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
  v_use_pack boolean := false;
  v_pack_id uuid;
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
    -- A class pack covers a member whose plan does not include classes and who has not paid for this class.
    if private.member_has_usable_pack(s.gym_id,auth.uid()) then
      v_use_pack:=true;
    elsif s.drop_in_price_pence is null then
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

  if v_use_pack then
    v_pack_id:=private.spend_pack_credit(s.gym_id,auth.uid());
    if v_pack_id is null then raise exception 'Your class pack has no classes left.'; end if;
  end if;

  insert into public.class_bookings(gym_id,session_id,user_id,status,booked_at,cancelled_at,class_pack_id)
  values(s.gym_id,p_session_id,auth.uid(),'booked',now(),null,v_pack_id)
  on conflict(session_id,user_id) do update set status='booked',booked_at=now(),cancelled_at=null,class_pack_id=excluded.class_pack_id,updated_at=now()
  returning id into v_id;

  update public.class_waitlist set status='booked', updated_at=now()
  where session_id=p_session_id and user_id=auth.uid() and status in ('waiting','offered');

  return jsonb_build_object('status','booked','booking_id',v_id,'used_pack',v_pack_id is not null);
end$$;

CREATE OR REPLACE FUNCTION public.member_cancel_class(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
declare
  s public.class_sessions%rowtype;
  v_booking public.class_bookings%rowtype;
  v_returned boolean := false;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into s from public.class_sessions where id=p_session_id;
  if not found then raise exception 'Class session not found'; end if;
  if not private.can_write_gym(s.gym_id) then raise exception 'Read-only access'; end if;
  if s.starts_at<=now() then raise exception 'This class has already started'; end if;

  -- A class paid for with a pack comes back if the member cancels in time.
  select * into v_booking from public.class_bookings where session_id=p_session_id and user_id=auth.uid();
  if found and v_booking.status='booked' and v_booking.class_pack_id is not null and s.starts_at-now()>=private.pack_cancel_window() then
    perform private.refund_pack_credit(v_booking.id);
    v_returned:=true;
  end if;

  delete from public.class_bookings where session_id=p_session_id and user_id=auth.uid();
  return jsonb_build_object('status','cancelled','class_returned',v_returned);
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
  v_starts timestamptz;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select gym_id, starts_at into v_gym_id, v_starts from public.class_sessions where id=p_session_id;
  if v_gym_id is null then raise exception 'Class session not found'; end if;
  if not private.can_write_gym(v_gym_id) then raise exception 'Read-only access'; end if;

  update public.class_bookings
  set status='cancelled',cancelled_at=now(),updated_at=now()
  where session_id=p_session_id and user_id=auth.uid() and status='booked'
  returning * into v_booking;

  if not found then raise exception 'Active booking not found'; end if;

  -- A class paid for with a pack comes back if the member cancels in time.
  if v_booking.class_pack_id is not null and v_starts-now()>=private.pack_cancel_window() then
    perform private.refund_pack_credit(v_booking.id);
    select * into v_booking from public.class_bookings where id=v_booking.id;
  end if;
  return v_booking;
end;
$$;

-- Owners and admins: add, cancel or mark a booking. Cancelling gives a pack class back.
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
    -- Taken off the list by the gym: any pack class used comes back.
    perform private.refund_pack_credit(v_booking.id);
    update public.class_bookings set status='cancelled', cancelled_at=now(), updated_at=now() where id=v_booking.id;
  else
    update public.class_bookings set status=p_action, updated_at=now() where id=v_booking.id;
  end if;
  return jsonb_build_object('ok',true,'warnings',v_warnings);
end$function$;

commit;
