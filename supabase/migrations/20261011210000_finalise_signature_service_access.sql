-- Lets the finalise-signature Edge Function read what it needs and record its result.
--
-- This project removes the service role's table access on purpose (20260930000000_live_schema_baseline.sql leaves it only
-- REFERENCES, TRIGGER and TRUNCATE, plus SELECT on a few tables). The function runs as the service role and read these tables,
-- so every call failed with "permission denied for table member_signatures", which looked like "no such signature". No signed
-- copy was ever made or emailed. This grants only what the function uses, and nothing else:
--   read:  member_signatures, member_signature_answers, gym_signup_documents, gym_signup_questions, and the id and name of gyms
--   write: the four result columns on member_signatures (the two PDF paths, when it was emailed, and why not)
-- (it already can read profiles, gym_members and gym_communication_settings)
-- Undo: supabase/rollback/20261011_revoke_finalise_signature_service_access.sql
grant select on table public.member_signatures to service_role;
grant select on table public.member_signature_answers to service_role;
grant select on table public.gym_signup_documents to service_role;
grant select on table public.gym_signup_questions to service_role;
grant select (id, name) on table public.gyms to service_role;
grant update (signed_terms_path, signed_waiver_path, emailed_at, email_error) on table public.member_signatures to service_role;
