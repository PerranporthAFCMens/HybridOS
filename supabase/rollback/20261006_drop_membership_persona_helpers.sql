-- Rollback for 20261006120000_membership_persona_helpers.sql
drop function if exists public.hybridone_membership_persona_setup(uuid, text);
drop function if exists public.hybridone_membership_persona_cleanup(uuid);
