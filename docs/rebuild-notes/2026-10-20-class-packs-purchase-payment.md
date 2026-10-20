# Class packs part 2b-2: starting a pack payment and recording it

Code only in this PR. Nothing is live until Adam approves the SQL from 2b-1 and each deploy below. Stripe sandbox only. Test gym: Puffin Performance.

- New edge function `stripe-pack-buy` (member sign-in required):
  - `prepare` {gym_id, pack_type_id}: checks the pack is on sale and the person is an active member (database function `stripe_pack_context`), then makes a one-off Stripe payment on the gym's own account (direct charge) and returns what the card form needs plus the exact words the member agrees to. Nothing is charged until the card form is confirmed.
  - `finish` {gym_id, payment_intent_id}: asks Stripe (not the browser) whether that payment succeeded and was made by this person for this gym, then makes the pack (`stripe_record_pack_purchase`).
- `stripe-webhook` now also handles `payment_intent.succeeded`: only payments our own server marked `kind: class_pack` make a pack; every other payment is ignored. This covers a member who closes the page before `finish`.
- One payment makes one pack however many times it is seen (`finish`, the webhook, or both).
- Before any of this works, Adam must: run the 2b-1 SQL (`sql-to-run/20261020_class_pack_purchase_RUN.sql`, then `_CHECK.sql`), approve deploying `stripe-pack-buy` and the updated `stripe-webhook`, and add the event `payment_intent.succeeded` to the existing Stripe sandbox webhook endpoint.
- Not built yet: the Buy button and card form on the member screen (2b-3).
- Tests: `web/tests/stripepackbuy.test.ts` (12 tests: form encoding, agreement words, reading our own payment, ignoring others).
