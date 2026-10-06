-- Read-only before/after ACL verification for the 17 hardened SECURITY DEFINER functions.
WITH target_names(name) AS (
  VALUES
    ('approve_admin_access'),
    ('approve_email_owner_invite'),
    ('approve_ownership_action'),
    ('approve_pending_access'),
    ('approve_shareable_owner_invite'),
    ('claim_access_invite'),
    ('claim_admin_invite'),
    ('create_access_invite'),
    ('create_admin_invite'),
    ('create_email_access_invite'),
    ('create_shareable_access_invite'),
    ('delete_admin_invite'),
    ('propose_gym_deletion'),
    ('propose_owner_promotion'),
    ('propose_owner_removal'),
    ('remove_admin_access'),
    ('revoke_admin_invite')
)
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_args,
  p.proacl,
  has_function_privilege('public', p.oid, 'EXECUTE') AS public_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute,
  has_function_privilege('postgres', p.oid, 'EXECUTE') AS postgres_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN target_names t ON t.name = p.proname
WHERE n.nspname = 'public'
ORDER BY p.proname, pg_get_function_identity_arguments(p.oid);
