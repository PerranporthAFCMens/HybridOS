# Email links that open on hybridone.co.uk (Puffin Performance first)

## Why
Invite and password-reset emails are sent from `hybridone.co.uk` but their button pointed at `mzgnhmeydhhpzgxlgudh.supabase.co`. That mismatch is a spam signal.

## What changed
- New app page `/auth-confirm` (`web/src/auth/AuthConfirm.tsx`, `confirmLink.ts`). The email link opens it; the person presses **Continue**, which confirms the one-time token in their browser (`verifyOtp`) and sends them on to the page the email was for. Confirming only on a press stops mail scanners that open links from using the token up.
- `send-auth-email` builds that link only for gyms in `OWN_DOMAIN_LINK_GYMS` (Puffin Performance only) and only when the return page is on hybridone.co.uk. Every other gym and case keeps the supabase.co link exactly as before.
- `vercel.json` rewrite list gets `auth-confirm`.
- A return address that is not on this site is ignored (lands on `/auth-return`).

## Checks run
`npm run check` in `web/` (typecheck, lint, 806 tests, build) and `scripts/email_hook_smoke.py`. Not run: a real invite or reset through the live site.

## Redeploy and test (Adam)
Redeploy `send-auth-email`, then on Puffin Performance send (1) an admin invite to a spare address and (2) a password reset. The button should start `https://www.hybridone.co.uk/auth-confirm?...`, show a Continue page, then land in the app signed in (invite) or on "Choose a new password" (reset).

## Rollback
Remove the gym id from `OWN_DOMAIN_LINK_GYMS` and redeploy `send-auth-email`; the old link comes back at once.
