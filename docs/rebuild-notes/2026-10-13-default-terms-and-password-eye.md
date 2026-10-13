# Default terms, and a show-password eye (13 October 2026)

**Default terms unless a plan changes them.** A plan with no minimum term or notice of its own now always shows, and agrees to, the gym's
usual terms. Until now a gym that had never saved any membership rules had no usual terms at all, so the sign-up page and the payment
agreement said nothing about them (seen in the first real test: the agreement had no term or notice line). Now:
- The database (`get_public_gym_join_options`, `stripe_join_context`) uses `private.rules_for(gym)`, which is the gym's saved rules or, when it
  never saved any, the built-in default: **no minimum term and 30 days' notice**. This is the same default cancelling already used, so what
  a member is shown is what happens when they leave.
- Plans screen: a plan with no terms of its own says "Your usual terms: No minimum term · 1 month notice to leave" (the gym's real numbers),
  and the two fields say what blank means and show the usual value as a hint.
- Nothing to change per plan: set terms on a plan only when it should differ.

**Show-password eye.** A new `PasswordInput` (in `src/ui`) puts an eye inside the right edge of a password box; tapping it shows what was
typed and tapping again hides it. Used on the sign-up page (password and confirm password, each with its own eye) and member Change
password. The old sign-in page (`login.html`) is a separate page and is not changed here.

**To switch on.** Run the two replaced functions from `supabase/migrations/20261015091000_plan_terms_functions.sql` (only
`get_public_gym_join_options` and `stripe_join_context` change; the file is safe to run again). No Edge Function change: the agreement
wording already uses whatever terms the database sends.

**Checked.** Unit tests (696), tsc, eslint, browser checks for join (eye shows and hides, own eye on confirm), plans (usual terms text), member
(password change); a database test for a gym with no saved rules (0 months / 30 days on the sign-up page and in the payment step).
