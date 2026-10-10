-- Read-only checks after applying 20261011120000_signup_documents.sql. Every row should say "ok".
select 'documents table exists with row level security' as check,
       case when (select relrowsecurity from pg_class where oid = to_regclass('public.gym_signup_documents')) then 'ok' else 'MISSING OR OPEN' end as result
union all
select 'signatures table exists with row level security',
       case when (select relrowsecurity from pg_class where oid = to_regclass('public.member_signatures')) then 'ok' else 'MISSING OR OPEN' end
union all
select 'questions and answers tables exist with row level security',
       case when (select relrowsecurity from pg_class where oid = to_regclass('public.gym_signup_questions'))
             and (select relrowsecurity from pg_class where oid = to_regclass('public.member_signature_answers')) then 'ok' else 'MISSING OR OPEN' end
union all
select 'nobody can write the tables directly',
       case when not has_table_privilege('authenticated', 'public.gym_signup_documents', 'insert')
             and not has_table_privilege('authenticated', 'public.gym_signup_documents', 'update')
             and not has_table_privilege('authenticated', 'public.member_signatures', 'insert')
             and not has_table_privilege('authenticated', 'public.member_signatures', 'update')
             and not has_table_privilege('authenticated', 'public.gym_signup_questions', 'insert')
             and not has_table_privilege('authenticated', 'public.member_signature_answers', 'insert')
             and not has_table_privilege('anon', 'public.member_signature_answers', 'select')
             and not has_table_privilege('anon', 'public.member_signatures', 'select') then 'ok' else 'WRONG' end
union all
select 'the two storage buckets exist, terms public and signed copies private',
       case when (select count(*) from storage.buckets where id = 'gym-signup-documents' and public and allowed_mime_types = array['application/pdf']) = 1
             and (select count(*) from storage.buckets where id = 'signed-documents' and not public and allowed_mime_types = array['application/pdf']) = 1 then 'ok' else 'WRONG' end
union all
select 'the four public functions exist',
       case when (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('add_gym_signup_document', 'remove_gym_signup_document', 'get_public_gym_signup_documents', 'sign_gym_documents')) = 4 then 'ok' else 'MISSING' end
union all
select 'anonymous users cannot call them',
       case when not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname in ('add_gym_signup_document', 'remove_gym_signup_document', 'get_public_gym_signup_documents', 'sign_gym_documents') and (has_function_privilege('anon', oid, 'execute') or has_function_privilege('public', oid, 'execute'))) then 'ok' else 'ANON CAN CALL' end
union all
select 'storage rules are in place (3 for uploads, 1 for signed copies)',
       case when (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname in ('gym owners and admins upload signup documents', 'gym owners and admins replace signup documents', 'gym owners and admins delete signup documents', 'members and gym staff read signed documents')) = 4 then 'ok' else 'MISSING' end
union all
select 'member_gaps now looks at signatures',
       case when pg_get_functiondef('private.member_gaps(uuid, uuid)'::regprocedure) like '%member_signatures%' then 'ok' else 'NOT UPDATED' end
union all
select 'no documents or signatures exist yet',
       case when (select count(*) from public.gym_signup_documents) = 0 and (select count(*) from public.member_signatures) = 0 then 'ok' else 'UNEXPECTED' end;
