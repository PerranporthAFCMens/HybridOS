# Supabase security warnings, 12 October 2026

Read from the live project's advisor report: 71 warnings and 5 notes. Read-only; nothing was changed by looking.

- **66 "signed-in users can run a security definer function".** These are the app's own actions. Each one checks who is
  calling inside the function. This is already covered by two automated checks: `member_cannot_use_admin_functions.sql`
  (a plain member can run only the reviewed list; 66 functions checked) and the function audit in
  `membership_status_personas.sql`. Accepted as designed.
- **4 "not signed in can run one".** Three are public by design (`get_access_invite` for the invite page,
  `get_public_gym_join_options` for the join page, `get_public_gym_brand` for the login page's name and logo).
  The fourth, `get_admin_invite`, is called by no page and no screen, so its public access is removed here
  (`20261012170000_admin_invite_signed_in_only.sql`). Signed-in people can still call it.
- **Leaked password protection is off.** A Supabase dashboard switch (Authentication, password protection); it may need
  the paid plan. Not a code change.
- **5 notes, "row security on, no rules".** Training groups and class purchases are reachable only through the app's
  functions. Intended.

New: a check that fails the build if any other security definer function ever becomes callable by someone who is not
signed in.

Found on the way: `get_public_gym_brand` exists on the live project and is used by `login.html`, but it is in no
migration file, so a fresh rebuild does not have it. It should be added to a migration when the login page moves over.
