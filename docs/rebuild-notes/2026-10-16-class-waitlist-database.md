# Class waitlist, part 1 of 2: the database (16 October 2026)

**Status: on a branch, NOT applied to the live database.** Needs Adam to approve the exact SQL in `supabase/migrations/20261016140000_class_waitlist.sql`. Nothing in the app uses it yet (part 2 is the screens).

**What it does:** when a class is full a member can join its waitlist. When a place opens (a booking is cancelled or removed, the class gets a bigger capacity), the first person in line is offered it and has 15 minutes to book it. If they do not, the offer expires and the next person is offered it. A place that has been offered is held: nobody else can book it while the offer is open. The person is told in the app (a `waitlist_offer` message).

**What changes for existing classes:** nothing until a class fills and someone joins its list. The two booking functions (`member_book_class`, `book_class_session`) are replaced with the same behaviour plus the hold, so a held place cannot be taken by someone who was not offered it.

**Who can do what:** members join, leave and look at their own place (`member_join_waitlist`, `member_leave_waitlist`, `get_my_waitlist`, `get_my_waitlists` for the whole gym in one call) under the same rules as booking (active membership, class access). Owners and admins can see a class's list (`get_class_waitlist`). Nobody writes the list directly.

**Offers expire without a schedule:** an expired offer is cleaned up, and the next person offered, the next time anyone books, joins or looks at that class. For classes that may sit quiet while an offer runs out, `supabase/verification/20261016_class_waitlist_schedule.sql` is an OPTIONAL pg_cron job (every minute). It is not applied by merging.

**Tested on a scratch database built from the repo migrations:** `supabase/tests/class_waitlist.sql` (54 checks: order of the line, the hold, expiry, leaving, capacity increase, who can see what, no direct writes, cancelled class) all pass; existing tests for membership status, member-cannot-use-admin-functions, class blocks, class workouts, Stripe join payments and plan terms still pass. The rollback `supabase/rollback/20261016_drop_class_waitlist.sql` gives exactly the catalog from before the migration, and applying the migration again gives the same catalog as the first time. `database-schema.yml` now expects 91 tables, 166 functions, 217 policies, 39 triggers and has a step for this change (not yet run in CI).

**Read-only check after applying:** `supabase/verification/20261016_class_waitlist_check.sql` (six rows, all `ok`).

**Not done yet (part 2):** the member's "Join waitlist" button and "A place opened up, book it" card on Classes, the owner's waitlist list on the class details, and the offer message in the app's notifications list. Class packs and the free trial are separate changes after that.

**Known limits:** the class schedule still shows a held place as available to people who were not offered it (they get "This class is full" when they try); part 2 will use `get_my_waitlist` to show the right state. Joining the line does not reserve a payment or a pass credit, since packs do not exist yet.
