-- Undo 20261014091000_stripe_join_payments.sql. Removes the Stripe join records and functions and puts the sign-up join back as it was.
-- Memberships and payment records already created are not touched. (The enum value 'stripe' stays: see 20261014_stripe_payment_provider.sql.)
begin;
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
drop function if exists public.stripe_activate_membership(text, text, integer, text, timestamptz, text, text, text, integer, integer);
drop function if exists public.stripe_begin_membership(uuid, uuid, uuid, text, text, text, text, boolean, integer, date);
drop function if exists public.stripe_save_customer(uuid, uuid, text, text);
drop function if exists public.stripe_save_plan_price(uuid, text, text, integer, text, text);
drop function if exists public.stripe_join_context(uuid, uuid, uuid);
drop function if exists public.get_gym_payment_mode(text);
drop function if exists private.gym_takes_payments(uuid);
drop index if exists public.payment_records_stripe_unique;
drop table if exists public.membership_agreements;
drop table if exists public.member_stripe_customers;
drop table if exists public.plan_stripe_prices;
commit;
