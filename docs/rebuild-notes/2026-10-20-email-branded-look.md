# Branded look for the invite and sign-in emails

## Why
The emails looked like a plain white form. Adam asked for the HybridOne look and feel (BRAND.md).

## What changed
- `renderEmail` in `send-auth-email` now draws a Midnight page, a Deep card, the HybridOne logo, the gym name as a small label, a white heading, Fog body text and a Volt button with Midnight text. The sign-in code sits in its own box.
- Table layout with inline styles, so it holds up in Outlook, Gmail and Apple Mail. Dark already, so apps that darken emails leave it alone. Phone width tested (390px).
- Wording, links, subjects, the plain-text part and all logic are unchanged. A gym's own logo, if set, shows on a small white chip.
- The per-gym accent colour is no longer used for the button: BRAND.md says the primary action is always Volt.
- The HybridOne logo is loaded from `https://www.hybridone.co.uk/assets/brand/logo/png/...` (already on the live site).

## Checks run
`scripts/email_hook_smoke.py` passes. Rendered the invite, sign-in code and reset emails in a headless browser at phone width and looked at them. Not run: Deno type-check (Deno not installed here), a real send through Resend.

## Redeploy and rollback
Redeploy `send-auth-email` after merge (Adam approves). Rollback: redeploy the previous version (v12 content).
