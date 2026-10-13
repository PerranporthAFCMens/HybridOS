-- Undo 20261013100000_stripe_foundation.sql. Removes the payment switch, the cancellation window and the link to Stripe
-- (the Stripe account itself is not touched).
begin;
drop table if exists public.gym_payment_settings;
drop function if exists private.payments_need_stripe();
drop table if exists public.gym_stripe_accounts;
commit;
