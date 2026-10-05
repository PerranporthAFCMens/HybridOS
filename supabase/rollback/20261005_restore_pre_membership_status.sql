-- NOT APPLIED. Rollback for 20261005120000_membership_status_enforcement.sql.
-- Restores the pre-Stage-2a definitions. Every function and policy below was copied programmatically from
-- supabase/migrations/20260930000000_live_schema_baseline.sql (later migrations only change function ACLs), not retyped.
-- Function ACLs are untouched by CREATE OR REPLACE, so the grants from the earlier migrations are preserved.

begin;
-- 1. drop the new policies
drop policy "plans readable by active paused and pending members" on public.membership_plans;
drop policy "members read own gym member row" on public.gym_members;
drop policy "gyms readable by creator and non-ended members" on public.gyms;
drop policy "own workout sessions readable when active or paused" on public.workout_sessions;
drop policy "own workout sessions insertable when active" on public.workout_sessions;
drop policy "own workout sessions updatable when active" on public.workout_sessions;
drop policy "own workout sessions deletable when active" on public.workout_sessions;
drop policy "own workout entries readable when active or paused" on public.workout_entries;
drop policy "own workout entries insertable when active" on public.workout_entries;
drop policy "own workout entries updatable when active" on public.workout_entries;
drop policy "own workout entries deletable when active" on public.workout_entries;
drop policy "own workout sets readable when active or paused" on public.workout_sets;
drop policy "own workout sets insertable when active" on public.workout_sets;
drop policy "own workout sets updatable when active" on public.workout_sets;
drop policy "own workout sets deletable when active" on public.workout_sets;
drop policy "own personal bests readable when active or paused" on public.personal_bests;
drop policy "own personal bests insertable when active" on public.personal_bests;
drop policy "own personal bests updatable when active" on public.personal_bests;
drop policy "own personal bests deletable when active" on public.personal_bests;
drop policy "own workout assignments readable when active or paused" on public.workout_assignments;
drop policy "own training preferences readable when active or paused" on public.member_training_preferences;
drop policy "own class bookings readable when active" on public.class_bookings;
drop policy "own pt appointments readable when active" on public.pt_appointments;
drop policy "own payments readable when active or admin reads" on public.payment_records;
drop policy "social posts readable by active members" on public.social_posts;
drop policy "social comments readable by active members" on public.social_comments;
drop policy "social reactions readable by active members" on public.social_reactions;
drop policy "access settings readable by active members" on public.gym_access_settings;

-- 2. recreate the original policies (exact text from the baseline)
create policy "gym members can read plans" on public.membership_plans for select to "authenticated" using (private.is_gym_member(gym_id));
create policy "authorized users can read gyms" on public.gyms for select to "authenticated" using (((created_by = ( SELECT auth.uid() AS uid)) OR private.is_gym_member(id)));
create policy "members_manage_own_workout_sessions" on public.workout_sessions for all to "authenticated" using (((user_id = auth.uid()) AND private.can_write_gym(gym_id))) with check (((user_id = auth.uid()) AND private.can_write_gym(gym_id)));
create policy "members_manage_own_workout_entries" on public.workout_entries for all to "authenticated" using (((user_id = auth.uid()) AND private.can_write_gym(gym_id))) with check (((user_id = auth.uid()) AND private.can_write_gym(gym_id) AND (EXISTS ( SELECT 1
   FROM workout_sessions ws
  WHERE ((ws.id = workout_entries.session_id) AND (ws.user_id = auth.uid()) AND (ws.gym_id = workout_entries.gym_id))))));
create policy "members_manage_sets_for_own_entries" on public.workout_sets for all to "authenticated" using ((EXISTS ( SELECT 1
   FROM workout_entries we
  WHERE ((we.id = workout_sets.entry_id) AND (we.user_id = auth.uid()) AND private.can_write_gym(we.gym_id))))) with check ((EXISTS ( SELECT 1
   FROM workout_entries we
  WHERE ((we.id = workout_sets.entry_id) AND (we.user_id = auth.uid()) AND private.can_write_gym(we.gym_id)))));
create policy "members_manage_own_personal_bests" on public.personal_bests for all to public using (((user_id = auth.uid()) AND private.can_write_gym(gym_id))) with check (((user_id = auth.uid()) AND private.can_write_gym(gym_id)));
create policy "members read own workout assignments" on public.workout_assignments for select to "authenticated" using (((member_user_id = ( SELECT auth.uid() AS uid)) AND private.is_gym_member(gym_id)));
create policy "members read own training preferences" on public.member_training_preferences for select to "authenticated" using (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM gym_members gm
  WHERE ((gm.gym_id = member_training_preferences.gym_id) AND (gm.user_id = auth.uid()) AND (gm.is_active = true))))));
create policy "users can view own class bookings" on public.class_bookings for select to "authenticated" using ((user_id = auth.uid()));
create policy "members can view own pt appointments" on public.pt_appointments for select to "authenticated" using ((member_user_id = auth.uid()));
create policy "gym users can read relevant payments" on public.payment_records for select to "authenticated" using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.has_gym_role(payment_records.gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]) AS has_gym_role)));
create policy "gym members read social posts" on public.social_posts for select to public using ((EXISTS ( SELECT 1
   FROM gym_members gm
  WHERE ((gm.gym_id = social_posts.gym_id) AND (gm.user_id = auth.uid()) AND gm.is_active))));
create policy "gym members read social comments" on public.social_comments for select to public using ((EXISTS ( SELECT 1
   FROM gym_members gm
  WHERE ((gm.gym_id = social_comments.gym_id) AND (gm.user_id = auth.uid()) AND gm.is_active))));
create policy "gym members read social reactions" on public.social_reactions for select to public using ((EXISTS ( SELECT 1
   FROM gym_members gm
  WHERE ((gm.gym_id = social_reactions.gym_id) AND (gm.user_id = auth.uid()) AND gm.is_active))));
create policy "gym members can view access settings" on public.gym_access_settings for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM gym_members gm
  WHERE ((gm.gym_id = gym_access_settings.gym_id) AND (gm.user_id = auth.uid()) AND (gm.is_active = true)))));

-- 3. restore the original function definitions (exact text from the baseline)
CREATE OR REPLACE FUNCTION private.is_gym_member(target_gym_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
  select exists (
    select 1
    from public.gym_members gm
    where gm.gym_id = target_gym_id
      and gm.user_id = (select auth.uid())
      and gm.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION private.can_write_gym(target_gym_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
  select exists (
    select 1
    from public.gym_members gm
    where gm.gym_id = target_gym_id
      and gm.user_id = (select auth.uid())
      and gm.is_active = true
      and gm.access_status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION private.can_view_profile(target_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
  select exists (
    select 1
    from public.gym_members mine
    join public.gym_members theirs on theirs.gym_id = mine.gym_id
    where mine.user_id = (select auth.uid())
      and mine.is_active = true
      and theirs.user_id = target_user_id
      and theirs.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION private.member_has_class_access(p_gym_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
  select coalesce((
    select mp.includes_classes
    from public.memberships m
    join public.membership_plans mp on mp.id=m.plan_id
    where m.gym_id=p_gym_id and m.user_id=p_user_id and m.status='active'
      and (m.starts_on is null or m.starts_on<=current_date)
      and (m.ends_on is null or m.ends_on>=current_date)
    order by m.created_at desc
    limit 1
  ),false)
$$;

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
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into v_session from public.class_sessions where id = p_session_id for update;
  if not found then raise exception 'Class session not found'; end if;
  if not private.can_write_gym(v_session.gym_id) then raise exception 'Not a member of this gym'; end if;
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
  from public.memberships m
  where m.gym_id = v_session.gym_id and m.user_id = auth.uid() and m.status = 'active'
    and (m.starts_on is null or m.starts_on <= current_date)
    and (m.ends_on is null or m.ends_on >= current_date)
  order by m.created_at desc limit 1;

  if v_plan_id is not null then
    select exists(select 1 from public.class_session_reserved_plans rp where rp.session_id = p_session_id and rp.plan_id = v_plan_id)
    into v_is_reserved_eligible;
  end if;

  if v_session.reserved_capacity > 0 and v_session.reserved_release_minutes_before is not null then
    v_reserved_released := now() >= (v_session.starts_at - make_interval(mins => v_session.reserved_release_minutes_before));
  end if;

  select count(*) into v_total_booked from public.class_bookings b
  where b.session_id = p_session_id and b.status = 'booked';
  if v_total_booked >= v_session.capacity then raise exception 'This class is full'; end if;

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
  return v_booking;
end$$;

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
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into s from public.class_sessions where id=p_session_id for update;
  if not found then raise exception 'Class session not found'; end if;
  if not private.can_write_gym(s.gym_id) then
    raise exception 'Not an active gym member';
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

  select count(*) into v_count from public.class_bookings b where b.session_id=p_session_id and b.status='booked';
  if s.capacity is not null and v_count>=s.capacity then raise exception 'This class is full'; end if;

  insert into public.class_bookings(gym_id,session_id,user_id,status,booked_at,cancelled_at)
  values(s.gym_id,p_session_id,auth.uid(),'booked',now(),null)
  on conflict(session_id,user_id) do update set status='booked',booked_at=now(),cancelled_at=null,updated_at=now()
  returning id into v_id;

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

CREATE OR REPLACE FUNCTION public.member_class_schedule(p_gym_id uuid, p_from timestamp with time zone DEFAULT now(), p_to timestamp with time zone DEFAULT (now() + '30 days'::interval))
 RETURNS TABLE(session_id uuid, name text, description text, starts_at timestamp with time zone, ends_at timestamp with time zone, capacity integer, booked_count integer, available_spaces integer, is_booked boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.gym_members gm where gm.gym_id=p_gym_id and gm.user_id=auth.uid() and gm.is_active) then
    raise exception 'Not an active gym member';
  end if;

  return query
  select s.id,
         s.name,
         s.description,
         s.starts_at,
         s.ends_at,
         s.capacity,
         count(b.id) filter (where b.status='booked')::integer as booked_count,
         greatest(coalesce(s.capacity,0) - count(b.id) filter (where b.status='booked')::integer,0) as available_spaces,
         exists(select 1 from public.class_bookings mine where mine.session_id=s.id and mine.user_id=auth.uid() and mine.status='booked') as is_booked
  from public.class_sessions s
  left join public.class_bookings b on b.session_id=s.id
  where s.gym_id=p_gym_id
    and not coalesce(s.is_cancelled,false)
    and s.starts_at>=p_from and s.starts_at<p_to
  group by s.id,s.name,s.description,s.starts_at,s.ends_at,s.capacity
  order by s.starts_at;
end;
$$;

CREATE OR REPLACE FUNCTION public.get_member_home_settings(p_gym_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_layout jsonb;
  v_cta jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.gym_members gm
    where gm.gym_id = p_gym_id
      and gm.user_id = auth.uid()
      and gm.is_active = true
  ) then
    raise exception 'Not authorised for this gym';
  end if;

  select home_layout, cta_config
    into v_layout, v_cta
  from public.gym_member_view_settings
  where gym_id = p_gym_id;

  return jsonb_build_object(
    'home_layout', coalesce(v_layout, '[]'::jsonb),
    'cta_config', coalesce(v_cta, '{}'::jsonb)
  );
end;
$$;

-- 4. drop the new helper functions (nothing references them any more)
drop function private.member_status_allows(uuid, text[]);
drop function private.current_membership_status(uuid, uuid);

commit;
