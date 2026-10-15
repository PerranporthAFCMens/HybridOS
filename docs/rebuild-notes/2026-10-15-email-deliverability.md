# Sign-up and invite emails landing in spam

## What was checked
- Sending goes through the `send-auth-email` Supabase function and Resend (domain `hybridone.co.uk`). Resend shows the domain verified, with DKIM, SPF and the return-path records all verified. Recent sends show as delivered.
- Mail leaves as `noreply@hybridone.co.uk` (saved in each gym's communication settings), with an HTML part only.
- The button link points at `mzgnhmeydhhpzgxlgudh.supabase.co`, a different domain from the sender.
- DMARC could not be checked from the build environment.

## Likely causes, most likely first
1. No DMARC record, or one set to `p=none` with no reports (to check, see steps for Adam in the PR).
2. Link domain (`supabase.co`) differs from the sender domain (`hybridone.co.uk`).
3. `noreply@` sender, a code plus a button in one short robotic message, no plain-text part.
4. New sending domain with low volume, so little reputation yet. Hotmail/Outlook is the strictest.

## Changed in this PR (`supabase/functions/send-auth-email`)
- Friendlier default wording for sign-up, sign-in and invite emails. Gym-specific templates saved in the database still win over these defaults.
- A proper plain-text version is now sent alongside the HTML.
- Default sender is `hello@hybridone.co.uk` when a gym has not saved its own sender.
- `lang="en"` on the HTML.

## Not changed
Per-gym saved sender (`noreply@`), saved gym templates, Supabase auth settings, DNS.
