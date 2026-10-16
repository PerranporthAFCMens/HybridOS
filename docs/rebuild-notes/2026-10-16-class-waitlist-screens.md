# Class waitlist, part 2: the screens

Gym touched: any (Puffin Performance is the test gym). Needs part 1 (PR for `20261016140000_class_waitlist.sql`) applied first; without it the new buttons report an error and nothing else changes.

**Member Classes and Today:** a full class now shows **Join waitlist** instead of a dead "Full" button. Once joined it says "You're 2nd in line" with **Leave waitlist**. When a place is offered it says "A place is held for you: 12 minutes left" with **Book it** and **No thanks**. If a class fills between loading the page and tapping Book, the member is told and offered the waitlist.

**Coach (owners and admins) Class details:** a **Waitlist** list under the bookings, showing who is waiting and who has an open offer. Hidden when empty or when the person is not allowed to read it.

**Database addition (in part 1):** `get_my_waitlists(gym)` so the page asks once for all of a member's places in line.

Checks: unit tests for the wording (ordinals, minutes left), new browser check `browser/member-waitlist.mjs`, existing member/today/classes browser checks updated and passing, `npm run check` passes.

Rollback: revert this change; the database part rolls back with `supabase/rollback/20261016_drop_class_waitlist.sql`.
