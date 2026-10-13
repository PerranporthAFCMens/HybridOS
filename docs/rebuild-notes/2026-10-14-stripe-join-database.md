# Pay at sign-up: the database part (step A1)

Nothing here takes a payment. It is the records and the guard the Stripe functions (A2) and the sign-up page (A3) will use.

- `20261014090000_stripe_payment_provider.sql`: adds `stripe` to the payment providers (its own migration because a new enum value cannot be used in the transaction that adds it; cannot be rolled back, and unused it does nothing).
- `20261014091000_stripe_join_payments.sql` (+ rollback, verification, `supabase/tests/stripe_join_payments.sql`):
  - `plan_stripe_prices`, `member_stripe_customers` (card brand, last four, expiry, never the number), `membership_agreements` (the exact wording agreed, who agreed, whether a parent or guardian, the amount and first payment date).
  - `private.gym_takes_payments` (payments switched on AND Stripe says the account can take cards) and `get_gym_payment_mode(slug)` ('stripe' or 'off') so the page knows whether to show the payment step.
  - Five functions for the Stripe service only (no table access is given to that role): `stripe_join_context`, `stripe_save_plan_price`, `stripe_save_customer`, `stripe_begin_membership` (creates a PENDING membership and records the agreement; a retry reuses it), `stripe_activate_membership` (Stripe confirmed: ACTIVE, payment recorded once, card kept; safe to call twice).
  - `join_public_gym_with_membership` now refuses a paid plan while the gym takes payments (it makes an ACTIVE membership with no payment, so otherwise anyone could skip paying by calling it directly). A free plan, and any gym with payments off, work exactly as before.
- CI counts: tables 86, functions 141, policies 206, triggers 36.
