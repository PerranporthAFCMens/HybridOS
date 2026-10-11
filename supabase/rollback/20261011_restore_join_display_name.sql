-- Undo 20261011200000_join_display_name.sql.
-- Puts save_my_join_details back to the 20261011180000 version (it keeps whatever display name already exists, so new joiners show as
-- their email address again). The repaired display names are NOT restored: use the listing saved from
-- supabase/verification/20261011_join_display_name_before.sql if you need the old values back.
begin;
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
revoke all on function public.save_my_join_details(text, text, date, text, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.save_my_join_details(text, text, date, text, text, text, text, text, text, text, text, text, text) to authenticated;
commit;
