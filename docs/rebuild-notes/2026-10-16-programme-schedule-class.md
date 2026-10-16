# Schedule a class from the programme page (16 October 2026)

Step 2 of a programme now has a **Schedule a new class** button. It opens the Timetable's own add-class form (same checks for coaches, rooms and clashes), already set to repeat weekly for the programme's weeks from its start day. When it is saved, the programme page selects that class so you only check the days and press Add. Nothing is attached automatically.

- `ClassForm` accepts a repeat/weeks starting value and tells the caller the class name it saved.
- No database changes. Gym comes from the shared gym context. Browser check `programmes.mjs` covers the form opening pre-filled and closing without writing.
