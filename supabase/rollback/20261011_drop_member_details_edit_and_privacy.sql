-- Undo 20261011180000_member_details_edit_and_privacy.sql.
-- Copies every mobile number back to profiles, puts the member's own form, the missing-details check and the staff read
-- policy back as they were, then drops the new functions, the settings table and the new column and trigger.
-- The owner's visibility choices are lost (everything is visible to the team again, as before).
begin;

drop trigger if exists profiles_keep_phone_out on public.profiles;
drop function if exists private.keep_phone_off_profiles();

update public.profiles p set phone = d.phone from public.member_details d where d.user_id = p.id and d.phone is not null;

drop function if exists public.staff_save_member_details(uuid, uuid, text, text, date, text, text, text, text, text, text, text, text, text, text);
drop function if exists public.get_member_details(uuid, uuid);
drop function if exists public.get_member_contact_visibility(uuid);
drop function if exists public.set_member_contact_visibility(uuid, boolean, boolean);
drop table if exists public.gym_privacy_settings;

drop policy if exists "members read their own details" on public.member_details;
create policy "members and gym staff read member details" on public.member_details for select to authenticated
  using (user_id = (select auth.uid()) or private.can_view_member_details(user_id));

alter table public.member_details drop column phone;

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

  insert into public.profiles(id, first_name, last_name, display_name, date_of_birth, phone)
  values (v_uid, v_first, v_last, v_first || ' ' || v_last, p_date_of_birth, p_phone)
  on conflict (id) do update
    set first_name = excluded.first_name,
        last_name = excluded.last_name,
        display_name = coalesce(nullif(btrim(public.profiles.display_name), ''), excluded.display_name),
        date_of_birth = excluded.date_of_birth,
        phone = excluded.phone,
        updated_at = now();

  insert into public.member_details(
    user_id, address_line1, address_line2, town, postcode,
    emergency_name, emergency_phone, emergency_relationship, guardian_name, guardian_phone
  ) values (
    v_uid, v_line1, v_line2, v_town, v_pc,
    v_ec_name, p_emergency_phone, v_ec_rel,
    case when v_under_18 then v_g_name end, case when v_under_18 then v_g_phone end
  )
  on conflict (user_id) do update
    set address_line1 = excluded.address_line1, address_line2 = excluded.address_line2,
        town = excluded.town, postcode = excluded.postcode,
        emergency_name = excluded.emergency_name, emergency_phone = excluded.emergency_phone,
        emergency_relationship = excluded.emergency_relationship,
        guardian_name = excluded.guardian_name, guardian_phone = excluded.guardian_phone;

  return jsonb_build_object('ok', true, 'under_18', v_under_18);
end$$;

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
  if coalesce(p.phone, '') = '' then gaps := array_append(gaps, 'mobile number'); end if;

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

commit;
