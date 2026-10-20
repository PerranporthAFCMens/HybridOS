# Class packs part 3b: member screen

Touches every gym's member app (Classes and Today). Test gym: Puffin Performance.

- A member who holds usable pack classes is no longer stopped by the "not included in your plan" box. The database still decides: it spends a pack class only when the plan does not cover the class (see `2026-10-20-class-packs-booking.md`).
- Booking says when a pack class was used and how many are left. Cancelling says when the class went back onto the pack.
- The Classes screen shows "You have N pack classes left" when there are any. Cancelled, empty and out-of-date packs are not counted.
- A member with no pack sees exactly what they saw before.
- Data: `bookClass` and `cancelClass` now return `usedPack` and `classReturned`; `listMyPacks` reads the member's own packs (named by user, since owners can read all packs in the gym).
- Check: `web/browser/member-pack.mjs` (with and without a pack, phone and desktop), `web/tests/packs.test.ts`.
