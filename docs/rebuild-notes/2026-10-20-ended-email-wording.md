# Membership-ended email: only blame payments when Stripe says so (2026-10-20)

Before: the "membership has ended" email always said it ended because payments could not be taken, even when a gym cancelled the subscription on purpose in Stripe.
After: the wording says "payments could not be taken" only when Stripe's cancellation reason is `payment_failed`; any other reason just says the membership has ended.
Files: `supabase/functions/stripe-webhook/index.ts`, `web/tests/paymentfailed.test.ts`. No database change. Needs a redeploy of `stripe-webhook`.
