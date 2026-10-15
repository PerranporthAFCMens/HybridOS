# Member Classes: booked days in the day strip

- Gym: no data change; member view only (tested on Puffin Performance).
- `web/src/member/MemberClasses.tsx`: a day is "booked" when any class that day has `isBooked`. Adds a `booked` class and a spoken label ("you have a class booked").
- `web/src/member/member.css`: booked day gets a lime outline and a wider lime pill instead of the dot (dark pill when selected).
- No SQL, no new data calls.
- Check: `npm run check` in `web/` passes.
