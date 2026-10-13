# Pay at sign-up: the Stripe functions (step A2)

Two Edge Functions. They need the database part (PR for step A1) run first.

## stripe-join (signed-in member; "Verify JWT" on)
- `prepare { gym_id, plan_id, guardian? }`: checks the gym takes payments and the member's details are complete, makes the plan's Stripe product and price on the GYM'S OWN Stripe account (once), the member's Stripe customer, and a subscription that waits for the first payment (`default_incomplete`). Creates a PENDING membership (no access), records the exact agreement wording, and returns what the card form needs. A retry reuses the open subscription. Under 18: a parent or guardian's name and email are required, they are the payer and the one agreeing.
- `finish { gym_id, plan_id, subscription_id }`: asks Stripe (not the browser) if it was paid, and only then makes the membership ACTIVE (and records the payment and the card's brand, last four and expiry).
- One-off plans and plans with no price are refused for now ("cannot be paid for online yet").

## stripe-webhook (Stripe calls it; "Verify JWT" OFF)
Checks Stripe's signature (and that the request is recent), then on `invoice.paid` activates the membership if it is still waiting, and records the payment. Safe to receive twice. Covers the member who closes the page before `finish`, and later monthly payments.

## Owner setup (after the code is merged and the SQL is run)
1. Supabase > Edge Functions > Secrets: add `STRIPE_PUBLISHABLE_KEY` (`pk_test_...`; must be from the same Stripe account and mode as `STRIPE_SECRET_KEY`).
2. Deploy `stripe-join` (JWT on) and `stripe-webhook` (JWT **off**) by pasting the files.
3. Stripe > Developers > Webhooks > Add endpoint > "Listen to events on Connected accounts": URL `https://<project>.supabase.co/functions/v1/stripe-webhook`, event `invoice.paid`. Copy its signing secret (`whsec_...`) into Secrets as `STRIPE_WEBHOOK_SECRET`.

Stripe calls use API version `2025-03-31.basil` (override with the `STRIPE_V1_API_VERSION` secret). Not yet tested against the live Stripe API: as with the account link, any field Stripe rejects comes back in plain words and is a one-line fix.
