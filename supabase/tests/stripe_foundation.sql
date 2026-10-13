-- Lift leaderboard: persona tests (rolled back at the end; leaves nothing behind).
-- Runs on a FRESH local database after the migrations are applied (never on the live project).
-- Real queries run as the `authenticated` role with that user's JWT claims, so Row Level Security and the functions
-- are exercised exactly as the app would.
-- Usage:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/stripe_foundation.sql
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
insert into auth.users(id,email) select uid, name||'@stripe.invalid' from pt.persona;
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


create function pt.sql(uid uuid, stmt text) returns text language sql as $$ select pt.q(uid, stmt) $$;
create function pt.set_on(uid uuid, gym uuid, on_ boolean) returns text language sql as $$
  select pt.q(uid, format($s$insert into public.gym_payment_settings(gym_id, payments_enabled) values (%L, %L) on conflict (gym_id) do update set payments_enabled = excluded.payments_enabled returning payments_enabled$s$, gym, on_)) $$;

-- ---------- before Stripe is linked ----------
select pt.check('payments cannot be turned on before Stripe is linked (owner)', pt.set_on(pt.u('owner_a'), pt.gym_a(), true) like 'ERROR:%Link your Stripe account%', true);
select pt.check('...nor by an admin', pt.set_on(pt.u('admin_a'), pt.gym_a(), true) like 'ERROR:%Link your Stripe account%', true);
select pt.check('an owner can save the settings with payments off', pt.set_on(pt.u('owner_a'), pt.gym_a(), false), 'false');
select pt.check('the cancellation window defaults to 24 hours', pt.q(pt.u('owner_a'), format($s$select cancellation_hours from public.gym_payment_settings where gym_id = %L$s$, pt.gym_a())), '24');

-- ---------- linking: only the service writes it ----------
select pt.check('an owner cannot write the Stripe link themselves', pt.q(pt.u('owner_a'), format($s$insert into public.gym_stripe_accounts(gym_id, stripe_account_id, charges_enabled) values (%L, 'acct_FAKE1', true) returning 1$s$, pt.gym_a())) like 'ERROR:%', true);
insert into public.gym_stripe_accounts(gym_id, stripe_account_id, environment, details_submitted, charges_enabled) values (pt.gym_a(), 'acct_TEST1', 'sandbox', true, false);
select pt.check('a half-finished Stripe link still does not allow payments', pt.set_on(pt.u('owner_a'), pt.gym_a(), true) like 'ERROR:%Link your Stripe account%', true);
update public.gym_stripe_accounts set charges_enabled = true where gym_id = pt.gym_a();
select pt.check('once Stripe says charges are enabled the owner can turn payments on', pt.set_on(pt.u('owner_a'), pt.gym_a(), true), 'true');
select pt.check('and off again', pt.set_on(pt.u('admin_a'), pt.gym_a(), false), 'false');

-- ---------- who can see and change what ----------
select pt.check('an owner can read the Stripe link', pt.q(pt.u('owner_a'), format($s$select stripe_account_id from public.gym_stripe_accounts where gym_id = %L$s$, pt.gym_a())), 'acct_TEST1');
select pt.check('an admin can read the Stripe link', pt.q(pt.u('admin_a'), format($s$select stripe_account_id from public.gym_stripe_accounts where gym_id = %L$s$, pt.gym_a())), 'acct_TEST1');
select pt.check('staff cannot see the Stripe link', pt.q(pt.u('staff_a'), format($s$select count(*) from public.gym_stripe_accounts where gym_id = %L$s$, pt.gym_a())), '0');
select pt.check('a member cannot see the Stripe link', pt.q(pt.u('m1'), format($s$select count(*) from public.gym_stripe_accounts where gym_id = %L$s$, pt.gym_a())), '0');
select pt.check('another gym cannot see the Stripe link', pt.q(pt.u('admin_b'), format($s$select count(*) from public.gym_stripe_accounts where gym_id = %L$s$, pt.gym_a())), '0');
select pt.check('a member can read the gym''s payment settings', pt.q(pt.u('m1'), format($s$select cancellation_hours from public.gym_payment_settings where gym_id = %L$s$, pt.gym_a())), '24');
select pt.check('...but not change them', pt.q(pt.u('m1'), format($s$update public.gym_payment_settings set cancellation_hours = 1 where gym_id = %L returning 1$s$, pt.gym_a())), null);
select pt.check('a member cannot switch payments on', pt.q(pt.u('m1'), format($s$update public.gym_payment_settings set payments_enabled = true where gym_id = %L returning 1$s$, pt.gym_a())), null);
select pt.check('staff cannot change the settings', pt.q(pt.u('staff_a'), format($s$update public.gym_payment_settings set cancellation_hours = 2 where gym_id = %L returning 1$s$, pt.gym_a())), null);
select pt.check('another gym''s admin cannot change them', pt.q(pt.u('admin_b'), format($s$update public.gym_payment_settings set cancellation_hours = 2 where gym_id = %L returning 1$s$, pt.gym_a())), null);
select pt.check('another gym''s members cannot read them', pt.q(pt.u('mb'), format($s$select count(*) from public.gym_payment_settings where gym_id = %L$s$, pt.gym_a())), '0');
select pt.check('an admin can set the cancellation window', pt.q(pt.u('admin_a'), format($s$update public.gym_payment_settings set cancellation_hours = 48 where gym_id = %L returning cancellation_hours$s$, pt.gym_a())), '48');
select pt.check('a cancellation window of 0 (no notice needed) is allowed', pt.q(pt.u('admin_a'), format($s$update public.gym_payment_settings set cancellation_hours = 0 where gym_id = %L returning cancellation_hours$s$, pt.gym_a())), '0');
select pt.check('a negative window is refused', pt.q(pt.u('admin_a'), format($s$update public.gym_payment_settings set cancellation_hours = -1 where gym_id = %L returning 1$s$, pt.gym_a())) like 'ERROR:%', true);
select pt.check('a window over 30 days is refused', pt.q(pt.u('admin_a'), format($s$update public.gym_payment_settings set cancellation_hours = 721 where gym_id = %L returning 1$s$, pt.gym_a())) like 'ERROR:%', true);
select pt.check('someone not signed in sees nothing', pt.anon(format($s$select count(*) from public.gym_payment_settings where gym_id = %L$s$, pt.gym_a())) like 'ERROR:%', true);
select pt.check('...and cannot read the Stripe link', pt.anon(format($s$select count(*) from public.gym_stripe_accounts where gym_id = %L$s$, pt.gym_a())) like 'ERROR:%', true);

\o
do $$
declare bad integer;
begin
  select count(*) into bad from pt.results where not ok;
  raise notice 'stripe foundation: % checks, % failed', (select count(*) from pt.results), bad;
  if bad > 0 then
    raise exception 'FAILED: %', (select string_agg(seq || ' ' || label || ' [got ' || coalesce(got,'NULL') || ' / want ' || coalesce(want,'NULL') || ']', E'\n') from pt.results where not ok);
  end if;
end $$;
rollback;
