# Programming library, part 3a: levels, cue and video in the member workout player

Gym touched: any. Needs the movement library SQL (already run on the live project) and a coach to fill in the Movements page; with no movement wording nothing changes for members.

**What members see:** in the workout player, beside each exercise whose name matches a movement in the gym's list (ignoring case and spaces): the coaching cue and a "Watch a video" link (opens in a new tab). If any exercise on the screen has Rx, Scaled or Foundations wording, a "Your level" choice appears at the top; picking one shows that level's wording under each exercise. The choice is remembered on that phone or browser, per gym.

**What it does not do yet:** the level is not saved with the finished workout, and personal bests are still kept by exercise name. Saving the level with the workout needs a database change (a column on the workout record), and unifying personal bests needs a name-to-movement link. Both are the next step, as a separate SQL for Adam to approve.

Checks: unit tests for matching and the level choice, new browser check `browser/member-levels.mjs` on phone and desktop (with and without level wording), existing class-workout and train browser checks pass, `npm run check` passes.

Rollback: revert this change. No database changes.
