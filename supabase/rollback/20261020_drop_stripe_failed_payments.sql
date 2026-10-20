-- Rolls back 20261020100000_stripe_failed_payments.sql. Payment records already written stay (they are real history).
drop function if exists public.get_my_payment_notice(uuid);
drop function if exists public.stripe_subscription_event(text, text, boolean);
drop function if exists public.stripe_clear_failed_payment(text, text);
drop function if exists public.stripe_record_failed_payment(text, text, integer, text, text, text);
