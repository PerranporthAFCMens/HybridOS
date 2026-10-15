# Workout builder: Save as new workout, and Duplicate (15 October 2026)

**Owner request:** take a workout, edit it, and save it as a new one without losing the original.

**What it does**
- Editing a saved workout now has two buttons side by side: **Save workout** (changes this workout, as before) and **Save as new workout** (leaves the original exactly as it was and saves what is on screen as a separate workout). If the name was left the same, the new one is called "<name> (copy)".
- The library has a **Duplicate** button on each workout. It opens an unsaved new workout called "<name> (copy)" with all the exercises filled in; nothing is written until Save is pressed.
- Members who were already given the original keep their own copy, as before.

**No database change.** Saving as new uses the same save as a brand new workout (`withoutIds` clears the saved ids on the sections and exercises so they are inserted fresh). Files: `web/src/workouts/Workouts.tsx`, `web/src/workouts/calc.ts` (`withoutIds`, `nameForCopy`), tests in `web/tests/workouts.test.ts` and `web/browser/workouts.mjs`.

**Next in the same plan (separate PRs, not started):** sections inside a workout (a "Create section" button, named freely), then distance units (metres, kilometres, miles).
