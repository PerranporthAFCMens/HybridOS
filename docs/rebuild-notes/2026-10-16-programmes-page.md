# Programmes page (step 1 of the flow redesign)

Gym touched: any gym (screen only, no database change). Test gym: Puffin Performance.

A new Programmes page at /programmes walks a coach through making a block (called a programme here):
1. Name it (name, start day, weeks).
2. Pick the classes: choose a class name and the days it runs; every match in the programme's weeks is attached in one press. Classes already in another programme are skipped and the coach is told.
3. Add the workouts: shows how many attached classes have a workout and lists the ones that do not, with a link to the Timetable. (A proper grid comes in the next PR.)
4. Set the tests (optional): the existing benchmark tests, unchanged.

Menu: the Classes tab is now called Timetable and a Programmes tab sits next to it. The old Blocks pop-up still works until the menu change in a later PR.

Uses the existing data code (`useBlocks`, `useBlockClasses`, `setBlockClasses`, `getBlocksOfClasses`). No new SQL, no rollback needed.
Checks: `web/tests/programmes.test.ts`, `web/browser/programmes.mjs`, audit state `programmes`.
