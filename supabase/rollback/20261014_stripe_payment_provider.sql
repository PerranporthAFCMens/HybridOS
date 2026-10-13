-- 20261014090000_stripe_payment_provider.sql adds the value 'stripe' to public.payment_provider. Postgres cannot remove an
-- enum value, and an unused one changes nothing, so there is nothing to undo here. This file exists so the list of
-- rollbacks is complete.
select 1;
