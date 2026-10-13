-- Lift leaderboard: persona tests (rolled back at the end; leaves nothing behind).
-- Runs on a FRESH local database after the migrations are applied (never on the live project).
-- Real queries run as the `authenticated` role with that user's JWT claims, so Row Level Security and the functions
-- are exercised exactly as the app would.
-- Usage:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/stripe_join_payments.sql
begin;
\o /dev/null
create schema pt;
create table pt.results(seq serial, label text, got text, want text, ok boolean);

create function pt.q(uid uuid, stmt text) returns text language plpgsql as $f$
declare r text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub',uid,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  begin
    execute stmt into r;
  exception when others then
    r := 'ERROR:' || sqlerrm;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claims','',true);
  perform set_config('request.jwt.claim.sub','',true);
  return r;
end $f$;

-- Same, as the anonymous role (no user).
create function pt.anon(stmt text) returns text language plpgsql as $f$
declare r text;
begin
  perform set_config('request.jwt.claims','',true);
  perform set_config('request.jwt.claim.sub','',true);
  execute 'set local role anon';
  begin execute stmt into r; exception when others then r := 'ERROR:' || sqlerrm; end;
  execute 'reset role';
  return r;
end $f$;

create function pt.check(label text, got text, want text) returns void language plpgsql as $f$
begin
  insert into pt.results(label,got,want,ok) values(label, got, want, got is not distinct from want or (want like '%\%' and got like want));
end $f$;

create function pt.check(label text, got boolean, want boolean) returns void language sql as $f$ select pt.check(label, got::text, want::text) $f$;

create table pt.persona(name text primary key, uid uuid);
insert into pt.persona values
 ('owner_a','00000000-0000-4000-8000-000000000001'), ('admin_a','00000000-0000-4000-8000-000000000002'), ('staff_a','00000000-0000-4000-8000-000000000003'), ('coach_a','00000000-0000-4000-8000-000000000004'),
 ('m1','00000000-0000-4000-8000-000000000011'), ('m2','00000000-0000-4000-8000-000000000012'), ('m3','00000000-0000-4000-8000-000000000013'), ('m4','00000000-0000-4000-8000-000000000014'), ('m5','00000000-0000-4000-8000-000000000015'), ('m6','00000000-0000-4000-8000-000000000016'), ('m7','00000000-0000-4000-8000-000000000017'), ('m8','00000000-0000-4000-8000-000000000018'),
 ('admin_b','00000000-0000-4000-8000-000000000022'), ('mb','00000000-0000-4000-8000-000000000021');
insert into auth.users(id,email) select uid, name||'@sjp.invalid' from pt.persona;
insert into public.profiles(id,display_name) select uid,name from pt.persona on conflict (id) do nothing;

create function pt.u(n text) returns uuid language sql as $$ select uid from pt.persona where name = n $$;
create function pt.gym_a() returns uuid language sql as $$ select 'a0000000-0000-4000-8000-00000000000a'::uuid $$;
create function pt.gym_b() returns uuid language sql as $$ select 'b0000000-0000-4000-8000-00000000000b'::uuid $$;
create function pt.c1() returns uuid language sql as $$ select 'f0000000-0000-4000-8000-000000000001'::uuid $$;
create function pt.c2() returns uuid language sql as $$ select 'f0000000-0000-4000-8000-000000000002'::uuid $$;

insert into public.gyms(id,name,slug,created_by) values (pt.gym_a(),'Training Gym A','tr-a',pt.u('owner_a')),(pt.gym_b(),'Training Gym B','tr-b',pt.u('admin_b'));
insert into public.gym_members(gym_id,user_id,role,is_active,access_status) values
 (pt.gym_a(),pt.u('owner_a'),'owner',true,'active'),(pt.gym_a(),pt.u('admin_a'),'admin',true,'active'),(pt.gym_a(),pt.u('staff_a'),'staff',true,'active'),(pt.gym_a(),pt.u('coach_a'),'coach',true,'active'),
 (pt.gym_a(),pt.u('m1'),'member',true,'active'),(pt.gym_a(),pt.u('m2'),'member',true,'active'),(pt.gym_a(),pt.u('m3'),'member',true,'active'),(pt.gym_a(),pt.u('m4'),'member',true,'active'),(pt.gym_a(),pt.u('m5'),'member',true,'active'),(pt.gym_a(),pt.u('m6'),'member',true,'active'),(pt.gym_a(),pt.u('m7'),'member',true,'active'),(pt.gym_a(),pt.u('m8'),'member',true,'active'),
 (pt.gym_b(),pt.u('admin_b'),'owner',true,'active'),(pt.gym_b(),pt.u('mb'),'member',true,'active');




create function pt.su(stmt text) returns text language plpgsql as $f$
declare r text;
begin
  begin execute stmt into r; exception when others then r := 'ERROR:' || sqlerrm; end;
  return r;
end $f$;
create function pt.plan(n int) returns uuid language sql as $$ select ('c0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
create function pt.join(uid uuid, plan uuid) returns text language sql as $$
  select pt.q(uid, format($s$select (public.join_public_gym_with_membership('tr-a', %L))->>'status'$s$, plan)) $$;
create function pt.begin(u uuid, plan uuid, sub text, guardian boolean default false) returns text language sql as $$
  select pt.su(format($s$select public.stripe_begin_membership(%L, %L, %L, %L, 'cus_x', 'I agree to be charged each month and for anything I miss', 'Name', %L, 3000, current_date)::text$s$, pt.gym_a(), u, plan, sub, guardian)) $$;
create function pt.act(sub text, inv text, amount int default 3000) returns text language plpgsql as $f$
declare r1 jsonb; r2 jsonb;
begin
  r1 := public.stripe_activate_membership(sub, inv, amount, 'gbp', now(), 'pm_1', 'visa', '4242', 12, 2030);
  r2 := public.stripe_activate_membership(sub, inv, amount, 'gbp', now(), 'pm_1', 'visa', '4242', 12, 2030);
  return (r1->>'status') || ':' || (r1->>'already_active') || ':' || (r2->>'already_active');
exception when others then return 'ERROR:' || sqlerrm;
end $f$;

update public.profiles set first_name = 'One', last_name = 'Member', date_of_birth = date '1990-01-01' where id in (pt.u('m1'), pt.u('m2'), pt.u('m4'), pt.u('m6'));
insert into public.member_details(user_id, phone, address_line1, town, postcode, emergency_name, emergency_phone, emergency_relationship)
  select pt.u(n), '+447700900101', '1 Test Street', 'Perranporth', 'TR6 0AA', 'Parent', '+447700900102', 'Parent' from unnest(array['m1','m2','m4','m6']) n;
insert into public.membership_plans(id, gym_id, name, price_pence, billing_interval, is_active, is_public) values
 ('c0000000-0000-4000-8000-000000000001', pt.gym_a(), 'Basic', 3000, 'monthly', true, true),
 ('c0000000-0000-4000-8000-000000000002', pt.gym_a(), 'Free', 0, 'monthly', true, true),
 ('c0000000-0000-4000-8000-000000000003', pt.gym_a(), 'Hidden', 3000, 'monthly', true, false);

-- ---------- payments off: everything works as before ----------
select pt.check('with payments off the sign-up page is told off', pt.q(pt.u('m1'), $s$select public.get_gym_payment_mode('tr-a')$s$), 'off');
select pt.check('someone not signed in cannot ask', pt.anon($s$select public.get_gym_payment_mode('tr-a')$s$) like 'ERROR:%', true);
select pt.check('an unknown gym is refused', pt.q(pt.u('m1'), $s$select public.get_gym_payment_mode('nope')$s$), 'ERROR:Gym not found');
select pt.check('joining a paid plan still works while payments are off', pt.join(pt.u('m1'), pt.plan(1)), 'active');

-- ---------- payments on ----------
insert into public.gym_stripe_accounts(gym_id, stripe_account_id, environment, details_submitted, charges_enabled, payouts_enabled) values (pt.gym_a(), 'acct_TEST1', 'sandbox', true, true, true);
insert into public.gym_payment_settings(gym_id, payments_enabled) values (pt.gym_a(), true);
select pt.check('with payments on the sign-up page is told stripe', pt.q(pt.u('m2'), $s$select public.get_gym_payment_mode('tr-a')$s$), 'stripe');
select pt.check('joining a paid plan directly is refused', pt.join(pt.u('m2'), pt.plan(1)), 'ERROR:This gym takes payment when you join. Use the payment step on the sign-up page.');
select pt.check('...and nothing was created', (select count(*) from public.memberships where user_id = pt.u('m2'))::text, '0');
select pt.check('a free plan can still be joined directly', pt.join(pt.u('m2'), pt.plan(2)), 'active');

-- ---------- what the Stripe function is told ----------
create temp table ctx(k text primary key, v jsonb);
insert into ctx values ('m4', public.stripe_join_context(pt.gym_a(), pt.u('m4'), pt.plan(1))), ('m3', public.stripe_join_context(pt.gym_a(), pt.u('m3'), pt.plan(1))),
  ('hidden', public.stripe_join_context(pt.gym_a(), pt.u('m4'), pt.plan(3))), ('none', public.stripe_join_context(pt.gym_a(), pt.u('m4'), gen_random_uuid()));
select pt.check('the join context carries the plan, the account and that payments are on', (select v #>> '{plan,name}' || ':' || (v #>> '{account,stripe_account_id}') || ':' || (v ->> 'takes_payments') from ctx where k = 'm4'), 'Basic:acct_TEST1:true');
select pt.check('a plan that is not public is not available', (select v ->> 'reason' from ctx where k = 'hidden'), 'Membership plan is not available');
select pt.check('a missing plan is not available', (select v ->> 'reason' from ctx where k = 'none'), 'Membership plan is not available');
select pt.check('missing details are listed', (select jsonb_array_length(v -> 'gaps') > 0 from ctx where k = 'm3'), true);
select pt.check('complete details give an empty list', (select jsonb_array_length(v -> 'gaps') from ctx where k = 'm4')::text, '0');
select public.stripe_save_plan_price(pt.plan(1), 'prod_1', 'price_1', 3000, 'monthly', 'sandbox');
select public.stripe_save_plan_price(pt.plan(1), 'prod_1', 'price_2', 3500, 'monthly', 'sandbox');
select pt.check('a plan price is saved once and updated, never duplicated', (select count(*) || ':' || max(stripe_price_id) || ':' || max(amount_pence) from public.plan_stripe_prices), '1:price_2:3500');
select pt.check('the context then carries the Stripe price', (select (public.stripe_join_context(pt.gym_a(), pt.u('m4'), pt.plan(1))) #>> '{price,stripe_price_id}'), 'price_2');
select public.stripe_save_customer(pt.gym_a(), pt.u('m4'), 'cus_M4', 'sandbox');
select public.stripe_save_customer(pt.gym_a(), pt.u('m4'), 'cus_M4', 'sandbox');
select pt.check('the customer is saved once for the member and gym', (select count(*) || ':' || max(stripe_customer_id) from public.member_stripe_customers where user_id = pt.u('m4')), '1:cus_M4');

-- ---------- starting to pay ----------
select pt.check('a person with missing details cannot start paying', pt.begin(pt.u('m3'), pt.plan(1), 'sub_M3') like 'ERROR:Complete your details before joining:%', true);
select pt.check('someone who already has a membership cannot start again', pt.begin(pt.u('m1'), pt.plan(1), 'sub_M1'), 'ERROR:You already have a membership at this gym. Contact your gym to change it.');
select pt.check('a plan that is not public cannot be paid for', pt.begin(pt.u('m4'), pt.plan(3), 'sub_M4'), 'ERROR:Membership plan is not available');
select pt.check('starting to pay makes a pending membership', (pt.begin(pt.u('m4'), pt.plan(1), 'sub_M4')) not like 'ERROR:%' and (pt.begin(pt.u('m4'), pt.plan(1), 'sub_M4b')) not like 'ERROR:%', true);
select pt.check('...one only, even after a second try, tied to the newest subscription', (select count(*) || ':' || max(status::text) || ':' || max(provider_subscription_id) || ':' || max(payment_provider::text) from public.memberships where user_id = pt.u('m4')), '1:pending:sub_M4b:stripe');
select pt.check('a pending member is not an active one (no access yet)', (select count(*) from public.memberships where user_id = pt.u('m4') and status = 'active')::text, '0');
select pt.check('each try is recorded as an agreement with the wording and the amount', (select count(*) || ':' || max(amount_pence) from public.membership_agreements where user_id = pt.u('m4')), '2:3000');
select pt.check('a guardian can start the payment', (pt.begin(pt.u('m4'), pt.plan(1), 'sub_M4c', true)) not like 'ERROR:%', true);
select pt.check('...and agreeing as a guardian is recorded as one', (select bool_or(signer_is_guardian) from public.membership_agreements where user_id = pt.u('m4')), true);

-- ---------- Stripe confirms the payment ----------
select pt.check('an unknown subscription is not activated', pt.su($s$select public.stripe_activate_membership('sub_nope', 'in_1', 3000, 'gbp', now(), null, null, null, null, null)->>'reason'$s$), 'No membership for that subscription');
select pt.check('the first payment activates the membership, and a repeat changes nothing', pt.act('sub_M4c', 'in_M4'), 'active:false:true');
select pt.check('it is active now', (select status::text || ':' || payment_status::text || ':' || provider_status from public.memberships where user_id = pt.u('m4')), 'active:confirmed:active');
select pt.check('the payment is recorded once', (select count(*) || ':' || max(amount_pence) || ':' || max(provider::text) || ':' || max(state::text) from public.payment_records where user_id = pt.u('m4') and provider_payment_id = 'in_M4'), '1:3000:stripe:confirmed');
select pt.check('only Stripe''s payment-method token is kept; no card detail exists in the database', (select payment_method_id from public.member_stripe_customers where user_id = pt.u('m4')) || ':' || (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'member_stripe_customers' and column_name ~ '(card|last4|exp_)'), 'pm_1:0');
select pt.check('a trial (nothing to pay today) starts a pending membership', pt.begin(pt.u('m6'), pt.plan(1), 'sub_M6') not like 'ERROR:%', true);
select pt.check('...and activates when the card is saved, with no payment record for nothing', pt.act('sub_M6', 'in_M6', 0), 'active:false:true');
select pt.check('...so no payment is recorded for a free first invoice', (select count(*) from public.payment_records where provider_payment_id = 'in_M6')::text, '0');

-- ---------- who can see what ----------
select pt.check('a member reads their own customer record', pt.q(pt.u('m4'), format($s$select stripe_customer_id from public.member_stripe_customers where gym_id = %L$s$, pt.gym_a())), 'cus_M4');
select pt.check('another member sees nothing of it', pt.q(pt.u('m2'), format($s$select count(*) from public.member_stripe_customers where gym_id = %L$s$, pt.gym_a())), '0');
select pt.check('an admin reads it', pt.q(pt.u('admin_a'), format($s$select count(*) from public.member_stripe_customers where gym_id = %L$s$, pt.gym_a())), '1');
select pt.check('staff cannot', pt.q(pt.u('staff_a'), format($s$select count(*) from public.member_stripe_customers where gym_id = %L$s$, pt.gym_a())), '0');
select pt.check('another gym cannot', pt.q(pt.u('admin_b'), format($s$select count(*) from public.member_stripe_customers where gym_id = %L$s$, pt.gym_a())), '0');
select pt.check('a member reads their own agreements', pt.q(pt.u('m4'), format($s$select count(*) from public.membership_agreements where gym_id = %L$s$, pt.gym_a())), '3');
select pt.check('another member sees none', pt.q(pt.u('m2'), format($s$select count(*) from public.membership_agreements where gym_id = %L$s$, pt.gym_a())), '0');
select pt.check('an admin sees all members', pt.q(pt.u('admin_a'), format($s$select count(*) from public.membership_agreements where gym_id = %L$s$, pt.gym_a())), '4');
select pt.check('staff do not', pt.q(pt.u('staff_a'), format($s$select count(*) from public.membership_agreements where gym_id = %L$s$, pt.gym_a())), '0');
select pt.check('an admin sees the plan prices', pt.q(pt.u('admin_a'), format($s$select count(*) from public.plan_stripe_prices where gym_id = %L$s$, pt.gym_a())), '1');
select pt.check('a member does not', pt.q(pt.u('m4'), format($s$select count(*) from public.plan_stripe_prices where gym_id = %L$s$, pt.gym_a())), '0');
select pt.check('nobody signed in can write an agreement', pt.q(pt.u('owner_a'), format($s$insert into public.membership_agreements(gym_id, user_id, wording, signer_name, amount_pence) values (%L, %L, repeat('x', 30), 'x', 0) returning 1$s$, pt.gym_a(), pt.u('m4'))) like 'ERROR:%', true);
select pt.check('nobody signed in can edit a customer', pt.q(pt.u('admin_a'), format($s$update public.member_stripe_customers set payment_method_id = 'pm_x' where gym_id = %L returning 1$s$, pt.gym_a())) like 'ERROR:%', true);
select pt.check('a signed-in person cannot run the Stripe functions', pt.q(pt.u('admin_a'), format($s$select public.stripe_activate_membership('sub_M4c', 'in_X', 100, 'gbp', now(), null, null, null, null, null)::text$s$)) like 'ERROR:%permission denied%', true);
select pt.check('...nor start a membership', pt.q(pt.u('owner_a'), format($s$select public.stripe_begin_membership(%L, %L, %L, 's', 'c', repeat('w', 30), 'n', false, 1, current_date)::text$s$, pt.gym_a(), pt.u('m5'), pt.plan(1))) like 'ERROR:%permission denied%', true);
select pt.check('...nor read the context', pt.q(pt.u('owner_a'), format($s$select public.stripe_join_context(%L, %L, %L)::text$s$, pt.gym_a(), pt.u('m4'), pt.plan(1))) like 'ERROR:%permission denied%', true);
select pt.check('someone not signed in cannot either', pt.anon($s$select public.stripe_save_customer(gen_random_uuid(), gen_random_uuid(), 'c', 'sandbox')::text$s$) like 'ERROR:%', true);

-- ---------- the account going off switches the guard off ----------
update public.gym_stripe_accounts set charges_enabled = false where gym_id = pt.gym_a();
select pt.check('if Stripe stops the account taking cards the page goes back to off', pt.q(pt.u('m2'), $s$select public.get_gym_payment_mode('tr-a')$s$), 'off');

\o
do $$
declare bad integer;
begin
  select count(*) into bad from pt.results where not ok;
  raise notice 'stripe join payments: % checks, % failed', (select count(*) from pt.results), bad;
  if bad > 0 then
    raise exception 'FAILED: %', (select string_agg(seq || ' ' || label || ' [got ' || coalesce(got,'NULL') || ' / want ' || coalesce(want,'NULL') || ']', E'\n') from pt.results where not ok);
  end if;
end $$;
rollback;
