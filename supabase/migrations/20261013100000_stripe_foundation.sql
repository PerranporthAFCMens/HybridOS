-- Stripe foundation: the gym's payment switch and its link to Stripe. Nothing is charged by this change.
--
--   gym_stripe_accounts   one row per gym once it has started linking a Stripe account (Stripe Connect). The row is created
--                         and kept up to date ONLY by the stripe-connect Edge Function (running as the service role) from what
--                         Stripe itself says; owners and admins can read it, nobody can edit it by hand.
--   gym_payment_settings  one row per gym with the gym's own choices:
--                           payments_enabled     the "turn it on" switch. Off by default. It cannot be switched on until Stripe
--                                                says the linked account can take card payments.
--                           cancellation_hours   how long before a class a member can still cancel (or lose their pass credit /
--                                                avoid being charged). Set by the gym, 24 by default.
--                         Owners and admins manage it; any member of the gym can read it (they need the cancellation window).
-- Rollback: supabase/rollback/20261013_drop_stripe_foundation.sql

create table public.gym_stripe_accounts (
  gym_id uuid primary key references public.gyms(id) on delete cascade,
  stripe_account_id text not null unique check (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  environment text not null default 'sandbox' check (environment in ('sandbox', 'live')),
  details_submitted boolean not null default false,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  last_error text,
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.gym_payment_settings (
  gym_id uuid primary key references public.gyms(id) on delete cascade,
  payments_enabled boolean not null default false,
  cancellation_hours integer not null default 24 check (cancellation_hours between 0 and 720),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references public.profiles(id) on delete set null
);

alter table public.gym_stripe_accounts enable row level security;
alter table public.gym_payment_settings enable row level security;
-- A fresh local database hands new tables to every role; the live project does not. Say exactly what is wanted.
revoke all on table public.gym_stripe_accounts, public.gym_payment_settings from anon, authenticated, service_role;
grant select on table public.gym_stripe_accounts to authenticated;
grant select, insert, update on table public.gym_stripe_accounts to service_role;
grant select, insert, update on table public.gym_payment_settings to authenticated;

create policy "owners admins read stripe account" on public.gym_stripe_accounts for select to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));

create policy "owners admins manage payment settings" on public.gym_payment_settings for all to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]))
  with check (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));
create policy "members read payment settings" on public.gym_payment_settings for select to authenticated
  using (private.is_gym_member(gym_id));

-- Payments cannot be switched on until Stripe has said the linked account can take card payments.
create function private.payments_need_stripe() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  if new.payments_enabled
     and not exists (select 1 from public.gym_stripe_accounts a where a.gym_id = new.gym_id and a.charges_enabled) then
    raise exception 'Link your Stripe account and finish its set-up before turning payments on.';
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function private.payments_need_stripe() from public, anon, authenticated, service_role;
create trigger gym_payment_settings_need_stripe before insert or update on public.gym_payment_settings
  for each row execute function private.payments_need_stripe();
