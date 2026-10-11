# Display names for people who join through the sign-up link (2026-10-11)

Status: written and tested in CI; NOT yet applied to the live database. Needs the owner's go-ahead.

## The problem
A new account's display name starts as its email address. `save_my_join_details` saved the first and last name but kept that display name, so everyone who joined through the sign-up link showed as an email address in lists, reports and Signed documents (seen on the second test sign-up).

## The change (one database migration, 20261011200000_join_display_name.sql)
1. `save_my_join_details` (same signature and grants): an empty display name, or one that contains `@`, becomes "First Last". A name the person chose is kept.
2. A one-off repair: profiles whose display name contains `@` and that have a first and last name get "First Last".

## How to apply (owner, in the Supabase SQL editor, in this order)
1. Run `supabase/verification/20261011_join_display_name_before.sql`. It only reads. It lists who the repair will change. Save the list.
2. Run `supabase/migrations/20261011200000_join_display_name.sql`.
3. Run `supabase/verification/20261011_join_display_name_check.sql`. Every row should say `ok`.

## Undo
`supabase/rollback/20261011_restore_join_display_name.sql` restores the previous function. The repaired names are not restored automatically; the saved "before" list is the record.

## Tests
`supabase/tests/member_details_edit_and_privacy.sql` (run by CI) now also checks that an email display name becomes "Ada Lovelace" after the join form, and that a chosen name ("Ace") is left alone.

## Scope
No other table or function is touched. Staff and team accounts are only affected if their display name contains `@` and they have a first and last name saved. Roll the whole PR back by reverting it; the live database changes only when the owner runs the migration.
