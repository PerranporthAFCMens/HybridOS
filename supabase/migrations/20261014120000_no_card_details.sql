-- No card details in our database. Stripe holds the card; we keep only Stripe's own tokens (the customer id and the payment-method id).
--
--   member_stripe_customers   drops card_brand, card_last4, card_exp_month, card_exp_year.
--                             When a screen needs "Visa ending 4242" it asks Stripe at that moment; nothing about the card is copied here.
--   stripe_activate_membership  keeps its signature (so the already-deployed Stripe functions keep working) but no longer reads or
--                             saves any card detail: it ignores the four card arguments and keeps only the payment-method token.
-- Rollback: supabase/rollback/20261014_restore_card_columns.sql. Check: supabase/verification/20261014_no_card_details_check.sql.

alter table public.member_stripe_customers
  drop column card_brand,
  drop column card_last4,
  drop column card_exp_month,
  drop column card_exp_year;

create or replace function public.stripe_activate_membership(
  p_subscription_id text, p_invoice_id text, p_amount_pence integer, p_currency text, p_paid_at timestamptz,
  p_payment_method_id text, p_card_brand text, p_card_last4 text, p_card_exp_month integer, p_card_exp_year integer
) returns jsonb
  language plpgsql security definer set search_path = ''
as $$
declare m public.memberships%rowtype; was_pending boolean;
begin
  -- p_card_brand, p_card_last4, p_card_exp_month and p_card_exp_year are ignored on purpose: no card detail is kept.
  select * into m from public.memberships where provider_subscription_id = p_subscription_id and payment_provider = 'stripe' for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'No membership for that subscription'); end if;
  was_pending := m.status = 'pending';
  if was_pending then
    update public.memberships set status = 'active', starts_on = current_date, ends_on = null, payment_status = 'confirmed', provider_status = 'active',
           provider_last_synced_at = now(), updated_at = now() where id = m.id;
  end if;
  if p_invoice_id is not null and coalesce(p_amount_pence, 0) > 0 then
    insert into public.payment_records (gym_id, membership_id, user_id, provider, provider_payment_id, provider_customer_id, provider_subscription_id, amount_pence, currency, state, charge_date, paid_out_at)
    values (m.gym_id, m.id, m.user_id, 'stripe', p_invoice_id, m.provider_customer_id, p_subscription_id, p_amount_pence, upper(coalesce(p_currency, 'GBP')), 'confirmed', coalesce(p_paid_at, now())::date, null)
    on conflict (provider_payment_id) where provider = 'stripe' do nothing;
  end if;
  if p_payment_method_id is not null then
    update public.member_stripe_customers set payment_method_id = p_payment_method_id, updated_at = now()
     where gym_id = m.gym_id and user_id = m.user_id;
  end if;
  return jsonb_build_object('ok', true, 'membership_id', m.id, 'status', 'active', 'already_active', not was_pending);
end $$;
