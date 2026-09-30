-- NOT APPLIED.
-- Restores the live ACL state observed before the hardening migrations:
-- PUBLIC EXECUTE + authenticated EXECUTE + postgres owner EXECUTE.
-- service_role and anon then inherit EXECUTE from PUBLIC as they do today.

REVOKE ALL ON FUNCTION public.approve_admin_access(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_admin_access(uuid,uuid) TO PUBLIC, authenticated, postgres;

REVOKE ALL ON FUNCTION public.approve_email_owner_invite(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_email_owner_invite(uuid) TO PUBLIC, authenticated, postgres;

REVOKE ALL ON FUNCTION public.approve_ownership_action(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_ownership_action(uuid) TO PUBLIC, authenticated, postgres;

REVOKE ALL ON FUNCTION public.approve_pending_access(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_pending_access(uuid,uuid) TO PUBLIC, authenticated, postgres;

REVOKE ALL ON FUNCTION public.approve_shareable_owner_invite(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_shareable_owner_invite(uuid) TO PUBLIC, authenticated, postgres;

REVOKE ALL ON FUNCTION public.claim_access_invite(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_access_invite(text) TO PUBLIC, authenticated, postgres;

REVOKE ALL ON FUNCTION public.claim_admin_invite(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_admin_invite(text) TO PUBLIC, authenticated, postgres;

REVOKE ALL ON FUNCTION public.create_access_invite(uuid,text,text,integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_access_invite(uuid,text,text,integer) TO PUBLIC, authenticated, postgres;

REVOKE ALL ON FUNCTION public.create_admin_invite(uuid,text,integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_admin_invite(uuid,text,integer) TO PUBLIC, authenticated, postgres;

REVOKE ALL ON FUNCTION public.create_email_access_invite(uuid,text,text,integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_email_access_invite(uuid,text,text,integer) TO PUBLIC, authenticated, postgres;

REVOKE ALL ON FUNCTION public.create_shareable_access_invite(uuid,text,text,integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_shareable_access_invite(uuid,text,text,integer) TO PUBLIC, authenticated, postgres;

REVOKE ALL ON FUNCTION public.delete_admin_invite(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_admin_invite(uuid) TO PUBLIC, authenticated, postgres;

REVOKE ALL ON FUNCTION public.propose_gym_deletion(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.propose_gym_deletion(uuid) TO PUBLIC, authenticated, postgres;

REVOKE ALL ON FUNCTION public.propose_owner_promotion(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.propose_owner_promotion(uuid,uuid) TO PUBLIC, authenticated, postgres;

REVOKE ALL ON FUNCTION public.propose_owner_removal(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.propose_owner_removal(uuid,uuid) TO PUBLIC, authenticated, postgres;

REVOKE ALL ON FUNCTION public.remove_admin_access(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_admin_access(uuid,uuid) TO PUBLIC, authenticated, postgres;

REVOKE ALL ON FUNCTION public.revoke_admin_invite(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_admin_invite(uuid) TO PUBLIC, authenticated, postgres;
