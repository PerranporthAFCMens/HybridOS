# Timetable tidy: one way to run a programme

Gym touched: any gym (screen only, no database change, no SQL).

The Timetable (Classes) page no longer has the old "Blocks" pop-up button or the "Workout builder" button in its header. Programmes and the workout library are reached from the tabs along the top (Timetable, Programmes, Workout builder, Movements, Client training), and everything the pop-up did is on the Programmes page: make a programme, pick classes by name and days, set workouts week by week, set the tests, delete.

- Removed `web/src/classes/ClassBlocks.tsx` (the pop-up). Its data code (`useBlocks`, `blocks.ts`) is still used by the Programmes page.
- `block-benchmarks.mjs` now opens the programme on /programmes. `class-blocks.mjs` keeps only the check that a class's workout shows its programme and week; the make, pick and delete checks live in `programmes.mjs`.
- `classes.mjs` checks the two old buttons are gone.
- Not changed: the tab names, and the "Workout builder" and "Movements" pages stay separate tabs for now. Merging them under one Library tab would rename headings that many checks look for, so it is left for its own change if wanted.
- `back.mjs` needs the built old site, so it was not run locally; CI runs it.
