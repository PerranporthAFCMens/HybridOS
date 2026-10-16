# Programme workout grid (step 3)

Gym touched: any gym (screen only, no database change, no SQL). Test gym: Puffin Performance.

Step 3 of a programme is now a grid: one row for each class slot (same name, weekday and start time, like "Mon 18:00 HIIT") and a button for each week. Tap a week to choose a workout from the library, make it available or take it back, or remove it. "Use for all N weeks of <row>" puts one workout on every week of that slot in one save.

- Same rules as the class pop-up: a workout is a copy, replacing keeps it available or draft as it was.
- "Build a new workout" opens the workout editor inside the picker and puts the new workout on that week.
- New data call `setClassWorkouts` saves one workout onto several classes in a single request.
- Weeks with no class in a slot show "No class". Uses the gym clock so a slot stays the same across the clocks changing.
- Not changed: adding movements. They are still added in the workout editor; neither gym has any movements yet.
- Checks: `web/tests/programmes.test.ts` (grid), `web/browser/programmes.mjs` (grid, picker, exact write) at phone and desktop width.
