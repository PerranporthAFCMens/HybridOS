# The new member home obeys "What members see" (2026-10-12)

Until now only the original member page read what the owner sets under **What members see** and **Door access**. The new member home (`/m/today`) ignored both. It now reads them:

- **Tiles:** which show and in what order. The nine tiles map to: Training hub = the gym's promo panel; Next classes = the "Book another / Coming up" list; Training goal = the weekly ring; Training snapshot (new: workouts this week, personal bests, latest best); Recent activity (new: recent workouts and bests); Upcoming bookings (new: count); Membership (new); My booked classes (new); PT appointments. A tile the owner hides is not shown; one missing from the saved order is added at the end, visible (same rule as the old page). Nothing is shown until the settings have loaded, so the order never flickers.
- **Promo panel:** eyebrow, headline, text and up to two buttons (Classes, Workouts, PBs, Membership, Community, or an external link). An external link must be https; a button with a bad link, or no label, is left out. External links open in a new tab with `noopener noreferrer`. The on/off switch is honoured.
- **Door PIN:** a card with the gym's label and note, the code hidden until the member taps. Shown only when the owner switched it on and set a code.
- If the settings cannot be read, the defaults apply (the old member app did the same).

What stays outside the tiles, always shown: the greeting and the one thing that matters now (next class, workout or PT), and today's assigned workout.

No database change. Members read the settings through `get_member_home_settings` (as the old page does) and the door row through the existing "gym members can view access settings" rule. The Community button target needs the Community tab (#247).

Checks: `web/browser/member-home.mjs` (custom order, hidden tiles, promo, external link, unsafe link refused, PIN hidden and revealed, switched off, nothing set; phone and desktop), unit tests for the link rules, the existing member and train checks, and the 320px layout audit.
