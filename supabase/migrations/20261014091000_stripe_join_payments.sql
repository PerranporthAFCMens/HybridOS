-- Pay at sign-up (step A, database part). Nothing here takes a payment: the Stripe Edge Functions do that. This holds the records.
--
--   plan_stripe_prices         which Stripe price a membership plan uses on the gym's Stripe account (made by the function)
--   member_stripe_customers    the member's Stripe customer id and the card brand, last four digits and expiry (never the number)
--   membership_agreements      what the member agreed to when they paid: the exact wording, who agreed (the member or a parent
--                              or guardian), the amount and the first payment date. Kept as the record of the agreement.
--   private.gym_takes_payments true when the gym has payments switched on AND Stripe says the account can take cards
--   get_gym_payment_mode       'stripe' or 'off', so the sign-up page knows whether to show the payment step
--   stripe_* functions         for the Edge Functions only (the service role). No table access is given to that role:
--                              each does one small job, so it can do nothing else.
--   join_public_gym_with_membership  now refuses a paid plan when the gym takes payments (it makes an active membership with no payment)
-- Rollback: supabase/rollback/20261014_drop_stripe_join_payments.sql

create table public.plan_stripe_prices (
  plan_id uuid primary key references public.membership_plans(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  stripe_product_id text not null,
  stripe_price_id text not null,
  amount_pence integer not null check (amount_pence >= 0),
  billing_interval text not null,
  environment text not null check (environment in ('sandbox', 'live')),
  updated_at timestamptz not null default now()
);
create table public.member_stripe_customers (
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_customer_id text not null,
  environment text not null check (environment in ('sandbox', 'live')),
  payment_method_id text,
  card_brand text,
  card_last4 text check (card_last4 is null or card_last4 ~ '^[0-9]{4}$'),
  card_exp_month integer check (card_exp_month is null or card_exp_month between 1 and 12),
  card_exp_year integer check (card_exp_year is null or card_exp_year between 2000 and 2200),
  updated_at timestamptz not null default now(),
  primary key (gym_id, user_id)
);
create table public.membership_agreements (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  membership_id uuid references public.memberships(id) on delete set null,
  plan_id uuid references public.membership_plans(id) on delete set null,
  kind text not null default 'payment' check (kind in ('payment')),
  wording text not null check (char_length(wording) between 20 and 4000),
  signer_name text not null check (char_length(btrim(signer_name)) between 1 and 200),
  signer_is_guardian boolean not null default false,
  amount_pence integer not null check (amount_pence >= 0),
  first_payment_date date,
  accepted_at timestamptz not null default now()
);
create index membership_agreements_user_idx on public.membership_agreements (gym_id, user_id);
create unique index payment_records_stripe_unique on public.payment_records (provider_payment_id) where provider = 'stripe';

alter table public.plan_stripe_prices enable row level security;
alter table public.member_stripe_customers enable row level security;
alter table public.membership_agreements enable row level security;
revoke all on table public.plan_stripe_prices, public.member_stripe_customers, public.membership_agreements from anon, authenticated, service_role;
grant select on table public.plan_stripe_prices, public.member_stripe_customers, public.membership_agreements to authenticated;

create policy "owners admins read plan prices" on public.plan_stripe_prices for select to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));
create policy "members and admins read stripe customers" on public.member_stripe_customers for select to authenticated
  using (user_id = auth.uid() or private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));
create policy "members and admins read agreements" on public.membership_agreements for select to authenticated
  using (user_id = auth.uid() or private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));

-- Payments are on only when the gym switched them on and Stripe says the account can take card payments.
create function private.gym_takes_payments(p_gym_id uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.gym_payment_settings s
      join public.gym_stripe_accounts a on a.gym_id = s.gym_id
     where s.gym_id = p_gym_id and s.payments_enabled and a.charges_enabled
  );
$$;
revoke all on function private.gym_takes_payments(uuid) from public, anon, authenticated, service_role;

-- What the sign-up page asks after someone has an account: take payment at sign-up, or not.
create function public.get_gym_payment_mode(p_gym_slug text) returns text
  language plpgsql stable security definer set search_path = ''
as $$
declare g uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select id into g from public.gyms where slug = p_gym_slug limit 1;
  if g is null then raise exception 'Gym not found'; end if;
  return case when private.gym_takes_payments(g) then 'stripe' else 'off' end;
end $$;
revoke all on function public.get_gym_payment_mode(text) from public, anon, authenticated, service_role;
grant execute on function public.get_gym_payment_mode(text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- For the Stripe Edge Functions only (the service role). Each returns or changes one small thing.
-- ---------------------------------------------------------------------------------------------------------------

-- Everything the function needs to start a payment for one person joining one plan.
create function public.stripe_join_context(p_gym_id uuid, p_user_id uuid, p_plan_id uuid) returns jsonb
  language plpgsql stable security definer set search_path = ''
as $$
declare g public.gyms%rowtype; a public.gym_stripe_accounts%rowtype; p public.membership_plans%rowtype; pp public.plan_stripe_prices%rowtype;
        c public.member_stripe_customers%rowtype; pr public.profiles%rowtype; m public.memberships%rowtype; gaps text[];
begin
  select * into g from public.gyms where id = p_gym_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'Gym not found'); end if;
  select * into a from public.gym_stripe_accounts where gym_id = p_gym_id;
  select * into p from public.membership_plans where id = p_plan_id and gym_id = p_gym_id and is_active and is_public;
  if not found then return jsonb_build_object('ok', false, 'reason', 'Membership plan is not available'); end if;
  select * into pp from public.plan_stripe_prices where plan_id = p_plan_id;
  select * into c from public.member_stripe_customers where gym_id = p_gym_id and user_id = p_user_id;
  select * into pr from public.profiles where id = p_user_id;
  select * into m from public.memberships where gym_id = p_gym_id and user_id = p_user_id order by created_at desc, id desc limit 1;
  gaps := private.member_gaps(p_user_id, p_gym_id);
  return jsonb_build_object(
    'ok', true,
    'takes_payments', private.gym_takes_payments(p_gym_id),
    'gym', jsonb_build_object('id', g.id, 'name', g.name, 'currency', g.currency, 'country', g.country_code),
    'account', case when a.gym_id is null then null else jsonb_build_object('stripe_account_id', a.stripe_account_id, 'environment', a.environment, 'charges_enabled', a.charges_enabled) end,
    'plan', jsonb_build_object('id', p.id, 'name', p.name, 'price_pence', p.price_pence, 'billing_interval', p.billing_interval),
    'price', case when pp.plan_id is null then null else jsonb_build_object('stripe_product_id', pp.stripe_product_id, 'stripe_price_id', pp.stripe_price_id, 'amount_pence', pp.amount_pence, 'billing_interval', pp.billing_interval, 'environment', pp.environment) end,
    'customer', case when c.user_id is null then null else jsonb_build_object('stripe_customer_id', c.stripe_customer_id, 'environment', c.environment) end,
    'person', jsonb_build_object('first_name', pr.first_name, 'last_name', pr.last_name, 'date_of_birth', pr.date_of_birth),
    'membership', case when m.id is null then null else jsonb_build_object('id', m.id, 'status', m.status, 'provider_subscription_id', m.provider_subscription_id) end,
    'gaps', to_jsonb(gaps)
  );
end $$;
revoke all on function public.stripe_join_context(uuid, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.stripe_join_context(uuid, uuid, uuid) to service_role;

create function public.stripe_save_plan_price(p_plan_id uuid, p_product_id text, p_price_id text, p_amount_pence integer, p_interval text, p_environment text) returns void
  language plpgsql security definer set search_path = ''
as $$
declare g uuid;
begin
  select gym_id into g from public.membership_plans where id = p_plan_id;
  if g is null then raise exception 'Membership plan not found'; end if;
  insert into public.plan_stripe_prices (plan_id, gym_id, stripe_product_id, stripe_price_id, amount_pence, billing_interval, environment)
  values (p_plan_id, g, p_product_id, p_price_id, p_amount_pence, p_interval, p_environment)
  on conflict (plan_id) do update set stripe_product_id = excluded.stripe_product_id, stripe_price_id = excluded.stripe_price_id,
    amount_pence = excluded.amount_pence, billing_interval = excluded.billing_interval, environment = excluded.environment, updated_at = now();
end $$;
revoke all on function public.stripe_save_plan_price(uuid, text, text, integer, text, text) from public, anon, authenticated, service_role;
grant execute on function public.stripe_save_plan_price(uuid, text, text, integer, text, text) to service_role;

create function public.stripe_save_customer(p_gym_id uuid, p_user_id uuid, p_customer_id text, p_environment text) returns void
  language sql security definer set search_path = ''
as $$
  insert into public.member_stripe_customers (gym_id, user_id, stripe_customer_id, environment) values (p_gym_id, p_user_id, p_customer_id, p_environment)
  on conflict (gym_id, user_id) do update set stripe_customer_id = excluded.stripe_customer_id, environment = excluded.environment, updated_at = now();
$$;
revoke all on function public.stripe_save_customer(uuid, uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.stripe_save_customer(uuid, uuid, text, text) to service_role;

-- A person starts paying to join: their membership is created PENDING (no access yet), tied to the Stripe subscription, and what
-- they agreed to is recorded. Calling it again for a retry (a declined card, another card) reuses the same pending membership.
create function public.stripe_begin_membership(
  p_gym_id uuid, p_user_id uuid, p_plan_id uuid, p_subscription_id text, p_customer_id text,
  p_wording text, p_signer_name text, p_signer_is_guardian boolean, p_amount_pence integer, p_first_payment_date date
) returns uuid
  language plpgsql security definer set search_path = ''
as $$
declare v_mid uuid; v_gaps text[]; v_role public.gym_member_role;
begin
  if not exists (select 1 from public.membership_plans where id = p_plan_id and gym_id = p_gym_id and is_active and is_public) then
    raise exception 'Membership plan is not available';
  end if;
  if exists (select 1 from public.memberships ms where ms.gym_id = p_gym_id and ms.user_id = p_user_id and ms.status <> 'pending') then
    raise exception 'You already have a membership at this gym. Contact your gym to change it.';
  end if;
  if exists (select 1 from public.gym_members gx where gx.gym_id = p_gym_id and gx.user_id = p_user_id and gx.access_status <> 'active') then
    raise exception 'This account no longer has access to this gym. Contact your gym.';
  end if;
  v_gaps := private.member_gaps(p_user_id, p_gym_id);
  if coalesce(array_length(v_gaps, 1), 0) > 0 then
    raise exception 'Complete your details before joining: %', array_to_string(v_gaps, ', ');
  end if;

  select role into v_role from public.gym_members where gym_id = p_gym_id and user_id = p_user_id limit 1;
  if v_role is null then
    insert into public.gym_members (gym_id, user_id, role, is_active) values (p_gym_id, p_user_id, 'member', true);
  else
    update public.gym_members set is_active = true, updated_at = now() where gym_id = p_gym_id and user_id = p_user_id;
  end if;

  select id into v_mid from public.memberships where gym_id = p_gym_id and user_id = p_user_id and status = 'pending' order by created_at desc, id desc limit 1;
  if v_mid is null then
    insert into public.memberships (gym_id, user_id, plan_id, status, starts_on, payment_provider, payment_status, provider_customer_id, provider_subscription_id, provider_status, provider_last_synced_at)
    values (p_gym_id, p_user_id, p_plan_id, 'pending', current_date, 'stripe', 'pending', p_customer_id, p_subscription_id, 'incomplete', now())
    returning id into v_mid;
  else
    update public.memberships set plan_id = p_plan_id, payment_provider = 'stripe', payment_status = 'pending', provider_customer_id = p_customer_id,
           provider_subscription_id = p_subscription_id, provider_status = 'incomplete', provider_last_synced_at = now(), updated_at = now()
     where id = v_mid;
  end if;

  insert into public.membership_agreements (gym_id, user_id, membership_id, plan_id, wording, signer_name, signer_is_guardian, amount_pence, first_payment_date)
  values (p_gym_id, p_user_id, v_mid, p_plan_id, p_wording, p_signer_name, coalesce(p_signer_is_guardian, false), p_amount_pence, p_first_payment_date);
  return v_mid;
end $$;
revoke all on function public.stripe_begin_membership(uuid, uuid, uuid, text, text, text, text, boolean, integer, date) from public, anon, authenticated, service_role;
grant execute on function public.stripe_begin_membership(uuid, uuid, uuid, text, text, text, text, boolean, integer, date) to service_role;

-- Stripe has confirmed the first payment (or the trial has started and the card is saved): the membership becomes ACTIVE, the payment
-- is recorded, and the card (brand, last four, expiry) is kept. Safe to call twice: the second call changes nothing.
create function public.stripe_activate_membership(
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
revoke all on function public.stripe_activate_membership(text, text, integer, text, timestamptz, text, text, text, integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.stripe_activate_membership(text, text, integer, text, timestamptz, text, text, text, integer, integer) to service_role;

-- Joining a paid plan without paying is no longer possible while the gym takes payments.
CREATE OR REPLACE FUNCTION public.join_public_gym_with_membership(p_gym_slug text, p_plan_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
declare
  v_uid uuid := auth.uid();
  v_gym_id uuid;
  v_gym_name text;
  v_plan public.membership_plans%rowtype;
  v_membership_id uuid;
  v_existing_role public.gym_member_role;
  v_gaps text[];
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select id, name into v_gym_id, v_gym_name
  from public.gyms
  where slug = p_gym_slug
  limit 1;

  if v_gym_id is null then
    raise exception 'Gym not found';
  end if;

  select * into v_plan
  from public.membership_plans
  where id = p_plan_id
    and gym_id = v_gym_id
    and is_active = true
    and is_public = true;

  if not found then
    raise exception 'Membership plan is not available';
  end if;

  -- When the gym takes payments through Stripe, joining a paid plan must go through the payment step. This function creates an
  -- ACTIVE membership without taking any money, so it refuses, otherwise anyone could skip paying by calling it directly.
  if private.gym_takes_payments(v_gym_id) and v_plan.price_pence > 0 then
    raise exception 'This gym takes payment when you join. Use the payment step on the sign-up page.';
  end if;

  -- Status gate: this (manual/test payment) join is for NEW members only. It must never change an existing membership
  -- (paused/pending -> active, cancelled/expired -> new active row, plan swaps) or reactivate a revoked account.
  if exists (select 1 from public.memberships ms where ms.gym_id = v_gym_id and ms.user_id = v_uid) then
    raise exception 'You already have a membership at this gym. Contact your gym to change it.';
  end if;
  if exists (select 1 from public.gym_members gx where gx.gym_id = v_gym_id and gx.user_id = v_uid and gx.access_status <> 'active') then
    raise exception 'This account no longer has access to this gym. Contact your gym.';
  end if;

  -- Every member must give their details and accept the gym's terms before a membership is created.
  v_gaps := private.member_gaps(v_uid, v_gym_id);
  if coalesce(array_length(v_gaps, 1), 0) > 0 then
    raise exception 'Complete your details before joining: %', array_to_string(v_gaps, ', ');
  end if;

  select role into v_existing_role
  from public.gym_members
  where gym_id = v_gym_id
    and user_id = v_uid
  limit 1;

  if v_existing_role is null then
    insert into public.gym_members(gym_id,user_id,role,is_active)
    values(v_gym_id,v_uid,'member',true);
  else
    update public.gym_members
    set is_active = true, updated_at = now()
    where gym_id = v_gym_id and user_id = v_uid;
  end if;

  select id into v_membership_id
  from public.memberships
  where gym_id = v_gym_id
    and user_id = v_uid
    and status in ('active','pending','paused')
  order by created_at desc
  limit 1;

  if v_membership_id is null then
    insert into public.memberships(
      gym_id,user_id,plan_id,status,starts_on,payment_provider,payment_status
    )
    values(
      v_gym_id,v_uid,v_plan.id,'active',current_date,'manual','confirmed'
    )
    returning id into v_membership_id;
  else
    update public.memberships
    set plan_id = v_plan.id,
        status = 'active',
        starts_on = coalesce(starts_on,current_date),
        ends_on = null,
        payment_provider = 'manual',
        payment_status = 'confirmed',
        provider_customer_id = null,
        provider_mandate_id = null,
        provider_subscription_id = null,
        provider_status = 'test_manual_active',
        provider_last_synced_at = now(),
        updated_at = now()
    where id = v_membership_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'gym_id', v_gym_id,
    'gym_name', v_gym_name,
    'plan_id', v_plan.id,
    'plan_name', v_plan.name,
    'membership_id', v_membership_id,
    'status', 'active',
    'payment_mode', 'manual_test'
  );
end;
$$;
