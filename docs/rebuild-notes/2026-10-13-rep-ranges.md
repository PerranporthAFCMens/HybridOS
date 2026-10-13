# Rep ranges and "max" reps (13 October 2026)

**What it does.** In the workout builder (and the class workout builder, which is the same one) the reps box takes a number
(`10`), a range (`8-12`) or `max` (`AMRAP` means the same). Each set can differ, so `max` for the last set of a ladder is fine, and a
range can sit beside a percentage (`8-12` reps at `70%`).

**What the member sees.** The plan reads `8–12 × 60 kg` or `max reps × 80%`. Tapping "As set" fills in the weight but leaves the
reps empty, because a range or "max" is something to aim for, not a number to copy: the member records what they actually did,
and that number is what is saved (and feeds last time and personal bests). Nothing else about recording changes.

**Rules.** A range is two whole numbers, smaller first, up to 999 (`12-8`, `8-` and `0-5` are refused when the coach saves, naming
the exercise). Anything else typed in the reps box is checked as a number, as before. The member's own reps box still takes only a
number.

**Database.** No change. The target is stored as text in the existing set boxes (`"8-12"`, `"max"`), like percentages.
Workouts saved before this are unchanged.
