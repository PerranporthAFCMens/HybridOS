-- Restrict anonymous execution of privileged SECURITY DEFINER RPCs.
-- Current live ACLs were checked before this migration was authored.
-- Intended callers retained: authenticated, service_role, and the postgres owner.

REVOKE ALL ON FUNCTION public.approve_admin_access(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_admin_access(uuid,uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.approve_email_owner_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_email_owner_invite(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.approve_ownership_action(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_ownership_action(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.approve_pending_access(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_pending_access(uuid,uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.approve_shareable_owner_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_shareable_owner_invite(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_access_invite(uuid,text,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_access_invite(uuid,text,text,integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_admin_invite(uuid,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_admin_invite(uuid,text,integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_email_access_invite(uuid,text,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_email_access_invite(uuid,text,text,integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_shareable_access_invite(uuid,text,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_shareable_access_invite(uuid,text,text,integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.delete_admin_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_admin_invite(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.propose_gym_deletion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.propose_gym_deletion(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.propose_owner_promotion(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.propose_owner_promotion(uuid,uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.propose_owner_removal(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.propose_owner_removal(uuid,uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.remove_admin_access(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_admin_access(uuid,uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.revoke_admin_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_admin_invite(uuid) TO authenticated, service_role;
