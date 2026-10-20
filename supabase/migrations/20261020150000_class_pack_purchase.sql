-- Class packs, part 2b-1 of 3: the database side of buying a pack by card. No screen and no payment code yet.
--
-- Two functions the payment service (edge functions, service role only) will call. Nothing here can be reached from the app:
--   public.stripe_pack_context(gym, member, pack_type)
--       what the service needs to start a payment: the pack's name and price, the gym's linked Stripe account, and whether this
--       person may buy (an active member of the gym, the pack on sale, the gym taking card payments).
--   public.stripe_record_pack_purchase(gym, member, pack_type, payment_id, amount_pence)
--       called once Stripe says the payment went through: makes the member's pack. The payment id can only ever make one pack,
--       so a message from Stripe that arrives twice returns the same pack and never doubles the classes.
--
-- Rollback: supabase/rollback/20261020_drop_class_pack_purchase.sql
begin;

create or replace function public.stripe_pack_context(p_gym_id uuid, p_user_id uuid, p_pack_type_id uuid) returns jsonb
  language plpgsql stable security definer set search_path = ''
as $$
declare
  g public.gyms%rowtype;
  a public.gym_stripe_accounts%rowtype;
  t record;
  c public.member_stripe_customers%rowtype;
begin
  select * into g from public.gyms where id = p_gym_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'Gym not found'); end if;
  select * into t from public.class_pack_types where id = p_pack_type_id and gym_id = p_gym_id and is_active;
  if not found then return jsonb_build_object('ok', false, 'reason', 'That class pack is not available'); end if;
  if not exists (select 1 from public.gym_members gm where gm.gym_id = p_gym_id and gm.user_id = p_user_id and gm.is_active and gm.access_status = 'active') then
    return jsonb_build_object('ok', false, 'reason', 'Only an active member of this gym can buy a class pack');
  end if;
  select * into a from public.gym_stripe_accounts where gym_id = p_gym_id;
  select * into c from public.member_stripe_customers where gym_id = p_gym_id and user_id = p_user_id;
  return jsonb_build_object(
    'ok', true,
    'takes_payments', private.gym_takes_payments(p_gym_id),
    'gym', jsonb_build_object('id', g.id, 'name', g.name, 'currency', g.currency, 'country', g.country_code),
    'account', case when a.gym_id is null then null else jsonb_build_object('stripe_account_id', a.stripe_account_id, 'environment', a.environment, 'charges_enabled', a.charges_enabled) end,
    'pack', jsonb_build_object('id', t.id, 'name', t.name, 'credits', t.credits, 'price_pence', t.price_pence, 'valid_days', t.valid_days),
    'customer', case when c.user_id is null then null else jsonb_build_object('stripe_customer_id', c.stripe_customer_id, 'environment', c.environment) end
  );
end $$;

create or replace function public.stripe_record_pack_purchase(p_gym_id uuid, p_user_id uuid, p_pack_type_id uuid, p_payment_id text, p_amount_pence integer) returns uuid
  language plpgsql security definer set search_path = ''
as $$
declare
  t record;
  v_id uuid;
begin
  if p_payment_id is null or btrim(p_payment_id) = '' then raise exception 'A payment id is needed'; end if;
  if p_amount_pence is null or p_amount_pence < 0 then raise exception 'The amount paid is not valid'; end if;
  -- the same payment seen again gives back the pack it already made
  select cp.id into v_id from public.class_packs cp where cp.provider_payment_id = p_payment_id;
  if found then
    if not exists (select 1 from public.class_packs cp where cp.id = v_id and cp.gym_id = p_gym_id and cp.user_id = p_user_id) then
      raise exception 'That payment already belongs to a different pack';
    end if;
    return v_id;
  end if;
  select * into t from public.class_pack_types where id = p_pack_type_id and gym_id = p_gym_id;
  if not found then raise exception 'That class pack does not exist at this gym'; end if;
  if not exists (select 1 from public.gym_members gm where gm.gym_id = p_gym_id and gm.user_id = p_user_id and gm.is_active) then
    raise exception 'That person is not a member of this gym';
  end if;
  insert into public.class_packs(gym_id, user_id, pack_type_id, name, credits_total, credits_left, expires_at, source, paid_pence, provider_payment_id)
  values (p_gym_id, p_user_id, t.id, t.name, t.credits, t.credits,
          case when t.valid_days is null then null else now() + make_interval(days => t.valid_days) end, 'purchase', p_amount_pence, p_payment_id)
  on conflict (provider_payment_id) where provider_payment_id is not null do nothing
  returning id into v_id;
  if v_id is null then
    select cp.id into v_id from public.class_packs cp where cp.provider_payment_id = p_payment_id;
  end if;
  return v_id;
end $$;

revoke all on function public.stripe_pack_context(uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.stripe_record_pack_purchase(uuid, uuid, uuid, text, integer) from public, anon, authenticated, service_role;
grant execute on function public.stripe_pack_context(uuid, uuid, uuid) to service_role;
grant execute on function public.stripe_record_pack_purchase(uuid, uuid, uuid, text, integer) to service_role;

commit;
