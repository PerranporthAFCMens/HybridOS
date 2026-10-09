-- Undo 20261010150000_membership_rules.sql.
-- Removes the rules, the requests (and so the record of who asked for what), the plan flag and the functions.
-- It does NOT undo a pause, cancellation or plan change that has already been put into effect on a membership: those
-- are ordinary changes to public.memberships. Check public.membership_requests before running this if any are live.
begin;
drop function if exists public.apply_due_membership_requests();
drop function if exists public.decide_membership_request(uuid, boolean, text);
drop function if exists public.withdraw_membership_request(uuid);
drop function if exists public.request_membership_change(uuid, uuid);
drop function if exists public.request_membership_cancel(uuid, text);
drop function if exists public.request_membership_pause(uuid, date, date, text);
drop function if exists public.get_my_membership_options(uuid);
drop function if exists private.new_request(public.memberships, text, text, date, date, uuid, text, integer, jsonb);
drop function if exists private.sweep(uuid);
drop function if exists private.apply_request(uuid);
drop function if exists private.newest_membership(uuid, uuid);
drop function if exists private.first_of_next_month(date);
drop function if exists private.rules_for(uuid);
drop function if exists private.monthly_pence(integer, text);
drop function if exists private.gym_today();
drop table if exists public.membership_requests;
drop table if exists public.membership_rules;
alter table public.membership_plans drop column if exists members_can_switch_to;
commit;
