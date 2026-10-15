# "New workout" in the classic member app opens the new workout screen

- The "New workout" button on My workouts in the classic member app (`member.html`) used to open the old pop-up logger (Log workout / Reps & weight chips / Finish workout). It now opens the new workout screen, `/m/train/new` (the same screen as Train → "Start my own workout").
- Reason: the owner wants the new screen's layout and way of entering sets, not the old pop-up.
- Nothing is deleted: `workout-logger.js` is still loaded and unchanged, so reverting is one line in `member.html` (`openWorkout`).
- Works on live (`/m/*` is served by the new app) and on the dev preview (404.html fallback).
- No database change. Files: `member.html`, `web/tests/classic-pages.test.ts`.
