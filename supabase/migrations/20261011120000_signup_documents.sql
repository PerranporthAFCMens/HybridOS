-- Gym terms and waiver as an uploaded PDF or typed wording, signed by each new member (drawn signature plus typed name), with the signed
-- copies kept in storage and a record in the database.
--
-- Replaces the typed-wording approach from 20261011090000 (gyms.terms_text, member_declarations): that is not used by
-- anything and holds no data, and is removed in a later clean-up once the new screens are live. Only private.member_gaps
-- changes here, so that a member must have signed the gym's CURRENT terms and waiver (when it has either).
--
-- New:
--   public.gym_signup_documents  the gym's terms and waiver PDFs, one current of each kind, every old version kept
--   public.member_signatures     who signed which document versions, the drawn signature, and the signed copies
--   storage 'gym-signup-documents' (public read, PDFs only, 10 MB, owner or admin of the gym writes to its own folder)
--   storage 'signed-documents'     (private; the member and the gym's owner, admin and staff read; only the server writes)
--   public.add_gym_signup_document(...)       owner / admin record an uploaded PDF, or typed wording, as the current version
--   public.remove_gym_signup_document(...)    owner / admin stop requiring one (the old versions and signatures stay)
--   public.get_public_gym_signup_documents()  what a joiner must read and sign
--   public.sign_gym_documents(...)            the member signs everything current in one go
--   private.safe_uuid(text)                   helper for the storage rules
-- Nothing existing is changed or deleted. Rollback: supabase/rollback/20261011_drop_signup_documents.sql.
-- Check: supabase/verification/20261011_signup_documents_check.sql.
begin;

create function private.safe_uuid(p text) returns uuid
language plpgsql immutable set search_path to '' as $$
begin
  return p::uuid;
exception when others then
  return null;
end$$;
revoke all on function private.safe_uuid(text) from public, anon, authenticated;
grant execute on function private.safe_uuid(text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- The gym's documents
-- ---------------------------------------------------------------------------------------------------------------
create table public.gym_signup_documents (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  kind text not null check (kind in ('terms', 'waiver')),
  version integer not null check (version >= 1),
  title text not null check (char_length(title) between 1 and 120),
  -- an uploaded PDF, or wording typed or pasted in by the gym
  source text not null check (source in ('pdf', 'text')),
  file_path text check (file_path is null or char_length(file_path) between 1 and 300),
  file_name text check (file_name is null or char_length(file_name) between 1 and 200),
  file_size integer check (file_size is null or (file_size > 0 and file_size <= 10485760)),
  body_text text check (body_text is null or char_length(btrim(body_text)) between 1 and 60000),
  constraint gym_signup_documents_source_fields check (
    (source = 'pdf' and file_path is not null and file_name is not null and file_size is not null and body_text is null)
    or (source = 'text' and body_text is not null and file_path is null and file_name is null and file_size is null)
  ),
  is_current boolean not null default true,
  uploaded_by uuid,
  uploaded_at timestamptz not null default now(),
  retired_at timestamptz,
  constraint gym_signup_documents_version_once unique (gym_id, kind, version)
);
create unique index gym_signup_documents_one_current on public.gym_signup_documents (gym_id, kind) where is_current;

alter table public.gym_signup_documents enable row level security;
revoke all on table public.gym_signup_documents from anon, authenticated;
grant select on table public.gym_signup_documents to authenticated;
create policy "gym staff read signup documents" on public.gym_signup_documents for select to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role, 'staff'::public.gym_member_role]));

-- ---------------------------------------------------------------------------------------------------------------
-- Signatures
-- ---------------------------------------------------------------------------------------------------------------
create table public.member_signatures (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  signer_name text not null check (char_length(btrim(signer_name)) between 2 and 120),
  -- true when the member is under 18, so the person signing is their parent or guardian
  signer_is_guardian boolean not null default false,
  signature_png text not null check (signature_png like 'data:image/png;base64,%' and char_length(signature_png) <= 400000),
  terms_document_id uuid references public.gym_signup_documents(id),
  waiver_document_id uuid references public.gym_signup_documents(id),
  signed_at timestamptz not null default now(),
  -- the signed copies (storage paths in 'signed-documents') and the email, filled in by the server after signing
  signed_terms_path text,
  signed_waiver_path text,
  emailed_at timestamptz,
  email_error text,
  constraint member_signatures_has_document check (terms_document_id is not null or waiver_document_id is not null)
);
create index member_signatures_member on public.member_signatures (gym_id, user_id, signed_at desc);

alter table public.member_signatures enable row level security;
revoke all on table public.member_signatures from anon, authenticated;
grant select on table public.member_signatures to authenticated;
create policy "members and gym staff read signatures" on public.member_signatures for select to authenticated
  using (user_id = (select auth.uid())
         or private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role, 'staff'::public.gym_member_role]));

-- ---------------------------------------------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('gym-signup-documents', 'gym-signup-documents', true, 10485760, array['application/pdf']),
  ('signed-documents', 'signed-documents', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

-- Owners and admins write only inside their own gym's folder: <gym id>/<file>.pdf. Anyone can read (it is the public terms).
create policy "gym owners and admins upload signup documents" on storage.objects for insert to authenticated
  with check (bucket_id = 'gym-signup-documents'
              and private.has_gym_role(private.safe_uuid((storage.foldername(name))[1]), array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));
create policy "gym owners and admins replace signup documents" on storage.objects for update to authenticated
  using (bucket_id = 'gym-signup-documents'
         and private.has_gym_role(private.safe_uuid((storage.foldername(name))[1]), array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));
create policy "gym owners and admins delete signup documents" on storage.objects for delete to authenticated
  using (bucket_id = 'gym-signup-documents'
         and private.has_gym_role(private.safe_uuid((storage.foldername(name))[1]), array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));

-- Signed copies are at <member id>/<gym id>/<file>.pdf. The member reads their own; the gym's staff read theirs. Nobody but the server writes.
create policy "members and gym staff read signed documents" on storage.objects for select to authenticated
  using (bucket_id = 'signed-documents'
         and ((storage.foldername(name))[1] = (select auth.uid())::text
              or private.has_gym_role(private.safe_uuid((storage.foldername(name))[2]), array['owner'::public.gym_member_role, 'admin'::public.gym_member_role, 'staff'::public.gym_member_role])));

-- ---------------------------------------------------------------------------------------------------------------
-- Gym: record an uploaded PDF as the current version, or stop requiring one
-- ---------------------------------------------------------------------------------------------------------------
create function public.add_gym_signup_document(
  p_gym_id uuid, p_kind text, p_title text, p_source text,
  p_file_path text, p_file_name text, p_file_size integer, p_body_text text
) returns jsonb
language plpgsql security definer set search_path to 'public', 'private', 'pg_temp' as $$
declare
  v_uid uuid := auth.uid();
  v_version integer;
  v_id uuid;
  v_text text := nullif(btrim(coalesce(p_body_text, '')), '');
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not private.has_gym_role(p_gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]) then
    raise exception 'Only an owner or admin can change the sign-up documents.';
  end if;
  if p_kind not in ('terms', 'waiver') then raise exception 'Choose terms or waiver.'; end if;
  if btrim(coalesce(p_title, '')) = '' or char_length(p_title) > 120 then raise exception 'Give the document a title.'; end if;

  if p_source = 'pdf' then
    if p_file_path is null or p_file_path not like p_gym_id::text || '/%' or lower(p_file_path) not like '%.pdf' then
      raise exception 'The document must be a PDF uploaded to your gym''s folder.';
    end if;
    if p_file_size is null or p_file_size <= 0 or p_file_size > 10485760 then raise exception 'The PDF must be under 10 MB.'; end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'gym-signup-documents' and o.name = p_file_path) then
      raise exception 'That file has not been uploaded.';
    end if;
    v_text := null;
  elsif p_source = 'text' then
    if v_text is null then raise exception 'Type or paste the wording.'; end if;
    if char_length(v_text) > 60000 then raise exception 'That wording is too long (60,000 characters at most).'; end if;
  else
    raise exception 'Choose a PDF or typed wording.';
  end if;

  select coalesce(max(version), 0) + 1 into v_version from public.gym_signup_documents where gym_id = p_gym_id and kind = p_kind;
  update public.gym_signup_documents set is_current = false, retired_at = now() where gym_id = p_gym_id and kind = p_kind and is_current;
  insert into public.gym_signup_documents(gym_id, kind, version, title, source, file_path, file_name, file_size, body_text, uploaded_by)
  values (p_gym_id, p_kind, v_version, btrim(p_title), p_source,
          case when p_source = 'pdf' then p_file_path end, case when p_source = 'pdf' then p_file_name end,
          case when p_source = 'pdf' then p_file_size end, v_text, v_uid)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'version', v_version);
end$$;
revoke all on function public.add_gym_signup_document(uuid, text, text, text, text, text, integer, text) from public, anon;
grant execute on function public.add_gym_signup_document(uuid, text, text, text, text, text, integer, text) to authenticated;

create function public.remove_gym_signup_document(p_gym_id uuid, p_kind text) returns jsonb
language plpgsql security definer set search_path to 'public', 'private', 'pg_temp' as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not private.has_gym_role(p_gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]) then
    raise exception 'Only an owner or admin can change the sign-up documents.';
  end if;
  update public.gym_signup_documents set is_current = false, retired_at = now() where gym_id = p_gym_id and kind = p_kind and is_current;
  return jsonb_build_object('ok', true);
end$$;
revoke all on function public.remove_gym_signup_document(uuid, text) from public, anon;
grant execute on function public.remove_gym_signup_document(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Joiner: what to read and sign, and signing
-- ---------------------------------------------------------------------------------------------------------------
create function public.get_public_gym_signup_documents(p_gym_slug text) returns jsonb
language plpgsql stable security definer set search_path to 'public', 'private', 'pg_temp' as $$
declare v_gym uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select id into v_gym from public.gyms where slug = p_gym_slug limit 1;
  if v_gym is null then raise exception 'Gym not found'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', d.id, 'kind', d.kind, 'version', d.version, 'title', d.title,
                                        'source', d.source, 'file_path', d.file_path, 'file_name', d.file_name,
                                        'body_text', d.body_text) order by d.kind desc)
    from public.gym_signup_documents d where d.gym_id = v_gym and d.is_current
  ), '[]'::jsonb);
end$$;
revoke all on function public.get_public_gym_signup_documents(text) from public, anon;
grant execute on function public.get_public_gym_signup_documents(text) to authenticated;

create function public.sign_gym_documents(p_gym_slug text, p_signer_name text, p_signature_png text) returns jsonb
language plpgsql security definer set search_path to 'public', 'private', 'pg_temp' as $$
declare
  v_uid uuid := auth.uid();
  v_gym uuid;
  v_terms uuid;
  v_waiver uuid;
  v_dob date;
  v_id uuid;
  v_name text := btrim(coalesce(p_signer_name, ''));
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select id into v_gym from public.gyms where slug = p_gym_slug limit 1;
  if v_gym is null then raise exception 'Gym not found'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then raise exception 'Type your full name.'; end if;
  if p_signature_png is null or p_signature_png not like 'data:image/png;base64,%' or char_length(p_signature_png) > 400000 then
    raise exception 'Draw your signature.';
  end if;
  -- an empty box encodes to a tiny image; a real signature is bigger
  if char_length(p_signature_png) < 1500 then raise exception 'Draw your signature.'; end if;

  select id into v_terms from public.gym_signup_documents where gym_id = v_gym and kind = 'terms' and is_current;
  select id into v_waiver from public.gym_signup_documents where gym_id = v_gym and kind = 'waiver' and is_current;
  if v_terms is null and v_waiver is null then raise exception 'This gym has nothing to sign.'; end if;

  select date_of_birth into v_dob from public.profiles where id = v_uid;

  insert into public.member_signatures(gym_id, user_id, signer_name, signer_is_guardian, signature_png, terms_document_id, waiver_document_id)
  values (v_gym, v_uid, v_name, coalesce(v_dob > (current_date - interval '18 years')::date, false), p_signature_png, v_terms, v_waiver)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'signature_id', v_id);
end$$;
revoke all on function public.sign_gym_documents(text, text, text) from public, anon;
grant execute on function public.sign_gym_documents(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- What is missing: now also the signature on the gym's CURRENT terms and waiver (the rest is as in 20261011090000)
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
