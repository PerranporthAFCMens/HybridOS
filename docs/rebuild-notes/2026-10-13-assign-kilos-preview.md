# The coach sees each client's kilos when assigning (13 October 2026)

**What it does.** When a coach assigns a workout (from the Workout builder, or from a client's file) that has weights set as a
percentage of the client's best (`80%`), the dialog shows **What <client> will see**: each such exercise in the words the client
will read, with the kilos worked out from that client's own bests, for example `Back Squat: 3 sets: 5 × 80% (112 kg)`.

- Choosing a different client changes the numbers.
- Where the client has no best for an exercise, it says `(no best recorded yet)` and adds a line saying they will fill in the
  weight themselves.
- Workouts with only plain kilos (or other kinds of exercise) show no preview.
- It is information only. What is sent is unchanged (the workout, with the percentages), and the client's own screen still works out
  their kilos from their best at the moment they open it, so a new best between assigning and doing it is respected.

**Rules.** Same as the client's screen: "best" is the client's heaviest recorded weight for that exercise (any reps), to the nearest
1 kg.

**Database.** No change. Coaches could already read the gym's personal bests (policy "staff_view_gym_personal_bests"); the screen
asks for that one client's bests in that gym only.
