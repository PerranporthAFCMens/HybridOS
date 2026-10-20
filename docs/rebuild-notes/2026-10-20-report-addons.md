# Report add-ons (20 October 2026)

Owner decision: Reports is on by default for every gym, but the **report library**, the **report builder** and the **Xero export** are separate add-ons, **off by default**, switched on per gym in HybridOne Control.

- SQL: `supabase/migrations/20261020100000_report_addons.sql` (three new add-on rows, one rename; rollback `supabase/rollback/20261020_drop_report_addons.sql`). Run by the owner after step 1; merging does not apply it.
- No gym changes by this SQL alone. Hiding the library, builder and Xero export in the gym's Reports screen (and the database refusing them) comes with the gating step, so until then every gym still sees them.
- Count guard: no new tables, functions or policies.
