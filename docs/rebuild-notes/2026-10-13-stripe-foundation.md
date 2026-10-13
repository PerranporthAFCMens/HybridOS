# Stripe foundation (13 October 2026)

First of the payment pieces. Nothing is charged by this change. It links a gym to its own Stripe account and adds the "turn payments on" switch.

## What it does
- Settings > **Payments** (new page, `/payments`):
  - **Stripe**: Connect Stripe / Finish set-up / Check again. Stripe's own page does the identity and bank set-up; the owner is sent back to this page and we ask Stripe how it went.
  - **Take payments**: one switch, off by default. It cannot be switched on until Stripe says the account can take card payments (the database enforces this, not just the page).
  - **Cancelling a class**: how long before a class members can cancel (none, 1h ... 7 days; default 24 hours). The gym sets it; later pass credits and charges will use it.
- Platform model: HybridOne is the Stripe platform, each gym links its own **Standard** connected account, money goes straight to the gym. No platform fee yet (the owner chose none).

## Pieces
- `supabase/migrations/20261013100000_stripe_foundation.sql` (+ rollback, verification, `supabase/tests/stripe_foundation.sql`): `gym_stripe_accounts` (written only by the Edge Function; owners/admins can read), `gym_payment_settings` (owners/admins manage, members of the gym read), trigger refusing `payments_enabled` before Stripe is ready. CI counts: tables 81, functions 129, policies 201, triggers 36.
- `supabase/functions/stripe-connect/index.ts`: `start` (create the Standard account if the gym has none, return Stripe's set-up link) and `refresh` (read the account from Stripe and save the three yes/no answers). Owner/admin only. The return address must be our own site. Uses the secret `STRIPE_SECRET_KEY`; test keys (`sk_test_`) are recorded as `sandbox`, live ones as `live`, and a gym linked with one kind is refused if the keys later change to the other.
- `web/src/payments/*`, `web/src/data/payments.ts`; tests `web/tests/stripeconnect.test.ts`, `web/browser/payments.mjs`.

## To switch it on (owner)
1. Run the migration (SQL in chat) and its check.
2. Supabase > Edge Functions > Secrets: add `STRIPE_SECRET_KEY` (start with the **test** secret key, `sk_test_...`). Never paste it into chat.
3. Deploy the `stripe-connect` function (paste `supabase/functions/stripe-connect/index.ts`).
4. In Stripe: Connect must be enabled on the platform account (Settings > Connect).
5. Settings > Payments > Connect Stripe.

## Next
Cards on file and pay as you go (charge for classes attended), class passes ("5 of 6 left"), the Stripe webhook, and the member side.
