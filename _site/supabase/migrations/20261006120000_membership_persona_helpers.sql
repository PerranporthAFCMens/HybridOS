-- Stage 3 test helpers: let the disposable membership personas be created and removed by the
-- service role through two tightly locked SECURITY DEFINER functions (the service role has no direct
-- write grants on these tables). Puffin Performance ONLY; users must match the persona email pattern.
-- Rollback: supabase/rollback/20261006_drop_membership_persona_helpers.sql

create or replace function public.hybridone_membership_persona_setup(target_user_id uuid, persona text)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_email text;
  v_puffin constant uuid := 'aec16956-3793-4543-873b-4412646ca1eb'::uuid;
  v_token uuid;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'Service role required'; end if;
  if persona is null or persona not in ('active','paused','cancelled','pending','expired','superseded') then raise exception 'Unknown persona'; end if;
  select lower(email) into v_email from auth.users where id = target_user_id;
  if v_email is null or v_email !~ '^delivered\+persona-[a-z0-9]{6,20}-(active|paused|cancelled|pending|expired|superseded)@resend\.dev$' or v_email not like '%-' || persona || '@resend.dev' then
    raise exception 'Not an approved persona user';
  end if;

  delete from public.calendar_feed_tokens where user_id = target_user_id and gym_id = v_puffin;
  delete from public.memberships where user_id = target_user_id and gym_id = v_puffin;
  delete from public.gym_members where user_id = target_user_id and gym_id = v_puffin;

  insert into public.profiles(id, display_name, first_name, last_name, updated_at)
  values (target_user_id, 'Persona ' || persona, 'Persona', persona, now())
  on conflict (id) do update set display_name = excluded.display_name, updated_at = now();

  insert into public.gym_members(gym_id, user_id, role, is_active, access_status, joined_at, updated_at, access_revoked_at)
  values (v_puffin, target_user_id, 'member'::public.gym_member_role, true, 'active', now(), now(), null);

  if persona = 'active' then
    insert into public.memberships(gym_id, user_id, status, starts_on, ends_on, created_at) values (v_puffin, target_user_id, 'active', current_date - 30, null, now());
  elsif persona = 'paused' then
    insert into public.memberships(gym_id, user_id, status, starts_on, ends_on, created_at) values (v_puffin, target_user_id, 'paused', current_date - 30, null, now());
  elsif persona = 'cancelled' then
    insert into public.memberships(gym_id, user_id, status, starts_on, ends_on, created_at) values (v_puffin, target_user_id, 'cancelled', current_date - 60, current_date - 1, now());
  elsif persona = 'pending' then
    insert into public.memberships(gym_id, user_id, status, starts_on, ends_on, created_at) values (v_puffin, target_user_id, 'pending', null, null, now());
  elsif persona = 'expired' then
    insert into public.memberships(gym_id, user_id, status, starts_on, ends_on, created_at) values (v_puffin, target_user_id, 'active', current_date - 60, current_date - 1, now());
  else -- superseded: older active row, newer cancelled row; the newest row governs
    insert into public.memberships(gym_id, user_id, status, starts_on, ends_on, created_at) values (v_puffin, target_user_id, 'active', current_date - 90, null, now() - interval '2 days');
    insert into public.memberships(gym_id, user_id, status, starts_on, ends_on, created_at) values (v_puffin, target_user_id, 'cancelled', current_date - 90, current_date - 1, now());
  end if;

  insert into public.calendar_feed_tokens(gym_id, user_id, is_active) values (v_puffin, target_user_id, true) returning token into v_token;
  return v_token;
end;
$function$;

create or replace function public.hybridone_membership_persona_cleanup(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_email text;
  v_puffin constant uuid := 'aec16956-3793-4543-873b-4412646ca1eb'::uuid;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'Service role required'; end if;
  select lower(email) into v_email from auth.users where id = target_user_id;
  if v_email is null or v_email !~ '^delivered\+persona-[a-z0-9]{6,20}-(active|paused|cancelled|pending|expired|superseded)@resend\.dev$' then
    raise exception 'Not an approved persona user';
  end if;
  delete from public.calendar_feed_tokens where user_id = target_user_id and gym_id = v_puffin;
  delete from public.class_bookings where user_id = target_user_id and gym_id = v_puffin;
  delete from public.memberships where user_id = target_user_id and gym_id = v_puffin;
  delete from public.gym_members where user_id = target_user_id and gym_id = v_puffin;
  delete from public.profiles where id = target_user_id;
end;
$function$;

revoke all on function public.hybridone_membership_persona_setup(uuid, text) from public, anon, authenticated;
revoke all on function public.hybridone_membership_persona_cleanup(uuid) from public, anon, authenticated;
grant execute on function public.hybridone_membership_persona_setup(uuid, text) to service_role;
grant execute on function public.hybridone_membership_persona_cleanup(uuid) to service_role;
