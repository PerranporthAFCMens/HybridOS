# Failed Stripe payments and subscriptions ended in Stripe (2026-10-20)

Gym touched: none directly (any gym that takes Stripe payments; test with Puffin Performance in Stripe test mode).

Before: the Stripe webhook only reacted to `invoice.paid`. A failed monthly payment, or a subscription cancelled in Stripe, changed nothing in HybridOne.

After:
- `invoice.payment_failed` records a FAILED payment, so the member appears on the owner's Money owed list and the Today alert (no new owner screen needed). The membership's payment status becomes failed. The member is emailed once per invoice (Resend, same sender settings as the other emails).
- `customer.subscription.deleted` (or status canceled) ends the membership today and emails the member. If the app already ended it (a member leaving), nothing changes and no email goes.
- `customer.subscription.updated` with past_due or unpaid marks the payment as failed; no email (the failed-payment event already sent it).
- A later `invoice.paid` for the same invoice turns the failed record back to confirmed (a retry worked), so the member stops being "not financial".
- The member's home screen shows a red card while a payment is failed or the membership ended for non-payment (`get_my_payment_notice`, own rows only).

Database: `supabase/migrations/20261020100000_stripe_failed_payments.sql` (4 new functions, no table changes; `stripe_activate_membership` untouched). Rollback: `supabase/rollback/20261020_drop_stripe_failed_payments.sql`. Check: `supabase/verification/20261020_stripe_failed_payments_check.sql`.

To switch on (Adam): run the SQL, deploy `stripe-webhook`, then in Stripe (test mode) add the three new events to the existing webhook endpoint: invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted.

Not done: the exact bank reason for a failure (the event does not carry it, so the wording is generic); an email to the owner (they see it on Today and Money owed). Live-mode use waits for the Stripe live trial.
