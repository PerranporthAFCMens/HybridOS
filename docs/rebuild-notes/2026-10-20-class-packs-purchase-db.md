# Class packs part 2b-1: database side of buying a pack by card

Database only. No screen and no payment code yet. Affects every gym once the SQL is run; nothing changes for anyone until the later pieces exist. Test gym: Puffin Performance.

- `stripe_pack_context(gym, member, pack_type)`: what the payment service needs to start a payment (pack name and price, the gym's linked Stripe account, whether this person may buy). Refuses a pack that is off sale, another gym's pack, and anyone who is not an active member.
- `stripe_record_pack_purchase(gym, member, pack_type, payment_id, amount_pence)`: makes the member's pack once Stripe says the payment went through. The payment id can only ever make one pack (the existing unique index), so a repeated message from Stripe returns the same pack. A payment that lands after the pack went off sale is still recorded, because the money is already taken.
- Both can be run only by the payment service (service role). Signed-in members, owners and visitors are refused; the tests check each.
- Next pieces (not built): 2b-2 the edge function that starts a payment and the `payment_intent.succeeded` webhook event; 2b-3 the "Buy" button on the member screen. Each needs Adam's go before anything is deployed.
- Rollback: `supabase/rollback/20261020_drop_class_pack_purchase.sql` (packs already made stay).
- Checks: `supabase/verification/20261020_class_pack_purchase_check.sql` (3 rows ok), `supabase/tests/class_pack_purchase.sql` (24 checks).
