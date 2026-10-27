# Start my own workout: blank page

Gym touched: none specific (member app, all gyms). No database change.

Adam saw a blank page on /m/train/new (Workouts, then "Start my own workout") in the member preview on the dev site.
The route and page exist and open fine in a clean browser, so the cause looks like something saved on the phone: a half-finished
workout draft (kept in the browser) whose exercises the screen cannot draw. I reproduced a blank page with such a draft.

- `web/src/train/Player.tsx`: a saved draft is only used if every exercise has what the screen needs; otherwise a fresh workout starts.
- `web/src/app/ErrorBoundary.tsx` and `App.tsx`: a screen that breaks now shows "Something went wrong on this page" with the reason, not a blank page.
- `web/browser/member-bad-draft.mjs`: new browser check for the above.

Not confirmed: that Adam's phone holds exactly this kind of draft. If the page still goes blank, the new message will show the real reason.

## Follow-up (same day)
The error message from Adam's phone said `undefined is not an object (evaluating 'e.some')`. Cause: an older saved draft has exercises
without the coach's `target` list, and `hasPercent(a.target)` calls `.some` on it. Fix: `readDraft` now fills in the missing fields
(target, plan, note, block) so the saved workout opens as it was; the browser check now uses such a draft.
