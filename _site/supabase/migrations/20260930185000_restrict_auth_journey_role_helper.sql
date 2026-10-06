-- Restrict the live-only auth-journey role helper to service-role callers.
-- The helper is deliberately absent from the schema baseline because it embeds live test fixture IDs.
-- On fresh/local databases this migration is therefore a no-op.

do $$
begin
  if to_regprocedure('public.hybridone_auth_journey_test_membership_role(uuid,text,uuid,text)') is not null then
    execute 'revoke all on function public.hybridone_auth_journey_test_membership_role(uuid,text,uuid,text) from public, anon, authenticated';
    execute 'grant execute on function public.hybridone_auth_journey_test_membership_role(uuid,text,uuid,text) to service_role';
  end if;
end
$$;
