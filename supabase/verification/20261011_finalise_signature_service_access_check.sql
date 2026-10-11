-- Read-only. Run AFTER applying 20261011210000_finalise_signature_service_access.sql. Every row should say "ok".
select 'the service role can read signatures' as check,
       case when has_table_privilege('service_role', 'public.member_signatures', 'select') then 'ok' else 'CANNOT' end as result
union all
select 'and the answers, documents and questions',
       case when has_table_privilege('service_role', 'public.member_signature_answers', 'select')
             and has_table_privilege('service_role', 'public.gym_signup_documents', 'select')
             and has_table_privilege('service_role', 'public.gym_signup_questions', 'select') then 'ok' else 'CANNOT' end
union all
select 'it can read only the id and name of a gym',
       case when has_column_privilege('service_role', 'public.gyms', 'name', 'select')
             and not has_column_privilege('service_role', 'public.gyms', 'logo_url', 'select') then 'ok' else 'WRONG' end
union all
select 'it can write only the four result columns',
       case when has_column_privilege('service_role', 'public.member_signatures', 'emailed_at', 'update')
             and has_column_privilege('service_role', 'public.member_signatures', 'signed_terms_path', 'update')
             and not has_column_privilege('service_role', 'public.member_signatures', 'signature_png', 'update')
             and not has_table_privilege('service_role', 'public.member_signatures', 'insert')
             and not has_table_privilege('service_role', 'public.member_signatures', 'delete') then 'ok' else 'WRONG' end
union all
select 'signed-in members and the public gained nothing',
       case when not has_table_privilege('authenticated', 'public.member_signatures', 'insert')
             and not has_table_privilege('authenticated', 'public.member_signatures', 'update')
             and not has_table_privilege('anon', 'public.member_signatures', 'select') then 'ok' else 'WRONG' end;
