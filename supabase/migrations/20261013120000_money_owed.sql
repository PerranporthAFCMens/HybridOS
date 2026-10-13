-- Money owed: who is "not financial", how much, and which payments they missed. Nothing is charged or sent by this change.
--
-- A payment counts as MISSED (outstanding) when it has not been settled and either
--   * its state is failed or charged_back, or
--   * it is still pending / submitted but its charge date is more than the gym's grace period ago
--     (gym_payment_settings.overdue_grace_days, 7 by default).
-- Anyone with one or more missed payments is "not financial". It is worked out from the payment records every time, so it cannot
-- drift out of date: pay it, waive it or write it off and the person is financial again. Reopening reverses that.
--
--   payment_settlements       how a missed payment was dealt with (paid by other means, waived, written off) and a private note.
--                             Kept apart from payment_records so a member can never read the note. Owners and admins read it;
--                             it is only ever written by settle_missed_payment.
--   private.missed_payments   the one definition of "missed", used by the functions below
--   get_gym_arrears           everyone who is not financial, with what they owe (owners and admins only)
--   get_member_missed_payments  one person's missed payments, plus what has already been settled
--   settle_missed_payment / reopen_missed_payment   mark one missed payment dealt with, or put it back
-- Rollback: supabase/rollback/20261013_drop_money_owed.sql

alter table public.gym_payment_settings add column overdue_grace_days integer not null default 7 check (overdue_grace_days between 0 and 90);

create table public.payment_settlements (
  payment_id uuid primary key references public.payment_records(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  how text not null check (how in ('paid', 'waived', 'written_off')),
  note text check (char_length(note) <= 500),
  settled_by uuid default auth.uid() references public.profiles(id) on delete set null,
  settled_at timestamptz not null default now()
);
create index payment_settlements_gym_idx on public.payment_settlements (gym_id);

alter table public.payment_settlements enable row level security;
revoke all on table public.payment_settlements from anon, authenticated, service_role;
grant select on table public.payment_settlements to authenticated;
create policy "owners admins read payment settlements" on public.payment_settlements for select to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));

-- The one definition of a missed payment (see the top of this file).
create function private.missed_payments(p_gym_id uuid)
returns table (payment_id uuid, user_id uuid, membership_id uuid, amount_pence integer, state public.payment_state, charge_date date, failure_code text, failure_message text)
  language sql stable security definer set search_path = ''
as $$
  select pr.id, coalesce(pr.user_id, ms.user_id), pr.membership_id, pr.amount_pence, pr.state, pr.charge_date, pr.failure_code, pr.failure_message
    from public.payment_records pr
    left join public.memberships ms on ms.id = pr.membership_id
    left join public.gym_payment_settings s on s.gym_id = pr.gym_id
    left join public.payment_settlements ps on ps.payment_id = pr.id
   where pr.gym_id = p_gym_id
     and ps.payment_id is null
     and coalesce(pr.user_id, ms.user_id) is not null
     and (pr.state in ('failed', 'charged_back')
          or (pr.state in ('pending', 'submitted') and pr.charge_date is not null and pr.charge_date < current_date - coalesce(s.overdue_grace_days, 7)));
$$;
revoke all on function private.missed_payments(uuid) from public, anon, authenticated, service_role;

-- Everyone who is not financial, biggest debt first.
create function public.get_gym_arrears(p_gym_id uuid)
returns table (user_id uuid, display_name text, plan_name text, membership_status text, owed_pence bigint, missed_count integer, oldest_missed date, latest_missed date, latest_reason text)
  language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_gym_role(p_gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]) then
    raise exception 'Only an owner or admin can see money owed';
  end if;
  return query
  with m as (select * from private.missed_payments(p_gym_id)),
  agg as (
    select m.user_id as uid, sum(m.amount_pence)::bigint as owed, count(*)::integer as n, min(m.charge_date) as oldest, max(m.charge_date) as latest
      from m group by m.user_id
  )
  select a.uid,
         coalesce(nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), nullif(btrim(p.display_name), ''), 'Member'),
         pl.name,
         cur.status::text,
         a.owed, a.n, a.oldest, a.latest,
         (select coalesce(nullif(btrim(x.failure_message), ''), nullif(btrim(x.failure_code), ''))
            from m x where x.user_id = a.uid order by x.charge_date desc nulls last, x.payment_id limit 1)
    from agg a
    left join public.profiles p on p.id = a.uid
    left join lateral (select ms.plan_id, ms.status from public.memberships ms where ms.gym_id = p_gym_id and ms.user_id = a.uid order by ms.created_at desc, ms.id desc limit 1) cur on true
    left join public.membership_plans pl on pl.id = cur.plan_id
   order by a.owed desc, 2;
end $$;
revoke all on function public.get_gym_arrears(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_gym_arrears(uuid) to authenticated;

-- One person's missed payments (newest first), plus what has already been settled, so there is a history.
create function public.get_member_missed_payments(p_gym_id uuid, p_user_id uuid)
returns table (payment_id uuid, charge_date date, amount_pence integer, state text, reason text, plan_name text, provider text, outstanding boolean, settled_how text, settled_note text, settled_at timestamptz, settled_by_name text)
  language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_gym_role(p_gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]) then
    raise exception 'Only an owner or admin can see money owed';
  end if;
  return query
  select pr.id, pr.charge_date, pr.amount_pence, pr.state::text,
         coalesce(nullif(btrim(pr.failure_message), ''), nullif(btrim(pr.failure_code), '')),
         pl.name, pr.provider::text,
         (mp.payment_id is not null),
         ps.how, ps.note, ps.settled_at,
         coalesce(nullif(btrim(coalesce(sp.first_name, '') || ' ' || coalesce(sp.last_name, '')), ''), nullif(btrim(sp.display_name), ''))
    from public.payment_records pr
    left join public.memberships ms on ms.id = pr.membership_id
    left join public.membership_plans pl on pl.id = ms.plan_id
    left join public.payment_settlements ps on ps.payment_id = pr.id
    left join public.profiles sp on sp.id = ps.settled_by
    left join private.missed_payments(p_gym_id) mp on mp.payment_id = pr.id
   where pr.gym_id = p_gym_id
     and coalesce(pr.user_id, ms.user_id) = p_user_id
     and (mp.payment_id is not null or ps.payment_id is not null)
   order by pr.charge_date desc nulls last, pr.created_at desc;
end $$;
revoke all on function public.get_member_missed_payments(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_member_missed_payments(uuid, uuid) to authenticated;

-- Mark one missed payment dealt with: paid some other way (cash, bank transfer), waived, or written off.
create function public.settle_missed_payment(p_gym_id uuid, p_payment_id uuid, p_how text, p_note text default null)
returns void
  language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_gym_role(p_gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]) then
    raise exception 'Only an owner or admin can settle a missed payment';
  end if;
  if p_how is null or p_how not in ('paid', 'waived', 'written_off') then
    raise exception 'Choose paid, waived or written off';
  end if;
  if not exists (select 1 from private.missed_payments(p_gym_id) m where m.payment_id = p_payment_id) then
    raise exception 'That payment is not outstanding';
  end if;
  insert into public.payment_settlements (payment_id, gym_id, how, note, settled_by)
  values (p_payment_id, p_gym_id, p_how, nullif(left(btrim(coalesce(p_note, '')), 500), ''), auth.uid());
end $$;
revoke all on function public.settle_missed_payment(uuid, uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.settle_missed_payment(uuid, uuid, text, text) to authenticated;

-- Put a settled payment back as outstanding (the undo).
create function public.reopen_missed_payment(p_gym_id uuid, p_payment_id uuid)
returns void
  language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_gym_role(p_gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]) then
    raise exception 'Only an owner or admin can reopen a missed payment';
  end if;
  delete from public.payment_settlements where payment_id = p_payment_id and gym_id = p_gym_id;
  if not found then
    raise exception 'That payment has not been settled';
  end if;
end $$;
revoke all on function public.reopen_missed_payment(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.reopen_missed_payment(uuid, uuid) to authenticated;
