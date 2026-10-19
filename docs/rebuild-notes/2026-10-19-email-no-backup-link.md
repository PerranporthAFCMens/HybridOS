# Sign-up and sign-in emails: no supabase.co backup button

## Why
Real members still reported the confirmation email going to junk. The email was sent from `hybridone.co.uk` but its button pointed at the `supabase.co` address, which is a common spam signal. Sign-up and sign-in emails already contain the code, and the new join page (`/join/<slug>`) has a box to type it.

## What changed (`supabase/functions/send-auth-email/index.ts`)
- For sign-up and sign-in emails whose return page is the new join page, the email now has the code only. No button, no supabase.co address.
- Everything else is unchanged: invite, password reset, email change, and sign-up from the old `join.html` still get their link.

## Not changed
Own-domain confirm link for invite and reset emails (planned separately, needs a new page and hosting routes). Sender address, DNS, saved gym templates.

## Redeploy
`send-auth-email` needs redeploying after merge. Gym touched: any gym using the new join page (Puffin Performance is the test gym).
