-- Restrict invite-claim RPCs separately because they are used on the invite landing flow.
-- Caller tracing confirms each claim occurs only after a Supabase Auth session exists.

REVOKE ALL ON FUNCTION public.claim_access_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_access_invite(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.claim_admin_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_admin_invite(text) TO authenticated, service_role;
