-- Undo 20261016090000_quick_join.sql: the door code goes back to being visible to every active member, member_gaps goes back to
-- its previous version (every gym asks for everything before paying), the new functions and the settings table are removed, and
-- the address and emergency contact columns are required again.
-- It refuses to run if anyone has paid but not yet given their address or emergency contact, because those columns cannot be
-- required while rows are empty. Ask those people to finish (Settings > Quick join > who has not finished), then run it again.
begin;

do $$
begin
  if exists (
    select 1 from public.member_details
    where address_line1 is null or town is null or postcode is null
       or emergency_name is null or emergency_phone is null or emergency_relationship is null
  ) then
    raise exception 'Some members have not given their address or emergency contact yet. Finish or remove those rows first, then run this again.';
  end if;
end $$;

drop policy "access settings readable by active members" on public.gym_access_settings;
create policy "access settings readable by active members" on public.gym_access_settings for select to authenticated
  using (private.is_gym_member(gym_id));

drop function public.get_public_gym_join_style(text);
drop function public.get_unfinished_members(uuid);
drop function public.save_join_settings(uuid, text, text, text, text, boolean);
drop function public.get_my_ready_status(uuid);
drop function public.save_my_address(text, text, text, text);
drop function public.save_my_emergency(text, text, text);
drop function public.save_my_basics(text, text, date, text, text, text);
drop function private.member_may_see_door_code(uuid);
drop function private.member_is_ready(uuid, uuid);
drop function private.member_ready_items(uuid, uuid);

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

drop function private.join_settings_for(uuid);
drop table public.gym_join_settings;

alter table public.member_details
  alter column address_line1 set not null,
  alter column town set not null,
  alter column postcode set not null,
  alter column emergency_name set not null,
  alter column emergency_phone set not null,
  alter column emergency_relationship set not null;

commit;
