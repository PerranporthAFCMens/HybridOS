# Staff app in the new view (15 October 2026)

**What:** staff and coaches now land in the rebuilt app at `/s/today` instead of the old `staff.html`. Owners and admins can preview it from the menu ("Preview as staff").

**Screens (all in `web/src/staffapp/`):**
- **My day** (`/s/today`): the classes you are assigned to, today first, a "Next up" card, and a tap-through list of who has booked. Staff with the attendance permission can mark Attended, No-show or Undo.
- **Timetable** (`/s/timetable`): the whole gym for the next two weeks. Only shown when the access level ticks "View timetable".
- **Me** (`/s/me`): who is signed in, what the access level allows, Open the admin (only with full access), Switch gym, Sign out.

**Access:** nothing new in the database. Staff attendance changes the booking directly, which the existing policy "assigned staff can mark attendance" allows only for a class they are assigned to and only with the `mark_attendance` permission. Owners and admins use the existing `admin_manage_class_booking` call. Members are sent to their own app if they open `/s/`.

**Gym:** comes from the shared gym context. No database change, no SQL to run.

**Not in this change:** "My clients" for personal trainers (built in its own thread, PR #304 and after); it adds a tab to this frame when ready. The old `staff.html` and its helper files are still in the repo until Adam signs off, then they move to an archive folder.

**Also changed:** `vercel.json` hands `/s/*` to the app; `homeFor` sends staff and coaches to `/s/today`.
