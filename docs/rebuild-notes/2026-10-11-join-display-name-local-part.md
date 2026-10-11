# Display names, second fix (2026-10-11)

Status: written; NOT applied to the live database. Needs the owner's go-ahead.

## What was missed
The first fix (20261011200000) treated a display name as "automatic" only when it contained "@". The trigger that makes a profile for a new account (`public.handle_new_user`) actually starts the display name as the part of the email BEFORE the "@" (`a.j.turner+signuptest`). So the earlier check said "ok" (it only looked for "@") but the Signed documents row still showed the automatic name.

## The change (20261011220000_join_display_name_local_part.sql)
A display name counts as automatic when it is empty, contains "@", or equals the part of the person's own email before the "@". Automatic names become "First Last" when the person saves their details; a name they chose is kept. A one-off repair does the same for profiles that already have a first and last name.

## How to apply (owner, Supabase SQL editor)
1. Run `supabase/migrations/20261011220000_join_display_name_local_part.sql`.
2. Run `supabase/verification/20261011_join_display_name_local_part_check.sql`: every row `ok`.
3. Reload Signed documents.

## Undo
`supabase/rollback/20261011_restore_join_display_name_v1.sql` restores the previous function; repaired names are not restored (the emails stay on the login accounts, so nothing real is lost).

## Test
`supabase/tests/member_details_edit_and_privacy.sql` now also covers the automatic name made from the email (`member` for `member@x`), alongside the "@" case and a chosen name that must be kept.
