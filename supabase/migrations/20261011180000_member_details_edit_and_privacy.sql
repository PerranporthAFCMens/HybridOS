-- Staff can edit a member's personal details, and the owner chooses what the team can see.
--
-- 1. Editing. Until now only the member could write their own details (public.save_my_join_details), so an owner,
--    admin or staff member could read them but not correct them, or fill them in for someone the gym added by hand.
--    New: public.staff_save_member_details(...). It checks in the database that the caller is an active owner, admin or
--    staff member of the gym and that the person is a member of that same gym, applies the same validation as the
--    member's own form, and refuses staff editing an owner or admin.
--
-- 2. Privacy. The owner decides whether the team (admin, staff) can see members' mobile numbers and addresses.
--    * New table gym_privacy_settings, one row per gym, changed only by the owner through set_member_contact_visibility.
--      No row means both are visible, which is how things behave today.
--    * A member's mobile number used to live on profiles, which every member of the same gym can read. It now lives with
--      the address in member_details, which only the member and (through get_member_details) the gym's team can read.
--      Existing numbers are copied across, and a trigger keeps profiles.phone empty from now on.
--    * Staff no longer read member_details directly. They call get_member_details, which blanks the mobile number and
--      address when the owner has hidden them. The owner always sees everything. Emergency contact and parent or guardian
--      details stay visible to the team (they are needed in an emergency).
--    * If anything is hidden from the team, only the owner can save a member's details (nobody edits what they cannot see).
--
-- 3. Members can read nothing about each other beyond what a community needs. Only the gym's owner, admin and staff read
--    other people's details. Two more places where a member could read other members' details are closed:
--    * profiles.date_of_birth and profiles.gender were readable by every active member of the same gym. They are now
--      readable only by the person themselves, through get_my_private_profile, and by the team through get_member_details and
--      get_gym_member_demographics. Names, photos and bios stay readable (the community and class lists need them).
--    * the older "members" contact table (email and phone) was readable by every member of the gym; it is now readable by
--      the gym's owner, admin and staff, and by the person themselves.
--
-- No existing member is changed other than the phone copy above. Rollback: supabase/rollback/20261011_drop_member_details_edit_and_privacy.sql.
-- Check: supabase/verification/20261011_member_details_edit_and_privacy_check.sql. Test: supabase/tests/member_details_edit_and_privacy.sql.
begin;

-- ---------------------------------------------------------------------------------------------------------------
-- The mobile number moves next to the address
-- ---------------------------------------------------------------------------------------------------------------
alter table public.member_details
  add column phone text check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$');

update public.member_details d set phone = p.phone
  from public.profiles p
 where p.id = d.user_id and d.phone is null and p.phone ~ '^\+[1-9][0-9]{6,14}$';

update public.profiles set phone = null where phone is not null;

create function private.keep_phone_off_profiles() returns trigger
language plpgsql set search_path to 'public', 'pg_temp' as $$
begin
  new.phone := null;
  return new;
end$$;
revoke all on function private.keep_phone_off_profiles() from public, anon, authenticated;

create trigger profiles_keep_phone_out before insert or update on public.profiles
  for each row execute function private.keep_phone_off_profiles();

-- ---------------------------------------------------------------------------------------------------------------
-- The owner's choice
-- ---------------------------------------------------------------------------------------------------------------
create table public.gym_privacy_settings (
  gym_id uuid primary key references public.gyms(id) on delete cascade,
  team_sees_phone boolean not null default true,
  team_sees_address boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
alter table public.gym_privacy_settings enable row level security;
revoke all on table public.gym_privacy_settings from anon, authenticated;
grant select on table public.gym_privacy_settings to authenticated;
create policy "owners and admins read their gym privacy settings" on public.gym_privacy_settings for select to authenticated
  using (exists (select 1 from public.gym_members gm
                 where gm.gym_id = gym_privacy_settings.gym_id and gm.user_id = (select auth.uid())
                   and gm.is_active = true and gm.role in ('owner', 'admin')));

create function public.set_member_contact_visibility(p_gym_id uuid, p_team_sees_phone boolean, p_team_sees_address boolean)
returns jsonb
language plpgsql security definer set search_path to 'public', 'private', 'pg_temp' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.gym_members where gym_id = p_gym_id and user_id = v_uid and is_active = true and role = 'owner') then
    raise exception 'Only the gym''s owner can change who sees members'' contact details.';
  end if;
  if p_team_sees_phone is null or p_team_sees_address is null then raise exception 'Choose yes or no for each.'; end if;
  insert into public.gym_privacy_settings(gym_id, team_sees_phone, team_sees_address, updated_by)
  values (p_gym_id, p_team_sees_phone, p_team_sees_address, v_uid)
  on conflict (gym_id) do update
    set team_sees_phone = excluded.team_sees_phone, team_sees_address = excluded.team_sees_address,
        updated_at = now(), updated_by = excluded.updated_by;
  return jsonb_build_object('team_sees_phone', p_team_sees_phone, 'team_sees_address', p_team_sees_address);
end$$;
revoke all on function public.set_member_contact_visibility(uuid, boolean, boolean) from public, anon;
grant execute on function public.set_member_contact_visibility(uuid, boolean, boolean) to authenticated;

create function public.get_member_contact_visibility(p_gym_id uuid) returns jsonb
language plpgsql stable security definer set search_path to 'public', 'private', 'pg_temp' as $$
declare v_uid uuid := auth.uid(); s public.gym_privacy_settings%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.gym_members where gym_id = p_gym_id and user_id = v_uid and is_active = true and role in ('owner', 'admin', 'staff')) then
    raise exception 'Only the gym''s team can see this setting.';
  end if;
  select * into s from public.gym_privacy_settings where gym_id = p_gym_id;
  return jsonb_build_object('team_sees_phone', coalesce(s.team_sees_phone, true), 'team_sees_address', coalesce(s.team_sees_address, true));
end$$;
revoke all on function public.get_member_contact_visibility(uuid) from public, anon;
grant execute on function public.get_member_contact_visibility(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Staff read a member's details through a function that applies the owner's choice
-- ---------------------------------------------------------------------------------------------------------------
drop policy "members and gym staff read member details" on public.member_details;
create policy "members read their own details" on public.member_details for select to authenticated
  using (user_id = (select auth.uid()));

create function public.get_member_details(p_gym_id uuid, p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path to 'public', 'private', 'pg_temp' as $$
declare
  v_uid uuid := auth.uid();
  v_role public.gym_member_role;
  s public.gym_privacy_settings%rowtype;
  p public.profiles%rowtype;
  d public.member_details%rowtype;
  v_hide_phone boolean;
  v_hide_address boolean;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select role into v_role from public.gym_members where gym_id = p_gym_id and user_id = v_uid and is_active = true;
  if v_role is null or v_role not in ('owner', 'admin', 'staff') then
    raise exception 'Only the gym''s owners, admins and staff can see member details.';
  end if;
  if not exists (select 1 from public.gym_members where gym_id = p_gym_id and user_id = p_user_id and is_active = true) then
    raise exception 'That person is not a member of this gym.';
  end if;
  select * into s from public.gym_privacy_settings where gym_id = p_gym_id;
  v_hide_phone := v_role <> 'owner' and not coalesce(s.team_sees_phone, true);
  v_hide_address := v_role <> 'owner' and not coalesce(s.team_sees_address, true);
  select * into p from public.profiles where id = p_user_id;
  select * into d from public.member_details where user_id = p_user_id;
  return jsonb_build_object(
    'date_of_birth', p.date_of_birth,
    'phone_hidden', v_hide_phone,
    'address_hidden', v_hide_address,
    'phone', case when v_hide_phone then null else d.phone end,
    'has_details', d.user_id is not null,
    'address_line1', case when v_hide_address then null else d.address_line1 end,
    'address_line2', case when v_hide_address then null else d.address_line2 end,
    'town', case when v_hide_address then null else d.town end,
    'postcode', case when v_hide_address then null else d.postcode end,
    'emergency_name', d.emergency_name, 'emergency_phone', d.emergency_phone, 'emergency_relationship', d.emergency_relationship,
    'guardian_name', d.guardian_name, 'guardian_phone', d.guardian_phone
  );
end$$;
revoke all on function public.get_member_details(uuid, uuid) from public, anon;
grant execute on function public.get_member_details(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Editing
-- ---------------------------------------------------------------------------------------------------------------
create function public.staff_save_member_details(
  p_gym_id uuid, p_user_id uuid,
  p_first_name text, p_last_name text, p_date_of_birth date, p_phone text,
  p_address_line1 text, p_address_line2 text, p_town text, p_postcode text,
  p_emergency_name text, p_emergency_phone text, p_emergency_relationship text,
  p_guardian_name text, p_guardian_phone text
) returns jsonb
language plpgsql security definer set search_path to 'public', 'private', 'pg_temp' as $$
declare
  v_uid uuid := auth.uid();
  v_caller_role public.gym_member_role;
  v_target_role public.gym_member_role;
  s public.gym_privacy_settings%rowtype;
  v_first text := btrim(coalesce(p_first_name, ''));
  v_last text := btrim(coalesce(p_last_name, ''));
  v_line1 text := btrim(coalesce(p_address_line1, ''));
  v_line2 text := nullif(btrim(coalesce(p_address_line2, '')), '');
  v_town text := btrim(coalesce(p_town, ''));
  v_pc text := upper(regexp_replace(btrim(coalesce(p_postcode, '')), '\s+', '', 'g'));
  v_ec_name text := btrim(coalesce(p_emergency_name, ''));
  v_ec_rel text := btrim(coalesce(p_emergency_relationship, ''));
  v_g_name text := nullif(btrim(coalesce(p_guardian_name, '')), '');
  v_g_phone text := nullif(btrim(coalesce(p_guardian_phone, '')), '');
  v_under_18 boolean;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select role into v_caller_role from public.gym_members
   where gym_id = p_gym_id and user_id = v_uid and is_active = true;
  if v_caller_role is null or v_caller_role not in ('owner', 'admin', 'staff') then
    raise exception 'Only the gym''s owners, admins and staff can edit member details.';
  end if;

  select role into v_target_role from public.gym_members
   where gym_id = p_gym_id and user_id = p_user_id and is_active = true;
  if v_target_role is null then raise exception 'That person is not a member of this gym.'; end if;
  if v_caller_role = 'staff' and v_target_role in ('owner', 'admin') then
    raise exception 'Only an owner or admin can edit an owner''s or admin''s details.';
  end if;

  select * into s from public.gym_privacy_settings where gym_id = p_gym_id;
  if v_caller_role <> 'owner' and (not coalesce(s.team_sees_phone, true) or not coalesce(s.team_sees_address, true)) then
    raise exception 'Only the owner can edit these details, because they are hidden from the team.';
  end if;

  if v_first = '' or char_length(v_first) > 80 then raise exception 'Enter a first name.'; end if;
  if v_last = '' or char_length(v_last) > 80 then raise exception 'Enter a last name.'; end if;
  if p_date_of_birth is null or p_date_of_birth < date '1900-01-01' or p_date_of_birth > current_date then
    raise exception 'Enter a valid date of birth.';
  end if;
  if p_phone is null or p_phone !~ '^\+[1-9][0-9]{6,14}$' then
    raise exception 'Enter a valid mobile number.';
  end if;
  if v_line1 = '' or char_length(v_line1) > 120 or char_length(coalesce(v_line2, '')) > 120 then
    raise exception 'Enter the first line of the address.';
  end if;
  if v_town = '' or char_length(v_town) > 80 then raise exception 'Enter a town or city.'; end if;
  if v_pc !~ '^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$' then raise exception 'Enter a valid UK postcode.'; end if;
  v_pc := substr(v_pc, 1, char_length(v_pc) - 3) || ' ' || substr(v_pc, char_length(v_pc) - 2);
  if v_ec_name = '' or char_length(v_ec_name) > 80 then raise exception 'Enter the emergency contact''s name.'; end if;
  if p_emergency_phone is null or p_emergency_phone !~ '^\+[1-9][0-9]{6,14}$' then
    raise exception 'Enter a valid phone number for the emergency contact.';
  end if;
  if char_length(v_ec_rel) < 2 or char_length(v_ec_rel) > 40 then
    raise exception 'Enter the emergency contact''s relationship to the member.';
  end if;

  v_under_18 := p_date_of_birth > (current_date - interval '18 years')::date;
  if v_under_18 and (v_g_name is null or v_g_phone is null) then
    raise exception 'Enter a parent or guardian name and phone number.';
  end if;
  if v_g_phone is not null and v_g_phone !~ '^\+[1-9][0-9]{6,14}$' then
    raise exception 'Enter a valid phone number for the parent or guardian.';
  end if;
  if char_length(coalesce(v_g_name, '')) > 80 then raise exception 'That guardian name is too long.'; end if;

  update public.profiles
     set first_name = v_first, last_name = v_last, display_name = v_first || ' ' || v_last,
         date_of_birth = p_date_of_birth, updated_at = now()
   where id = p_user_id;
  if not found then raise exception 'That person has no profile.'; end if;

  insert into public.member_details(
    user_id, phone, address_line1, address_line2, town, postcode,
    emergency_name, emergency_phone, emergency_relationship, guardian_name, guardian_phone
  ) values (
    p_user_id, p_phone, v_line1, v_line2, v_town, v_pc,
    v_ec_name, p_emergency_phone, v_ec_rel,
    case when v_under_18 then v_g_name end, case when v_under_18 then v_g_phone end
  )
  on conflict (user_id) do update
    set phone = excluded.phone,
        address_line1 = excluded.address_line1, address_line2 = excluded.address_line2,
        town = excluded.town, postcode = excluded.postcode,
        emergency_name = excluded.emergency_name, emergency_phone = excluded.emergency_phone,
        emergency_relationship = excluded.emergency_relationship,
        guardian_name = excluded.guardian_name, guardian_phone = excluded.guardian_phone;

  return jsonb_build_object('ok', true, 'under_18', v_under_18);
end$$;
revoke all on function public.staff_save_member_details(uuid, uuid, text, text, date, text, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.staff_save_member_details(uuid, uuid, text, text, date, text, text, text, text, text, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- The member's own form now keeps the mobile number with the address
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.save_my_join_details(
  p_first_name text, p_last_name text, p_date_of_birth date, p_phone text,
  p_address_line1 text, p_address_line2 text, p_town text, p_postcode text,
  p_emergency_name text, p_emergency_phone text, p_emergency_relationship text,
  p_guardian_name text, p_guardian_phone text
) returns jsonb
language plpgsql security definer set search_path to 'public', 'private', 'pg_temp' as $$
declare
  v_uid uuid := auth.uid();
  v_first text := btrim(coalesce(p_first_name, ''));
  v_last text := btrim(coalesce(p_last_name, ''));
  v_line1 text := btrim(coalesce(p_address_line1, ''));
  v_line2 text := nullif(btrim(coalesce(p_address_line2, '')), '');
  v_town text := btrim(coalesce(p_town, ''));
  v_pc text := upper(regexp_replace(btrim(coalesce(p_postcode, '')), '\s+', '', 'g'));
  v_ec_name text := btrim(coalesce(p_emergency_name, ''));
  v_ec_rel text := btrim(coalesce(p_emergency_relationship, ''));
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
  if v_line1 = '' or char_length(v_line1) > 120 or char_length(coalesce(v_line2, '')) > 120 then
    raise exception 'Enter the first line of your address.';
  end if;
  if v_town = '' or char_length(v_town) > 80 then raise exception 'Enter your town or city.'; end if;
  if v_pc !~ '^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$' then raise exception 'Enter a valid UK postcode.'; end if;
  v_pc := substr(v_pc, 1, char_length(v_pc) - 3) || ' ' || substr(v_pc, char_length(v_pc) - 2);
  if v_ec_name = '' or char_length(v_ec_name) > 80 then raise exception 'Enter your emergency contact''s name.'; end if;
  if p_emergency_phone is null or p_emergency_phone !~ '^\+[1-9][0-9]{6,14}$' then
    raise exception 'Enter a valid phone number for your emergency contact.';
  end if;
  if char_length(v_ec_rel) < 2 or char_length(v_ec_rel) > 40 then
    raise exception 'Enter your emergency contact''s relationship to you.';
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
        display_name = coalesce(nullif(btrim(public.profiles.display_name), ''), excluded.display_name),
        date_of_birth = excluded.date_of_birth,
        updated_at = now();

  insert into public.member_details(
    user_id, phone, address_line1, address_line2, town, postcode,
    emergency_name, emergency_phone, emergency_relationship, guardian_name, guardian_phone
  ) values (
    v_uid, p_phone, v_line1, v_line2, v_town, v_pc,
    v_ec_name, p_emergency_phone, v_ec_rel,
    case when v_under_18 then v_g_name end, case when v_under_18 then v_g_phone end
  )
  on conflict (user_id) do update
    set phone = excluded.phone,
        address_line1 = excluded.address_line1, address_line2 = excluded.address_line2,
        town = excluded.town, postcode = excluded.postcode,
        emergency_name = excluded.emergency_name, emergency_phone = excluded.emergency_phone,
        emergency_relationship = excluded.emergency_relationship,
        guardian_name = excluded.guardian_name, guardian_phone = excluded.guardian_phone;

  return jsonb_build_object('ok', true, 'under_18', v_under_18);
end$$;

-- ---------------------------------------------------------------------------------------------------------------
-- "Missing details" now looks for the mobile number where it is kept
-- ---------------------------------------------------------------------------------------------------------------
create or replace function private.member_gaps(p_user_id uuid, p_gym_id uuid) returns text[]
language plpgsql stable security definer set search_path to 'public', 'private', 'pg_temp' as $$
declare
  p public.profiles%rowtype;
  d public.member_details%rowtype;
  gaps text[] := '{}';
begin
  select * into p from public.profiles where id = p_user_id;
  select * into d from public.member_details where user_id = p_user_id;

  if coalesce(btrim(p.first_name), '') = '' then gaps := array_append(gaps, 'first name'); end if;
  if coalesce(btrim(p.last_name), '') = '' then gaps := array_append(gaps, 'last name'); end if;
  if p.date_of_birth is null or p.date_of_birth < date '1900-01-01' or p.date_of_birth > current_date then
    gaps := array_append(gaps, 'date of birth');
  end if;
  if coalesce(d.phone, '') = '' then gaps := array_append(gaps, 'mobile number'); end if;

  if d.user_id is null then
    gaps := array_append(array_append(gaps, 'address'), 'emergency contact');
  else
    if p.date_of_birth is not null and p.date_of_birth > (current_date - interval '18 years')::date
       and (coalesce(d.guardian_name, '') = '' or coalesce(d.guardian_phone, '') = '') then
      gaps := array_append(gaps, 'parent or guardian');
    end if;
  end if;

  if exists (
    select 1 from public.gym_signup_documents gd
    where gd.gym_id = p_gym_id and gd.is_current
      and not exists (
        select 1 from public.member_signatures s
        where s.gym_id = p_gym_id and s.user_id = p_user_id
          and (s.terms_document_id = gd.id or s.waiver_document_id = gd.id)
      )
  ) then
    gaps := array_append(gaps, 'signature on the terms and waiver');
  end if;

  return gaps;
end$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Date of birth and gender: the person themselves, and the team, only
-- ---------------------------------------------------------------------------------------------------------------
-- A column privilege only restricts anything once the table-wide SELECT is taken away, so the columns every member may read
-- are listed. A column added to profiles later needs adding to this list in the migration that adds it.
revoke select on public.profiles from authenticated;
grant select (id, display_name, first_name, last_name, avatar_url, bio, phone, created_at, updated_at) on public.profiles to authenticated;

create function public.get_my_private_profile() returns jsonb
language plpgsql stable security definer set search_path to 'public', 'private', 'pg_temp' as $$
declare v_uid uuid := auth.uid(); p public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into p from public.profiles where id = v_uid;
  return jsonb_build_object('date_of_birth', p.date_of_birth, 'gender', p.gender);
end$$;
revoke all on function public.get_my_private_profile() from public, anon;
grant execute on function public.get_my_private_profile() to authenticated;

create function public.get_gym_member_demographics(p_gym_id uuid) returns table(user_id uuid, date_of_birth date, gender text)
language plpgsql stable security definer set search_path to 'public', 'private', 'pg_temp' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.gym_members m where m.gym_id = p_gym_id and m.user_id = v_uid and m.is_active = true and m.role in ('owner', 'admin', 'staff')) then
    raise exception 'Only the gym''s owners, admins and staff can see this.';
  end if;
  return query
    select p.id, p.date_of_birth, p.gender
      from public.profiles p
     where p.id in (select gm.user_id from public.gym_members gm where gm.gym_id = p_gym_id and gm.is_active = true);
end$$;
revoke all on function public.get_gym_member_demographics(uuid) from public, anon;
grant execute on function public.get_gym_member_demographics(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- The older members contact table (email, phone)
-- ---------------------------------------------------------------------------------------------------------------
drop policy "gym users can read members" on public.members;
create policy "the team and the person read member contact records" on public.members for select to authenticated
  using (user_id = (select auth.uid())
         or private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role, 'staff'::public.gym_member_role]));

commit;
