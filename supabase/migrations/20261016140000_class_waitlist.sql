-- Class waitlist, part 1 of 2: the database. No screen changes yet.
--
-- When a class is full a member can join its waitlist. When a place opens (someone cancels, the class gets a bigger capacity),
-- the person at the front of the line is offered it and has 15 minutes to book it. If they do not, the offer expires and the
-- next person is offered it. A place that is offered is HELD: nobody else can book it while the offer is open.
--
--   public.class_waitlist              one row per person per class: waiting, offered, booked, left or expired. Members read only
--                                      their own row; owners and admins read the class's list. Nobody writes it directly: the
--                                      functions below do, so the order of the line and the 15 minute hold cannot be skipped.
--   private.advance_waitlist(session)  the one place that expires old offers and offers free places to the next people in line.
--                                      It runs when a booking is cancelled, when a class changes capacity, and whenever someone
--                                      books, joins or looks at the list. The optional schedule file (supabase/verification/
--                                      20261016_class_waitlist_schedule.sql, needs pg_cron) runs it every minute so offers expire on
--                                      time even when nobody touches the class. Without it an expired offer is cleaned up the next
--                                      time anyone books, joins or looks at that class.
--   public.member_join_waitlist(session), member_leave_waitlist(session), get_my_waitlist(session)
--                                      member functions (same sign-in, active membership and class access rules as booking)
--   public.get_class_waitlist(gym, session)   owners and admins: who is on the list and who has an open offer
--   public.member_book_class / public.book_class_session
--                                      REPLACED (same behaviour as 20261005120000 plus): places held for other people's offers count as
--                                      taken, and booking after an offer marks the waitlist row as booked.
--   Offers are written to member_notifications (type waitlist_offer), the same in-app messages as booking confirmations.
--
-- Nothing changes for a class that never fills: no waitlist rows, no held places. Classes with no capacity limit have no waitlist.
-- Rollback: supabase/rollback/20261016_drop_class_waitlist.sql (restores the two booking functions exactly).
begin;

create table public.class_waitlist (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting', 'offered', 'booked', 'left', 'expired')),
  joined_at timestamptz not null default now(),
  offered_at timestamptz,
  offer_expires_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint class_waitlist_session_user_key unique (session_id, user_id),
  constraint class_waitlist_offer_has_expiry check (status <> 'offered' or offer_expires_at is not null)
);
create index class_waitlist_session_idx on public.class_waitlist (session_id, status, joined_at);
create index class_waitlist_user_idx on public.class_waitlist (user_id);

alter table public.class_waitlist enable row level security;
-- A fresh local database hands new tables to every role; the live project does not. Say exactly what is wanted.
revoke all on table public.class_waitlist from anon, authenticated, service_role;
grant select on table public.class_waitlist to authenticated;

create policy "members read own waitlist rows" on public.class_waitlist for select to authenticated
  using (user_id = auth.uid() and private.is_gym_member(gym_id));
create policy "owners admins read class waitlists" on public.class_waitlist for select to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));

-- Expire old offers and offer free places to the next people in line. Internal: called by the functions and triggers below.
create function private.advance_waitlist(p_session_id uuid) returns void
 language plpgsql
 security definer
 set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  s public.class_sessions%rowtype;
  w public.class_waitlist%rowtype;
  v_booked integer;
  v_held integer;
begin
  select * into s from public.class_sessions where id = p_session_id for update;
  if not found then return; end if;

  update public.class_waitlist set status = 'expired', updated_at = now()
  where session_id = p_session_id and status = 'offered' and offer_expires_at <= now();

  -- A cancelled or started class has no places to offer: close the line.
  if coalesce(s.is_cancelled, false) or s.starts_at <= now() then
    update public.class_waitlist set status = 'left', updated_at = now()
    where session_id = p_session_id and status in ('waiting', 'offered');
    return;
  end if;
  if s.capacity is null then return; end if;

  loop
    select count(*) into v_booked from public.class_bookings where session_id = p_session_id and status = 'booked';
    select count(*) into v_held from public.class_waitlist where session_id = p_session_id and status = 'offered';
    exit when v_booked + v_held >= s.capacity;

    select * into w from public.class_waitlist
    where session_id = p_session_id and status = 'waiting'
    order by joined_at, id limit 1 for update skip locked;
    exit when not found;

    -- Someone whose membership is no longer active drops out of the line instead of being offered a place.
    if private.current_membership_status(s.gym_id, w.user_id) is distinct from 'active' then
      update public.class_waitlist set status = 'left', updated_at = now() where id = w.id;
      continue;
    end if;

    update public.class_waitlist
    set status = 'offered', offered_at = now(), offer_expires_at = least(now() + interval '15 minutes', s.starts_at), updated_at = now()
    where id = w.id;

    insert into public.member_notifications(gym_id, user_id, notification_type, title, body, related_session_id, scheduled_for)
    values (s.gym_id, w.user_id, 'waitlist_offer', 'A place has opened up',
            s.name || ' on ' || to_char(s.starts_at at time zone 'Europe/London', 'Dy DD Mon HH24:MI') || ' has a place for you. Book it within 15 minutes to keep it.',
            p_session_id, now())
    on conflict (user_id, related_session_id, notification_type) where related_session_id is not null
    do update set title = excluded.title, body = excluded.body, scheduled_for = now(), delivered_at = null, read_at = null;
  end loop;
end
$function$;
revoke all on function private.advance_waitlist(uuid) from public, anon, authenticated, service_role;

-- A place opens when a booking is cancelled or removed, or the class's capacity grows (or the class is cancelled or moved).
create function private.waitlist_on_booking_change() returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'private', 'pg_temp'
as $function$
begin
  if tg_op = 'DELETE' then
    if old.status = 'booked' then perform private.advance_waitlist(old.session_id); end if;
    return old;
  end if;
  if old.status = 'booked' and new.status is distinct from 'booked' then perform private.advance_waitlist(new.session_id); end if;
  return new;
end
$function$;
revoke all on function private.waitlist_on_booking_change() from public, anon, authenticated, service_role;
create trigger class_waitlist_on_booking_change after update of status or delete on public.class_bookings
  for each row execute function private.waitlist_on_booking_change();

create function private.waitlist_on_session_change() returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'private', 'pg_temp'
as $function$
begin
  if new.capacity is distinct from old.capacity or new.is_cancelled is distinct from old.is_cancelled or new.starts_at is distinct from old.starts_at then
    perform private.advance_waitlist(new.id);
  end if;
  return new;
end
$function$;
revoke all on function private.waitlist_on_session_change() from public, anon, authenticated, service_role;
create trigger class_waitlist_on_session_change after update of capacity, is_cancelled, starts_at on public.class_sessions
  for each row execute function private.waitlist_on_session_change();

-- Member: join the line for a full class.
create function public.member_join_waitlist(p_session_id uuid) returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  s public.class_sessions%rowtype;
  v_booked integer;
  v_held integer;
  v_row public.class_waitlist%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into s from public.class_sessions where id = p_session_id for update;
  if not found then raise exception 'Class session not found'; end if;
  if not private.can_write_gym(s.gym_id) then raise exception 'Not an active gym member'; end if;
  if not private.member_status_allows(s.gym_id, array['active']) then
    raise exception 'Your membership is not active. Contact your gym to book classes.';
  end if;
  if coalesce(s.is_cancelled, false) then raise exception 'This class has been cancelled'; end if;
  if s.starts_at <= now() then raise exception 'This class has already started'; end if;
  if s.capacity is null then raise exception 'This class has no limit on places, so there is no waitlist'; end if;
  if not private.member_has_class_access(s.gym_id, auth.uid()) and not private.member_has_paid_class(s.id, auth.uid()) then
    raise exception 'Your membership does not include classes.';
  end if;
  if exists (select 1 from public.class_bookings b where b.session_id = p_session_id and b.user_id = auth.uid() and b.status = 'booked') then
    raise exception 'You are already booked into this class';
  end if;

  perform private.advance_waitlist(p_session_id);
  select count(*) into v_booked from public.class_bookings where session_id = p_session_id and status = 'booked';
  select count(*) into v_held from public.class_waitlist where session_id = p_session_id and status = 'offered' and user_id <> auth.uid();
  if v_booked + v_held < s.capacity then raise exception 'This class has a place free. Book it instead.'; end if;

  -- clock_timestamp(), not now(): two people joining inside one transaction (the tests do) still get a strict order.
  insert into public.class_waitlist(gym_id, session_id, user_id, status, joined_at)
  values (s.gym_id, p_session_id, auth.uid(), 'waiting', clock_timestamp())
  on conflict (session_id, user_id) do update
    set status = case when public.class_waitlist.status in ('waiting', 'offered') then public.class_waitlist.status else 'waiting' end,
        joined_at = case when public.class_waitlist.status in ('waiting', 'offered') then public.class_waitlist.joined_at else clock_timestamp() end,
        offered_at = case when public.class_waitlist.status in ('waiting', 'offered') then public.class_waitlist.offered_at else null end,
        offer_expires_at = case when public.class_waitlist.status in ('waiting', 'offered') then public.class_waitlist.offer_expires_at else null end,
        updated_at = now()
  returning * into v_row;

  return public.get_my_waitlist(p_session_id);
end
$function$;

-- Member: leave the line (or turn down an offer).
create function public.member_leave_waitlist(p_session_id uuid) returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_gym uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select gym_id into v_gym from public.class_sessions where id = p_session_id;
  if v_gym is null then raise exception 'Class session not found'; end if;
  if not private.can_write_gym(v_gym) then raise exception 'Read-only access'; end if;
  update public.class_waitlist set status = 'left', updated_at = now()
  where session_id = p_session_id and user_id = auth.uid() and status in ('waiting', 'offered');
  perform private.advance_waitlist(p_session_id);
  return jsonb_build_object('status', 'left');
end
$function$;

-- Member: where am I in the line for this class? status is none, waiting, offered, booked, left or expired.
create function public.get_my_waitlist(p_session_id uuid) returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_gym uuid;
  me public.class_waitlist%rowtype;
  v_pos integer;
  v_waiting integer;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select gym_id into v_gym from public.class_sessions where id = p_session_id;
  if v_gym is null then raise exception 'Class session not found'; end if;
  if not private.is_gym_member(v_gym) then raise exception 'Not a member of this gym'; end if;
  perform private.advance_waitlist(p_session_id);
  select count(*) into v_waiting from public.class_waitlist where session_id = p_session_id and status = 'waiting';
  select * into me from public.class_waitlist where session_id = p_session_id and user_id = auth.uid();
  if not found then return jsonb_build_object('status', 'none', 'waiting', v_waiting); end if;
  if me.status = 'waiting' then
    select count(*) into v_pos from public.class_waitlist w
    where w.session_id = p_session_id and w.status = 'waiting' and (w.joined_at, w.id) <= (me.joined_at, me.id);
  end if;
  return jsonb_build_object('status', me.status, 'position', v_pos, 'waiting', v_waiting, 'offer_expires_at', me.offer_expires_at);
end
$function$;

-- Owners and admins: the line for one class.
create function public.get_class_waitlist(p_gym_id uuid, p_session_id uuid)
 returns table(user_id uuid, display_name text, status text, joined_at timestamptz, offer_expires_at timestamptz)
 language plpgsql
 security definer
 set search_path to 'public', 'private', 'pg_temp'
as $function$
begin
  if not private.has_gym_role(p_gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]) then
    raise exception 'Not authorised';
  end if;
  if not exists (select 1 from public.class_sessions cs where cs.id = p_session_id and cs.gym_id = p_gym_id) then
    raise exception 'Class not found';
  end if;
  perform private.advance_waitlist(p_session_id);
  return query
  select w.user_id,
         coalesce(nullif(pr.display_name, ''), nullif(trim(concat_ws(' ', pr.first_name, pr.last_name)), ''), 'Member'),
         w.status, w.joined_at, w.offer_expires_at
  from public.class_waitlist w
  left join public.profiles pr on pr.id = w.user_id
  where w.session_id = p_session_id and w.gym_id = p_gym_id and w.status in ('waiting', 'offered')
  order by (w.status = 'offered') desc, w.joined_at, w.id;
end
$function$;

revoke all on function public.member_join_waitlist(uuid), public.member_leave_waitlist(uuid), public.get_my_waitlist(uuid), public.get_class_waitlist(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.member_join_waitlist(uuid), public.member_leave_waitlist(uuid), public.get_my_waitlist(uuid), public.get_class_waitlist(uuid, uuid)
  to authenticated;

-- The two booking functions, as in 20261005120000 plus the waitlist hold. Their existing grants stay as they are.
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

commit;
