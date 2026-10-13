-- Plan terms: how long a member is committed to a plan, and how much notice they give to leave. Set per plan by the gym
-- (any values; the screen only warns about long terms), copied onto each membership when it starts, and used by the
-- existing cancel rules. A plan with nothing set uses the gym-wide rule (Settings > Membership rules), as before.
--
--   membership_plans.min_term_months / notice_days     optional; blank = use the gym-wide rule
--   memberships.term_months / notice_days              the terms this member agreed to (blank = the gym-wide rule, live)
--   membership_staff_actions                           every staff override, with the reason it was done
--   staff_end_membership(membership, last_day, reason) owner/admin ends a membership today (last_day blank) or on a date,
--                                                      ignoring the term and notice; a reason is required
--   staff_release_from_term(membership, reason)        owner/admin removes the minimum term for one member; a reason is required
--   apply_plan_terms_to_members(plan, reason)          owner/admin passes a plan's terms to its existing members, ONLY where that
--                                                      is the same or better for the member (shorter or equal term and notice)
--   (part 2, 20261015091000_plan_terms_functions.sql) request_membership_cancel and get_my_membership_options use the member's own terms, else the gym-wide rule
--   (part 2) get_public_gym_join_options and stripe_join_context carry the plan's terms so they are shown before paying
-- Changing a plan's terms later changes nothing for existing members unless the gym passes them on (and only if better).
-- Rollback: supabase/rollback/20261015_drop_plan_terms.sql. Check: supabase/verification/20261015_plan_terms_check.sql.

alter table public.membership_plans
  add column min_term_months integer check (min_term_months is null or min_term_months between 0 and 60),
  add column notice_days integer check (notice_days is null or notice_days between 0 and 365);

alter table public.memberships
  add column term_months integer check (term_months is null or term_months between 0 and 60),
  add column notice_days integer check (notice_days is null or notice_days between 0 and 365);

-- A new membership takes the plan's terms with it, so later changes to the plan do not rewrite what this member agreed to.
create function private.copy_plan_terms() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  if new.plan_id is not null and new.term_months is null and new.notice_days is null then
    select p.min_term_months, p.notice_days into new.term_months, new.notice_days from public.membership_plans p where p.id = new.plan_id;
  end if;
  return new;
end $$;
revoke all on function private.copy_plan_terms() from public, anon, authenticated, service_role;
create trigger memberships_copy_plan_terms before insert on public.memberships for each row execute function private.copy_plan_terms();

create table public.membership_staff_actions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  membership_id uuid references public.memberships(id) on delete set null,
  plan_id uuid references public.membership_plans(id) on delete set null,
  action text not null check (action in ('end_membership', 'release_from_term', 'apply_plan_terms')),
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  details jsonb not null default '{}'::jsonb,
  done_by uuid not null,
  done_at timestamptz not null default now()
);
create index membership_staff_actions_gym_idx on public.membership_staff_actions (gym_id, done_at desc);
create index membership_staff_actions_membership_idx on public.membership_staff_actions (membership_id);
alter table public.membership_staff_actions enable row level security;
revoke all on table public.membership_staff_actions from anon, authenticated, service_role;
grant select on table public.membership_staff_actions to authenticated;
create policy "owners and admins read staff membership actions" on public.membership_staff_actions for select to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));

-- Owner or admin ends a membership, ignoring the term and notice. last_day blank = ends today; otherwise the last day of membership.
create function public.staff_end_membership(p_membership_id uuid, p_last_day date, p_reason text) returns uuid
  language plpgsql security definer set search_path = ''
as $$
declare m public.memberships; v_today date := private.gym_today(); v_req uuid; v_reason text := btrim(coalesce(p_reason, ''));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into m from public.memberships where id = p_membership_id for update;
  if not found then raise exception 'Membership not found'; end if;
  if not private.has_gym_role(m.gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]) then raise exception 'Owner or admin access required'; end if;
  if char_length(v_reason) < 3 then raise exception 'Give a reason (a few words is fine)'; end if;
  if m.status not in ('active', 'paused', 'pending') then raise exception 'This membership is not active'; end if;
  if m.user_id is null then raise exception 'This membership has no member account to end'; end if;
  if p_last_day is not null and (p_last_day < v_today or p_last_day > v_today + 730) then raise exception 'Choose a last day from today onwards'; end if;
  update public.membership_requests set status = 'withdrawn', decided_by = auth.uid(), decided_at = now(), decision_note = 'Replaced by the gym ending the membership'
   where membership_id = m.id and kind = 'cancel' and status in ('pending', 'approved');
  if p_last_day is null then
    insert into public.membership_requests (gym_id, membership_id, user_id, kind, status, effective_on, from_plan_id, reason, rules_snapshot, decided_by, decided_at, applied_at)
    values (m.gym_id, m.id, m.user_id, 'cancel', 'applied', v_today, m.plan_id, left(v_reason, 500), jsonb_build_object('by', 'staff', 'overrode_term_months', m.term_months, 'overrode_notice_days', m.notice_days), auth.uid(), now(), now())
    returning id into v_req;
    update public.memberships set status = 'cancelled', ends_on = v_today, updated_at = now() where id = m.id;
  else
    insert into public.membership_requests (gym_id, membership_id, user_id, kind, status, effective_on, from_plan_id, reason, rules_snapshot, decided_by, decided_at)
    values (m.gym_id, m.id, m.user_id, 'cancel', 'approved', p_last_day + 1, m.plan_id, left(v_reason, 500), jsonb_build_object('by', 'staff', 'last_day', p_last_day, 'overrode_term_months', m.term_months, 'overrode_notice_days', m.notice_days), auth.uid(), now())
    returning id into v_req;
  end if;
  insert into public.membership_staff_actions (gym_id, membership_id, plan_id, action, reason, details, done_by)
  values (m.gym_id, m.id, m.plan_id, 'end_membership', left(v_reason, 500), jsonb_build_object('last_day', coalesce(p_last_day, v_today), 'now', p_last_day is null, 'request_id', v_req), auth.uid());
  return v_req;
end $$;

-- Owner or admin lets one member leave without serving the rest of their minimum term.
create function public.staff_release_from_term(p_membership_id uuid, p_reason text) returns void
  language plpgsql security definer set search_path = ''
as $$
declare m public.memberships; v_reason text := btrim(coalesce(p_reason, ''));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into m from public.memberships where id = p_membership_id for update;
  if not found then raise exception 'Membership not found'; end if;
  if not private.has_gym_role(m.gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]) then raise exception 'Owner or admin access required'; end if;
  if char_length(v_reason) < 3 then raise exception 'Give a reason (a few words is fine)'; end if;
  if m.status not in ('active', 'paused', 'pending') then raise exception 'This membership is not active'; end if;
  update public.memberships set term_months = 0, updated_at = now() where id = m.id;
  insert into public.membership_staff_actions (gym_id, membership_id, plan_id, action, reason, details, done_by)
  values (m.gym_id, m.id, m.plan_id, 'release_from_term', left(v_reason, 500), jsonb_build_object('was_term_months', m.term_months), auth.uid());
end $$;

-- Owner or admin passes a plan's terms to the people already on it, but only where it is the same or better for them.
create function public.apply_plan_terms_to_members(p_plan_id uuid, p_reason text) returns integer
  language plpgsql security definer set search_path = ''
as $$
declare p public.membership_plans; r public.membership_rules; v_reason text := btrim(coalesce(p_reason, '')); v_count integer := 0; m public.memberships; v_new_term integer; v_new_notice integer; v_old_term integer; v_old_notice integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into p from public.membership_plans where id = p_plan_id;
  if not found then raise exception 'Membership plan not found'; end if;
  if not private.has_gym_role(p.gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]) then raise exception 'Owner or admin access required'; end if;
  if char_length(v_reason) < 3 then raise exception 'Give a reason (a few words is fine)'; end if;
  r := private.rules_for(p.gym_id);
  for m in select * from public.memberships x where x.plan_id = p.id and x.status in ('active', 'paused') for update loop
    v_old_term := coalesce(m.term_months, r.cancel_min_term_months);
    v_old_notice := coalesce(m.notice_days, r.cancel_notice_days);
    v_new_term := m.term_months;
    v_new_notice := m.notice_days;
    if p.min_term_months is not null and p.min_term_months <= v_old_term then v_new_term := p.min_term_months; end if;
    if p.notice_days is not null and p.notice_days <= v_old_notice then v_new_notice := p.notice_days; end if;
    if v_new_term is distinct from m.term_months or v_new_notice is distinct from m.notice_days then
      update public.memberships set term_months = v_new_term, notice_days = v_new_notice, updated_at = now() where id = m.id;
      v_count := v_count + 1;
    end if;
  end loop;
  insert into public.membership_staff_actions (gym_id, membership_id, plan_id, action, reason, details, done_by)
  values (p.gym_id, null, p.id, 'apply_plan_terms', left(v_reason, 500), jsonb_build_object('members_changed', v_count, 'min_term_months', p.min_term_months, 'notice_days', p.notice_days), auth.uid());
  return v_count;
end $$;

revoke all on function public.staff_end_membership(uuid, date, text), public.staff_release_from_term(uuid, text), public.apply_plan_terms_to_members(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.staff_end_membership(uuid, date, text), public.staff_release_from_term(uuid, text), public.apply_plan_terms_to_members(uuid, text) to authenticated;
