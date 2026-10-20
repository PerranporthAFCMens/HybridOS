-- Undo 20261020140000_report_addons.sql.
begin;
delete from public.gym_addons where addon_key in ('report_library', 'report_builder', 'xero_export');
delete from public.platform_addons where key in ('report_library', 'report_builder', 'xero_export');
update public.platform_addons set name = 'Reports and report builder', description = 'Reports, downloads and Xero export' where key = 'reports';
commit;
