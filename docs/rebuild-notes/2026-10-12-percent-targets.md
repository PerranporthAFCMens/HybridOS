# Percentage targets in workouts (12 October 2026)

**What it does.** In the workout builder (and the class workout builder, which is the same one), the weight box takes either
kilos or a percentage of the member's best: type `85` or `80%`. Each set can be different, so a build-up is just
`60%`, `70%`, `80%`, and a mix of kilos and percentages is fine.

**What the member sees.** On the workout screen the plan reads, for example, `3 sets: 5 × 80% (80 kg)`. Tapping "As set"
puts the kilos in the weight boxes, and the member can go up or down from there. What is saved is always kilos.

**The rules.**
- "Best" is the member's heaviest recorded weight for that exercise (any reps), the same number as their personal best.
- Rounded to the nearest 1 kg.
- The percentage applies to the exercise as named in the plan. If the member swaps to another exercise, it uses the best
  for the new name, if they have one.
- No best recorded yet: the plan says "(no best recorded yet)", a line says so, and the weight box is left empty for the
  member to fill in. Their reps are still filled in.
- Allowed range 1% to 150%. A badly typed percentage is refused when the coach saves, naming the exercise.

**Nothing in the database changes.** The percentage is stored as text in the workout's set boxes (`"80%"`), which the
existing workouts, assignments and class workouts already hold. Workouts saved before this are unchanged.

**Not done yet.**
- A different base than the exercise itself (for example "80% of 5RM Back Squat" set by a test week).
- Rep ranges, "max" reps and waves in one box.
- Showing the coach, when assigning, what each member's kilos would be.
