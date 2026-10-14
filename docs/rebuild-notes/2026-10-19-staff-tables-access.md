# Staff screen could not load the team (14 October 2026)

**What the owner saw:** Settings and staff > Staff said "Could not load the team. Refresh to try again." and "Add staff login" did nothing (the form only opens once the team has loaded).

**Cause:** the live database leaves signed-in users no table rights at all on `staff_profiles` (job title and pay) and `staff_working_hours` (it was set up that way in the 30 September baseline). The new Staff screen, the class checks, the staff reports and the old staff pages all read them straight from the browser, so each failed with "permission denied for table". Found by running the screen's seven reads as the owner's login: five worked, these two were refused.

**Fix (applied to the live project on 14 October 2026 and recorded here):** `supabase/migrations/20261016100000_staff_tables_access.sql`
- Signed-in users get read, add and change (no delete) on the two tables. Row Level Security still decides which rows: owners and admins manage all; a team member reads only their own details; members and the public see nothing.
- The hours read policy said "any active member of the gym". With the table readable that would have shown the team's hours to every ordinary member, so it now says owner, admin, staff or coach.
- Nothing is granted to `anon`.

**Check:** `supabase/verification/20261016_staff_tables_access_check.sql` (four rows, all `ok` on live), persona tests `supabase/tests/staff_tables_access.sql`, and a CI step with rollback and re-apply.
**Undo:** `supabase/rollback/20261016_revoke_staff_tables_access.sql` (puts the old policy back and removes the rights; the Staff screen stops loading again).

**Same cause, other tables?** Not checked here. If another new screen says "Could not load", the first thing to try is the same seven-reads test as the owner.
