# No card details in our database (2026-10-14)

Rule from the owner: card details live only in Stripe. HybridOne keeps nothing about a card.

- The card number is typed into Stripe's own form (an iframe), so it never reaches the app, the functions or the database. That was already true.
- `member_stripe_customers` no longer has `card_brand`, `card_last4`, `card_exp_month` or `card_exp_year`. It keeps only Stripe's own tokens: the customer id and the payment-method id (useless without the platform secret key).
- `stripe_activate_membership` keeps its signature (the deployed functions still call it with the same arguments) but ignores the four card arguments.
- `stripe-join` and `stripe-webhook` now read only the payment-method id from Stripe and pass nulls for the rest. `finish` no longer returns a `card`.
- Showing "Visa ending 4242" will be done by asking Stripe at that moment (a small function, built with the classes and visits step); nothing is copied into our database.

Owner steps after merge: run `supabase/migrations/20261014120000_no_card_details.sql` (comments stripped), run `supabase/verification/20261014_no_card_details_check.sql` (every row `ok`), then paste the two updated functions into Supabase (`stripe-join`, `stripe-webhook`) and Deploy. Order does not matter: the old functions keep working against the new database, and the new functions work against the old one.
