-- Class workouts: persona tests (rolled back at the end; leaves nothing behind).
-- Runs on a FRESH local database after the migrations are applied (never on the live project).
-- Real queries run as the `authenticated` role with that user's JWT claims, so Row Level Security and the functions
-- are exercised exactly as the app would.
-- Usage:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/class_workouts.sql
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
 ('m1','00000000-0000-4000-8000-000000000011'), ('m2','00000000-0000-4000-8000-000000000012'), ('m3','00000000-0000-4000-8000-000000000013'), ('m4','00000000-0000-4000-8000-000000000014'), ('m5','00000000-0000-4000-8000-000000000015'),
 ('admin_b','00000000-0000-4000-8000-000000000022'), ('mb','00000000-0000-4000-8000-000000000021');
insert into auth.users(id,email) select uid, name||'@classwk.invalid' from pt.persona;
insert into public.profiles(id,display_name) select uid,name from pt.persona on conflict (id) do nothing;

create function pt.u(n text) returns uuid language sql as $$ select uid from pt.persona where name = n $$;
create function pt.gym_a() returns uuid language sql as $$ select 'a0000000-0000-4000-8000-00000000000a'::uuid $$;
create function pt.gym_b() returns uuid language sql as $$ select 'b0000000-0000-4000-8000-00000000000b'::uuid $$;
create function pt.c1() returns uuid language sql as $$ select 'f0000000-0000-4000-8000-000000000001'::uuid $$;
create function pt.c2() returns uuid language sql as $$ select 'f0000000-0000-4000-8000-000000000002'::uuid $$;

insert into public.gyms(id,name,slug,created_by) values (pt.gym_a(),'Training Gym A','tr-a',pt.u('owner_a')),(pt.gym_b(),'Training Gym B','tr-b',pt.u('admin_b'));
insert into public.gym_members(gym_id,user_id,role,is_active,access_status) values
 (pt.gym_a(),pt.u('owner_a'),'owner',true,'active'),(pt.gym_a(),pt.u('admin_a'),'admin',true,'active'),(pt.gym_a(),pt.u('staff_a'),'staff',true,'active'),(pt.gym_a(),pt.u('coach_a'),'coach',true,'active'),
 (pt.gym_a(),pt.u('m1'),'member',true,'active'),(pt.gym_a(),pt.u('m2'),'member',true,'active'),(pt.gym_a(),pt.u('m3'),'member',true,'active'),(pt.gym_a(),pt.u('m4'),'member',true,'active'),(pt.gym_a(),pt.u('m5'),'member',true,'active'),
 (pt.gym_b(),pt.u('admin_b'),'owner',true,'active'),(pt.gym_b(),pt.u('mb'),'member',true,'active');

insert into public.membership_plans(id,gym_id,name,price_pence,billing_interval) values ('c0000000-0000-4000-8000-000000000001',pt.gym_a(),'Basic',3000,'monthly');
insert into public.memberships(gym_id,user_id,plan_id,status,starts_on) select pt.gym_a(), pt.u(n), 'c0000000-0000-4000-8000-000000000001', 'active', current_date-30 from unnest(array['m1','m2','m3','m4']) n;
insert into public.memberships(gym_id,user_id,plan_id,status,starts_on) values (pt.gym_a(), pt.u('m5'), 'c0000000-0000-4000-8000-000000000001', 'cancelled', current_date-60);

-- two classes in gym A; coach_a is assigned to the first only
insert into public.class_sessions(id, gym_id, name, starts_at, ends_at, capacity) values
 (pt.c1(), pt.gym_a(), 'Hybrid 6pm', now() + interval '1 day', now() + interval '1 day 1 hour', 20),
 (pt.c2(), pt.gym_a(), 'Hybrid 7pm', now() + interval '2 days', now() + interval '2 days 1 hour', 20);
insert into public.class_session_staff(session_id, gym_id, user_id, assignment_role, is_lead) values (pt.c1(), pt.gym_a(), pt.u('coach_a'), 'coach', true);
-- m1 is booked, m2 attended, m3 was a no-show, m4 never booked
insert into public.class_bookings(gym_id, session_id, user_id, status) values
 (pt.gym_a(), pt.c1(), pt.u('m1'), 'booked'), (pt.gym_a(), pt.c1(), pt.u('m2'), 'attended'), (pt.gym_a(), pt.c1(), pt.u('m3'), 'no_show'), (pt.gym_a(), pt.c1(), pt.u('m5'), 'attended');

create function pt.put(uid uuid, sess uuid, gym uuid, title text) returns text language sql as $$
  select pt.q(uid, format('insert into public.class_session_workouts(session_id, gym_id, title, workout_snapshot) values (%L, %L, %L, %L) returning title', sess, gym, title, '{"blocks":[]}')) $$;
create function pt.log(uid uuid, sess uuid) returns text language sql as $$
  select pt.q(uid, format('insert into public.workout_sessions(gym_id, user_id, title, performed_at, class_session_id) values (%L, %L, %L, now(), %L) returning title', pt.gym_a(), uid, 'Class', sess)) $$;
create function pt.count_cw(uid uuid) returns text language sql as $$ select pt.q(uid, 'select count(*)::text from public.class_session_workouts') $$;

-- ---------- setting it up ----------
select pt.check('the coach assigned to the class can put a workout on it (a draft)', pt.put(pt.u('coach_a'), pt.c1(), pt.gym_a(), 'Hybrid benchmark'), 'Hybrid benchmark');
select pt.check('staff not assigned to that class cannot', pt.put(pt.u('staff_a'), pt.c2(), pt.gym_a(), 'x'), 'ERROR:new row violates row-level security policy for table "class_session_workouts"');
select pt.check('the assigned coach cannot put one on a class they are not assigned to', pt.put(pt.u('coach_a'), pt.c2(), pt.gym_a(), 'x'), 'ERROR:new row violates row-level security policy for table "class_session_workouts"');
select pt.check('an admin can', pt.put(pt.u('admin_a'), pt.c2(), pt.gym_a(), 'Evening burner'), 'Evening burner');
select pt.check('a member cannot', pt.put(pt.u('m1'), pt.c1(), pt.gym_a(), 'x'), 'ERROR:new row violates row-level security policy for table "class_session_workouts"');
select pt.check('another gym''s admin cannot', pt.put(pt.u('admin_b'), pt.c1(), pt.gym_b(), 'x'), 'ERROR:new row violates row-level security policy for table "class_session_workouts"');
select pt.check('a row cannot claim a different gym than its class', pt.put(pt.u('admin_a'), pt.c1(), pt.gym_b(), 'x'), 'ERROR:new row violates row-level security policy for table "class_session_workouts"');
select pt.check('a class has one workout', pt.put(pt.u('owner_a'), pt.c1(), pt.gym_a(), 'again'), 'ERROR:duplicate key value violates unique constraint "class_session_workouts_pkey"');
select pt.check('anonymous cannot read', pt.anon('select count(*)::text from public.class_session_workouts'), 'ERROR:permission denied for table class_session_workouts');

-- ---------- a draft is not visible to members ----------
select pt.check('the coach sees their draft', pt.count_cw(pt.u('coach_a')), '1');
select pt.check('a booked member cannot see a draft', pt.count_cw(pt.u('m1')), '0');
select pt.check('and cannot log against it', pt.log(pt.u('m1'), pt.c1()), 'ERROR:That class workout is not available to you');
select pt.check('no notification went out for a draft', pt.q(pt.u('m1'), 'select count(*)::text from public.member_notifications where notification_type = ''class_workout'''), '0');

-- ---------- making it available ----------
select pt.check('the coach makes it available', pt.q(pt.u('coach_a'), format('update public.class_session_workouts set published_at = now(), published_by = %L where session_id = %L returning (published_at is not null)::text', pt.u('coach_a'), pt.c1())), 'true');
select pt.check('a booked member can now see it', pt.count_cw(pt.u('m1')), '1');
select pt.check('so can someone marked attended', pt.count_cw(pt.u('m2')), '1');
select pt.check('a no-show cannot', pt.count_cw(pt.u('m3')), '0');
select pt.check('someone who never booked cannot', pt.count_cw(pt.u('m4')), '0');
select pt.check('someone whose membership has ended cannot, even with an old booking', pt.count_cw(pt.u('m5')), '0');
select pt.check('another gym''s member cannot', pt.count_cw(pt.u('mb')), '0');
select pt.check('a member of the gym who is not in the class cannot see the other class either', pt.q(pt.u('m1'), format('select count(*)::text from public.class_session_workouts where session_id = %L', pt.c2())), '0');
select pt.check('the people in the class were told in the app', pt.q(pt.u('m1'), 'select title || '' / '' || body from public.member_notifications where notification_type = ''class_workout'''), 'Your class workout is ready / Hybrid benchmark');
select pt.check('the attended member was told too', pt.q(pt.u('m2'), 'select count(*)::text from public.member_notifications where notification_type = ''class_workout'''), '1');
select pt.check('the no-show and the non-booker were not', pt.q(pt.u('m3'), 'select count(*)::text from public.member_notifications') || ' / ' || pt.q(pt.u('m4'), 'select count(*)::text from public.member_notifications'), '0 / 0');
select pt.check('the coach who published it was not told about their own action', pt.q(pt.u('coach_a'), 'select count(*)::text from public.member_notifications'), '0');
select pt.check('changing it afterwards does not tell people again', pt.q(pt.u('coach_a'), format('update public.class_session_workouts set title = %L where session_id = %L returning title', 'Hybrid benchmark v2', pt.c1())) || ' / ' || pt.q(pt.u('m1'), 'select count(*)::text from public.member_notifications where notification_type = ''class_workout'''), 'Hybrid benchmark v2 / 1');

-- ---------- members cannot change it ----------
select pt.check('a member cannot edit it', pt.q(pt.u('m1'), format('with u as (update public.class_session_workouts set title = %L where session_id = %L returning 1) select count(*)::text from u', 'mine', pt.c1())), '0');
select pt.check('a member cannot delete it', pt.q(pt.u('m1'), 'with d as (delete from public.class_session_workouts returning 1) select count(*)::text from d'), '0');

-- ---------- recording the session ----------
select pt.check('a booked member can record their session against the class', pt.log(pt.u('m1'), pt.c1()), 'Class');
select pt.check('so can someone marked attended', pt.log(pt.u('m2'), pt.c1()), 'Class');
select pt.check('a no-show cannot', pt.log(pt.u('m3'), pt.c1()), 'ERROR:That class workout is not available to you');
select pt.check('someone who never booked cannot', pt.log(pt.u('m4'), pt.c1()), 'ERROR:That class workout is not available to you');
select pt.check('nobody can link to a class that has no available workout', pt.log(pt.u('m1'), pt.c2()), 'ERROR:That class workout is not available to you');
select pt.check('an ordinary workout with no class is unaffected', pt.q(pt.u('m4'), format('insert into public.workout_sessions(gym_id, user_id, title, performed_at) values (%L, %L, %L, now()) returning title', pt.gym_a(), pt.u('m4'), 'My own')), 'My own');
select pt.check('the member reads their own recorded class session', pt.q(pt.u('m1'), format('select count(*)::text from public.workout_sessions where class_session_id = %L', pt.c1())), '1');
select pt.check('and the other member cannot see it', pt.q(pt.u('m2'), format('select count(*)::text from public.workout_sessions where class_session_id = %L and user_id = %L', pt.c1(), pt.u('m1'))), '0');

-- ---------- taking it back ----------
select pt.check('the coach can take it back', pt.q(pt.u('coach_a'), format('update public.class_session_workouts set published_at = null where session_id = %L returning (published_at is null)::text', pt.c1())), 'true');
select pt.check('members can no longer see it', pt.count_cw(pt.u('m1')), '0');
select pt.check('nor start a new record against it', pt.log(pt.u('m2'), pt.c1()), 'ERROR:That class workout is not available to you');
select pt.check('the coach can delete it', pt.q(pt.u('coach_a'), 'with d as (delete from public.class_session_workouts where session_id = ''' || pt.c1() || ''' returning 1) select count(*)::text from d'), '1');
delete from public.class_sessions where id = pt.c2();
select pt.check('removing a class removes its workout', not exists (select 1 from public.class_session_workouts where session_id = pt.c2()), true);

\o
do $$
declare bad integer;
begin
  select count(*) into bad from pt.results where not ok;
  raise notice 'class workouts: % checks, % failed', (select count(*) from pt.results), bad;
  if bad > 0 then
    raise exception 'FAILED: %', (select string_agg(seq || ' ' || label || ' [got ' || coalesce(got,'NULL') || ' / want ' || coalesce(want,'NULL') || ']', E'\n') from pt.results where not ok);
  end if;
end $$;
rollback;
