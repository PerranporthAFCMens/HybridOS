-- Undo 20261013120000_money_owed.sql. Removes the settlements (how missed payments were dealt with) and the overdue setting.
-- The payment records themselves are not touched.
begin;
drop function if exists public.reopen_missed_payment(uuid, uuid);
drop function if exists public.settle_missed_payment(uuid, uuid, text, text);
drop function if exists public.get_member_missed_payments(uuid, uuid);
drop function if exists public.get_gym_arrears(uuid);
drop function if exists private.missed_payments(uuid);
drop table if exists public.payment_settlements;
alter table public.gym_payment_settings drop column if exists overdue_grace_days;
commit;
