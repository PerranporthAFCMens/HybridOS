-- Membership rules: what a member may do about their own membership (pause, cancel, change plan), set per gym by an
-- owner or admin, and checked by the database, not by the screen.
--
-- New: public.membership_rules (one row per gym), public.membership_requests (every pause / cancel / change, with who
-- asked, what the rules said at the time, and what the gym decided), public.membership_plans.members_can_switch_to,
-- and these functions:
--   public.get_my_membership_options(gym)       what this member may do right now, in plain facts
--   public.request_membership_pause(...)        member asks to pause between two dates
--   public.request_membership_cancel(...)       member asks to leave (last day follows notice and minimum term)
--   public.request_membership_change(...)       member asks to move to another plan
--   public.withdraw_membership_request(...)     member takes back a request that has not started
--   public.decide_membership_request(...)       owner or admin approves or declines a waiting request
--   public.apply_due_membership_requests()      starts approved requests whose date has come and ends finished pauses
--
-- Nothing here changes an existing table's rows. Every rule starts OFF, so no member can do anything new until an owner
-- switches it on. Rollback: supabase/rollback/20261010_drop_membership_rules.sql. Check: supabase/verification/20261010_membership_rules_check.sql.
-- Billing: payments are collected by GoCardless and are not connected to this app yet. A pause, cancellation or plan
-- change changes the membership (and so access) here; someone at the gym still stops, restarts or changes the direct
-- debit until that link is built. Fees are recorded on the request; collecting them is the gym's.
begin;

-- ---------------------------------------------------------------------------------------------------------------
-- Rules, one row per gym
-- ---------------------------------------------------------------------------------------------------------------
create table public.membership_rules (
  gym_id uuid primary key references public.gyms(id) on delete cascade,
  pause_enabled boolean not null default false,
  pause_min_weeks integer not null default 1 check (pause_min_weeks between 1 and 52),
  pause_max_weeks integer not null default 8 check (pause_max_weeks between 1 and 52),
  pause_notice_days integer not null default 7 check (pause_notice_days between 0 and 90),
  pause_max_per_year integer not null default 2 check (pause_max_per_year between 1 and 12),
  pause_fee_pence integer not null default 0 check (pause_fee_pence >= 0),
  pause_approval text not null default 'admin' check (pause_approval in ('auto', 'admin')),
  cancel_enabled boolean not null default false,
  cancel_notice_days integer not null default 30 check (cancel_notice_days between 0 and 365),
  cancel_min_term_months integer not null default 0 check (cancel_min_term_months between 0 and 36),
  cancel_early_mode text not null default 'wait' check (cancel_early_mode in ('wait', 'fee')),
  cancel_early_fee_pence integer not null default 0 check (cancel_early_fee_pence >= 0),
  cancel_offer_pause boolean not null default true,
  cancel_ask_reason boolean not null default true,
  cancel_approval text not null default 'admin' check (cancel_approval in ('auto', 'admin')),
  upgrade_enabled boolean not null default false,
  downgrade_enabled boolean not null default false,
  upgrade_starts text not null default 'now' check (upgrade_starts in ('now', 'next_month')),
  downgrade_starts text not null default 'next_month' check (downgrade_starts in ('now', 'next_month')),
  change_min_months integer not null default 1 check (change_min_months between 0 and 24),
  change_approval text not null default 'admin' check (change_approval in ('auto', 'admin')),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint membership_rules_pause_weeks_order check (pause_min_weeks <= pause_max_weeks)
);

create trigger membership_rules_set_updated_at before update on public.membership_rules
  for each row execute function public.set_updated_at();

alter table public.membership_rules enable row level security;
revoke all on table public.membership_rules from anon, authenticated;
grant select, insert, update on table public.membership_rules to authenticated;

create policy "owners and admins read membership rules" on public.membership_rules for select to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));
create policy "owners and admins add membership rules" on public.membership_rules for insert to authenticated
  with check (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));
create policy "owners and admins change membership rules" on public.membership_rules for update to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]))
  with check (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));

-- Which plans a member may move to (set on each plan by an owner or admin, through the existing plan policies).
alter table public.membership_plans add column members_can_switch_to boolean not null default false;

-- ---------------------------------------------------------------------------------------------------------------
-- Requests
-- ---------------------------------------------------------------------------------------------------------------
create table public.membership_requests (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  user_id uuid not null,
  kind text not null check (kind in ('pause', 'cancel', 'change_plan')),
  -- pending: waiting for an admin. approved: accepted, waiting for its date. applied: in effect now.
  -- ended: finished (a pause that is over). declined / withdrawn: did not go ahead.
  status text not null default 'pending' check (status in ('pending', 'approved', 'applied', 'ended', 'declined', 'withdrawn')),
  effective_on date not null,
  until_on date,
  from_plan_id uuid,
  to_plan_id uuid,
  reason text check (reason is null or char_length(reason) <= 500),
  fee_pence integer not null default 0 check (fee_pence >= 0),
  rules_snapshot jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 500),
  applied_at timestamptz,
  constraint membership_requests_pause_dates check (kind <> 'pause' or (until_on is not null and until_on > effective_on)),
  constraint membership_requests_change_plan check (kind <> 'change_plan' or to_plan_id is not null)
);
create index membership_requests_membership_idx on public.membership_requests (membership_id, kind, status);
create index membership_requests_gym_idx on public.membership_requests (gym_id, status, effective_on);

alter table public.membership_requests enable row level security;
revoke all on table public.membership_requests from anon, authenticated;
grant select on table public.membership_requests to authenticated;

create policy "members read their own membership requests" on public.membership_requests for select to authenticated
  using (user_id = (select auth.uid()));
create policy "owners and admins read membership requests" on public.membership_requests for select to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));

-- ---------------------------------------------------------------------------------------------------------------
-- Helpers (not callable from the app)
-- ---------------------------------------------------------------------------------------------------------------
create function private.gym_today() returns date language sql stable set search_path to '' as
$$ select (now() at time zone 'Europe/London')::date $$;

-- A plan's price as pence a month, so plans billed differently can be compared.
create function private.monthly_pence(p_price integer, p_interval text) returns numeric language sql immutable set search_path to '' as
$$ select case p_interval
    when 'weekly' then p_price * 52.0 / 12
    when 'monthly' then p_price::numeric
    when 'quarterly' then p_price / 3.0
    when 'annual' then p_price / 12.0
    else null end $$;

-- The rules for a gym; a gym with no row has everything off.
create function private.rules_for(p_gym uuid) returns public.membership_rules language sql stable security definer set search_path to '' as
$$ select coalesce((select r from public.membership_rules r where r.gym_id = p_gym),
                   (select row(p_gym, false, 1, 8, 7, 2, 0, 'admin', false, 30, 0, 'wait', 0, true, true, 'admin', false, false, 'now', 'next_month', 1, 'admin', now(), null)::public.membership_rules)) $$;

create function private.first_of_next_month(p_day date) returns date language sql immutable set search_path to '' as
$$ select (date_trunc('month', p_day) + interval '1 month')::date $$;

-- The member's current membership at a gym: the newest row, as the rest of the app treats it.
create function private.newest_membership(p_gym uuid, p_user uuid) returns public.memberships language sql stable security definer set search_path to '' as
$$ select m from public.memberships m where m.gym_id = p_gym and m.user_id = p_user order by m.created_at desc, m.id desc limit 1 $$;

-- Put one approved request into effect. Callers have already checked that it is due.
create function private.apply_request(p_id uuid) returns void language plpgsql security definer set search_path to '' as
$$
declare r public.membership_requests;
begin
  select * into r from public.membership_requests where id = p_id for update;
  if not found or r.status <> 'approved' then return; end if;
  if r.kind = 'pause' then
    update public.memberships set status = 'paused' where id = r.membership_id and status = 'active';
  elsif r.kind = 'cancel' then
    update public.memberships set status = 'cancelled', ends_on = r.effective_on - 1 where id = r.membership_id and status in ('active', 'paused');
  else
    update public.memberships set plan_id = r.to_plan_id where id = r.membership_id and status in ('active', 'paused');
  end if;
  update public.membership_requests set status = 'applied', applied_at = now() where id = r.id;
end;
$$;

-- Start approved requests whose date has come, and end pauses whose time is up. gym null means every gym.
create function private.sweep(p_gym uuid default null) returns void language plpgsql security definer set search_path to '' as
$$
declare r record; v_today date := private.gym_today();
begin
  for r in select id from public.membership_requests where status = 'approved' and effective_on <= v_today and (p_gym is null or gym_id = p_gym) order by effective_on, requested_at loop
    perform private.apply_request(r.id);
  end loop;
  for r in select id, membership_id from public.membership_requests where kind = 'pause' and status = 'applied' and until_on <= v_today and (p_gym is null or gym_id = p_gym) loop
    update public.memberships set status = 'active' where id = r.membership_id and status = 'paused';
    update public.membership_requests set status = 'ended' where id = r.id;
  end loop;
end;
$$;

revoke all on function private.gym_today(), private.monthly_pence(integer, text), private.rules_for(uuid), private.first_of_next_month(date),
  private.newest_membership(uuid, uuid), private.apply_request(uuid), private.sweep(uuid) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- What this member may do
-- ---------------------------------------------------------------------------------------------------------------
create function public.get_my_membership_options(p_gym_id uuid) returns jsonb language plpgsql security definer set search_path to '' as
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
  v_term_end := (coalesce(m.starts_on, m.created_at::date) + make_interval(months => r.cancel_min_term_months))::date;
  v_notice_end := v_today + r.cancel_notice_days;
  v_cancel := jsonb_build_object('enabled', r.cancel_enabled, 'notice_days', r.cancel_notice_days, 'min_term_months', r.cancel_min_term_months, 'early_mode', r.cancel_early_mode,
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

-- ---------------------------------------------------------------------------------------------------------------
-- Asking
-- ---------------------------------------------------------------------------------------------------------------
create function private.new_request(p_membership public.memberships, p_kind text, p_approval text, p_effective date, p_until date, p_to_plan uuid, p_reason text, p_fee integer, p_snapshot jsonb)
returns uuid language plpgsql security definer set search_path to '' as
$$
declare v_id uuid;
begin
  insert into public.membership_requests (gym_id, membership_id, user_id, kind, status, effective_on, until_on, from_plan_id, to_plan_id, reason, fee_pence, rules_snapshot, decided_at)
  values (p_membership.gym_id, p_membership.id, p_membership.user_id, p_kind, case when p_approval = 'auto' then 'approved' else 'pending' end, p_effective, p_until, p_membership.plan_id, p_to_plan,
          nullif(left(trim(coalesce(p_reason, '')), 500), ''), p_fee, p_snapshot, case when p_approval = 'auto' then now() end)
  returning id into v_id;
  if p_approval = 'auto' then perform private.sweep(p_membership.gym_id); end if;
  return v_id;
end;
$$;
revoke all on function private.new_request(public.memberships, text, text, date, date, uuid, text, integer, jsonb) from public, anon, authenticated, service_role;

create function public.request_membership_pause(p_membership_id uuid, p_starts_on date, p_ends_on date, p_reason text default null) returns uuid language plpgsql security definer set search_path to '' as
$$
declare m public.memberships; r public.membership_rules; v_today date := private.gym_today(); v_days integer; v_used integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into m from public.memberships where id = p_membership_id for update;
  if not found or m.user_id is distinct from auth.uid() then raise exception 'Membership not found'; end if;
  if m.id is distinct from (private.newest_membership(m.gym_id, m.user_id)).id then raise exception 'Only your current membership can be paused'; end if;
  r := private.rules_for(m.gym_id);
  if not r.pause_enabled then raise exception 'Pausing is not available at this gym'; end if;
  if m.status <> 'active' then raise exception 'Only an active membership can be paused'; end if;
  if exists (select 1 from public.membership_requests q where q.membership_id = m.id and q.kind in ('pause', 'cancel') and q.status in ('pending', 'approved', 'applied')) then
    raise exception 'You already have a pause or cancellation in progress'; end if;
  if p_starts_on is null or p_ends_on is null then raise exception 'Choose when the pause starts and ends'; end if;
  if p_starts_on < v_today + r.pause_notice_days then
    raise exception 'A pause needs % days notice, so it can start from %', r.pause_notice_days, to_char(v_today + r.pause_notice_days, 'FMDD FMMon YYYY'); end if;
  v_days := p_ends_on - p_starts_on;
  if v_days < r.pause_min_weeks * 7 or v_days > r.pause_max_weeks * 7 then
    raise exception 'A pause must be between % and % weeks', r.pause_min_weeks, r.pause_max_weeks; end if;
  select count(*) into v_used from public.membership_requests q where q.membership_id = m.id and q.kind = 'pause' and q.status in ('pending', 'approved', 'applied', 'ended') and q.requested_at > now() - interval '12 months';
  if v_used >= r.pause_max_per_year then raise exception 'You have used the % pauses allowed in a year', r.pause_max_per_year; end if;
  return private.new_request(m, 'pause', r.pause_approval, p_starts_on, p_ends_on, null, p_reason, r.pause_fee_pence,
    jsonb_build_object('notice_days', r.pause_notice_days, 'min_weeks', r.pause_min_weeks, 'max_weeks', r.pause_max_weeks, 'max_per_year', r.pause_max_per_year, 'fee_pence', r.pause_fee_pence, 'approval', r.pause_approval));
end;
$$;

create function public.request_membership_cancel(p_membership_id uuid, p_reason text default null) returns uuid language plpgsql security definer set search_path to '' as
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
  v_notice_end := v_today + r.cancel_notice_days;
  v_term_end := (coalesce(m.starts_on, m.created_at::date) + make_interval(months => r.cancel_min_term_months))::date;
  v_last := v_notice_end;
  if v_term_end > v_notice_end then
    if r.cancel_early_mode = 'wait' then v_last := v_term_end; else v_fee := r.cancel_early_fee_pence; end if;
  end if;
  return private.new_request(m, 'cancel', r.cancel_approval, v_last + 1, null, null, p_reason, v_fee,
    jsonb_build_object('notice_days', r.cancel_notice_days, 'min_term_months', r.cancel_min_term_months, 'early_mode', r.cancel_early_mode, 'early_fee_pence', r.cancel_early_fee_pence, 'last_day', v_last, 'approval', r.cancel_approval));
end;
$$;

create function public.request_membership_change(p_membership_id uuid, p_to_plan_id uuid) returns uuid language plpgsql security definer set search_path to '' as
$$
declare m public.memberships; r public.membership_rules; cur public.membership_plans; tgt public.membership_plans; v_today date := private.gym_today();
        v_up boolean; v_since date; v_start date; v_cm numeric; v_tm numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into m from public.memberships where id = p_membership_id for update;
  if not found or m.user_id is distinct from auth.uid() then raise exception 'Membership not found'; end if;
  if m.id is distinct from (private.newest_membership(m.gym_id, m.user_id)).id then raise exception 'Only your current membership can change plan'; end if;
  r := private.rules_for(m.gym_id);
  if m.status <> 'active' then raise exception 'Only an active membership can change plan'; end if;
  select * into cur from public.membership_plans where id = m.plan_id;
  select * into tgt from public.membership_plans where id = p_to_plan_id and gym_id = m.gym_id and is_active and members_can_switch_to;
  if tgt.id is null or tgt.id = m.plan_id then raise exception 'That plan is not available to switch to'; end if;
  v_cm := private.monthly_pence(cur.price_pence, cur.billing_interval); v_tm := private.monthly_pence(tgt.price_pence, tgt.billing_interval);
  if v_cm is null or v_tm is null or v_cm = v_tm then raise exception 'That plan cannot be compared with yours. Please ask the gym'; end if;
  v_up := v_tm > v_cm;
  if v_up and not r.upgrade_enabled then raise exception 'Upgrading is not available at this gym'; end if;
  if not v_up and not r.downgrade_enabled then raise exception 'Moving to a cheaper plan is not available at this gym'; end if;
  if exists (select 1 from public.membership_requests q where q.membership_id = m.id and q.kind = 'change_plan' and q.status in ('pending', 'approved')) then raise exception 'You already have a plan change waiting'; end if;
  select max(q.applied_at)::date into v_since from public.membership_requests q where q.membership_id = m.id and q.kind = 'change_plan' and q.status = 'applied';
  v_since := greatest(coalesce(v_since, m.created_at::date), coalesce(m.starts_on, m.created_at::date));
  if (v_since + make_interval(months => r.change_min_months))::date > v_today then
    raise exception 'You can change plan again from %', to_char((v_since + make_interval(months => r.change_min_months))::date, 'FMDD FMMon YYYY'); end if;
  v_start := case when (case when v_up then r.upgrade_starts else r.downgrade_starts end) = 'now' then v_today else private.first_of_next_month(v_today) end;
  return private.new_request(m, 'change_plan', r.change_approval, v_start, null, tgt.id, null, 0,
    jsonb_build_object('direction', case when v_up then 'up' else 'down' end, 'from_monthly_pence', round(v_cm), 'to_monthly_pence', round(v_tm), 'starts', case when v_up then r.upgrade_starts else r.downgrade_starts end, 'approval', r.change_approval));
end;
$$;

create function public.withdraw_membership_request(p_request_id uuid) returns void language plpgsql security definer set search_path to '' as
$$
declare q public.membership_requests;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into q from public.membership_requests where id = p_request_id for update;
  if not found or q.user_id is distinct from auth.uid() then raise exception 'Request not found'; end if;
  if q.status not in ('pending', 'approved') then raise exception 'This request has already started or finished. Please ask the gym'; end if;
  update public.membership_requests set status = 'withdrawn', decided_at = now(), decided_by = auth.uid() where id = q.id;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Deciding
-- ---------------------------------------------------------------------------------------------------------------
create function public.decide_membership_request(p_request_id uuid, p_approve boolean, p_note text default null) returns void language plpgsql security definer set search_path to '' as
$$
declare q public.membership_requests;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into q from public.membership_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if not private.has_gym_role(q.gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]) then raise exception 'Owner or admin access required'; end if;
  if q.status <> 'pending' then raise exception 'This request is no longer waiting'; end if;
  update public.membership_requests set status = case when p_approve then 'approved' else 'declined' end, decided_by = auth.uid(), decided_at = now(),
         decision_note = nullif(left(trim(coalesce(p_note, '')), 500), '') where id = q.id;
  if p_approve then perform private.sweep(q.gym_id); end if;
end;
$$;

create function public.apply_due_membership_requests() returns void language sql security definer set search_path to '' as
$$ select private.sweep(null) $$;

-- Who may call what. The sweep is for the scheduler (service role) only.
revoke all on function public.get_my_membership_options(uuid), public.request_membership_pause(uuid, date, date, text), public.request_membership_cancel(uuid, text),
  public.request_membership_change(uuid, uuid), public.withdraw_membership_request(uuid), public.decide_membership_request(uuid, boolean, text), public.apply_due_membership_requests()
  from public, anon, authenticated, service_role;
grant execute on function public.get_my_membership_options(uuid), public.request_membership_pause(uuid, date, date, text), public.request_membership_cancel(uuid, text),
  public.request_membership_change(uuid, uuid), public.withdraw_membership_request(uuid), public.decide_membership_request(uuid, boolean, text) to authenticated;
grant execute on function public.apply_due_membership_requests() to service_role;

commit;
