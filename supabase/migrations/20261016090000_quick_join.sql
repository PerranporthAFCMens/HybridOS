-- Quick join, part 1 of 4: the database. No screen changes yet.
--
-- "Quick join" lets a gym take payment first and collect the rest afterwards. Today nobody can join until their name, date of
-- birth, mobile, address, emergency contact and (if the gym has them) signature are all in. Under Quick join only the name,
-- date of birth and mobile are needed before paying (plus a parent or guardian under 18); the emergency contact, address and
-- signed waiver become a short checklist after paying, and the gym can hold the door code until the checklist is done.
--
-- What this adds
--   public.gym_join_settings            one row per gym, written only by save_join_settings (sign_before_paying is set by the owner's settings screen, part 4). A gym with no row is "full", which is
--                                       exactly how joining works today. The ask_* choices below apply to Quick join only.
--   private.join_settings_for(gym)      the settings for a gym, or the defaults when it has no row
--   private.member_gaps(user, gym)      changed: for a "full" gym it behaves as before; for a "quick" gym it asks only for the basics
--                                       (and a parent or guardian under 18). It is what the join and payment functions check.
--   private.member_ready_items(user, gym) / member_is_ready(user, gym)
--                                       the checklist after joining (emergency contact, waiver, address) and whether the required
--                                       items are done
--   private.member_may_see_door_code(gym)
--                                       false only for a person who joined a Quick join gym since it switched on, whose gym holds
--                                       the code, and who has not finished the required items. Staff always see it. The
--                                       new restrictive policy "door code held until finished" on gym_access_settings asks this, on top of the existing policy.
--   public.save_my_basics / save_my_emergency / save_my_address
--                                       save one part of the person's details at a time (the same checks as save_my_join_details)
--   public.get_my_ready_status(gym)     what the person still has to do, and whether the door code is being held
--   public.save_join_settings(...)      owner or admin changes the gym's choices
--   public.get_unfinished_members(gym)  owner, admin and staff: who has paid but not finished (Quick join gyms only)
--   public.get_public_gym_join_style(slug)  what the sign-up page needs to know (public by design)
--
-- Also: the address and emergency contact columns of member_details may now be empty (a person can have paid before giving
-- them). Their checks still apply to anything that is saved.
--
-- Nothing changes for any gym until it is switched to Quick join. Existing members are never held: only people who joined
-- after the switch are. Rollback: supabase/rollback/20261016_drop_quick_join.sql. Check: supabase/verification/20261016_quick_join_check.sql.
-- Test: supabase/tests/quick_join.sql.

-- ---------------------------------------------------------------------------------------------------------------
-- A person can have paid before giving their address and emergency contact
-- ---------------------------------------------------------------------------------------------------------------
alter table public.member_details
  alter column address_line1 drop not null,
  alter column town drop not null,
  alter column postcode drop not null,
  alter column emergency_name drop not null,
  alter column emergency_phone drop not null,
  alter column emergency_relationship drop not null;

-- ---------------------------------------------------------------------------------------------------------------
-- The gym's choices
-- ---------------------------------------------------------------------------------------------------------------
create table public.gym_join_settings (
  gym_id uuid primary key references public.gyms(id) on delete cascade,
  join_style text not null default 'full' check (join_style in ('quick', 'full')),
  ask_address text not null default 'optional' check (ask_address in ('required', 'optional', 'off')),
  ask_emergency text not null default 'required' check (ask_emergency in ('required', 'optional', 'off')),
  ask_documents text not null default 'required' check (ask_documents in ('required', 'optional')),
  hold_door_code boolean not null default true,
  quick_since timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  -- true: the terms and waiver are read and signed before paying (the database refuses to take payment until they are); false: after paying
  sign_before_paying boolean not null default false
);

alter table public.gym_join_settings enable row level security;
revoke all on table public.gym_join_settings from anon, authenticated;
grant select on table public.gym_join_settings to authenticated;

create policy "join settings readable by the team" on public.gym_join_settings for select to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role, 'staff'::public.gym_member_role]));

-- The settings for a gym; a gym with no row is "full", with the usual choices.
create function private.join_settings_for(p_gym uuid) returns public.gym_join_settings language sql stable security definer set search_path to '' as
$$ select coalesce((select s from public.gym_join_settings s where s.gym_id = p_gym),
                   (select row(p_gym, 'full', 'optional', 'required', 'required', true, null, now(), null, false)::public.gym_join_settings)) $$;
revoke all on function private.join_settings_for(uuid) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- What is missing before someone may join (replaces the version in 20261011180000)
-- ---------------------------------------------------------------------------------------------------------------
-- Full gym: as before, and a person with a half-filled row (possible only after a gym switched style) is also told about
-- the address and emergency contact. Quick gym: the basics, and a parent or guardian under 18. The signature, the emergency
-- contact and the address come later (private.member_ready_items).
create or replace function private.member_gaps(p_user_id uuid, p_gym_id uuid) returns text[]
language plpgsql stable security definer set search_path to 'public', 'private', 'pg_temp' as $$
declare
  p public.profiles%rowtype;
  d public.member_details%rowtype;
  s public.gym_join_settings%rowtype;
  gaps text[] := '{}';
  v_minor boolean;
begin
  select * into p from public.profiles where id = p_user_id;
  select * into d from public.member_details where user_id = p_user_id;
  s := private.join_settings_for(p_gym_id);

  if coalesce(btrim(p.first_name), '') = '' then gaps := array_append(gaps, 'first name'); end if;
  if coalesce(btrim(p.last_name), '') = '' then gaps := array_append(gaps, 'last name'); end if;
  if p.date_of_birth is null or p.date_of_birth < date '1900-01-01' or p.date_of_birth > current_date then
    gaps := array_append(gaps, 'date of birth');
  end if;
  if coalesce(d.phone, '') = '' then gaps := array_append(gaps, 'mobile number'); end if;

  v_minor := p.date_of_birth is not null and p.date_of_birth > (current_date - interval '18 years')::date;

  if s.join_style = 'quick' then
    if v_minor and (coalesce(d.guardian_name, '') = '' or coalesce(d.guardian_phone, '') = '') then
      gaps := array_append(gaps, 'parent or guardian');
    end if;
    -- A gym that wants the terms and waiver signed before paying: joining and paying are refused until they are.
    if s.sign_before_paying and exists (
      select 1 from public.gym_signup_documents gd
      where gd.gym_id = p_gym_id and gd.is_current
        and not exists (
          select 1 from public.member_signatures sg
          where sg.gym_id = p_gym_id and sg.user_id = p_user_id
            and (sg.terms_document_id = gd.id or sg.waiver_document_id = gd.id)
        )
    ) then
      gaps := array_append(gaps, 'signature on the terms and waiver');
    end if;
    return gaps;
  end if;

  if d.user_id is null then
    gaps := array_append(array_append(gaps, 'address'), 'emergency contact');
  else
    if d.address_line1 is null or d.town is null or d.postcode is null then gaps := array_append(gaps, 'address'); end if;
    if d.emergency_name is null or d.emergency_phone is null or d.emergency_relationship is null then
      gaps := array_append(gaps, 'emergency contact');
    end if;
    if v_minor and (coalesce(d.guardian_name, '') = '' or coalesce(d.guardian_phone, '') = '') then
      gaps := array_append(gaps, 'parent or guardian');
    end if;
  end if;

  if exists (
    select 1 from public.gym_signup_documents gd
    where gd.gym_id = p_gym_id and gd.is_current
      and not exists (
        select 1 from public.member_signatures sg
        where sg.gym_id = p_gym_id and sg.user_id = p_user_id
          and (sg.terms_document_id = gd.id or sg.waiver_document_id = gd.id)
      )
  ) then
    gaps := array_append(gaps, 'signature on the terms and waiver');
  end if;

  return gaps;
end$$;

-- ---------------------------------------------------------------------------------------------------------------
-- The checklist after joining
-- ---------------------------------------------------------------------------------------------------------------
-- A json list of {key, label, required, done}. An item the gym switched off is left out; the signature is left out when the
-- gym has no current terms or waiver.
create function private.member_ready_items(p_user_id uuid, p_gym_id uuid) returns jsonb
language plpgsql stable security definer set search_path to 'public', 'private', 'pg_temp' as $$
declare
  d public.member_details%rowtype;
  s public.gym_join_settings%rowtype;
  items jsonb := '[]'::jsonb;
  v_has_docs boolean;
  v_unsigned boolean;
begin
  select * into d from public.member_details where user_id = p_user_id;
  s := private.join_settings_for(p_gym_id);

  if s.ask_emergency <> 'off' then
    items := items || jsonb_build_array(jsonb_build_object(
      'key', 'emergency', 'label', 'Emergency contact', 'required', s.ask_emergency = 'required',
      'done', d.emergency_name is not null and d.emergency_phone is not null and d.emergency_relationship is not null));
  end if;

  select exists (select 1 from public.gym_signup_documents gd where gd.gym_id = p_gym_id and gd.is_current) into v_has_docs;
  if v_has_docs then
    select exists (
      select 1 from public.gym_signup_documents gd
      where gd.gym_id = p_gym_id and gd.is_current
        and not exists (
          select 1 from public.member_signatures sg
          where sg.gym_id = p_gym_id and sg.user_id = p_user_id
            and (sg.terms_document_id = gd.id or sg.waiver_document_id = gd.id)
        )
    ) into v_unsigned;
    items := items || jsonb_build_array(jsonb_build_object(
      'key', 'documents', 'label', 'Health questions and waiver', 'required', s.ask_documents = 'required', 'done', not v_unsigned));
  end if;

  if s.ask_address <> 'off' then
    items := items || jsonb_build_array(jsonb_build_object(
      'key', 'address', 'label', 'Your address', 'required', s.ask_address = 'required',
      'done', d.address_line1 is not null and d.town is not null and d.postcode is not null));
  end if;

  return items;
end$$;
revoke all on function private.member_ready_items(uuid, uuid) from public, anon, authenticated, service_role;

create function private.member_is_ready(p_user_id uuid, p_gym_id uuid) returns boolean
language sql stable security definer set search_path to 'public', 'private', 'pg_temp' as $$
  select not exists (
    select 1 from jsonb_array_elements(private.member_ready_items(p_user_id, p_gym_id)) i
    where (i->>'required')::boolean and not (i->>'done')::boolean)
$$;
revoke all on function private.member_is_ready(uuid, uuid) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- The door code
-- ---------------------------------------------------------------------------------------------------------------
-- True for the team, and for every member except one who joined a Quick join gym since it switched on, whose gym holds the
-- code until the checklist is done, and who has not finished the required items. Used by the row security policy below.
create function private.member_may_see_door_code(p_gym uuid) returns boolean
language plpgsql stable security definer set search_path to 'public', 'private', 'pg_temp' as $$
declare
  v_uid uuid := (select auth.uid());
  s public.gym_join_settings%rowtype;
  v_joined timestamptz;
begin
  if v_uid is null then return false; end if;
  if private.has_gym_role(p_gym, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role, 'staff'::public.gym_member_role, 'coach'::public.gym_member_role]) then
    return true;
  end if;
  s := private.join_settings_for(p_gym);
  if s.join_style <> 'quick' or not s.hold_door_code or s.quick_since is null then return true; end if;
  select gm.created_at into v_joined from public.gym_members gm where gm.gym_id = p_gym and gm.user_id = v_uid;
  if v_joined is null or v_joined < s.quick_since then return true; end if;
  return private.member_is_ready(v_uid, p_gym);
end$$;
revoke all on function private.member_may_see_door_code(uuid) from public, anon;
grant execute on function private.member_may_see_door_code(uuid) to authenticated;

-- A restrictive policy is ANDed with the existing "access settings readable by active members" policy, which is left exactly as it is.
create policy "door code held until finished" on public.gym_access_settings as restrictive for select to authenticated
  using (private.member_may_see_door_code(gym_id));

-- ---------------------------------------------------------------------------------------------------------------
-- Saving details a part at a time (the same checks as save_my_join_details)
-- ---------------------------------------------------------------------------------------------------------------
create function public.save_my_basics(
  p_first_name text, p_last_name text, p_date_of_birth date, p_phone text, p_guardian_name text, p_guardian_phone text
) returns jsonb
language plpgsql security definer set search_path to 'public', 'private', 'pg_temp' as $$
declare
  v_uid uuid := auth.uid();
  v_first text := btrim(coalesce(p_first_name, ''));
  v_last text := btrim(coalesce(p_last_name, ''));
  v_g_name text := nullif(btrim(coalesce(p_guardian_name, '')), '');
  v_g_phone text := nullif(btrim(coalesce(p_guardian_phone, '')), '');
  v_under_18 boolean;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  if v_first = '' or char_length(v_first) > 80 then raise exception 'Enter your first name.'; end if;
  if v_last = '' or char_length(v_last) > 80 then raise exception 'Enter your last name.'; end if;
  if p_date_of_birth is null or p_date_of_birth < date '1900-01-01' or p_date_of_birth > current_date then
    raise exception 'Enter a valid date of birth.';
  end if;
  if p_phone is null or p_phone !~ '^\+[1-9][0-9]{6,14}$' then
    raise exception 'Enter a valid mobile number.';
  end if;

  v_under_18 := p_date_of_birth > (current_date - interval '18 years')::date;
  if v_under_18 and (v_g_name is null or v_g_phone is null) then
    raise exception 'Enter a parent or guardian name and phone number.';
  end if;
  if v_g_phone is not null and v_g_phone !~ '^\+[1-9][0-9]{6,14}$' then
    raise exception 'Enter a valid phone number for the parent or guardian.';
  end if;
  if char_length(coalesce(v_g_name, '')) > 80 then raise exception 'That guardian name is too long.'; end if;

  insert into public.profiles(id, first_name, last_name, display_name, date_of_birth)
  values (v_uid, v_first, v_last, v_first || ' ' || v_last, p_date_of_birth)
  on conflict (id) do update
    set first_name = excluded.first_name,
        last_name = excluded.last_name,
        -- A name the person chose is kept. An empty one, or the email address every new account starts with, becomes "First Last".
        display_name = case
          when coalesce(btrim(public.profiles.display_name), '') = '' or public.profiles.display_name like '%@%' then excluded.display_name
          else public.profiles.display_name
        end,
        date_of_birth = excluded.date_of_birth,
        updated_at = now();

  insert into public.member_details(user_id, phone, guardian_name, guardian_phone)
  values (v_uid, p_phone, case when v_under_18 then v_g_name end, case when v_under_18 then v_g_phone end)
  on conflict (user_id) do update
    set phone = excluded.phone, guardian_name = excluded.guardian_name, guardian_phone = excluded.guardian_phone;

  return jsonb_build_object('ok', true, 'under_18', v_under_18);
end$$;
revoke all on function public.save_my_basics(text, text, date, text, text, text) from public, anon;
grant execute on function public.save_my_basics(text, text, date, text, text, text) to authenticated;

create function public.save_my_emergency(p_name text, p_phone text, p_relationship text) returns jsonb
language plpgsql security definer set search_path to 'public', 'private', 'pg_temp' as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_rel text := btrim(coalesce(p_relationship, ''));
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if v_name = '' or char_length(v_name) > 80 then raise exception 'Enter your emergency contact''s name.'; end if;
  if p_phone is null or p_phone !~ '^\+[1-9][0-9]{6,14}$' then
    raise exception 'Enter a valid phone number for your emergency contact.';
  end if;
  if char_length(v_rel) < 2 or char_length(v_rel) > 40 then
    raise exception 'Enter your emergency contact''s relationship to you.';
  end if;

  insert into public.profiles(id) values (v_uid) on conflict (id) do nothing;
  insert into public.member_details(user_id, emergency_name, emergency_phone, emergency_relationship)
  values (v_uid, v_name, p_phone, v_rel)
  on conflict (user_id) do update
    set emergency_name = excluded.emergency_name, emergency_phone = excluded.emergency_phone,
        emergency_relationship = excluded.emergency_relationship;

  return jsonb_build_object('ok', true);
end$$;
revoke all on function public.save_my_emergency(text, text, text) from public, anon;
grant execute on function public.save_my_emergency(text, text, text) to authenticated;

create function public.save_my_address(p_line1 text, p_line2 text, p_town text, p_postcode text) returns jsonb
language plpgsql security definer set search_path to 'public', 'private', 'pg_temp' as $$
declare
  v_uid uuid := auth.uid();
  v_line1 text := btrim(coalesce(p_line1, ''));
  v_line2 text := nullif(btrim(coalesce(p_line2, '')), '');
  v_town text := btrim(coalesce(p_town, ''));
  v_pc text := upper(regexp_replace(btrim(coalesce(p_postcode, '')), '\s+', '', 'g'));
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if v_line1 = '' or char_length(v_line1) > 120 or char_length(coalesce(v_line2, '')) > 120 then
    raise exception 'Enter the first line of your address.';
  end if;
  if v_town = '' or char_length(v_town) > 80 then raise exception 'Enter your town or city.'; end if;
  if v_pc !~ '^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$' then raise exception 'Enter a valid UK postcode.'; end if;
  v_pc := substr(v_pc, 1, char_length(v_pc) - 3) || ' ' || substr(v_pc, char_length(v_pc) - 2);

  insert into public.profiles(id) values (v_uid) on conflict (id) do nothing;
  insert into public.member_details(user_id, address_line1, address_line2, town, postcode)
  values (v_uid, v_line1, v_line2, v_town, v_pc)
  on conflict (user_id) do update
    set address_line1 = excluded.address_line1, address_line2 = excluded.address_line2,
        town = excluded.town, postcode = excluded.postcode;

  return jsonb_build_object('ok', true);
end$$;
revoke all on function public.save_my_address(text, text, text, text) from public, anon;
grant execute on function public.save_my_address(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- What the person still has to do
-- ---------------------------------------------------------------------------------------------------------------
create function public.get_my_ready_status(p_gym_id uuid) returns jsonb
language plpgsql stable security definer set search_path to 'public', 'private', 'pg_temp' as $$
declare
  v_uid uuid := auth.uid();
  s public.gym_join_settings%rowtype;
  v_items jsonb;
  v_ready boolean;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.gym_members gm where gm.gym_id = p_gym_id and gm.user_id = v_uid and gm.is_active = true) then
    return null;
  end if;
  s := private.join_settings_for(p_gym_id);
  v_items := private.member_ready_items(v_uid, p_gym_id);
  v_ready := private.member_is_ready(v_uid, p_gym_id);
  return jsonb_build_object(
    'style', s.join_style,
    'ready', v_ready,
    'held', not private.member_may_see_door_code(p_gym_id),
    'items', v_items);
end$$;
revoke all on function public.get_my_ready_status(uuid) from public, anon;
grant execute on function public.get_my_ready_status(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- The gym's choices: changing them, and who has not finished
-- ---------------------------------------------------------------------------------------------------------------
create function public.save_join_settings(
  p_gym_id uuid, p_join_style text, p_ask_address text, p_ask_emergency text, p_ask_documents text, p_hold_door_code boolean
) returns jsonb
language plpgsql security definer set search_path to 'public', 'private', 'pg_temp' as $$
declare
  v_uid uuid := auth.uid();
  old public.gym_join_settings%rowtype;
  v_since timestamptz;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not private.has_gym_role(p_gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]) then
    raise exception 'Only the gym''s owners and admins can change how people join.';
  end if;
  if p_join_style is null or p_join_style not in ('quick', 'full') then raise exception 'Choose quick join or full join.'; end if;
  if p_ask_address is null or p_ask_address not in ('required', 'optional', 'off') then raise exception 'Choose whether to ask for an address.'; end if;
  if p_ask_emergency is null or p_ask_emergency not in ('required', 'optional', 'off') then raise exception 'Choose whether to ask for an emergency contact.'; end if;
  if p_ask_documents is null or p_ask_documents not in ('required', 'optional') then raise exception 'Choose whether the waiver is required.'; end if;
  if p_hold_door_code is null then raise exception 'Choose whether to hold the door code.'; end if;

  select * into old from public.gym_join_settings where gym_id = p_gym_id;
  -- The date Quick join switched on: only people who join after it can be held, so nobody who is already a member is locked out.
  v_since := case
    when p_join_style = 'quick' and (old.gym_id is null or old.join_style <> 'quick' or old.quick_since is null) then now()
    else old.quick_since end;

  insert into public.gym_join_settings(gym_id, join_style, ask_address, ask_emergency, ask_documents, hold_door_code, quick_since, updated_at, updated_by)
  values (p_gym_id, p_join_style, p_ask_address, p_ask_emergency, p_ask_documents, p_hold_door_code, v_since, now(), v_uid)
  on conflict (gym_id) do update
    set join_style = excluded.join_style, ask_address = excluded.ask_address, ask_emergency = excluded.ask_emergency,
        ask_documents = excluded.ask_documents, hold_door_code = excluded.hold_door_code, quick_since = excluded.quick_since,
        updated_at = now(), updated_by = v_uid;

  return jsonb_build_object('ok', true, 'join_style', p_join_style, 'quick_since', v_since);
end$$;
revoke all on function public.save_join_settings(uuid, text, text, text, text, boolean) from public, anon;
grant execute on function public.save_join_settings(uuid, text, text, text, text, boolean) to authenticated;

-- Members of a Quick join gym who joined since it switched on and have not finished the required items.
create function public.get_unfinished_members(p_gym_id uuid)
returns table(user_id uuid, member_name text, joined_at timestamptz, missing text[], door_code_held boolean)
language plpgsql stable security definer set search_path to 'public', 'private', 'pg_temp' as $$
declare s public.gym_join_settings%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not private.has_gym_role(p_gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role, 'staff'::public.gym_member_role]) then
    raise exception 'Not allowed';
  end if;
  s := private.join_settings_for(p_gym_id);
  if s.join_style <> 'quick' or s.quick_since is null then return; end if;
  return query
  select m.user_id,
         coalesce(nullif(btrim(pr.display_name), ''), nullif(btrim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), ''), 'Member'),
         m.created_at,
         array(select lower(i->>'label') from jsonb_array_elements(private.member_ready_items(m.user_id, p_gym_id)) i
               where (i->>'required')::boolean and not (i->>'done')::boolean),
         s.hold_door_code
  from public.gym_members m
  left join public.profiles pr on pr.id = m.user_id
  where m.gym_id = p_gym_id and m.is_active = true and m.role = 'member' and m.created_at >= s.quick_since
    and not private.member_is_ready(m.user_id, p_gym_id)
  order by m.created_at;
end$$;
revoke all on function public.get_unfinished_members(uuid) from public, anon;
grant execute on function public.get_unfinished_members(uuid) to authenticated;

-- What the sign-up page needs to know before it shows any screens (public by design, by gym slug).
create function public.get_public_gym_join_style(p_gym_slug text) returns jsonb
language plpgsql stable security definer set search_path to 'public', 'private', 'pg_temp' as $$
declare v_gym uuid; s public.gym_join_settings%rowtype;
begin
  select id into v_gym from public.gyms where slug = p_gym_slug;
  if v_gym is null then return null; end if;
  s := private.join_settings_for(v_gym);
  return jsonb_build_object('join_style', s.join_style, 'ask_address', s.ask_address, 'ask_emergency', s.ask_emergency, 'ask_documents', s.ask_documents, 'sign_before_paying', s.sign_before_paying);
end$$;
revoke all on function public.get_public_gym_join_style(text) from public;
grant execute on function public.get_public_gym_join_style(text) to anon, authenticated;
