# Open a past workout and "Do it again" (member app)

Gym touched: none specific (member screens, works for any gym; tested on Puffin Performance data shapes).

## What and why
Members could not tap a workout under Recent on the Workouts tab, so they could not see what they did or repeat it.

- Tapping one of your own Recent workouts opens `/m/train/session/:id`: exercises, sets, weights, reps, notes.
- "Do it again" opens `/m/train/again/:id`: the normal workout logger, prefilled with last time's numbers. Change them to today's and finish; it saves as a new workout. The old one is untouched.

## Files
- `web/src/data/train.ts`: `getMySession` (read-only, own sessions only).
- `web/src/train/TrainSession.tsx` (new): detail screen.
- `web/src/train/Train.tsx`: Recent rows are links.
- `web/src/train/Player.tsx`: "again" mode with seeded exercises.
- `web/src/app/App.tsx`: two routes.
- `web/src/member/member.css`: `.tr-open` tap target.
- `web/browser/train-again.mjs` (new), `web/package.json` (browser script).

## Noticed, not changed
- Exercises with two scores can't be rebuilt exactly: names copy, reps start blank.
- Finished workouts set by a coach have no "Do it again" yet.

No database change.
