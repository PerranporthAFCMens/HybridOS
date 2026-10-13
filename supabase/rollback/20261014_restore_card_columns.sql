-- Puts back the four card display columns and the previous version of stripe_activate_membership (which filled them).
alter table public.member_stripe_customers
  add column card_brand text,
  add column card_last4 text check (card_last4 is null or card_last4 ~ '^[0-9]{4}$'),
  add column card_exp_month integer check (card_exp_month is null or card_exp_month between 1 and 12),
  add column card_exp_year integer check (card_exp_year is null or card_exp_year between 2000 and 2200);

create or replace function public.stripe_activate_membership(
  p_subscription_id text, p_invoice_id text, p_amount_pence integer, p_currency text, p_paid_at timestamptz,
  p_payment_method_id text, p_card_brand text, p_card_last4 text, p_card_exp_month integer, p_card_exp_year integer
) returns jsonb
  language plpgsql security definer set search_path = ''
as $$
declare m public.memberships%rowtype; was_pending boolean;
begin
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
    update public.member_stripe_customers set payment_method_id = p_payment_method_id, card_brand = p_card_brand, card_last4 = p_card_last4,
           card_exp_month = p_card_exp_month, card_exp_year = p_card_exp_year, updated_at = now()
     where gym_id = m.gym_id and user_id = m.user_id;
  end if;
  return jsonb_build_object('ok', true, 'membership_id', m.id, 'status', 'active', 'already_active', not was_pending);
end $$;
