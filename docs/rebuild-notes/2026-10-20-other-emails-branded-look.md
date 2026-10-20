# Branded look for the staff welcome, training and payment emails

## Why
The staff "Welcome to the team" email (and the workout and payment emails) still had the old plain white look. Adam asked for the HybridOne look and feel (BRAND.md) on all of them. The sign-up, sign-in, invite and reset emails were done in #383.

## What changed
- `shell` and `para` in `notify-staff-welcome`, `notify-training` and `stripe-webhook` now draw the same layout as #383: Midnight page, HybridOne logo, Deep card, gym name label, white heading, Volt button with Midnight text. Wording, links and logic are unchanged.
- In `notify-training` the coach's note box is now dark (it was light grey, which would not be readable on the dark card).
- Test change: `web/tests/trainingemail.test.ts` checked that the page never contains `<img`. The email now has one fixed `<img>` for the logo, so the check is narrowed to the exact payload the test injects (`<img src=x`). It still proves that markup from a name, title or note is escaped.

## Checks run
The three email test files pass (25 tests). Rendered the welcome, workout and payment emails in a headless browser at phone width and looked at them. Not run: Deno type-check (not installed), a real send.

## Redeploy and rollback
Redeploy `notify-staff-welcome`, `notify-training` and `stripe-webhook` after merge (Adam approves). Rollback: redeploy the previous versions.
