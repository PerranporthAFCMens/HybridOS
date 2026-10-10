-- Let a gym's tick-box wording be up to 2,000 characters (it was 300). Some gyms need a full paragraph beside the tick-box.
-- Changes one table rule and one function (add_gym_signup_document, same name and arguments, so its permissions stay). No row changes.
-- Rollback: supabase/rollback/20261011_acceptance_text_300.sql.
begin;

alter table public.gym_signup_documents drop constraint gym_signup_documents_acceptance_text_check;
alter table public.gym_signup_documents add constraint gym_signup_documents_acceptance_text_check
  check (char_length(btrim(acceptance_text)) between 1 and 2000);

create or replace function public.add_gym_signup_document(
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
  if char_length(v_accept) > 2000 then raise exception 'The tick-box wording is too long (2,000 characters at most).'; end if;

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

commit;
