-- Undo 20261019100000_platform_foundation.sql. Removes the platform admin list, add-on catalogue, per-gym add-on switches
-- and the platform audit log. Gyms themselves are not touched; every module goes back to always on.
begin;
drop function if exists public.platform_audit(integer);
drop function if exists public.platform_set_gym_addon(uuid, text, boolean);
drop function if exists public.platform_list_gyms();
drop function if exists public.my_gym_addons(uuid);
drop function if exists public.gym_addon_enabled(uuid, text);
drop function if exists private.is_platform_admin();
drop table if exists public.platform_audit_log;
drop table if exists public.gym_addons;
drop table if exists public.platform_addons;
drop table if exists public.platform_admins;
commit;
