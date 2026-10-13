# Two scores on one exercise (13 October 2026)

**What it does.** Some exercises are scored two ways: an AMRAP in rounds *and* reps, a for-time in time *and* reps (WodBoard calls it
"multiple scoring"). In the workout builder (and the class workout builder) an exercise's **Record** list now has
**Two scores (like rounds and reps)**. The coach names each score and says what kind of number it is (rounds, reps, time, weight,
distance or calories). The two must be different kinds. It starts as "Rounds" and "Reps".

**What the member sees.** One row with one box per score, each labelled with the score's name (a time score is the hours, minutes,
seconds selectors). The plan reads "Record Rounds completed and Finish time"; the coach's note (the AMRAP itself) shows as usual.
After saving it reads, for example, "5 rounds · 11:30". It is a single row, not three sets.

**How it is saved (no database change).** Each score goes in the set's own column: reps, time (seconds), weight, distance and calories
as before, and rounds in the set's spare "custom value" (unit `rounds`). The exercise is saved as `custom`, and every set carries a
mark in its custom unit (`rounds` or `score`) so it can still be told apart from other custom exercises (intervals) when the coach
reviews it or it comes back as "last time". The live database already allows those two columns to be written.

**What does not happen.** No personal best is made from a two-score exercise, and nothing is ranked.

**Checked.** Builder and member browser checks (see `browser/workouts.mjs`, `browser/member-two-scores.mjs`) assert the exact saved
workout and the exact set that is written, in both phone and desktop width.
