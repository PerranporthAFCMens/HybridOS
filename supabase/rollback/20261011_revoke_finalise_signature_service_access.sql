-- Undo 20261011210000_finalise_signature_service_access.sql. The finalise-signature function stops working again.
begin;
revoke update (signed_terms_path, signed_waiver_path, emailed_at, email_error) on table public.member_signatures from service_role;
revoke select (id, name) on table public.gyms from service_role;
revoke select on table public.gym_signup_questions from service_role;
revoke select on table public.gym_signup_documents from service_role;
revoke select on table public.member_signature_answers from service_role;
revoke select on table public.member_signatures from service_role;
commit;
