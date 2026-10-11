# Member details: editing, and who sees mobile numbers and addresses (11 October 2026)

## Why
The member record showed a member's details but gave staff no way to change them (a person added by hand, or a typo, could only be fixed by the member). And a member's mobile number was stored on `profiles`, which every member of the same gym can read. That was wrong: a member's number should be seen by the gym's team, not by other members, and the owner should choose whether the team sees it.

## What changed (one migration, `20261011180000_member_details_edit_and_privacy.sql`)
- **Edit.** `staff_save_member_details(gym, member, …)`: owners, admins and staff can save a member's name, date of birth, mobile, address, emergency contact and parent or guardian. The database checks who is asking, that the person is a member of that gym, and applies the same validation as the member's own form. Staff cannot edit an owner or admin.
- **Mobile number moved.** It now lives in `member_details` next to the address, which only the member and (through `get_member_details`) the gym's team can read. Existing numbers are copied across, `profiles.phone` is emptied, and a trigger keeps it empty. Other members can no longer read anyone's number.
- **Owner's choice.** `gym_privacy_settings` (one row per gym, owner-only to change, through `set_member_contact_visibility`). Two switches: the team sees mobile numbers; the team sees addresses. No row means both visible. The owner always sees everything. Emergency contact and parent or guardian details always stay visible to the team (needed in an emergency). If anything is hidden, only the owner can edit a member's details.
- Staff no longer read `member_details` directly; they call `get_member_details`, which blanks hidden fields in the database, not on the screen.

## Screens
- Members › a member › **Personal details**: shows everything held, with **Edit details** / **Add details**; says "Hidden by the owner" where it applies.
- Settings › **Who sees member details** (`/member-privacy`): the two tick boxes. Only the owner can change them.

## Still open (flagged, not changed here)
Date of birth and gender stay on `profiles`, so other members of the same gym can still read them (the same rule that lets members see each other's names and photos). Same treatment is the next step.

## Rollback
`supabase/rollback/20261011_drop_member_details_edit_and_privacy.sql` puts mobile numbers back on `profiles` and restores the earlier functions and read rule.
