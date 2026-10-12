# Times are chosen as hours, minutes and seconds (12 October 2026)

**The problem.** The time box on a workout exercise was a plain text box. A bare number such as "1" was read as one *second*, and
nothing on screen said so, so a coach could not tell whether they were setting minutes or seconds.

**What changed.** Wherever an exercise records a time (the coach's workout builder, class workouts, and the member's logger,
which share the same set boxes), the box is now three selectors: **hours, minutes, seconds** ("0 hr", "1 min", "30 sec").
Nothing is typed, so nothing can be misread. All zero means no time set. It fits on a phone (checked at 390px).

**What is kept.** The time is stored as text exactly as before, `12:30` (minutes and seconds), now also `1:05:00` once there are
hours. Workouts saved earlier keep working: a bare `90` still means 90 seconds and shows as 1 min 30 sec; `12:30` shows as
12 min 30 sec. Nothing in the database changes.

**Limits.** Hours go up to 12. Existing text that is not a time shows as all zeros and is replaced when a time is chosen.
