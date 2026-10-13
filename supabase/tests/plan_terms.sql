-- Plan terms: persona tests (rolled back at the end; leaves nothing behind).
-- Runs on a FRESH local database after the migrations are applied (never on the live project).
-- Real queries run as the `authenticated` role with that user's JWT claims, so Row Level Security and the functions
-- are exercised exactly as the app would.
-- Usage:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/plan_terms.sql
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
create function pt.today() returns date language sql as $$ select private.gym_today() $$;

-- Gym A's rules: members may cancel, 30 days notice, no minimum term, an admin decides.
insert into public.membership_rules(gym_id, cancel_enabled, cancel_notice_days, cancel_min_term_months, cancel_early_mode, cancel_ask_reason, cancel_approval)
values (pt.gym_a(), true, 30, 0, 'wait', false, 'admin');
-- Plans: P1 has its own terms (6 months, 14 days), P2 has none (uses the gym rule), P3 is a 12 month plan with 60 days notice.
insert into public.membership_plans(id, gym_id, name, price_pence, billing_interval, is_active, is_public, min_term_months, notice_days) values
 (pt.plan(1), pt.gym_a(), 'Six month', 4000, 'monthly', true, true, 6, 14),
 (pt.plan(2), pt.gym_a(), 'Rolling', 3000, 'monthly', true, true, null, null),
 (pt.plan(3), pt.gym_a(), 'Annual deal', 3500, 'monthly', true, true, 12, 60);
insert into public.memberships(gym_id, user_id, plan_id, status, starts_on) values
 (pt.gym_a(), pt.u('m1'), pt.plan(1), 'active', pt.today()),
 (pt.gym_a(), pt.u('m2'), pt.plan(2), 'active', pt.today()),
 (pt.gym_a(), pt.u('m3'), pt.plan(2), 'active', pt.today()),
 (pt.gym_a(), pt.u('m4'), pt.plan(3), 'active', pt.today()),
 (pt.gym_a(), pt.u('m5'), pt.plan(2), 'active', pt.today());

-- ---------- terms travel with the membership ----------
select pt.check('a membership takes its plan''s terms when it starts', (select term_months || ':' || notice_days from public.memberships where user_id = pt.u('m1')), '6:14');
select pt.check('a plan with no terms leaves the membership on the gym rule', (select coalesce(term_months::text, 'rule') || ':' || coalesce(notice_days::text, 'rule') from public.memberships where user_id = pt.u('m2')), 'rule:rule');
select pt.check('the sign-up page is told each plan''s terms (own, else the gym rule)', (select string_agg(p->>'name' || '=' || coalesce(p->>'min_term_months', '-') || '/' || coalesce(p->>'notice_days', '-'), ', ' order by p->>'name') from jsonb_array_elements((public.get_public_gym_join_options('tr-a'))->'plans') p), 'Annual deal=12/60, Rolling=0/30, Six month=6/14');
select pt.check('the payment step is told the plan''s terms', (public.stripe_join_context(pt.gym_a(), pt.u('m1'), pt.plan(1))) #>> '{plan,min_term_months}', '6');

-- ---------- a member leaving: own terms, else the gym rule ----------
select pt.check('a member on a 6 month, 14 day plan asks to leave: last day follows the 6 month term', pt.q(pt.u('m1'), format($s$select (public.request_membership_cancel(%L, 'moving'))::text$s$, (select id from public.memberships where user_id = pt.u('m1')))) not like 'ERROR:%', true);
select pt.check('...the earliest end is after the term, not after the 14 days', (select effective_on::text from public.membership_requests where user_id = pt.u('m1') and kind = 'cancel'), ((pt.today() + interval '6 months')::date + 1)::text);
select pt.check('a member on the gym rule gets the gym''s 30 days', pt.q(pt.u('m2'), format($s$select (public.request_membership_cancel(%L, 'moving'))::text$s$, (select id from public.memberships where user_id = pt.u('m2')))) not like 'ERROR:%', true);
select pt.check('...30 days notice', (select effective_on::text from public.membership_requests where user_id = pt.u('m2') and kind = 'cancel'), (pt.today() + 31)::text);
update public.membership_rules set cancel_notice_days = 10 where gym_id = pt.gym_a();
select pt.check('changing the gym rule changes it for members on the rule', pt.q(pt.u('m3'), format($s$select (public.get_my_membership_options(%L))->'cancel'->>'notice_days'$s$, pt.gym_a())), '10');
select pt.check('...but not for a member on their own plan terms', pt.q(pt.u('m4'), format($s$select (public.get_my_membership_options(%L))->'cancel'->>'notice_days'$s$, pt.gym_a())), '60');
select pt.check('...and they see their term too', pt.q(pt.u('m4'), format($s$select (public.get_my_membership_options(%L))->'cancel'->>'min_term_months'$s$, pt.gym_a())), '12');

-- ---------- staff override: ends the membership, with a reason ----------
select pt.check('a member cannot use the staff function', pt.q(pt.u('m3'), format($s$select public.staff_end_membership(%L, null, 'because')::text$s$, (select id from public.memberships where user_id = pt.u('m3')))), 'ERROR:Owner or admin access required');
select pt.check('staff (not admin) cannot either', pt.q(pt.u('staff_a'), format($s$select public.staff_end_membership(%L, null, 'because')::text$s$, (select id from public.memberships where user_id = pt.u('m3')))), 'ERROR:Owner or admin access required');
select pt.check('another gym''s admin cannot', pt.q(pt.u('admin_b'), format($s$select public.staff_end_membership(%L, null, 'because')::text$s$, (select id from public.memberships where user_id = pt.u('m3')))), 'ERROR:Owner or admin access required');
select pt.check('a reason is required', pt.q(pt.u('admin_a'), format($s$select public.staff_end_membership(%L, null, '  ')::text$s$, (select id from public.memberships where user_id = pt.u('m3')))), 'ERROR:Give a reason (a few words is fine)');
select pt.check('an admin ends it today', pt.q(pt.u('admin_a'), format($s$select public.staff_end_membership(%L, null, 'Moved away, agreed at the desk')::text$s$, (select id from public.memberships where user_id = pt.u('m3')))) not like 'ERROR:%', true);
select pt.check('...the membership is cancelled now', (select status::text || ':' || ends_on::text from public.memberships where user_id = pt.u('m3')), 'cancelled:' || pt.today()::text);
select pt.check('...and the reason is on the record', (select reason from public.membership_staff_actions where membership_id = (select id from public.memberships where user_id = pt.u('m3'))), 'Moved away, agreed at the desk');
select pt.check('ending it on a date keeps it active until then', pt.q(pt.u('admin_a'), format($s$select public.staff_end_membership(%L, %L, 'Injury, last day agreed')::text$s$, (select id from public.memberships where user_id = pt.u('m5')), (pt.today() + 10)::text)) not like 'ERROR:%', true);
select pt.check('...still active today, request ready for its date', (select m.status::text || ':' || q.status || ':' || q.effective_on::text from public.memberships m join public.membership_requests q on q.membership_id = m.id and q.kind = 'cancel' where m.user_id = pt.u('m5')), 'active:approved:' || (pt.today() + 11)::text);
select pt.check('a date in the past is refused', pt.q(pt.u('admin_a'), format($s$select public.staff_end_membership(%L, %L, 'Late')::text$s$, (select id from public.memberships where user_id = pt.u('m4')), (pt.today() - 1)::text)), 'ERROR:Choose a last day from today onwards');
select pt.check('ending a member''s membership replaces a cancellation they had asked for', (select count(*) from public.membership_requests where membership_id = (select id from public.memberships where user_id = pt.u('m2')) and kind = 'cancel' and status = 'pending')::text, '1');
select pt.check('...(an admin ending m2 withdraws their waiting request)', pt.q(pt.u('admin_a'), format($s$select public.staff_end_membership(%L, null, 'Agreed at desk')::text$s$, (select id from public.memberships where user_id = pt.u('m2')))) not like 'ERROR:%', true);
select pt.check('...none left waiting', (select count(*) from public.membership_requests where membership_id = (select id from public.memberships where user_id = pt.u('m2')) and kind = 'cancel' and status = 'pending')::text, '0');

-- ---------- release from term ----------
select pt.check('a member cannot release themselves', pt.q(pt.u('m1'), format($s$select public.staff_release_from_term(%L, 'please')::text$s$, (select id from public.memberships where user_id = pt.u('m1')))), 'ERROR:Owner or admin access required');
select pt.check('a reason is required to release', pt.q(pt.u('admin_a'), format($s$select public.staff_release_from_term(%L, '')::text$s$, (select id from public.memberships where user_id = pt.u('m1')))), 'ERROR:Give a reason (a few words is fine)');
select pt.check('an admin releases a member from their term', pt.q(pt.u('admin_a'), format($s$select public.staff_release_from_term(%L, 'Goodwill, long illness')::text$s$, (select id from public.memberships where user_id = pt.u('m1')))) not like 'ERROR:%', true);
select pt.check('...their term is now 0', (select term_months::text from public.memberships where user_id = pt.u('m1')), '0');
select pt.check('...they can take back their old request and ask again: only their 14 days apply', pt.q(pt.u('m1'), format($s$select public.withdraw_membership_request(%L)::text$s$, (select id from public.membership_requests where user_id = pt.u('m1') and kind = 'cancel' and status = 'pending'))) not like 'ERROR:%', true);
select pt.check('...asking again', pt.q(pt.u('m1'), format($s$select (public.request_membership_cancel(%L, 'again'))::text$s$, (select id from public.memberships where user_id = pt.u('m1')))) not like 'ERROR:%', true);
select pt.check('...ends after 14 days notice', (select effective_on::text from public.membership_requests where user_id = pt.u('m1') and kind = 'cancel' and status = 'pending'), (pt.today() + 15)::text);

-- ---------- passing a plan's terms to existing members: only if better ----------
update public.membership_plans set min_term_months = 6, notice_days = 30 where id = pt.plan(3);
select pt.check('a member cannot pass terms on', pt.q(pt.u('m4'), format($s$select public.apply_plan_terms_to_members(%L, 'goodwill')::text$s$, pt.plan(3))), 'ERROR:Owner or admin access required');
select pt.check('another gym''s admin cannot', pt.q(pt.u('admin_b'), format($s$select public.apply_plan_terms_to_members(%L, 'goodwill')::text$s$, pt.plan(3))), 'ERROR:Owner or admin access required');
select pt.check('a reason is required', pt.q(pt.u('admin_a'), format($s$select public.apply_plan_terms_to_members(%L, 'x')::text$s$, pt.plan(3))), 'ERROR:Give a reason (a few words is fine)');
select pt.check('shorter terms are passed on to the existing member (1 changed)', pt.q(pt.u('admin_a'), format($s$select public.apply_plan_terms_to_members(%L, 'Shorter term for everyone')::text$s$, pt.plan(3))), '1');
select pt.check('...they now have 6 months and 30 days', (select term_months || ':' || notice_days from public.memberships where user_id = pt.u('m4')), '6:30');
update public.membership_plans set min_term_months = 24, notice_days = 90 where id = pt.plan(3);
select pt.check('longer terms are NOT passed on (0 changed)', pt.q(pt.u('admin_a'), format($s$select public.apply_plan_terms_to_members(%L, 'Longer term, new joiners only')::text$s$, pt.plan(3))), '0');
select pt.check('...the member keeps the better terms', (select term_months || ':' || notice_days from public.memberships where user_id = pt.u('m4')), '6:30');
insert into public.memberships(gym_id, user_id, plan_id, status, starts_on) values (pt.gym_a(), pt.u('m6'), pt.plan(3), 'active', pt.today());
select pt.check('a new joiner on that plan gets the new, longer terms', (select term_months || ':' || notice_days from public.memberships where user_id = pt.u('m6')), '24:90');

-- ---------- what the Stripe function is told ----------
select pt.check('the Stripe state shows a staff-dated ending as waiting', (public.stripe_membership_state((select id from public.memberships where user_id = pt.u('m5')))) #>> '{cancel,status}', 'approved');
select pt.check('...and an ended membership as cancelled', (public.stripe_membership_state((select id from public.memberships where user_id = pt.u('m3')))) #>> '{membership,status}', 'cancelled');
select pt.check('...and a member with nothing waiting has no cancel', (public.stripe_membership_state((select id from public.memberships where user_id = pt.u('m6')))) -> 'cancel' = 'null'::jsonb, true);
select pt.check('a signed-in person cannot ask Stripe''s question', pt.q(pt.u('admin_a'), format($s$select public.stripe_membership_state(%L)::text$s$, (select id from public.memberships where user_id = pt.u('m5')))) like 'ERROR:%permission denied%', true);

-- ---------- who can read the log ----------
select pt.check('an admin reads the staff actions', pt.q(pt.u('admin_a'), format($s$select count(*) > 0 from public.membership_staff_actions where gym_id = %L$s$, pt.gym_a())), 'true');
select pt.check('a member reads none', pt.q(pt.u('m1'), format($s$select count(*) from public.membership_staff_actions where gym_id = %L$s$, pt.gym_a())), '0');
select pt.check('staff read none', pt.q(pt.u('staff_a'), format($s$select count(*) from public.membership_staff_actions where gym_id = %L$s$, pt.gym_a())), '0');
select pt.check('another gym reads none', pt.q(pt.u('admin_b'), format($s$select count(*) from public.membership_staff_actions where gym_id = %L$s$, pt.gym_a())), '0');
select pt.check('nobody can write to the log directly', pt.q(pt.u('admin_a'), format($s$insert into public.membership_staff_actions(gym_id, action, reason, done_by) values (%L, 'end_membership', 'fake reason', %L) returning 1$s$, pt.gym_a(), pt.u('admin_a'))) like 'ERROR:%', true);
select pt.check('someone not signed in cannot use the staff functions', pt.anon(format($s$select public.staff_end_membership(%L, null, 'abc')::text$s$, gen_random_uuid())) like 'ERROR:%', true);

\o
do $$
declare bad integer;
begin
  select count(*) into bad from pt.results where not ok;
  raise notice 'plan terms: % checks, % failed', (select count(*) from pt.results), bad;
  if bad > 0 then
    raise exception 'FAILED: %', (select string_agg(seq || ' ' || label || ' [got ' || coalesce(got,'NULL') || ' / want ' || coalesce(want,'NULL') || ']', E'\n') from pt.results where not ok);
  end if;
end $$;
rollback;
