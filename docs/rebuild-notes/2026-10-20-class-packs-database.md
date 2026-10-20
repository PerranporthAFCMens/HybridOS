# Class packs, part 1 of 3: the database (20 October 2026)

**Database only. No screens, no payments, booking unchanged. SQL to run by hand (Adam).** Migration `supabase/migrations/20261020100000_class_packs.sql`, rollback `supabase/rollback/20261020_drop_class_packs.sql`, check `supabase/verification/20261020_class_packs_check.sql`, tests `supabase/tests/class_packs.sql` (39 checks).

- `class_pack_types`: what a gym sells (name, number of classes, price, days it lasts or never). Owners and admins manage; members read the ones switched on.
- `class_packs`: a pack a member holds, with the name and class count copied at the time (so editing a pack type never changes packs already held), classes left, expiry, who gave it or the payment it came from. Members read their own; owners and admins read the gym's. Nobody writes it directly.
- `owner_give_class_pack(gym, member, pack_type)` and `owner_void_class_pack(pack)`: owners and admins only, checked inside the function.
- One payment can make only one pack (unique payment id), ready for part 2 so a repeated message from Stripe never doubles credits.

Next: part 2 = owners set up packs on screen and members buy them by card (Stripe, sandbox); part 3 = booking spends a credit and a cancel in time gives it back.

Checked on a scratch Postgres 16 with stand-ins for the Supabase pieces: the 6 verification rows say ok, the 39 persona checks pass, rollback removes both tables and the migration re-applies. The full schema rebuild runs in CI (counts moved to 101 tables, 176 functions, 233 policies).
