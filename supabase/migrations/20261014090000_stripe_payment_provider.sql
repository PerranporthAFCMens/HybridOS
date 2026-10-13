-- Adds "stripe" to the payment providers, so memberships and payment records can say they are paid through Stripe.
-- It has to be its own migration: a new enum value cannot be used in the same transaction that adds it.
-- Rollback: none needed. An enum value cannot be removed, and an unused one does nothing (see supabase/rollback/20261014_stripe_payment_provider.sql).
alter type public.payment_provider add value if not exists 'stripe';
