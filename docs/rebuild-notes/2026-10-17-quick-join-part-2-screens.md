# Quick join, part 2: the new sign-up screens

Part 1 (database) is already live. This part is the screens. **Nothing changes for any gym until it is switched to Quick join**: the
join page asks the database which journey the gym chose, and any gym without a choice (or if the answer cannot be read) gets the full
journey exactly as before.

## The Quick join journey
1. **Choose your membership.** Price, what it includes, "Free" for free plans, and the minimum term and notice. "Step 1 of 4" from the first screen.
2. **Your email.** No password. A code is emailed (signed-in people skip this step); the page confirms itself when the 8th digit is typed. A returning member gets a code the same way.
3. **Just the basics.** Name, date of birth, mobile; a parent or guardian appears the moment the birthday says under 18. Each message sits next to its own box. A box says what comes after paying, using the gym's own settings.
4. **Agree and pay.** The existing payment step (the agreement word for word, Stripe's own card form, which offers Apple Pay and Google Pay when switched on in Stripe). A free plan skips this and joins from step 3.
5. **You're in.** A welcome, then the checklist: emergency contact, health questions and waiver (one signature), address. Each opens in place. The door code is shown when the required items are done; until then the page says it is waiting.

## Coming back to the list
Under Quick join the member's Today screen shows a "Finish setting up" card until the list is done (and says the door code is waiting). It leads to `/m/finish`. A gym on the full journey never shows it.

## Other changes
- The read-and-sign form is now one shared component (`SignForm`), used by the full journey and the checklist. The full journey behaves as before.
- `Field` can show an error next to its box.
- The sign-in email (`send-auth-email`) now shows the code for a returning member too, and the join page passes the gym with the request so these emails can carry the gym's name and logo. **This function must be deployed** (it is not part of the web build) before returning members and gym branding work. Without it, a new member's code email still works and a returning member's email has only the button.

## Switching a gym on
Settings screen (part 4), or the owner/admin calling `save_join_settings`. Switch Puffin only after trying the journey on the dev site.

## Checks
`web/browser/quick-join.mjs` (82 checks per width: whole journey, checklist, free plan, member app card, full journey untouched), `web/tests/quick-join.test.ts`, and all earlier join checks pass.
