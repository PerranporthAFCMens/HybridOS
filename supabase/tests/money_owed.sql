-- Lift leaderboard: persona tests (rolled back at the end; leaves nothing behind).
-- Runs on a FRESH local database after the migrations are applied (never on the live project).
-- Real queries run as the `authenticated` role with that user's JWT claims, so Row Level Security and the functions
-- are exercised exactly as the app would.
-- Usage:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/money_owed.sql
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
insert into auth.users(id,email) select uid, name||'@owed.invalid' from pt.persona;
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


insert into public.membership_plans(id,gym_id,name,price_pence,billing_interval) values ('c0000000-0000-4000-8000-000000000001',pt.gym_a(),'Basic',3000,'monthly');
-- m1 has an active membership; m2 has none (a member is only a member for these rules while theirs is active).
insert into public.memberships(gym_id,user_id,plan_id,status,starts_on) values (pt.gym_a(), pt.u('m1'), 'c0000000-0000-4000-8000-000000000001', 'active', current_date-30);


update public.profiles set first_name = 'Priya', last_name = 'Nair' where id = pt.u('m1');
update public.profiles set first_name = 'Sam', last_name = 'Lee' where id = pt.u('m2');
update public.profiles set first_name = null, last_name = null, display_name = 'Dee' where id = pt.u('m3');
update public.profiles set first_name = null, last_name = null, display_name = 'Quinn' where id = pt.u('m4');
insert into public.membership_plans(id,gym_id,name,price_pence,billing_interval) values ('c0000000-0000-4000-8000-000000000001',pt.gym_a(),'Basic',3000,'monthly'),('c0000000-0000-4000-8000-000000000002',pt.gym_a(),'Pro',5000,'monthly');
insert into public.memberships(id,gym_id,user_id,plan_id,status,starts_on) values
 ('d0000000-0000-4000-8000-000000000001',pt.gym_a(),pt.u('m1'),'c0000000-0000-4000-8000-000000000001','active',current_date-90),
 ('d0000000-0000-4000-8000-000000000002',pt.gym_a(),pt.u('m2'),'c0000000-0000-4000-8000-000000000002','active',current_date-90),
 ('d0000000-0000-4000-8000-000000000003',pt.gym_a(),pt.u('m3'),'c0000000-0000-4000-8000-000000000001','cancelled',current_date-200),
 ('d0000000-0000-4000-8000-000000000004',pt.gym_a(),pt.u('m4'),'c0000000-0000-4000-8000-000000000001','active',current_date-90),
 ('d0000000-0000-4000-8000-000000000005',pt.gym_a(),pt.u('m5'),'c0000000-0000-4000-8000-000000000001','active',current_date-90);
insert into public.membership_plans(id,gym_id,name,price_pence,billing_interval) values ('c0000000-0000-4000-8000-0000000000b1',pt.gym_b(),'Basic B',3000,'monthly');
insert into public.memberships(id,gym_id,user_id,plan_id,status,starts_on) values ('d0000000-0000-4000-8000-0000000000b1',pt.gym_b(),pt.u('mb'),'c0000000-0000-4000-8000-0000000000b1','active',current_date-90);

-- m1: two failed (7000 owed). m2: one pending well past the grace (5000 owed) and one pending inside it (not owed yet).
-- m3: a charge-back (1500) on a cancelled membership. m4: paid and refunded and cancelled: owes nothing. m5: one failed (2500).
insert into public.payment_records(id,gym_id,membership_id,user_id,provider,amount_pence,state,charge_date,failure_code,failure_message) values
 ('e0000000-0000-4000-8000-000000000001',pt.gym_a(),'d0000000-0000-4000-8000-000000000001',pt.u('m1'),'manual',4000,'failed',current_date-3,'insufficient_funds','Not enough in the account'),
 ('e0000000-0000-4000-8000-000000000002',pt.gym_a(),'d0000000-0000-4000-8000-000000000001',pt.u('m1'),'manual',3000,'failed',current_date-33,'insufficient_funds',null),
 ('e0000000-0000-4000-8000-000000000003',pt.gym_a(),'d0000000-0000-4000-8000-000000000002',pt.u('m2'),'manual',5000,'pending',current_date-10,null,null),
 ('e0000000-0000-4000-8000-000000000004',pt.gym_a(),'d0000000-0000-4000-8000-000000000002',pt.u('m2'),'manual',2000,'pending',current_date-3,null,null),
 ('e0000000-0000-4000-8000-000000000005',pt.gym_a(),'d0000000-0000-4000-8000-000000000003',pt.u('m3'),'manual',1500,'charged_back',current_date-60,'authorisation_disputed',null),
 ('e0000000-0000-4000-8000-000000000006',pt.gym_a(),'d0000000-0000-4000-8000-000000000004',pt.u('m4'),'manual',3000,'paid_out',current_date-3,null,null),
 ('e0000000-0000-4000-8000-000000000007',pt.gym_a(),'d0000000-0000-4000-8000-000000000004',pt.u('m4'),'manual',3000,'refunded',current_date-40,null,null),
 ('e0000000-0000-4000-8000-000000000008',pt.gym_a(),'d0000000-0000-4000-8000-000000000004',pt.u('m4'),'manual',3000,'cancelled',current_date-70,null,null),
 ('e0000000-0000-4000-8000-000000000009',pt.gym_a(),'d0000000-0000-4000-8000-000000000005',pt.u('m5'),'manual',2500,'failed',current_date-5,'refer_to_payer',null),
 ('e0000000-0000-4000-8000-0000000000b1',pt.gym_b(),'d0000000-0000-4000-8000-0000000000b1',pt.u('mb'),'manual',9900,'failed',current_date-2,'x',null);

create function pt.arrears(uid uuid, gym uuid) returns text language sql as $$
  select pt.q(uid, format($s$select coalesce(string_agg(display_name || ':' || owed_pence || ':' || missed_count, ' | ' order by owed_pence desc, display_name), '') from public.get_gym_arrears(%L)$s$, gym)) $$;
create function pt.settle(uid uuid, gym uuid, pay uuid, how text, note text default null) returns text language sql as $$
  select pt.q(uid, format($s$select public.settle_missed_payment(%L, %L, %L, %L)::text$s$, gym, pay, how, note)) $$;
create function pt.pid(n int) returns uuid language sql as $$ select ('e0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;

-- ---------- who is not financial ----------
select pt.check('an owner sees everyone who owes, biggest debt first', pt.arrears(pt.u('owner_a'), pt.gym_a()), 'Priya Nair:7000:2 | Sam Lee:5000:1 | m5:2500:1 | Dee:1500:1');

select pt.check('an admin sees the same', pt.arrears(pt.u('admin_a'), pt.gym_a()), 'Priya Nair:7000:2 | Sam Lee:5000:1 | m5:2500:1 | Dee:1500:1');
select pt.check('a payment still inside the grace period is not owed (Sam owes the 50.00 only)', pt.q(pt.u('owner_a'), format($s$select owed_pence from public.get_gym_arrears(%L) where display_name = 'Sam Lee'$s$, pt.gym_a())), '5000');
select pt.check('a charge-back on a cancelled membership still counts', pt.q(pt.u('owner_a'), format($s$select owed_pence || ':' || membership_status from public.get_gym_arrears(%L) where display_name = 'Dee'$s$, pt.gym_a())), '1500:cancelled');
select pt.check('paid, refunded and cancelled payments are not owed (Quinn is financial)', pt.q(pt.u('owner_a'), format($s$select count(*) from public.get_gym_arrears(%L) where display_name = 'Quinn'$s$, pt.gym_a())), '0');
select pt.check('the plan, the oldest missed date and the reason come with it', pt.q(pt.u('owner_a'), format($s$select plan_name || ':' || (current_date - oldest_missed) || ':' || latest_reason from public.get_gym_arrears(%L) where display_name = 'Priya Nair'$s$, pt.gym_a())), 'Basic:33:Not enough in the account');
select pt.check('staff cannot see money owed', pt.arrears(pt.u('staff_a'), pt.gym_a()) like 'ERROR:%Only an owner or admin%', true);
select pt.check('a coach cannot', pt.arrears(pt.u('coach_a'), pt.gym_a()) like 'ERROR:%Only an owner or admin%', true);
select pt.check('a member cannot see anyone''s, not even their own', pt.arrears(pt.u('m1'), pt.gym_a()) like 'ERROR:%Only an owner or admin%', true);
select pt.check('another gym''s admin cannot see this gym''s', pt.arrears(pt.u('admin_b'), pt.gym_a()) like 'ERROR:%Only an owner or admin%', true);
select pt.check('and this gym''s admin sees nothing of the other gym', pt.arrears(pt.u('admin_a'), pt.gym_b()) like 'ERROR:%Only an owner or admin%', true);
select pt.check('the other gym sees only its own debtor', pt.arrears(pt.u('admin_b'), pt.gym_b()), 'mb:9900:1');
select pt.check('someone not signed in cannot ask', pt.anon(format($s$select count(*) from public.get_gym_arrears(%L)$s$, pt.gym_a())) like 'ERROR:%', true);

-- ---------- one person's missed payments ----------
select pt.check('Priya''s missed payments, newest first, with the reason', pt.q(pt.u('owner_a'), format($s$select string_agg(amount_pence || ':' || state || ':' || outstanding || ':' || coalesce(reason, '-'), ' | ' order by charge_date desc) from public.get_member_missed_payments(%L, %L)$s$, pt.gym_a(), pt.u('m1'))), '4000:failed:true:Not enough in the account | 3000:failed:true:insufficient_funds');
select pt.check('Sam''s list holds only the overdue one', pt.q(pt.u('owner_a'), format($s$select count(*) from public.get_member_missed_payments(%L, %L)$s$, pt.gym_a(), pt.u('m2'))), '1');
select pt.check('someone who owes nothing has an empty list', pt.q(pt.u('owner_a'), format($s$select count(*) from public.get_member_missed_payments(%L, %L)$s$, pt.gym_a(), pt.u('m4'))), '0');
select pt.check('staff cannot open a person''s missed payments', pt.q(pt.u('staff_a'), format($s$select count(*) from public.get_member_missed_payments(%L, %L)$s$, pt.gym_a(), pt.u('m1'))) like 'ERROR:%', true);
select pt.check('a member cannot open their own', pt.q(pt.u('m1'), format($s$select count(*) from public.get_member_missed_payments(%L, %L)$s$, pt.gym_a(), pt.u('m1'))) like 'ERROR:%', true);
select pt.check('another gym cannot', pt.q(pt.u('admin_b'), format($s$select count(*) from public.get_member_missed_payments(%L, %L)$s$, pt.gym_a(), pt.u('m1'))) like 'ERROR:%', true);

-- ---------- settling ----------
select pt.check('staff cannot settle a payment', pt.settle(pt.u('staff_a'), pt.gym_a(), pt.pid(9), 'paid') like 'ERROR:%Only an owner or admin%', true);
select pt.check('a member cannot settle their own', pt.settle(pt.u('m5'), pt.gym_a(), pt.pid(9), 'waived') like 'ERROR:%Only an owner or admin%', true);
select pt.check('another gym cannot settle it', pt.settle(pt.u('admin_b'), pt.gym_a(), pt.pid(9), 'paid') like 'ERROR:%Only an owner or admin%', true);
select pt.check('the other gym''s admin cannot settle this gym''s payment by naming their own gym', pt.settle(pt.u('admin_b'), pt.gym_b(), pt.pid(9), 'paid'), 'ERROR:That payment is not outstanding');
select pt.check('a made-up way of settling is refused', pt.settle(pt.u('admin_a'), pt.gym_a(), pt.pid(9), 'forgotten') like 'ERROR:Choose paid, waived or written off%', true);
select pt.check('a payment that is not missed cannot be settled', pt.settle(pt.u('admin_a'), pt.gym_a(), pt.pid(6), 'paid'), 'ERROR:That payment is not outstanding');
select pt.check('a payment still inside the grace period cannot be settled', pt.settle(pt.u('admin_a'), pt.gym_a(), pt.pid(4), 'paid'), 'ERROR:That payment is not outstanding');
select pt.check('an admin can mark a payment paid some other way', pt.settle(pt.u('admin_a'), pt.gym_a(), pt.pid(9), 'paid', 'Cash at the desk 12 Oct'), '');
select pt.check('...and the person is financial again', pt.arrears(pt.u('owner_a'), pt.gym_a()), 'Priya Nair:7000:2 | Sam Lee:5000:1 | Dee:1500:1');
select pt.check('it cannot be settled twice', pt.settle(pt.u('admin_a'), pt.gym_a(), pt.pid(9), 'waived'), 'ERROR:That payment is not outstanding');
select pt.check('the history keeps who, how and the note', pt.q(pt.u('owner_a'), format($s$select settled_how || ':' || settled_note || ':' || outstanding from public.get_member_missed_payments(%L, %L)$s$, pt.gym_a(), pt.u('m5'))), 'paid:Cash at the desk 12 Oct:false');
select pt.check('the name of whoever settled it is kept', pt.q(pt.u('owner_a'), format($s$select settled_by_name from public.get_member_missed_payments(%L, %L)$s$, pt.gym_a(), pt.u('m5'))), 'admin_a');
select pt.check('the person themselves cannot read the settlement note', pt.q(pt.u('m5'), format($s$select count(*) from public.payment_settlements where gym_id = %L$s$, pt.gym_a())), '0');
select pt.check('staff cannot read settlements', pt.q(pt.u('staff_a'), format($s$select count(*) from public.payment_settlements where gym_id = %L$s$, pt.gym_a())), '0');
select pt.check('an owner can read settlements directly', pt.q(pt.u('owner_a'), format($s$select count(*) from public.payment_settlements where gym_id = %L$s$, pt.gym_a())), '1');
select pt.check('nobody can write a settlement directly', pt.q(pt.u('owner_a'), format($s$insert into public.payment_settlements(payment_id, gym_id, how) values (%L, %L, 'paid') returning 1$s$, pt.pid(1), pt.gym_a())) like 'ERROR:%', true);
select pt.check('a written-off payment also clears the debt', pt.settle(pt.u('owner_a'), pt.gym_a(), pt.pid(5), 'written_off', 'Not worth chasing'), '');
select pt.check('...so Dee is financial', pt.arrears(pt.u('owner_a'), pt.gym_a()), 'Priya Nair:7000:2 | Sam Lee:5000:1');
select pt.check('a very long note is cut to 500 characters', (select (pt.settle(pt.u('owner_a'), pt.gym_a(), pt.pid(2), 'waived', repeat('x', 900))) = ''), true);
select pt.check('...and kept', pt.q(pt.u('owner_a'), format($s$select char_length(settled_note) from public.get_member_missed_payments(%L, %L) where settled_how = 'waived'$s$, pt.gym_a(), pt.u('m1'))), '500');

-- ---------- reopening ----------
select pt.check('staff cannot reopen', pt.q(pt.u('staff_a'), format($s$select public.reopen_missed_payment(%L, %L)::text$s$, pt.gym_a(), pt.pid(9))) like 'ERROR:%Only an owner or admin%', true);
select pt.check('an admin can put a settled payment back', pt.q(pt.u('admin_a'), format($s$select public.reopen_missed_payment(%L, %L)::text$s$, pt.gym_a(), pt.pid(9))), '');
select pt.check('...and the debt is back', pt.arrears(pt.u('owner_a'), pt.gym_a()), 'Sam Lee:5000:1 | Priya Nair:4000:1 | m5:2500:1');
select pt.check('reopening one that was never settled is refused', pt.q(pt.u('admin_a'), format($s$select public.reopen_missed_payment(%L, %L)::text$s$, pt.gym_a(), pt.pid(1))), 'ERROR:That payment has not been settled');
select pt.check('another gym cannot reopen this gym''s', pt.q(pt.u('admin_b'), format($s$select public.reopen_missed_payment(%L, %L)::text$s$, pt.gym_b(), pt.pid(2))), 'ERROR:That payment has not been settled');

-- ---------- the grace period ----------
select pt.check('the grace period starts at 7 days', pt.q(pt.u('admin_a'), format($s$insert into public.gym_payment_settings(gym_id) values (%L) on conflict (gym_id) do update set updated_at = now() returning overdue_grace_days$s$, pt.gym_a())), '7');
select pt.check('a gym can make it shorter: Sam''s newer pending payment is now overdue too', pt.q(pt.u('admin_a'), format($s$update public.gym_payment_settings set overdue_grace_days = 2 where gym_id = %L returning overdue_grace_days$s$, pt.gym_a())), '2');
select pt.check('...and Sam owes both', pt.q(pt.u('owner_a'), format($s$select owed_pence || ':' || missed_count from public.get_gym_arrears(%L) where display_name = 'Sam Lee'$s$, pt.gym_a())), '7000:2');
select pt.check('a grace period of more than 90 days is refused', pt.q(pt.u('admin_a'), format($s$update public.gym_payment_settings set overdue_grace_days = 91 where gym_id = %L returning 1$s$, pt.gym_a())) like 'ERROR:%', true);
select pt.check('a negative one is refused', pt.q(pt.u('admin_a'), format($s$update public.gym_payment_settings set overdue_grace_days = -1 where gym_id = %L returning 1$s$, pt.gym_a())) like 'ERROR:%', true);

\o
do $$
declare bad integer;
begin
  select count(*) into bad from pt.results where not ok;
  raise notice 'money owed: % checks, % failed', (select count(*) from pt.results), bad;
  if bad > 0 then
    raise exception 'FAILED: %', (select string_agg(seq || ' ' || label || ' [got ' || coalesce(got,'NULL') || ' / want ' || coalesce(want,'NULL') || ']', E'\n') from pt.results where not ok);
  end if;
end $$;
rollback;
