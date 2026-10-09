# Coach side: send a workout on several days (2026-10-10)

In the Workout builder, **Assign to member** now has "How often": Once (as before), or **Every week on chosen days**: a start date, the days of the week and 1 to 12 weeks (up to 60 workouts). One request creates one assignment per day (so a programme goes in full or not at all), each with its own due date. Members see them under Today / Coming up in the new Workouts tab, and they are suggestions they can change, swap or skip.

No database change. Not done: linking a PT appointment to its plan (needs a new column; SQL to the owner first), and telling the member something was sent (notifications).
