-- Plan terms, part 2: four existing functions changed to use the member's own terms (else the gym-wide rule) and to carry the plan's terms.
-- Only "create or replace", so it is safe to run again. Part 1 (20261015090000_plan_terms.sql) must be run first: it adds the columns used here.
--   request_membership_cancel / get_my_membership_options   last day follows the member's own notice and term, else the gym-wide rule
--   get_public_gym_join_options                              each plan also carries its minimum term and notice, shown before joining
--   stripe_join_context                                      the same, so the payment agreement can state them
-- Rollback: supabase/rollback/20261015_drop_plan_terms.sql (restores the previous versions of all four).

create or replace function public.request_membership_cancel(p_membership_id uuid, p_reason text default null) returns uuid language plpgsql security definer set search_path to '' as
$$
declare m public.memberships; r public.membership_rules; v_today date := private.gym_today(); v_notice_end date; v_term_end date; v_last date; v_fee integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into m from public.memberships where id = p_membership_id for update;
  if not found or m.user_id is distinct from auth.uid() then raise exception 'Membership not found'; end if;
  if m.id is distinct from (private.newest_membership(m.gym_id, m.user_id)).id then raise exception 'Only your current membership can be cancelled'; end if;
  r := private.rules_for(m.gym_id);
  if not r.cancel_enabled then raise exception 'Please ask the gym to cancel your membership'; end if;
  if m.status not in ('active', 'paused') then raise exception 'This membership is not active'; end if;
  if exists (select 1 from public.membership_requests q where q.membership_id = m.id and q.kind = 'cancel' and q.status in ('pending', 'approved')) then raise exception 'You have already asked to cancel'; end if;
  if r.cancel_ask_reason and nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'Please tell us why you are leaving'; end if;
  v_notice_end := v_today + coalesce(m.notice_days, r.cancel_notice_days);
  v_term_end := (coalesce(m.starts_on, m.created_at::date) + make_interval(months => coalesce(m.term_months, r.cancel_min_term_months)))::date;
  v_last := v_notice_end;
  if v_term_end > v_notice_end then
    if r.cancel_early_mode = 'wait' then v_last := v_term_end; else v_fee := r.cancel_early_fee_pence; end if;
  end if;
  return private.new_request(m, 'cancel', r.cancel_approval, v_last + 1, null, null, p_reason, v_fee,
    jsonb_build_object('notice_days', coalesce(m.notice_days, r.cancel_notice_days), 'min_term_months', coalesce(m.term_months, r.cancel_min_term_months), 'early_mode', r.cancel_early_mode, 'early_fee_pence', r.cancel_early_fee_pence, 'last_day', v_last, 'approval', r.cancel_approval));
end;
$$;

create or replace function public.get_my_membership_options(p_gym_id uuid) returns jsonb language plpgsql security definer set search_path to '' as
$$
declare
  v_uid uuid := auth.uid();
  v_today date := private.gym_today();
  m public.memberships;
  p public.membership_plans;
  r public.membership_rules;
  v_used integer;
  v_open jsonb;
  v_pause jsonb;
  v_cancel jsonb;
  v_change jsonb;
  v_term_end date;
  v_notice_end date;
  v_cur_monthly numeric;
  v_since date;
  v_plans jsonb;
  v_blocked_change text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  perform private.sweep(p_gym_id);
  m := private.newest_membership(p_gym_id, v_uid);
  if m.id is null then return jsonb_build_object('membership', null); end if;
  select * into p from public.membership_plans where id = m.plan_id;
  r := private.rules_for(p_gym_id);

  select count(*) into v_used from public.membership_requests q
    where q.membership_id = m.id and q.kind = 'pause' and q.status in ('pending', 'approved', 'applied', 'ended') and q.requested_at > now() - interval '12 months';
  select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'kind', q.kind, 'status', q.status, 'effective_on', q.effective_on, 'until_on', q.until_on,
         'to_plan_id', q.to_plan_id, 'fee_pence', q.fee_pence, 'requested_at', q.requested_at, 'decision_note', q.decision_note) order by q.requested_at desc), '[]'::jsonb)
    into v_open from public.membership_requests q
    where q.membership_id = m.id and (q.status in ('pending', 'approved', 'applied') or q.decided_at > now() - interval '30 days');

  -- Pause
  v_pause := jsonb_build_object('enabled', r.pause_enabled, 'min_weeks', r.pause_min_weeks, 'max_weeks', r.pause_max_weeks, 'notice_days', r.pause_notice_days,
    'max_per_year', r.pause_max_per_year, 'used_this_year', v_used, 'fee_pence', r.pause_fee_pence, 'approval', r.pause_approval,
    'earliest_start', v_today + r.pause_notice_days);
  if not r.pause_enabled then v_pause := v_pause || jsonb_build_object('allowed', false, 'reason', 'Pausing is not available at this gym.');
  elsif m.status <> 'active' then v_pause := v_pause || jsonb_build_object('allowed', false, 'reason', 'Only an active membership can be paused.');
  elsif exists (select 1 from public.membership_requests q where q.membership_id = m.id and q.kind in ('pause', 'cancel') and q.status in ('pending', 'approved', 'applied')) then
    v_pause := v_pause || jsonb_build_object('allowed', false, 'reason', 'You already have a pause or cancellation in progress.');
  elsif v_used >= r.pause_max_per_year then v_pause := v_pause || jsonb_build_object('allowed', false, 'reason', format('You have used the %s pauses allowed in a year.', r.pause_max_per_year));
  else v_pause := v_pause || jsonb_build_object('allowed', true);
  end if;

  -- Cancel
  v_term_end := (coalesce(m.starts_on, m.created_at::date) + make_interval(months => coalesce(m.term_months, r.cancel_min_term_months)))::date;
  v_notice_end := v_today + coalesce(m.notice_days, r.cancel_notice_days);
  v_cancel := jsonb_build_object('enabled', r.cancel_enabled, 'notice_days', coalesce(m.notice_days, r.cancel_notice_days), 'min_term_months', coalesce(m.term_months, r.cancel_min_term_months), 'early_mode', r.cancel_early_mode,
    'offer_pause', r.cancel_offer_pause and r.pause_enabled, 'ask_reason', r.cancel_ask_reason, 'approval', r.cancel_approval, 'term_ends_on', v_term_end,
    'in_term', v_term_end > v_notice_end,
    'last_day', case when v_term_end > v_notice_end and r.cancel_early_mode = 'wait' then v_term_end else v_notice_end end,
    'fee_pence', case when v_term_end > v_notice_end and r.cancel_early_mode = 'fee' then r.cancel_early_fee_pence else 0 end);
  if not r.cancel_enabled then v_cancel := v_cancel || jsonb_build_object('allowed', false, 'reason', 'Please ask the gym to cancel your membership.');
  elsif m.status not in ('active', 'paused') then v_cancel := v_cancel || jsonb_build_object('allowed', false, 'reason', 'This membership is not active.');
  elsif exists (select 1 from public.membership_requests q where q.membership_id = m.id and q.kind = 'cancel' and q.status in ('pending', 'approved')) then
    v_cancel := v_cancel || jsonb_build_object('allowed', false, 'reason', 'You have already asked to cancel.');
  else v_cancel := v_cancel || jsonb_build_object('allowed', true);
  end if;

  -- Change plan
  v_cur_monthly := private.monthly_pence(p.price_pence, p.billing_interval);
  select coalesce(max(q.applied_at)::date, m.starts_on, m.created_at::date) into v_since from public.membership_requests q where q.membership_id = m.id and q.kind = 'change_plan' and q.status = 'applied';
  v_since := greatest(coalesce(v_since, m.created_at::date), coalesce(m.starts_on, m.created_at::date));
  v_blocked_change := case
    when m.status <> 'active' then 'Only an active membership can change plan.'
    when exists (select 1 from public.membership_requests q where q.membership_id = m.id and q.kind = 'change_plan' and q.status in ('pending', 'approved')) then 'You already have a plan change waiting.'
    when (v_since + make_interval(months => r.change_min_months))::date > v_today then format('You can change plan again from %s.', to_char((v_since + make_interval(months => r.change_min_months))::date, 'FMDD FMMon YYYY'))
    else null end;
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'price_pence', x.price_pence, 'interval', x.billing_interval,
      'direction', case when x.mp > v_cur_monthly then 'up' else 'down' end,
      'starts_on', case when (case when x.mp > v_cur_monthly then r.upgrade_starts else r.downgrade_starts end) = 'now' then v_today else private.first_of_next_month(v_today) end) order by x.mp), '[]'::jsonb)
    into v_plans
    from (select pl.*, private.monthly_pence(pl.price_pence, pl.billing_interval) as mp from public.membership_plans pl
          where pl.gym_id = p_gym_id and pl.is_active and pl.members_can_switch_to and pl.id <> m.plan_id) x
    where x.mp is not null and v_cur_monthly is not null and x.mp <> v_cur_monthly
      and ((x.mp > v_cur_monthly and r.upgrade_enabled) or (x.mp < v_cur_monthly and r.downgrade_enabled));
  v_change := jsonb_build_object('upgrade_enabled', r.upgrade_enabled, 'downgrade_enabled', r.downgrade_enabled, 'approval', r.change_approval, 'min_months', r.change_min_months, 'plans', v_plans,
    'allowed', v_blocked_change is null and jsonb_array_length(v_plans) > 0);
  if v_blocked_change is not null then v_change := v_change || jsonb_build_object('reason', v_blocked_change);
  elsif not (r.upgrade_enabled or r.downgrade_enabled) then v_change := v_change || jsonb_build_object('reason', 'Please ask the gym to change your plan.');
  elsif jsonb_array_length(v_plans) = 0 then v_change := v_change || jsonb_build_object('reason', 'There are no other plans you can move to.');
  end if;

  return jsonb_build_object('today', v_today,
    'membership', jsonb_build_object('id', m.id, 'status', m.status, 'plan_id', m.plan_id, 'plan_name', p.name, 'price_pence', p.price_pence, 'interval', p.billing_interval, 'starts_on', m.starts_on, 'ends_on', m.ends_on),
    'pause', v_pause, 'cancel', v_cancel, 'change', v_change, 'requests', v_open);
end;
$$;

CREATE OR REPLACE FUNCTION public.get_public_gym_join_options(p_gym_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
declare
  v_gym public.gyms%rowtype;
  v_plans jsonb;
begin
  select * into v_gym
  from public.gyms
  where slug = p_gym_slug
  limit 1;

  if not found then
    raise exception 'Gym not found';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', mp.id,
      'name', mp.name,
      'description', mp.description,
      'price_pence', mp.price_pence,
      'billing_interval', mp.billing_interval,
      'joining_fee_pence', mp.joining_fee_pence,
      'access_type', mp.access_type,
      'includes_open_gym', mp.includes_open_gym,
      'includes_classes', mp.includes_classes,
      'includes_pt', mp.includes_pt,
      'classes_per_week', mp.classes_per_week,
      'trial_days', mp.trial_days,
      'min_term_months', coalesce(mp.min_term_months, (select r.cancel_min_term_months from public.membership_rules r where r.gym_id = v_gym.id)),
      'notice_days', coalesce(mp.notice_days, (select r.cancel_notice_days from public.membership_rules r where r.gym_id = v_gym.id))
    )
    order by mp.price_pence, mp.name
  ), '[]'::jsonb)
  into v_plans
  from public.membership_plans mp
  where mp.gym_id = v_gym.id
    and mp.is_active = true
    and mp.is_public = true;

  return jsonb_build_object(
    'gym_id', v_gym.id,
    'gym_name', v_gym.name,
    'gym_slug', v_gym.slug,
    'logo_url', v_gym.logo_url,
    'plans', v_plans
  );
end;
$$;

create or replace function public.stripe_join_context(p_gym_id uuid, p_user_id uuid, p_plan_id uuid) returns jsonb
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
    'plan', jsonb_build_object('id', p.id, 'name', p.name, 'price_pence', p.price_pence, 'billing_interval', p.billing_interval,
      'min_term_months', coalesce(p.min_term_months, (select r.cancel_min_term_months from public.membership_rules r where r.gym_id = p_gym_id)),
      'notice_days', coalesce(p.notice_days, (select r.cancel_notice_days from public.membership_rules r where r.gym_id = p_gym_id))),
    'price', case when pp.plan_id is null then null else jsonb_build_object('stripe_product_id', pp.stripe_product_id, 'stripe_price_id', pp.stripe_price_id, 'amount_pence', pp.amount_pence, 'billing_interval', pp.billing_interval, 'environment', pp.environment) end,
    'customer', case when c.user_id is null then null else jsonb_build_object('stripe_customer_id', c.stripe_customer_id, 'environment', c.environment) end,
    'person', jsonb_build_object('first_name', pr.first_name, 'last_name', pr.last_name, 'date_of_birth', pr.date_of_birth),
    'membership', case when m.id is null then null else jsonb_build_object('id', m.id, 'status', m.status, 'provider_subscription_id', m.provider_subscription_id) end,
    'gaps', to_jsonb(gaps)
  );
end $$;
