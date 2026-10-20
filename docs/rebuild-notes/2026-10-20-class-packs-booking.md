# Class packs, part 3a: booking uses a pack class (database) (20 October 2026)

Migration `20261020133000_class_pack_booking.sql` (rollback `supabase/rollback/20261020_drop_class_pack_booking.sql`, check `supabase/verification/20261020_class_pack_booking_check.sql`, tests `supabase/tests/class_pack_booking.sql`, 55 checks).

**The rules**
- A member whose plan includes classes, or who paid for that class as a drop-in, books exactly as before. No pack class is used.
- A member whose plan does **not** include classes, and who holds a pack that is not cancelled, not used up and not expired, books with one class from that pack. The pack that runs out soonest is used first. Their membership must still be active (the existing rule is unchanged: a pack does not replace a membership).
- Cancelling **at least 12 hours before** the class gives the class back. Cancelling later does not.
- The gym cancelling or deleting a class, or an owner or admin taking someone off the list, always gives the class back.
- A cancelled pack never gets a class back, and a pack never holds more than it started with. A booking can give a class back only once.

**What changed**
- `class_bookings.class_pack_id` records which pack paid for a booking.
- Five private helper functions (not callable by members) and one trigger on `class_sessions` for the cancelled or deleted class.
- `member_book_class` and `book_class_session` (as the waitlist migration left them, plus the pack path), `member_cancel_class`, `cancel_class_booking` and `admin_manage_class_booking` (plus the give-back). Their permissions are unchanged and no new public function is added.
- `member_book_class` now also says `used_pack` and `member_cancel_class` says `class_returned`, for the member screen in the next PR.

**Choices I made, easy to change**
- The 12 hours lives in one place, `private.pack_cancel_window()`. Making it a per-gym setting is a small follow-up if wanted.
- A pack must still be in date when the member books (not when the class happens).
- A person with a pack but no active membership cannot book. That is the existing status rule and I left it alone.

Not in this PR: the member screen (shows the pack, "uses 1 of your classes", "class returned"); buying a pack by card (part 2b). Until the screen PR, a pack holder can book and cancel on the existing member classes page and the rules above apply, but nothing on screen mentions the pack.

**Live database:** the SQL must be run by Adam (`/mnt/project-files/sql-to-run/20261020_class_pack_booking_RUN.sql`, then `..._CHECK.sql`: every row must say ok). It replaces five existing functions, so Adam's go-ahead is needed first. CI counts are now 187 functions and 44 triggers.
