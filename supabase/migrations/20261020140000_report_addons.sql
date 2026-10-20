-- HybridOne Control: split the Reports add-on so the paid extras can be sold separately.
-- DRAFT FOR THE OWNER TO APPROVE; merging does not apply it. Run after 20261019100000_platform_foundation.sql.
--
--   reports          stays ON by default: the Overview and its four tabs (everything except the three below).
--   report_library   NEW, OFF by default: the 24-report library with downloads.
--   report_builder   NEW, OFF by default: the report builder.
--   xero_export      NEW, OFF by default: the Xero export.
--
-- New rows only; no gym is switched on or off by this, and existing gym_addons rows are untouched. A gym gets one of the
-- new add-ons only when HybridOne Control switches it on for that gym.
-- Rollback: supabase/rollback/20261020_drop_report_addons.sql

update public.platform_addons
   set name = 'Reports (overview and tabs)', description = 'The Reports overview and its four tabs'
 where key = 'reports';

insert into public.platform_addons (key, name, description, optional, default_on, sort_order) values
  ('report_library', 'Report library',  'The full library of reports with CSV, Excel and PDF downloads', true, false, 101),
  ('report_builder', 'Report builder',  'Build, save and print your own reports', true, false, 102),
  ('xero_export',    'Xero export',     'Export payments and income to Xero', true, false, 103)
on conflict (key) do nothing;
