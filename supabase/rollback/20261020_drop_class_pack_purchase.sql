-- Rollback for 20261020150000_class_pack_purchase.sql. Removes the two payment-service functions. Packs already made stay.
begin;
drop function if exists public.stripe_record_pack_purchase(uuid, uuid, uuid, text, integer);
drop function if exists public.stripe_pack_context(uuid, uuid, uuid);
commit;
