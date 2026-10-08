-- Let an owner or admin manage the people on a class: mark attended or no-show (or undo), remove a booking,
-- or add a member. Today nobody can change a booking directly (signed-in users only have SELECT on
-- public.class_bookings), so the old page's attended / no-show buttons cannot work. This adds ONE checked
-- function instead of opening the table to direct writes. Additive: nothing existing is changed or granted.
--
-- Actions (p_action):
--   'attended' | 'no_show' | 'booked'  set the status of an existing active booking ('booked' undoes a mark)
--   'cancel'                           remove the booking (kept as cancelled, with the time)
--   'add'                              book the member into the class
-- Rules:
--   * Owners and admins of the gym only; the class and the person must belong to the gym.
--   * 'add': the class must not be cancelled and the person must be an active member of this gym with
--     access. It refuses when the class is full (every non-cancelled booking counts). It does NOT apply the
--     member self-service rules (reserved spaces, membership includes classes, class not started): the owner
--     is choosing to put them there, so those problems come back as WARNINGS in the result, not refusals.
--   * A cancelled booking can be added again (the same row is reused); an active one cannot be added twice.
--   * Marking is only for an active (booked / attended / no_show) booking.
--   * The existing booking-notification trigger still runs on the status change, exactly as for a member.
begin;

create function public.admin_manage_class_booking(
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

revoke all on function public.admin_manage_class_booking(uuid, uuid, uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_manage_class_booking(uuid, uuid, uuid, text) to authenticated;

commit;
