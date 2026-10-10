-- Gym terms and waiver as an uploaded PDF or typed wording, signed by each new member (drawn signature plus typed name), with the signed
-- copies kept in storage and a record in the database.
--
-- Replaces the typed-wording approach from 20261011090000 (gyms.terms_text, member_declarations): that is not used by
-- anything and holds no data, and is removed in a later clean-up once the new screens are live. Only private.member_gaps
-- changes here, so that a member must have signed the gym's CURRENT terms and waiver (when it has either).
--
-- New:
--   public.gym_signup_documents  the gym's terms and waiver PDFs, one current of each kind, every old version kept
--   public.gym_signup_questions  questions that belong to one version of a document (health questions and the like)
--   public.member_signatures     who signed which document versions, the drawn signature, and the signed copies
--   public.member_signature_answers  what the member answered
--   storage 'gym-signup-documents' (public read, PDFs only, 10 MB, owner or admin of the gym writes to its own folder)
--   storage 'signed-documents'     (private; the member and the gym's owner, admin and staff read; only the server writes)
--   public.add_gym_signup_document(...)       owner / admin record an uploaded PDF, or typed wording, with its tick-box sentence and questions, as the current version
--   public.remove_gym_signup_document(...)    owner / admin stop requiring one (the old versions and signatures stay)
--   public.get_public_gym_signup_documents()  what a joiner must read and sign
--   public.sign_gym_documents(...)            the member answers the questions and signs everything current in one go
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
  -- the sentence beside the tick-box for this document
  acceptance_text text not null default 'I confirm I have read, understood and agree to this document.'
    check (char_length(btrim(acceptance_text)) between 1 and 300),
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
-- Questions that belong to one version of a document (for example a health questionnaire)
-- ---------------------------------------------------------------------------------------------------------------
create table public.gym_signup_questions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.gym_signup_documents(id) on delete cascade,
  position integer not null check (position >= 1),
  prompt text not null check (char_length(btrim(prompt)) between 1 and 300),
  answer_type text not null check (answer_type in ('yes_no', 'text')),
  -- for a yes / no question: ask for details when the answer is yes
  details_if_yes boolean not null default false,
  is_required boolean not null default true,
  -- show staff when the member answers yes
  flag_on_yes boolean not null default false,
  constraint gym_signup_questions_order unique (document_id, position)
);

alter table public.gym_signup_questions enable row level security;
revoke all on table public.gym_signup_questions from anon, authenticated;
grant select on table public.gym_signup_questions to authenticated;
create policy "gym staff read signup questions" on public.gym_signup_questions for select to authenticated
  using (exists (select 1 from public.gym_signup_documents d
                 where d.id = document_id
                   and private.has_gym_role(d.gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role, 'staff'::public.gym_member_role])));

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
  -- the exact tick-box sentences the member agreed to
  agreed_text text,
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

create table public.member_signature_answers (
  id uuid primary key default gen_random_uuid(),
  signature_id uuid not null references public.member_signatures(id) on delete cascade,
  question_id uuid not null references public.gym_signup_questions(id),
  answer_yes boolean,
  answer_text text check (answer_text is null or char_length(answer_text) <= 2000),
  constraint member_signature_answers_once unique (signature_id, question_id)
);

alter table public.member_signature_answers enable row level security;
revoke all on table public.member_signature_answers from anon, authenticated;
grant select on table public.member_signature_answers to authenticated;
create policy "members and gym staff read answers" on public.member_signature_answers for select to authenticated
  using (exists (select 1 from public.member_signatures s
                 where s.id = signature_id
                   and (s.user_id = (select auth.uid())
                        or private.has_gym_role(s.gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role, 'staff'::public.gym_member_role]))));

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
  p_file_path text, p_file_name text, p_file_size integer, p_body_text text,
  p_acceptance_text text, p_questions jsonb
) returns jsonb
language plpgsql security definer set search_path to 'public', 'private', 'pg_temp' as $$
declare
  v_uid uuid := auth.uid();
  v_version integer;
  v_id uuid;
  v_text text := nullif(btrim(coalesce(p_body_text, '')), '');
  v_accept text := coalesce(nullif(btrim(coalesce(p_acceptance_text, '')), ''), 'I confirm I have read, understood and agree to this document.');
  v_q jsonb;
  v_pos integer := 0;
  v_prompt text;
  v_type text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not private.has_gym_role(p_gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]) then
    raise exception 'Only an owner or admin can change the sign-up documents.';
  end if;
  if p_kind not in ('terms', 'waiver') then raise exception 'Choose terms or waiver.'; end if;
  if btrim(coalesce(p_title, '')) = '' or char_length(p_title) > 120 then raise exception 'Give the document a title.'; end if;
  if char_length(v_accept) > 300 then raise exception 'The tick-box sentence is too long (300 characters at most).'; end if;

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

  if p_questions is not null and jsonb_typeof(p_questions) <> 'array' then raise exception 'The questions must be a list.'; end if;
  if jsonb_array_length(coalesce(p_questions, '[]'::jsonb)) > 40 then raise exception 'Use 40 questions at most.'; end if;
  for v_q in select * from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) loop
    v_prompt := btrim(coalesce(v_q->>'prompt', ''));
    v_type := coalesce(v_q->>'answer_type', '');
    if v_prompt = '' or char_length(v_prompt) > 300 then raise exception 'Each question needs some wording (300 characters at most).'; end if;
    if v_type not in ('yes_no', 'text') then raise exception 'Each question must be yes or no, or a written answer.'; end if;
  end loop;

  select coalesce(max(version), 0) + 1 into v_version from public.gym_signup_documents where gym_id = p_gym_id and kind = p_kind;
  update public.gym_signup_documents set is_current = false, retired_at = now() where gym_id = p_gym_id and kind = p_kind and is_current;
  insert into public.gym_signup_documents(gym_id, kind, version, title, source, file_path, file_name, file_size, body_text, acceptance_text, uploaded_by)
  values (p_gym_id, p_kind, v_version, btrim(p_title), p_source,
          case when p_source = 'pdf' then p_file_path end, case when p_source = 'pdf' then p_file_name end,
          case when p_source = 'pdf' then p_file_size end, v_text, v_accept, v_uid)
  returning id into v_id;

  for v_q in select * from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) loop
    v_pos := v_pos + 1;
    insert into public.gym_signup_questions(document_id, position, prompt, answer_type, details_if_yes, is_required, flag_on_yes)
    values (v_id, v_pos, btrim(v_q->>'prompt'), v_q->>'answer_type',
            coalesce((v_q->>'details_if_yes')::boolean, false) and (v_q->>'answer_type') = 'yes_no',
            coalesce((v_q->>'is_required')::boolean, true),
            coalesce((v_q->>'flag_on_yes')::boolean, false) and (v_q->>'answer_type') = 'yes_no');
  end loop;
  return jsonb_build_object('ok', true, 'id', v_id, 'version', v_version, 'questions', v_pos);
end$$;
revoke all on function public.add_gym_signup_document(uuid, text, text, text, text, text, integer, text, text, jsonb) from public, anon;
grant execute on function public.add_gym_signup_document(uuid, text, text, text, text, text, integer, text, text, jsonb) to authenticated;

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
                                        'body_text', d.body_text, 'acceptance_text', d.acceptance_text,
                                        'questions', coalesce((
                                          select jsonb_agg(jsonb_build_object('id', q.id, 'prompt', q.prompt, 'answer_type', q.answer_type,
                                                                              'details_if_yes', q.details_if_yes, 'is_required', q.is_required) order by q.position)
                                          from public.gym_signup_questions q where q.document_id = d.id), '[]'::jsonb)) order by d.kind desc)
    from public.gym_signup_documents d where d.gym_id = v_gym and d.is_current
  ), '[]'::jsonb);
end$$;
revoke all on function public.get_public_gym_signup_documents(text) from public, anon;
grant execute on function public.get_public_gym_signup_documents(text) to authenticated;

create function public.sign_gym_documents(p_gym_slug text, p_signer_name text, p_signature_png text, p_answers jsonb)
returns jsonb
language plpgsql security definer set search_path to 'public', 'private', 'pg_temp' as $$
declare
  v_uid uuid := auth.uid();
  v_gym uuid;
  v_terms uuid;
  v_waiver uuid;
  v_dob date;
  v_id uuid;
  v_name text := btrim(coalesce(p_signer_name, ''));
  v_agreed text;
  q record;
  a jsonb;
  v_yes boolean;
  v_text text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select id into v_gym from public.gyms where slug = p_gym_slug limit 1;
  if v_gym is null then raise exception 'Gym not found'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then raise exception 'Type your full name.'; end if;
  if p_signature_png is null or p_signature_png not like 'data:image/png;base64,%' or char_length(p_signature_png) > 400000 then
    raise exception 'Draw your signature.';
  end if;
  if char_length(p_signature_png) < 1500 then raise exception 'Draw your signature.'; end if;
  if p_answers is not null and jsonb_typeof(p_answers) <> 'array' then raise exception 'The answers must be a list.'; end if;

  select id into v_terms from public.gym_signup_documents where gym_id = v_gym and kind = 'terms' and is_current;
  select id into v_waiver from public.gym_signup_documents where gym_id = v_gym and kind = 'waiver' and is_current;
  if v_terms is null and v_waiver is null then raise exception 'This gym has nothing to sign.'; end if;

  -- every required question on the current documents must be answered
  for q in
    select qu.* from public.gym_signup_questions qu
    where qu.document_id in (v_terms, v_waiver)
  loop
    select x into a from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) x where x->>'question_id' = q.id::text limit 1;
    v_yes := case when a is null then null else (a->>'yes')::boolean end;
    v_text := nullif(btrim(coalesce(a->>'text', '')), '');
    if q.is_required then
      if q.answer_type = 'yes_no' and v_yes is null then raise exception 'Answer every question: %', q.prompt; end if;
      if q.answer_type = 'text' and v_text is null then raise exception 'Answer every question: %', q.prompt; end if;
    end if;
    if q.answer_type = 'yes_no' and v_yes and q.details_if_yes and v_text is null then
      raise exception 'Give details for: %', q.prompt;
    end if;
  end loop;

  select string_agg(d.title || ': ' || d.acceptance_text, E'\n' order by d.kind desc) into v_agreed
  from public.gym_signup_documents d where d.id in (v_terms, v_waiver);

  select date_of_birth into v_dob from public.profiles where id = v_uid;

  insert into public.member_signatures(gym_id, user_id, signer_name, signer_is_guardian, signature_png, terms_document_id, waiver_document_id, agreed_text)
  values (v_gym, v_uid, v_name, coalesce(v_dob > (current_date - interval '18 years')::date, false), p_signature_png, v_terms, v_waiver, v_agreed)
  returning id into v_id;

  for q in select qu.* from public.gym_signup_questions qu where qu.document_id in (v_terms, v_waiver) loop
    select x into a from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) x where x->>'question_id' = q.id::text limit 1;
    if a is not null then
      insert into public.member_signature_answers(signature_id, question_id, answer_yes, answer_text)
      values (v_id, q.id,
              case when q.answer_type = 'yes_no' then (a->>'yes')::boolean end,
              left(nullif(btrim(coalesce(a->>'text', '')), ''), 2000));
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'signature_id', v_id);
end$$;
revoke all on function public.sign_gym_documents(text, text, text, jsonb) from public, anon;
grant execute on function public.sign_gym_documents(text, text, text, jsonb) to authenticated;

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
