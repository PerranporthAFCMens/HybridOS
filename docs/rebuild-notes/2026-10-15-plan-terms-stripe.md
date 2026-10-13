# Plan terms and cancelling, part 2: Stripe stops billing (2026-10-15)

New Edge function `stripe-membership-sync` (JWT on). The app calls it with `{ membership_id }` after anything that ends, schedules the end of, or takes back the end of a membership. It reads the database's answer (`stripe_membership_state`, service role only) and makes the Stripe subscription on the gym's own account match:

- membership over (cancelled/expired), or its ending has come due -> subscription cancelled now, nothing more charged
- an ending booked for a future last day -> subscription set to stop at the start of the day after the last day (London time, summer and winter handled), so no later payment is taken
- nothing booked (a request was withdrawn or declined) -> any scheduled stop is removed

It never decides anything and never changes a membership: it only copies the database to Stripe, so calling it twice, or by someone who should not, can only make Stripe agree. The caller must be able to see the membership (row security). Memberships not paid through Stripe are left alone.

Needs part 1 (the database, PR for `20261015090000_plan_terms.sql`) run first: it provides `stripe_membership_state`.

Owner steps after merge: create the function `stripe-membership-sync` in Supabase (Edge Functions, Deploy a new function, Via Editor), paste `supabase/functions/stripe-membership-sync/index.ts`, leave Verify JWT ON, Deploy. No new secrets: it uses `STRIPE_SECRET_KEY`.

Not in this part: the calls from the screens (the next part wires them in).
