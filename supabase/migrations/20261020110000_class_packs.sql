-- Class packs, part 1 of 3: the database. No screen changes yet.
--
-- A class pack is a bundle of class credits a member buys or is given ("10 classes, use within 3 months"). Later parts let owners set
-- them up on screen, members buy them by card, and booking spend a credit. This part only adds the tables and the two owner actions.
--
--   public.class_pack_types   what a gym sells: a name, how many classes, the price, and how many days it lasts (empty = never expires).
--                             Owners and admins manage them; members of the gym can read the ones that are switched on.
--   public.class_packs        one row per pack a member holds: what it was called and how many classes it had when it was made (so
--                             changing the pack type later never changes a pack already held), how many are left, when it expires,
--                             whether it was given by the gym or paid for. Members read only their own; owners and admins read the gym's.
--                             Nobody writes this table directly: only the functions below (and, in part 2, the payment function).
--   public.owner_give_class_pack(gym, member, pack_type)   owners and admins give a member a pack (no payment).
--   public.owner_void_class_pack(pack)                     owners and admins cancel a pack; its credits can no longer be used.
--
-- Nothing changes for booking yet: no credit is spent until part 3.
-- Rollback: supabase/rollback/20261020_drop_class_packs.sql
begin;

create table public.class_pack_types (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  credits integer not null check (credits between 1 and 200),
  price_pence integer not null check (price_pence >= 0),
  valid_days integer check (valid_days is null or valid_days between 1 and 730),
  is_active boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index class_pack_types_gym_idx on public.class_pack_types (gym_id, is_active);

create table public.class_packs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_type_id uuid references public.class_pack_types(id) on delete set null,
  name text not null,
  credits_total integer not null check (credits_total >= 1),
  credits_left integer not null,
  expires_at timestamptz,
  source text not null check (source in ('owner', 'purchase')),
  paid_pence integer not null default 0 check (paid_pence >= 0),
  provider_payment_id text,
  granted_by uuid references auth.users(id) on delete set null,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint class_packs_credits_left_check check (credits_left between 0 and credits_total)
);
create index class_packs_user_idx on public.class_packs (gym_id, user_id);
-- One payment can only ever make one pack, so a payment seen twice (a repeated message from Stripe) never doubles the credits.
create unique index class_packs_payment_unique on public.class_packs (provider_payment_id) where provider_payment_id is not null;

alter table public.class_pack_types enable row level security;
alter table public.class_packs enable row level security;
-- A fresh local database hands new tables to every role; the live project does not. Say exactly what is wanted.
revoke all on table public.class_pack_types from anon, authenticated, service_role;
revoke all on table public.class_packs from anon, authenticated, service_role;
grant select, insert, update, delete on table public.class_pack_types to authenticated;
grant select on table public.class_packs to authenticated;

create policy "members read active pack types" on public.class_pack_types for select to authenticated
  using (is_active and private.is_gym_member(gym_id));
create policy "owners admins manage pack types" on public.class_pack_types for all to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]))
  with check (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));

create policy "members read own packs" on public.class_packs for select to authenticated
  using (user_id = auth.uid() and private.is_gym_member(gym_id));
create policy "owners admins read gym packs" on public.class_packs for select to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));

-- Owners and admins: give a member a pack without payment.
create function public.owner_give_class_pack(p_gym_id uuid, p_user_id uuid, p_pack_type_id uuid) returns uuid
 language plpgsql
 security definer
 set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  t public.class_pack_types%rowtype;
  v_id uuid;
begin
  if auth.uid() is null or not private.has_gym_role(p_gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]) then
    raise exception 'Only an owner or admin can give a class pack.';
  end if;
  select * into t from public.class_pack_types where id = p_pack_type_id and gym_id = p_gym_id and is_active;
  if not found then
    raise exception 'That class pack is not available.';
  end if;
  if not exists (select 1 from public.gym_members where gym_id = p_gym_id and user_id = p_user_id and is_active) then
    raise exception 'That person is not a member of this gym.';
  end if;
  insert into public.class_packs(gym_id, user_id, pack_type_id, name, credits_total, credits_left, expires_at, source, granted_by)
  values (p_gym_id, p_user_id, t.id, t.name, t.credits, t.credits,
          case when t.valid_days is null then null else now() + make_interval(days => t.valid_days) end, 'owner', auth.uid())
  returning id into v_id;
  return v_id;
end
$function$;

-- Owners and admins: cancel a pack. Its credits can no longer be used. Cancelling twice does nothing more.
create function public.owner_void_class_pack(p_pack_id uuid) returns void
 language plpgsql
 security definer
 set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  p public.class_packs%rowtype;
begin
  select * into p from public.class_packs where id = p_pack_id;
  if not found or auth.uid() is null or not private.has_gym_role(p.gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]) then
    raise exception 'Only an owner or admin can cancel a class pack.';
  end if;
  update public.class_packs set voided_at = now() where id = p_pack_id and voided_at is null;
end
$function$;

revoke all on function public.owner_give_class_pack(uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.owner_void_class_pack(uuid) from public, anon, authenticated, service_role;
grant execute on function public.owner_give_class_pack(uuid, uuid, uuid) to authenticated;
grant execute on function public.owner_void_class_pack(uuid) to authenticated;

commit;
