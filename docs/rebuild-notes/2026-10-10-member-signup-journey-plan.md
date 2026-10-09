# Member sign-up journey: plan (not built, no SQL applied)

Owner decisions so far: no real customers yet (so strict rules from day one, no migration of existing members). Every member must give: name, address, date of birth, emergency contact and relationship. The defaults below are open for change.

## What exists today
- `join.html?gym=<slug>` already is a per-gym sign-up link: account (name, email, mobile, DOB, password), then pick a plan, then confirmation.
- `join_public_gym_with_membership(slug, plan)` creates the member and membership. It checks nothing about personal details.
- `profiles` has name, phone, `date_of_birth`, gender. It has no address and no emergency contact. Members can update their own row.

## Proposed journey (link `/join/<gym-slug>`, clean URL, same page behind it)
1. Create account: email, password.
2. About you: first name, last name, date of birth, mobile.
3. Address: line 1, line 2 (optional), town, postcode (UK check).
4. Emergency contact: name, phone, relationship.
5. Under 18 only: parent or guardian name and phone.
6. Declaration: accept the gym's terms and health declaration (tick-box, date and time recorded).
7. Choose a plan, then confirmation with a link into the app.

The browser keeps the answers between steps (so a refresh does not lose them) and saves them to the database in one call after the emergency contact / guardian step. Step 7 only works if steps 2 to 6 are complete.

## Database changes (exact SQL to be approved before anything is applied)
- Address, emergency contact and guardian go in one new table `member_details`, NOT on `profiles`: any member of a gym can read any other member's profile today, so an address there would be visible to the whole gym. Only the member and owner/admin/staff of their gym can read it, and it is written only through one database function that validates everything.
- New table `member_declarations`: `user_id`, `gym_id`, `terms_version`, `accepted_at`. Insert-only for the member.
- `gyms`: add `terms_text`, `health_declaration_text`, `terms_version` (the gym edits the wording).
- `join_public_gym_with_membership` refuses unless all required details exist (guardian details when under 18, and a declaration for the gym's current terms version).
- Staff "missing details" view for staff-created members.
- A rollback script for every change, and `database.types.ts` updated to match.

## Build order (each its own PR to dev)
1. SQL for approval, applied only on the owner's go-ahead.
2. Profile and emergency contact data layer, with tests.
3. New join journey with browser checks for each step and the refusal cases.
4. Gym settings: edit the terms and declaration wording.
5. Members: "missing details" list, details on the member record, staff-created members asked for the same fields.
6. Clean `/join/<slug>` URL and a copy-link button in gym settings.

## Open questions (defaults in use unless changed)
Separate address fields; terms plus health declaration required; guardian details for under-18s (no signature); staff missing-details list.
