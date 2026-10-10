-- Undo 20261011120000_signup_documents.sql.
-- Deletes every uploaded document record and every signature record (the signed PDFs in storage are NOT deleted; remove
-- them in the Storage screen if wanted). Puts member_gaps back to the 20261011090000 version.
begin;
drop policy if exists "members and gym staff read signed documents" on storage.objects;
drop policy if exists "gym owners and admins delete signup documents" on storage.objects;
drop policy if exists "gym owners and admins replace signup documents" on storage.objects;
drop policy if exists "gym owners and admins upload signup documents" on storage.objects;
drop function if exists public.sign_gym_documents(text, text, text);
drop function if exists public.get_public_gym_signup_documents(text);
drop function if exists public.remove_gym_signup_document(uuid, text);
drop function if exists public.add_gym_signup_document(uuid, text, text, text, text, text, integer, text);
drop table if exists public.member_signatures;
drop table if exists public.gym_signup_documents;
drop function if exists private.safe_uuid(text);
create or replace function private.member_gaps(p_user_id uuid, p_gym_id uuid) returns text[]
language plpgsql stable security definer set search_path to 'public', 'private', 'pg_temp' as $$
declare
  p public.profiles%rowtype;
  d public.member_details%rowtype;
  g public.gyms%rowtype;
  gaps text[] := '{}';
begin
  select * into p from public.profiles where id = p_user_id;
  select * into d from public.member_details where user_id = p_user_id;
  select * into g from public.gyms where id = p_gym_id;

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

  if (coalesce(btrim(g.terms_text), '') <> '' or coalesce(btrim(g.health_declaration_text), '') <> '')
     and not exists (
       select 1 from public.member_declarations md
       where md.gym_id = p_gym_id and md.user_id = p_user_id and md.terms_version = g.terms_version
     ) then
    gaps := array_append(gaps, 'terms and health declaration');
  end if;

  return gaps;
end$$;
delete from storage.buckets where id in ('gym-signup-documents', 'signed-documents') and not exists (select 1 from storage.objects o where o.bucket_id = storage.buckets.id);
commit;
