-- Class pack purchase (payment service functions): persona tests (rolled back at the end; leaves nothing behind).
-- Runs on a FRESH local database after the migrations are applied (never on the live project).
-- Usage:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/class_pack_purchase.sql
begin;
\o /dev/null
create schema pt;
create table pt.results(seq serial, label text, got text, want text, ok boolean);

-- run a statement as a given role (none = the signed-in-less anon role); an error becomes the text ERROR:<message>
create function pt.as_role(r text, uid uuid, stmt text) returns text language plpgsql as $f$
declare out text;
begin
  perform set_config('request.jwt.claims', case when uid is null then '' else json_build_object('sub',uid,'role',r)::text end, true);
  perform set_config('request.jwt.claim.sub', coalesce(uid::text,''), true);
  execute 'set local role ' || r;
  begin execute stmt into out; exception when others then out := 'ERROR:' || sqlerrm; end;
  execute 'reset role';
  perform set_config('request.jwt.claims','',true);
  perform set_config('request.jwt.claim.sub','',true);
  return out;
end $f$;

create function pt.check(label text, got text, want text) returns void language plpgsql as $f$
begin
  insert into pt.results(label,got,want,ok) values(label, got, want, got is not distinct from want);
end $f$;

create table pt.persona(name text primary key, uid uuid);
insert into pt.persona values
 ('owner_a','00000000-0000-4000-8000-0000000000a1'), ('m1','00000000-0000-4000-8000-0000000000a2'), ('m2','00000000-0000-4000-8000-0000000000a3'),
 ('stranger','00000000-0000-4000-8000-0000000000a4'), ('owner_b','00000000-0000-4000-8000-0000000000b1');
insert into auth.users(id,email) select uid, name||'@cppurch.invalid' from pt.persona;
insert into public.profiles(id,display_name) select uid,name from pt.persona on conflict (id) do nothing;
create function pt.u(n text) returns uuid language sql as $$ select uid from pt.persona where name = n $$;
create function pt.gym_a() returns uuid language sql as $$ select 'a0000000-0000-4000-8000-0000000000aa'::uuid $$;
create function pt.gym_b() returns uuid language sql as $$ select 'b0000000-0000-4000-8000-0000000000bb'::uuid $$;
insert into public.gyms(id,name,slug,created_by) values (pt.gym_a(),'Pack Buy Gym A','cpp-a',pt.u('owner_a')),(pt.gym_b(),'Pack Buy Gym B','cpp-b',pt.u('owner_b'));
insert into public.gym_members(gym_id,user_id,role,is_active,access_status) values
 (pt.gym_a(),pt.u('owner_a'),'owner',true,'active'), (pt.gym_a(),pt.u('m1'),'member',true,'active'),
 (pt.gym_a(),pt.u('m2'),'member',true,'revoked'), (pt.gym_b(),pt.u('owner_b'),'owner',true,'active');
insert into public.membership_plans(id,gym_id,name,price_pence,billing_interval,includes_classes) values ('c0000000-0000-4000-8000-0000000000c1',pt.gym_a(),'Open gym',2000,'monthly',false);
insert into public.memberships(gym_id,user_id,plan_id,status,starts_on) values (pt.gym_a(), pt.u('m1'), 'c0000000-0000-4000-8000-0000000000c1', 'active', current_date-30);
insert into public.class_pack_types(id,gym_id,name,credits,price_pence,valid_days,is_active) values
 ('d0000000-0000-4000-8000-000000000001',pt.gym_a(),'10 classes',10,6000,90,true),
 ('d0000000-0000-4000-8000-000000000002',pt.gym_a(),'Off sale',5,3000,null,false),
 ('d0000000-0000-4000-8000-000000000003',pt.gym_b(),'Other gym pack',5,3000,null,true);
insert into public.gym_stripe_accounts(gym_id,stripe_account_id,environment,charges_enabled) values (pt.gym_a(),'acct_testpackbuy','sandbox',true);

-- who may call the functions
select set_config('pt.ctx', format('select public.stripe_pack_context(%L,%L,%L)::text', pt.gym_a(), pt.u('m1'), 'd0000000-0000-4000-8000-000000000001'), true);
select pt.check('a signed-in member cannot ask for payment details', pt.as_role('authenticated', pt.u('m1'), current_setting('pt.ctx')), 'ERROR:permission denied for function stripe_pack_context');
select pt.check('a visitor cannot either', pt.as_role('anon', null, current_setting('pt.ctx')), 'ERROR:permission denied for function stripe_pack_context');
select pt.check('a signed-in member cannot record a purchase', pt.as_role('authenticated', pt.u('m1'), format('select public.stripe_record_pack_purchase(%L,%L,%L,%L,6000)::text', pt.gym_a(), pt.u('m1'), 'd0000000-0000-4000-8000-000000000001', 'pi_hack')), 'ERROR:permission denied for function stripe_record_pack_purchase');
select pt.check('and an owner cannot either (only the payment service)', pt.as_role('authenticated', pt.u('owner_a'), format('select public.stripe_record_pack_purchase(%L,%L,%L,%L,6000)::text', pt.gym_a(), pt.u('m1'), 'd0000000-0000-4000-8000-000000000001', 'pi_hack')), 'ERROR:permission denied for function stripe_record_pack_purchase');

-- the context
select pt.check('the service sees the pack and price for an active member', (public.stripe_pack_context(pt.gym_a(), pt.u('m1'), 'd0000000-0000-4000-8000-000000000001')->'pack'->>'price_pence'), '6000');
select pt.check('and the linked account', (public.stripe_pack_context(pt.gym_a(), pt.u('m1'), 'd0000000-0000-4000-8000-000000000001')->'account'->>'stripe_account_id'), 'acct_testpackbuy');
select pt.check('a pack that is off sale is refused', (public.stripe_pack_context(pt.gym_a(), pt.u('m1'), 'd0000000-0000-4000-8000-000000000002')->>'ok'), 'false');
select pt.check('another gym''s pack is refused', (public.stripe_pack_context(pt.gym_a(), pt.u('m1'), 'd0000000-0000-4000-8000-000000000003')->>'ok'), 'false');
select pt.check('a member whose access was removed is refused', (public.stripe_pack_context(pt.gym_a(), pt.u('m2'), 'd0000000-0000-4000-8000-000000000001')->>'ok'), 'false');
select pt.check('a stranger is refused', (public.stripe_pack_context(pt.gym_a(), pt.u('stranger'), 'd0000000-0000-4000-8000-000000000001')->>'ok'), 'false');

-- recording a purchase
create function pt.buy(uid uuid, pk uuid, pay text, amt int) returns text language plpgsql as $f$
declare out text;
begin
  begin out := public.stripe_record_pack_purchase(pt.gym_a(), uid, pk, pay, amt)::text; exception when others then out := 'ERROR:' || sqlerrm; end;
  return out;
end $f$;
create table pt.first(id text);
insert into pt.first select pt.buy(pt.u('m1'), 'd0000000-0000-4000-8000-000000000001', 'pi_one', 6000);
select pt.check('a paid pack is made', (select (id is not null and id not like 'ERROR%')::text from pt.first), 'true');
select pt.check('with the classes and name from the pack on sale', (select credits_total || '/' || credits_left || '/' || name || '/' || source || '/' || paid_pence from public.class_packs where provider_payment_id = 'pi_one'), '10/10/10 classes/purchase/6000');
select pt.check('it belongs to the buyer', (select (user_id = pt.u('m1') and gym_id = pt.gym_a())::text from public.class_packs where provider_payment_id = 'pi_one'), 'true');
select pt.check('and runs out in about 90 days', (select (expires_at between now() + interval '89 days' and now() + interval '91 days')::text from public.class_packs where provider_payment_id = 'pi_one'), 'true');
select pt.check('the same payment seen again returns the same pack', (pt.buy(pt.u('m1'), 'd0000000-0000-4000-8000-000000000001', 'pi_one', 6000) = (select id from pt.first))::text, 'true');
select pt.check('and never makes a second pack', (select count(*)::text from public.class_packs where provider_payment_id = 'pi_one'), '1');
select pt.check('the same payment cannot be claimed by someone else', pt.buy(pt.u('owner_a'), 'd0000000-0000-4000-8000-000000000001', 'pi_one', 6000), 'ERROR:That payment already belongs to a different pack');
create table pt.second(id text);
insert into pt.second select pt.buy(pt.u('m1'), 'd0000000-0000-4000-8000-000000000002', 'pi_two', 3000);
select pt.check('a pack with no expiry never expires', (select (expires_at is null)::text from public.class_packs where provider_payment_id = 'pi_two'), 'true');
select pt.check('a payment that arrives after the pack went off sale is still recorded', (select (id is not null and id not like 'ERROR%')::text from pt.second), 'true');
select pt.check('another gym''s pack cannot be bought here', pt.buy(pt.u('m1'), 'd0000000-0000-4000-8000-000000000003', 'pi_three', 3000), 'ERROR:That class pack does not exist at this gym');
select pt.check('a stranger cannot be given a pack', pt.buy(pt.u('stranger'), 'd0000000-0000-4000-8000-000000000001', 'pi_four', 6000), 'ERROR:That person is not a member of this gym');
select pt.check('a missing payment id is refused', pt.buy(pt.u('m1'), 'd0000000-0000-4000-8000-000000000001', '', 6000), 'ERROR:A payment id is needed');
select pt.check('a negative amount is refused', pt.buy(pt.u('m1'), 'd0000000-0000-4000-8000-000000000001', 'pi_neg', -1), 'ERROR:The amount paid is not valid');
select pt.check('the buyer can read their own pack', pt.as_role('authenticated', pt.u('m1'), format('select count(*)::text from public.class_packs where user_id = %L and provider_payment_id = %L', pt.u('m1'), 'pi_one')), '1');

\o
do $$
declare bad integer;
begin
  select count(*) into bad from pt.results where not ok;
  raise notice 'class pack purchase: % checks, % failed', (select count(*) from pt.results), bad;
  if bad > 0 then
    raise exception 'FAILED: %', (select string_agg(seq || ' ' || label || ' [got ' || coalesce(got,'NULL') || ' / want ' || coalesce(want,'NULL') || ']', E'\n') from pt.results where not ok);
  end if;
end $$;
rollback;
