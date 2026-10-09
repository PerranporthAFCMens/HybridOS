-- Membership rules: persona tests (rolled back at the end; leaves nothing behind).
-- Runs on a FRESH local database after the migrations are applied (never on the live project).
-- Real queries run as the `authenticated` role with that user's JWT claims, so Row Level Security and the functions
-- are exercised exactly as the app would.
-- Usage:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/membership_rules.sql
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
 ('owner_a','00000000-0000-4000-8000-000000000001'), ('admin_a','00000000-0000-4000-8000-000000000002'), ('staff_a','00000000-0000-4000-8000-000000000003'),
 ('m1','00000000-0000-4000-8000-000000000011'), ('m2','00000000-0000-4000-8000-000000000012'), ('m3','00000000-0000-4000-8000-000000000013'),
 ('admin_b','00000000-0000-4000-8000-000000000022'), ('mb','00000000-0000-4000-8000-000000000021');
insert into auth.users(id,email) select uid, name||'@rules.invalid' from pt.persona;
insert into public.profiles(id,display_name) select uid,name from pt.persona on conflict (id) do nothing;

create function pt.u(n text) returns uuid language sql as $$ select uid from pt.persona where name = n $$;
create function pt.gym_a() returns uuid language sql as $$ select 'a0000000-0000-4000-8000-00000000000a'::uuid $$;
create function pt.gym_b() returns uuid language sql as $$ select 'b0000000-0000-4000-8000-00000000000b'::uuid $$;

insert into public.gyms(id,name,slug,created_by) values (pt.gym_a(),'Rules Gym A','rules-a',pt.u('owner_a')),(pt.gym_b(),'Rules Gym B','rules-b',pt.u('admin_b'));
insert into public.gym_members(gym_id,user_id,role,is_active,access_status) values
 (pt.gym_a(),pt.u('owner_a'),'owner',true,'active'),(pt.gym_a(),pt.u('admin_a'),'admin',true,'active'),(pt.gym_a(),pt.u('staff_a'),'staff',true,'active'),
 (pt.gym_a(),pt.u('m1'),'member',true,'active'),(pt.gym_a(),pt.u('m2'),'member',true,'active'),(pt.gym_a(),pt.u('m3'),'member',true,'active'),
 (pt.gym_b(),pt.u('admin_b'),'owner',true,'active'),(pt.gym_b(),pt.u('mb'),'member',true,'active');

insert into public.membership_plans(id,gym_id,name,price_pence,billing_interval,members_can_switch_to) values
 ('c0000000-0000-4000-8000-000000000001',pt.gym_a(),'Basic',3000,'monthly',true),
 ('c0000000-0000-4000-8000-000000000002',pt.gym_a(),'Plus',4500,'monthly',true),
 ('c0000000-0000-4000-8000-000000000003',pt.gym_a(),'Elite',6000,'monthly',false),
 ('c0000000-0000-4000-8000-000000000004',pt.gym_a(),'Annual',36000,'annual',true),
 ('c0000000-0000-4000-8000-000000000005',pt.gym_b(),'B plan',2000,'monthly',true);
-- m1 joined long ago; m2 joined today; m3 joined long ago (kept for the approval tests); mb is in the other gym
insert into public.memberships(id,gym_id,user_id,plan_id,status,starts_on,created_at) values
 ('d0000000-0000-4000-8000-000000000001',pt.gym_a(),pt.u('m1'),'c0000000-0000-4000-8000-000000000001','active',current_date-400,now()-interval '400 days'),
 ('d0000000-0000-4000-8000-000000000002',pt.gym_a(),pt.u('m2'),'c0000000-0000-4000-8000-000000000001','active',current_date,now()),
 ('d0000000-0000-4000-8000-000000000003',pt.gym_a(),pt.u('m3'),'c0000000-0000-4000-8000-000000000001','active',current_date-400,now()-interval '400 days'),
 ('d0000000-0000-4000-8000-000000000009',pt.gym_b(),pt.u('mb'),'c0000000-0000-4000-8000-000000000005','active',current_date-100,now()-interval '100 days');

create function pt.mid(n int) returns uuid language sql as $$ select ('d0000000-0000-4000-8000-00000000000'||n)::uuid $$;
create function pt.opt(uid uuid, path text) returns text language sql as $$ select pt.q(uid, format('select (public.get_my_membership_options(%L)) #>> %L', pt.gym_a(), path)) $$;
create function public.private_today_for_tests() returns date language sql as $$ select private.gym_today() $$;
create function pt.d(offset_days int) returns text language sql as $$ select (public.private_today_for_tests() + offset_days)::text $$;

-- ---------- 1. everything is off until an owner switches it on ----------
select pt.check('default: pause not allowed', pt.opt(pt.u('m1'), '{pause,allowed}'), 'false');
select pt.check('default: pause says why', pt.opt(pt.u('m1'), '{pause,reason}'), 'Pausing is not available at this gym.');
select pt.check('default: cancel not allowed', pt.opt(pt.u('m1'), '{cancel,allowed}'), 'false');
select pt.check('default: change not allowed', pt.opt(pt.u('m1'), '{change,allowed}'), 'false');
select pt.check('default: pause request refused', pt.q(pt.u('m1'), format('select public.request_membership_pause(%L, %L::date, %L::date)', pt.mid(1), pt.d(10), pt.d(24))), 'ERROR:Pausing is not available at this gym');
select pt.check('default: cancel request refused', pt.q(pt.u('m1'), format('select public.request_membership_cancel(%L, %L)', pt.mid(1), 'moving')), 'ERROR:Please ask the gym to cancel your membership');

-- ---------- 2. who may read and write the rules ----------
select pt.check('member cannot add rules', pt.q(pt.u('m1'), format('insert into public.membership_rules(gym_id, pause_enabled) values (%L, true) returning gym_id::text', pt.gym_a())), 'ERROR:new row violates row-level security policy for table "membership_rules"');
select pt.check('staff cannot add rules', pt.q(pt.u('staff_a'), format('insert into public.membership_rules(gym_id) values (%L) returning gym_id::text', pt.gym_a())), 'ERROR:new row violates row-level security policy for table "membership_rules"');
select pt.check('another gym''s admin cannot add rules', pt.q(pt.u('admin_b'), format('insert into public.membership_rules(gym_id) values (%L) returning gym_id::text', pt.gym_a())), 'ERROR:new row violates row-level security policy for table "membership_rules"');
select pt.check('an owner can add rules', pt.q(pt.u('owner_a'), format('insert into public.membership_rules(gym_id, pause_enabled, pause_min_weeks, pause_max_weeks, pause_notice_days, pause_max_per_year, pause_fee_pence, pause_approval) values (%L, true, 1, 4, 7, 2, 500, %L) returning gym_id::text', pt.gym_a(), 'auto')), pt.gym_a()::text);
select pt.check('an admin can change rules', pt.q(pt.u('admin_a'), format('with u as (update public.membership_rules set pause_fee_pence = 500 where gym_id = %L returning 1) select count(*)::text from u', pt.gym_a())), '1');
select pt.check('a member cannot read rules directly', pt.q(pt.u('m1'), format('select count(*)::text from public.membership_rules where gym_id = %L', pt.gym_a())), '0');
select pt.check('staff cannot read rules directly', pt.q(pt.u('staff_a'), format('select count(*)::text from public.membership_rules where gym_id = %L', pt.gym_a())), '0');
select pt.check('rules cannot be bad (min above max)', pt.q(pt.u('owner_a'), format('update public.membership_rules set pause_min_weeks = 9 where gym_id = %L returning 1::text', pt.gym_a())), 'ERROR:new row for relation "membership_rules" violates check constraint "membership_rules_pause_weeks_order"');
select pt.check('anonymous cannot ask', pt.anon(format('select public.get_my_membership_options(%L)::text', pt.gym_a())), 'ERROR:permission denied for function get_my_membership_options');

-- ---------- 3. pause, automatic ----------
select pt.check('pause allowed once on', pt.opt(pt.u('m1'), '{pause,allowed}'), 'true');
select pt.check('pause earliest start follows notice', pt.opt(pt.u('m1'), '{pause,earliest_start}'), pt.d(7));
select pt.check('pause with too little notice', pt.q(pt.u('m1'), format('select public.request_membership_pause(%L, %L::date, %L::date)', pt.mid(1), pt.d(3), pt.d(17))), 'ERROR:A pause needs 7 days notice, so it can start from ' || to_char((public.private_today_for_tests() + 7), 'FMDD FMMon YYYY'));
select pt.check('pause too long', pt.q(pt.u('m1'), format('select public.request_membership_pause(%L, %L::date, %L::date)', pt.mid(1), pt.d(10), pt.d(45))), 'ERROR:A pause must be between 1 and 4 weeks');
select pt.check('pause too short', pt.q(pt.u('m1'), format('select public.request_membership_pause(%L, %L::date, %L::date)', pt.mid(1), pt.d(10), pt.d(13))), 'ERROR:A pause must be between 1 and 4 weeks');
select pt.check('pause for someone else''s membership', pt.q(pt.u('m2'), format('select public.request_membership_pause(%L, %L::date, %L::date)', pt.mid(1), pt.d(10), pt.d(24))), 'ERROR:Membership not found');
select pt.check('pause in another gym''s membership', pt.q(pt.u('mb'), format('select public.request_membership_pause(%L, %L::date, %L::date)', pt.mid(1), pt.d(10), pt.d(24))), 'ERROR:Membership not found');
select pt.check('a good pause is accepted', pt.q(pt.u('m1'), format('select (public.request_membership_pause(%L, %L::date, %L::date, %L) is not null)::text', pt.mid(1), pt.d(10), pt.d(24), 'holiday')), 'true');
select pt.check('auto pause waits for its date: membership still active', (select status::text from public.memberships where id = pt.mid(1)), 'active');
select pt.check('auto pause is approved, fee and reason kept', (select status || ' ' || fee_pence || ' ' || reason from public.membership_requests where membership_id = pt.mid(1) and kind = 'pause'), 'approved 500 holiday');
select pt.check('a second pause while one is open', pt.q(pt.u('m1'), format('select public.request_membership_pause(%L, %L::date, %L::date)', pt.mid(1), pt.d(40), pt.d(54))), 'ERROR:You already have a pause or cancellation in progress');
select pt.check('cancel is a separate rule and still off', pt.q(pt.u('m1'), format('select public.request_membership_cancel(%L, %L)', pt.mid(1), 'x')), 'ERROR:Please ask the gym to cancel your membership');
-- the date comes: the pause starts
update public.membership_requests set effective_on = private.gym_today(), until_on = private.gym_today() + 14 where membership_id = pt.mid(1) and kind = 'pause';
select pt.check('options start the pause when its date has come', pt.opt(pt.u('m1'), '{membership,status}'), 'paused');
select pt.check('the request is now applied', (select status from public.membership_requests where membership_id = pt.mid(1) and kind = 'pause'), 'applied');
select pt.check('a paused member cannot pause again', pt.opt(pt.u('m1'), '{pause,reason}'), 'Only an active membership can be paused.');
-- the pause is over
update public.membership_requests set effective_on = private.gym_today() - 14, until_on = private.gym_today() where membership_id = pt.mid(1) and kind = 'pause';
select pt.check('and when it ends the membership is active again', pt.opt(pt.u('m1'), '{membership,status}'), 'active');
select pt.check('the request is marked ended', (select status from public.membership_requests where membership_id = pt.mid(1) and kind = 'pause'), 'ended');
-- a second pause is allowed (max 2 a year), a third is not
select pt.check('a second pause in the year', pt.q(pt.u('m1'), format('select (public.request_membership_pause(%L, %L::date, %L::date) is not null)::text', pt.mid(1), pt.d(30), pt.d(44))), 'true');
update public.membership_requests set status = 'ended' where membership_id = pt.mid(1) and kind = 'pause' and status = 'approved';
select pt.check('a third pause in the year is refused', pt.q(pt.u('m1'), format('select public.request_membership_pause(%L, %L::date, %L::date)', pt.mid(1), pt.d(60), pt.d(74))), 'ERROR:You have used the 2 pauses allowed in a year');
select pt.check('and the options say so', pt.opt(pt.u('m1'), '{pause,reason}'), 'You have used the 2 pauses allowed in a year.');

-- ---------- 4. pause, with an admin deciding ----------
update public.membership_rules set pause_approval = 'admin', pause_max_per_year = 6 where gym_id = pt.gym_a();
select pt.check('pause waiting for an admin', pt.q(pt.u('m3'), format('select public.request_membership_pause(%L, %L::date, %L::date)', pt.mid(3), pt.d(10), pt.d(24))) is not null, true);
select pt.check('it is pending', (select status from public.membership_requests where membership_id = pt.mid(3)), 'pending');
select pt.check('a member cannot approve their own', pt.q(pt.u('m3'), format('select public.decide_membership_request(%L, true)::text', (select id from public.membership_requests where membership_id = pt.mid(3)))), 'ERROR:Owner or admin access required');
select pt.check('staff cannot decide', pt.q(pt.u('staff_a'), format('select public.decide_membership_request(%L, true)::text', (select id from public.membership_requests where membership_id = pt.mid(3)))), 'ERROR:Owner or admin access required');
select pt.check('another gym''s admin cannot decide', pt.q(pt.u('admin_b'), format('select public.decide_membership_request(%L, true)::text', (select id from public.membership_requests where membership_id = pt.mid(3)))), 'ERROR:Owner or admin access required');
select pt.check('an admin declines with a note', pt.q(pt.u('admin_a'), format('select public.decide_membership_request(%L, false, %L)::text', (select id from public.membership_requests where membership_id = pt.mid(3)), 'Busy week, sorry')) is not distinct from '', true);
select pt.check('declined, note kept, who decided', (select status || ' ' || decision_note || ' ' || (decided_by = pt.u('admin_a'))::text from public.membership_requests where membership_id = pt.mid(3)), 'declined Busy week, sorry true');
select pt.check('a declined request cannot be decided again', pt.q(pt.u('admin_a'), format('select public.decide_membership_request(%L, true)::text', (select id from public.membership_requests where membership_id = pt.mid(3)))), 'ERROR:This request is no longer waiting');
select pt.check('the member sees the note', pt.q(pt.u('m3'), format('select (public.get_my_membership_options(%L)) #>> %L', pt.gym_a(), '{requests,0,decision_note}')), 'Busy week, sorry');
select pt.check('a new pause, then withdrawn by the member', pt.q(pt.u('m3'), format('select public.request_membership_pause(%L, %L::date, %L::date)', pt.mid(3), pt.d(12), pt.d(26))) is not null, true);
select pt.check('withdraw', pt.q(pt.u('m3'), format('select public.withdraw_membership_request(%L)::text', (select id from public.membership_requests where membership_id = pt.mid(3) and status = 'pending'))) is not distinct from '', true);
select pt.check('withdrawn', (select count(*)::text from public.membership_requests where membership_id = pt.mid(3) and status = 'withdrawn'), '1');
select pt.check('someone else cannot withdraw it', pt.q(pt.u('m2'), format('select public.withdraw_membership_request(%L)::text', (select id from public.membership_requests where membership_id = pt.mid(3) and status = 'withdrawn' limit 1))), 'ERROR:Request not found');
select pt.check('a pause the admin approves', pt.q(pt.u('m3'), format('select public.request_membership_pause(%L, %L::date, %L::date)', pt.mid(3), pt.d(14), pt.d(28))) is not null, true);
select pt.check('approve', pt.q(pt.u('owner_a'), format('select public.decide_membership_request(%L, true)::text', (select id from public.membership_requests where membership_id = pt.mid(3) and status = 'pending'))) is not distinct from '', true);
select pt.check('approved, not yet started', (select status from public.membership_requests where membership_id = pt.mid(3) and status in ('approved')), 'approved');

-- ---------- 5. who sees which requests ----------
select pt.check('a member sees their own requests', pt.q(pt.u('m3'), 'select count(*)::text from public.membership_requests'), (select count(*)::text from public.membership_requests where user_id = pt.u('m3')));
select pt.check('another member sees none of them', pt.q(pt.u('m2'), format('select count(*)::text from public.membership_requests where user_id = %L', pt.u('m3'))), '0');
select pt.check('an admin sees their gym''s requests', pt.q(pt.u('admin_a'), 'select count(*)::text from public.membership_requests'), (select count(*)::text from public.membership_requests where gym_id = pt.gym_a()));
select pt.check('another gym''s admin sees none', pt.q(pt.u('admin_b'), 'select count(*)::text from public.membership_requests'), '0');
select pt.check('staff cannot read requests', pt.q(pt.u('staff_a'), 'select count(*)::text from public.membership_requests'), '0');
select pt.check('nobody can write requests directly', pt.q(pt.u('m3'), format('update public.membership_requests set status = %L returning 1::text', 'approved')), 'ERROR:permission denied for table membership_requests');
select pt.check('nobody can insert requests directly', pt.q(pt.u('admin_a'), format('insert into public.membership_requests(gym_id, membership_id, user_id, kind, effective_on) values (%L, %L, %L, %L, current_date) returning 1::text', pt.gym_a(), pt.mid(3), pt.u('m3'), 'cancel')), 'ERROR:permission denied for table membership_requests');

-- ---------- 6. cancel ----------
update public.membership_requests set status = 'ended' where membership_id = pt.mid(3);
insert into public.membership_rules(gym_id) values (pt.gym_b()) on conflict do nothing;
update public.membership_rules set cancel_enabled = true, cancel_notice_days = 30, cancel_min_term_months = 3, cancel_early_mode = 'wait', cancel_early_fee_pence = 2000, cancel_approval = 'admin', cancel_ask_reason = true where gym_id = pt.gym_a();
select pt.check('cancel allowed', pt.opt(pt.u('m1'), '{cancel,allowed}'), 'true');
select pt.check('a long-standing member leaves after notice', pt.opt(pt.u('m1'), '{cancel,last_day}'), pt.d(30));
select pt.check('a new member must wait for the minimum term', pt.opt(pt.u('m2'), '{cancel,in_term}'), 'true');
select pt.check('...and the last day is the end of the term', pt.opt(pt.u('m2'), '{cancel,last_day}'), ((public.private_today_for_tests() + interval '3 months')::date)::text);
select pt.check('a reason is required', pt.q(pt.u('m1'), format('select public.request_membership_cancel(%L, %L)', pt.mid(1), '  ')), 'ERROR:Please tell us why you are leaving');
select pt.check('cancel request', pt.q(pt.u('m1'), format('select public.request_membership_cancel(%L, %L)', pt.mid(1), 'moving away')) is not null, true);
select pt.check('cancel waits for an admin', (select status || ' ' || effective_on::text || ' ' || fee_pence from public.membership_requests where membership_id = pt.mid(1) and kind = 'cancel'), 'pending ' || public.private_today_for_tests() + 31 || ' 0');
select pt.check('and the membership is untouched', (select status::text from public.memberships where id = pt.mid(1)), 'active');
select pt.check('asking twice', pt.q(pt.u('m1'), format('select public.request_membership_cancel(%L, %L)', pt.mid(1), 'again')), 'ERROR:You have already asked to cancel');
select pt.check('admin approves the cancellation', pt.q(pt.u('admin_a'), format('select public.decide_membership_request(%L, true)::text', (select id from public.membership_requests where membership_id = pt.mid(1) and kind = 'cancel'))) is not distinct from '', true);
select pt.check('still active until the last day', (select status::text from public.memberships where id = pt.mid(1)), 'active');
update public.membership_requests set effective_on = private.gym_today() where membership_id = pt.mid(1) and kind = 'cancel';
select pt.check('on the day it is cancelled', pt.opt(pt.u('m1'), '{membership,status}'), 'cancelled');
select pt.check('the last day is recorded', (select ends_on::text from public.memberships where id = pt.mid(1)), (public.private_today_for_tests() - 1)::text);
-- the early-leaver fee mode
update public.membership_rules set cancel_early_mode = 'fee', cancel_approval = 'auto' where gym_id = pt.gym_a();
select pt.check('fee mode: leave after notice but pay', pt.opt(pt.u('m2'), '{cancel,fee_pence}'), '2000');
select pt.check('fee mode: last day follows notice', pt.opt(pt.u('m2'), '{cancel,last_day}'), pt.d(30));
select pt.check('fee mode request recorded with the fee', pt.q(pt.u('m2'), format('select public.request_membership_cancel(%L, %L)', pt.mid(2), 'cost')) is not null, true);
select pt.check('auto cancel is approved straight away', (select status || ' ' || fee_pence from public.membership_requests where membership_id = pt.mid(2) and kind = 'cancel'), 'approved 2000');
select pt.check('member withdraws before it starts', pt.q(pt.u('m2'), format('select public.withdraw_membership_request(%L)::text', (select id from public.membership_requests where membership_id = pt.mid(2) and kind = 'cancel'))) is not distinct from '', true);
select pt.check('and the membership carries on', (select status::text from public.memberships where id = pt.mid(2)), 'active');

-- ---------- 7. change plan ----------
update public.membership_rules set upgrade_enabled = true, downgrade_enabled = false, upgrade_starts = 'now', downgrade_starts = 'next_month', change_min_months = 1, change_approval = 'auto' where gym_id = pt.gym_a();
select pt.check('options list one plan, not Elite (not switchable) or the same plan', pt.opt(pt.u('m3'), '{change,plans}') like '%"Plus"%' and pt.opt(pt.u('m3'), '{change,plans}') not like '%Elite%' and pt.opt(pt.u('m3'), '{change,plans}') not like '%Basic%', true);
select pt.check('annual plan compared by monthly value (3000/month): Annual 36000/12 = 3000 is the same', pt.opt(pt.u('m3'), '{change,plans}') not like '%Annual%', true);
select pt.check('a plan that is not switchable', pt.q(pt.u('m3'), format('select public.request_membership_change(%L, %L)', pt.mid(3), 'c0000000-0000-4000-8000-000000000003')), 'ERROR:That plan is not available to switch to');
select pt.check('a plan from another gym', pt.q(pt.u('m3'), format('select public.request_membership_change(%L, %L)', pt.mid(3), 'c0000000-0000-4000-8000-000000000005')), 'ERROR:That plan is not available to switch to');
select pt.check('the same plan', pt.q(pt.u('m3'), format('select public.request_membership_change(%L, %L)', pt.mid(3), 'c0000000-0000-4000-8000-000000000001')), 'ERROR:That plan is not available to switch to');
select pt.check('an upgrade is accepted', pt.q(pt.u('m3'), format('select public.request_membership_change(%L, %L)', pt.mid(3), 'c0000000-0000-4000-8000-000000000002')) is not null, true);
select pt.check('auto and starting now: the plan changes', (select plan_id::text from public.memberships where id = pt.mid(3)), 'c0000000-0000-4000-8000-000000000002');
select pt.check('the request is applied', (select status from public.membership_requests where membership_id = pt.mid(3) and kind = 'change_plan'), 'applied');
select pt.check('the direction was recorded', (select rules_snapshot->>'direction' from public.membership_requests where membership_id = pt.mid(3) and kind = 'change_plan'), 'up');
select pt.check('moving to the plan you are already on', pt.q(pt.u('m3'), format('select public.request_membership_change(%L, %L)', pt.mid(3), 'c0000000-0000-4000-8000-000000000002')), 'ERROR:That plan is not available to switch to');
update public.membership_rules set downgrade_enabled = false, upgrade_enabled = true, change_min_months = 6 where gym_id = pt.gym_a();
select pt.check('a downgrade is refused while that rule is off', pt.q(pt.u('m3'), format('select public.request_membership_change(%L, %L)', pt.mid(3), 'c0000000-0000-4000-8000-000000000004')), 'ERROR:Moving to a cheaper plan is not available at this gym');
update public.membership_rules set downgrade_enabled = true where gym_id = pt.gym_a();
select pt.check('minimum months blocks a second change', pt.q(pt.u('m3'), format('select public.request_membership_change(%L, %L)', pt.mid(3), 'c0000000-0000-4000-8000-000000000001')) like 'ERROR:You can change plan again from %', true);
update public.membership_rules set change_min_months = 0, change_approval = 'admin', downgrade_starts = 'next_month' where gym_id = pt.gym_a();
select pt.check('a downgrade waits for an admin and for next month', pt.q(pt.u('m3'), format('select public.request_membership_change(%L, %L)', pt.mid(3), 'c0000000-0000-4000-8000-000000000001')) is not null, true);
select pt.check('it starts on the first of next month', (select effective_on::text from public.membership_requests where membership_id = pt.mid(3) and kind = 'change_plan' and status = 'pending'), (date_trunc('month', public.private_today_for_tests()) + interval '1 month')::date::text);
select pt.check('and the plan has not changed yet', (select plan_id::text from public.memberships where id = pt.mid(3)), 'c0000000-0000-4000-8000-000000000002');

-- ---------- 8. the scheduler ----------
select pt.check('members cannot run the sweep', pt.q(pt.u('m1'), 'select public.apply_due_membership_requests()::text'), 'ERROR:permission denied for function apply_due_membership_requests');
select pt.check('anonymous cannot run the sweep', pt.anon('select public.apply_due_membership_requests()::text'), 'ERROR:permission denied for function apply_due_membership_requests');
select pt.check('the service role can', (select has_function_privilege('service_role', 'public.apply_due_membership_requests()', 'execute'))::text, 'true');

\o
do $$
declare bad integer;
begin
  select count(*) into bad from pt.results where not ok;
  raise notice 'membership rules: % checks, % failed', (select count(*) from pt.results), bad;
  if bad > 0 then
    raise exception 'FAILED: %', (select string_agg(seq || ' ' || label || ' [got ' || coalesce(got,'NULL') || ' / want ' || coalesce(want,'NULL') || ']', E'\n') from pt.results where not ok);
  end if;
end $$;
rollback;
