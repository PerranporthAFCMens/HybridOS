# HybridOne Supabase schema reconciliation

## Scope
Task 2 captures the current HybridOne database structure in Git without copying live application data. The live Supabase project was inspected read-only through PostgreSQL catalogue queries. No DDL or mutation was run against the live project.

## Live structure observed
- 62 application tables: 58 public and 4 private
- 5 application enum types
- 1 application sequence
- 83 live public/private functions
- 150 public RLS policies
- 4 custom avatar policies on storage.objects
- 25 application-related ordinary triggers when including the Auth signup trigger
- 1 application event trigger that enables RLS on newly created public tables
- 141 foreign keys
- 65 non-constraint indexes in addition to indexes backing constraints
- explicit schema, table and routine grants for Supabase API roles
- no application views
- no application publication membership

The live migration history contains well over 100 historical entries, including schema changes, demo/seed operations and temporary tests. The repository previously contained only seven partial migration files.

## What is committed
`supabase/migrations/20260930000000_live_schema_baseline.sql` is a schema-only current-state baseline for fresh/local databases. It contains extensions, enums, sequence, tables, constraints, foreign keys, indexes, functions, RLS, custom Storage policies, triggers and explicit grants. No table rows are copied.

## Deliberately not copied
Two live browser-test helper functions are omitted because they embed live fixture identifiers:
- `public.hybridone_auth_journey_test_membership`
- `public.hybridone_auth_journey_test_membership_role`

They are recorded as live-only operational test helpers rather than putting those fixture identifiers into Git.

Supabase-managed platform tables in auth, storage, realtime, vault and migration-history schemas are not duplicated. The local Supabase stack supplies them. HybridOne's four custom Storage policies are included.

Historical seed/demo/test migration rows are not copied. Their structural end state is represented where applicable, but data is intentionally excluded.

## Previous repository migrations
The seven migration fragments previously in the repository are preserved unchanged under `supabase/migrations-legacy/`. They are outside the active migration chain because replaying them after the current-state baseline would duplicate objects.

## Verification
CI pins Supabase CLI 2.118.0, starts a fresh local stack, runs `supabase db reset --local`, checks expected schema object counts, and confirms representative application tables have no rows. The workflow contains no live project reference, access token or database password.

## Future changes
Add new timestamped files to `supabase/migrations/` and prove them with the fresh-local rebuild before merging. Never apply this baseline to the existing live project.
