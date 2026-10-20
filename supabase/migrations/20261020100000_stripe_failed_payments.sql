-- Failed Stripe payments and subscriptions ended in Stripe. Until now the app only reacted to "paid".
--
--   stripe_record_failed_payment   a monthly payment failed: records it as a FAILED payment (so it shows on the owner's Money owed
--                                  list and Today alert) and marks the membership's payment as failed. Safe to call twice.
--   stripe_clear_failed_payment    the same invoice was paid later (a retry worked): the failed record becomes confirmed.
--   stripe_subscription_event      Stripe says the subscription is past due / unpaid / cancelled. A cancelled subscription ends
--                                  the membership today; nothing happens if the membership has already ended.
--   get_my_payment_notice          what a member sees about their own billing problem (their own rows only).
-- The three stripe_* functions are for the Edge Function only (service role). stripe_activate_membership is not changed.
-- Rollback: supabase/rollback/20261020_drop_stripe_failed_payments.sql. Check: supabase/verification/20261020_stripe_failed_payments_check.sql.

create function public.stripe_record_failed_payment(
  p_subscription_id text, p_invoice_id text, p_amount_pence integer, p_currency text, p_code text, p_message text
) returns jsonb
  language plpgsql security definer set search_path = ''
as $$
declare m public.memberships%rowtype; existing public.payment_records%rowtype; is_new boolean := false;
begin
  select * into m from public.memberships where provider_subscription_id = p_subscription_id and payment_provider = 'stripe' for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'No membership for that subscription'); end if;
  if p_invoice_id is null or p_invoice_id = '' then return jsonb_build_object('ok', false, 'reason', 'No invoice'); end if;

  select * into existing from public.payment_records where provider = 'stripe' and provider_payment_id = p_invoice_id;
  if not found then
    insert into public.payment_records (gym_id, membership_id, user_id, provider, provider_payment_id, provider_customer_id, provider_subscription_id, amount_pence, currency, state, charge_date, failure_code, failure_message)
    values (m.gym_id, m.id, m.user_id, 'stripe', p_invoice_id, m.provider_customer_id, p_subscription_id, greatest(coalesce(p_amount_pence, 0), 0), upper(coalesce(nullif(p_currency, ''), 'GBP')), 'failed', current_date,
            left(p_code, 100), left(p_message, 300));
    is_new := true;
  elsif existing.state not in ('confirmed', 'paid_out', 'refunded') then
    update public.payment_records set state = 'failed', failure_code = left(p_code, 100), failure_message = left(p_message, 300), updated_at = now() where id = existing.id;
  end if;

  if m.status in ('active', 'paused') then
    update public.memberships set payment_status = 'failed', provider_status = 'past_due', provider_last_synced_at = now(), updated_at = now() where id = m.id;
  end if;
  return jsonb_build_object('ok', true, 'membership_id', m.id, 'gym_id', m.gym_id, 'user_id', m.user_id, 'first_failure', is_new);
end $$;
revoke all on function public.stripe_record_failed_payment(text, text, integer, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.stripe_record_failed_payment(text, text, integer, text, text, text) to service_role;

create function public.stripe_clear_failed_payment(p_subscription_id text, p_invoice_id text) returns jsonb
  language plpgsql security definer set search_path = ''
as $$
declare m public.memberships%rowtype;
begin
  select * into m from public.memberships where provider_subscription_id = p_subscription_id and payment_provider = 'stripe' for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'No membership for that subscription'); end if;
  update public.payment_records set state = 'confirmed', failure_code = null, failure_message = null, updated_at = now()
   where provider = 'stripe' and provider_payment_id = p_invoice_id and state = 'failed';
  if not exists (select 1 from public.payment_records where membership_id = m.id and provider = 'stripe' and state = 'failed')
     and m.status in ('active', 'paused') then
    update public.memberships set payment_status = 'confirmed', provider_status = 'active', provider_last_synced_at = now(), updated_at = now() where id = m.id;
  end if;
  return jsonb_build_object('ok', true, 'membership_id', m.id);
end $$;
revoke all on function public.stripe_clear_failed_payment(text, text) from public, anon, authenticated, service_role;
grant execute on function public.stripe_clear_failed_payment(text, text) to service_role;

-- p_stripe_status is Stripe's own word: active, past_due, unpaid, canceled, incomplete_expired, ... p_deleted is true for customer.subscription.deleted.
create function public.stripe_subscription_event(p_subscription_id text, p_stripe_status text, p_deleted boolean) returns jsonb
  language plpgsql security definer set search_path = ''
as $$
declare m public.memberships%rowtype; ended boolean := coalesce(p_deleted, false) or p_stripe_status in ('canceled', 'incomplete_expired');
begin
  select * into m from public.memberships where provider_subscription_id = p_subscription_id and payment_provider = 'stripe' for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'No membership for that subscription'); end if;
  if m.status in ('cancelled', 'expired') then
    return jsonb_build_object('ok', true, 'membership_id', m.id, 'gym_id', m.gym_id, 'user_id', m.user_id, 'changed', false);
  end if;
  if ended then
    -- A subscription that never took its first payment (pending) is simply dropped; anyone else loses the membership from today.
    update public.memberships set status = 'cancelled', ends_on = least(coalesce(ends_on, current_date), current_date), provider_status = 'canceled',
           payment_status = case when m.status = 'pending' then payment_status else 'failed' end, provider_last_synced_at = now(), updated_at = now() where id = m.id;
    return jsonb_build_object('ok', true, 'membership_id', m.id, 'gym_id', m.gym_id, 'user_id', m.user_id, 'changed', m.status <> 'pending', 'was_pending', m.status = 'pending');
  end if;
  if p_stripe_status in ('past_due', 'unpaid') and m.status in ('active', 'paused') then
    update public.memberships set payment_status = 'failed', provider_status = p_stripe_status, provider_last_synced_at = now(), updated_at = now() where id = m.id;
    return jsonb_build_object('ok', true, 'membership_id', m.id, 'gym_id', m.gym_id, 'user_id', m.user_id, 'changed', true);
  end if;
  return jsonb_build_object('ok', true, 'membership_id', m.id, 'gym_id', m.gym_id, 'user_id', m.user_id, 'changed', false);
end $$;
revoke all on function public.stripe_subscription_event(text, text, boolean) from public, anon, authenticated, service_role;
grant execute on function public.stripe_subscription_event(text, text, boolean) to service_role;

-- A member's own billing problem, in plain facts. Own rows only: auth.uid() decides, there is no way to ask about someone else.
create function public.get_my_payment_notice(p_gym_id uuid) returns jsonb
  language plpgsql stable security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); n integer; owed bigint; latest date; m public.memberships%rowtype;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  -- Any status of membership may read its own notice (a member whose membership just ended still needs to see why).
  if not private.member_status_allows(p_gym_id, array['pending', 'active', 'paused', 'cancelled', 'expired']) then raise exception 'Not a member of this gym'; end if;
  select count(*), coalesce(sum(amount_pence), 0), max(charge_date) into n, owed, latest
    from private.missed_payments(p_gym_id) where user_id = uid and state = 'failed';
  select * into m from public.memberships where gym_id = p_gym_id and user_id = uid order by created_at desc, id desc limit 1;
  return jsonb_build_object(
    'failed_count', n, 'owed_pence', owed, 'latest_failed', latest,
    'ended_for_non_payment', coalesce(m.status = 'cancelled' and m.provider_status = 'canceled' and m.payment_status = 'failed', false));
end $$;
revoke all on function public.get_my_payment_notice(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_my_payment_notice(uuid) to authenticated;
