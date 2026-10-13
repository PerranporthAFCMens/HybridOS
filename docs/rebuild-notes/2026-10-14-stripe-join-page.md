# Pay at sign-up, part 3: the sign-up page (2026-10-14)

The sign-up link (`/join/<gym>`) now has a **Payment** step after "Choose your membership", but only when the gym takes payment:
`get_gym_payment_mode(slug)` answers `stripe` (payments switched on in Settings > Payments and Stripe says the account can take cards).
If that answer is `off`, or the call fails (for example the database part has not been run yet), joining works exactly as before.

## What the member sees
1. Choose a plan. Paid, repeating plans go to the Payment step. Free plans join straight away (no card). One-off passes are not
   subscriptions, so the page says "ask the gym to sign you up" for them.
2. Payment step, part one: the plan and "£59.00 today, then £59.00 every month". Under 18: the parent or guardian's email is asked
   (their name was taken on the guardian step) and the page says the parent or guardian agrees and pays.
3. "Continue to payment" calls `stripe-join` `prepare` (creates the pending membership, returns the exact agreement wording and the
   card form's secret). Part two shows Stripe's own card form (Stripe.js, loaded from js.stripe.com, on the gym's own account), the
   agreement word for word with a tick box, and "Pay £X and join".
4. Pay: Stripe takes the payment. A declined card shows Stripe's message and they can try again or use another card. On success the page
   calls `stripe-join` `finish`; the server asks Stripe and only then makes the membership active. If Stripe has not confirmed yet, the
   page asks a few times and then says "Payment received ... please do not pay again"; the webhook finishes the job.

A pending membership at a gym that takes payment is an unfinished payment, so that person is no longer told "you are already a member":
they go through the steps again and pay.

## Not in this part
"Send this to my parent to pay" for under-18s, discounts and trials, terms and cancelling.

## Checks
`web/browser/join-pay.mjs` (fake Stripe card form, mocked network), unit tests in `web/tests/join.test.ts`.
