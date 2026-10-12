-- Training feedback loop: persona tests (rolled back at the end; leaves nothing behind).
-- Runs on a FRESH local database after the migrations are applied (never on the live project).
-- Real queries run as the `authenticated` role with that user's JWT claims, so Row Level Security and the functions
-- are exercised exactly as the app would.
-- Usage:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/training_feedback_loop.sql
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
 ('m1','00000000-0000-4000-8000-000000000011'), ('m2','00000000-0000-4000-8000-000000000012'),
 ('admin_b','00000000-0000-4000-8000-000000000022'), ('mb','00000000-0000-4000-8000-000000000021');
insert into auth.users(id,email) select uid, name||'@training.invalid' from pt.persona;
insert into public.profiles(id,display_name) select uid,name from pt.persona on conflict (id) do nothing;

create function pt.u(n text) returns uuid language sql as $$ select uid from pt.persona where name = n $$;
create function pt.gym_a() returns uuid language sql as $$ select 'a0000000-0000-4000-8000-00000000000a'::uuid $$;
create function pt.gym_b() returns uuid language sql as $$ select 'b0000000-0000-4000-8000-00000000000b'::uuid $$;
create function pt.asg() returns uuid language sql as $$ select 'e0000000-0000-4000-8000-000000000001'::uuid $$;
create function pt.fb(uid uuid, author uuid, body text) returns text language sql as $$
  select pt.q(uid, format('insert into public.workout_assignment_feedback(gym_id, assignment_id, author_id, body) values (%L, %L, %L, %L) returning body', pt.gym_a(), pt.asg(), author, body)) $$;

insert into public.gyms(id,name,slug,created_by) values (pt.gym_a(),'Training Gym A','tr-a',pt.u('owner_a')),(pt.gym_b(),'Training Gym B','tr-b',pt.u('admin_b'));
insert into public.gym_members(gym_id,user_id,role,is_active,access_status) values
 (pt.gym_a(),pt.u('owner_a'),'owner',true,'active'),(pt.gym_a(),pt.u('admin_a'),'admin',true,'active'),(pt.gym_a(),pt.u('staff_a'),'staff',true,'active'),(pt.gym_a(),pt.u('coach_a'),'coach',true,'active'),
 (pt.gym_a(),pt.u('m1'),'member',true,'active'),(pt.gym_a(),pt.u('m2'),'member',true,'active'),
 (pt.gym_b(),pt.u('admin_b'),'owner',true,'active'),(pt.gym_b(),pt.u('mb'),'member',true,'active');
insert into public.membership_plans(id,gym_id,name,price_pence,billing_interval) values ('c0000000-0000-4000-8000-000000000001',pt.gym_a(),'Basic',3000,'monthly');
insert into public.memberships(id,gym_id,user_id,plan_id,status,starts_on) values
 ('d0000000-0000-4000-8000-000000000001',pt.gym_a(),pt.u('m1'),'c0000000-0000-4000-8000-000000000001','active',current_date-30),
 ('d0000000-0000-4000-8000-000000000002',pt.gym_a(),pt.u('m2'),'c0000000-0000-4000-8000-000000000001','active',current_date-30);

-- ---------- assigning: a coach gives m1 a workout, with no day ----------
select pt.check('a coach can assign a workout with no date', pt.q(pt.u('coach_a'), format('insert into public.workout_assignments(id, gym_id, member_user_id, assigned_by, source, title) values (%L, %L, %L, %L, %L, %L) returning status', pt.asg(), pt.gym_a(), pt.u('m1'), pt.u('coach_a'), 'pt', 'Lower body strength')), 'todo');
select pt.check('assigning tells the client in the app', pt.q(pt.u('m1'), 'select notification_type || '' / '' || body from public.member_notifications order by created_at limit 1'), 'workout_assigned / Lower body strength');
select pt.check('the notification points at the workout', (select (related_assignment_id = pt.asg())::text from public.member_notifications where user_id = pt.u('m1')), 'true');
select pt.check('a second client sees nothing of it', pt.q(pt.u('m2'), 'select count(*)::text from public.member_notifications'), '0');
select pt.check('a client''s own workout notifies nobody', pt.q(pt.u('m2'), format('insert into public.workout_assignments(gym_id, member_user_id, assigned_by, source, title) values (%L, %L, %L, %L, %L) returning source', pt.gym_a(), pt.u('m2'), pt.u('m2'), 'self', 'My run')) || ' / ' || pt.q(pt.u('m2'), 'select count(*)::text from public.member_notifications'), 'self / 0');
select pt.check('a member cannot assign work as a coach', pt.q(pt.u('m1'), format('insert into public.workout_assignments(gym_id, member_user_id, assigned_by, source, title) values (%L, %L, %L, %L, %L) returning source', pt.gym_a(), pt.u('m1'), pt.u('m1'), 'pt', 'Sneaky')), 'ERROR:new row violates row-level security policy for table "workout_assignments"');

-- ---------- the client does it: the finished workout is tied to the set one ----------
select pt.check('a client can link their workout to their own assigned workout', pt.q(pt.u('m1'), format('insert into public.workout_sessions(id, gym_id, user_id, title, assignment_id) values (%L, %L, %L, %L, %L) returning (assignment_id is not null)::text', 'f0000000-0000-4000-8000-000000000001', pt.gym_a(), pt.u('m1'), 'Lower body strength', pt.asg())), 'true');
select pt.check('a client cannot link to someone else''s assigned workout', pt.q(pt.u('m2'), format('insert into public.workout_sessions(gym_id, user_id, title, assignment_id) values (%L, %L, %L, %L) returning id::text', pt.gym_a(), pt.u('m2'), 'Borrowed', pt.asg())), 'ERROR:That workout was not set for you');
select pt.check('a plain workout with no link is still fine', pt.q(pt.u('m2'), format('insert into public.workout_sessions(gym_id, user_id, title) values (%L, %L, %L) returning (assignment_id is null)::text', pt.gym_a(), pt.u('m2'), 'Park run')), 'true');
select pt.check('a client cannot re-point a workout at someone else''s', pt.q(pt.u('m2'), format('update public.workout_sessions set assignment_id = %L where user_id = %L returning id::text', pt.asg(), pt.u('m2'))), 'ERROR:That workout was not set for you');
select pt.check('the client records what changed and why', pt.q(pt.u('m1'), format('update public.workout_assignments set status = %L, completed_at = now(), result = %L::jsonb where id = %L returning result #>> %L', 'completed', '{"exercises":[{"name":"Back squat","status":"changed","reason":"too_tired"}]}', pt.asg(), '{exercises,0,reason}')), 'too_tired');
select pt.check('a result has to be an object', pt.q(pt.u('m1'), format('update public.workout_assignments set result = %L::jsonb where id = %L returning 1::text', '"just text"', pt.asg())), 'ERROR:new row for relation "workout_assignments" violates check constraint "workout_assignments_result_check"');
select pt.check('the coach can read what the client did', pt.q(pt.u('coach_a'), format('select count(*)::text from public.workout_sessions where assignment_id = %L', pt.asg())), '1');

-- ---------- the coach replies ----------
select pt.check('a coach can reply', pt.fb(pt.u('coach_a'), pt.u('coach_a'), 'Good effort. Try 57.5 next time.'), 'Good effort. Try 57.5 next time.');
select pt.check('staff can reply too', pt.fb(pt.u('staff_a'), pt.u('staff_a'), 'Looks good'), 'Looks good');
select pt.check('a reply cannot be empty', pt.fb(pt.u('coach_a'), pt.u('coach_a'), '   '), 'ERROR:new row for relation "workout_assignment_feedback" violates check constraint "workout_assignment_feedback_body_check"');
select pt.check('a reply cannot be written in someone else''s name', pt.fb(pt.u('coach_a'), pt.u('owner_a'), 'forged'), 'ERROR:new row violates row-level security policy for table "workout_assignment_feedback"');
select pt.check('a client cannot write a coach reply', pt.fb(pt.u('m1'), pt.u('m1'), 'I am great'), 'ERROR:new row violates row-level security policy for table "workout_assignment_feedback"');
select pt.check('another gym''s admin cannot reply here', pt.fb(pt.u('admin_b'), pt.u('admin_b'), 'x'), 'ERROR:new row violates row-level security policy for table "workout_assignment_feedback"');
select pt.check('the client reads the replies on their own workout', pt.q(pt.u('m1'), 'select count(*)::text from public.workout_assignment_feedback'), '2');
select pt.check('another client cannot read them', pt.q(pt.u('m2'), 'select count(*)::text from public.workout_assignment_feedback'), '0');
select pt.check('another gym''s people cannot read them', pt.q(pt.u('mb'), 'select count(*)::text from public.workout_assignment_feedback') || ' / ' || pt.q(pt.u('admin_b'), 'select count(*)::text from public.workout_assignment_feedback'), '0 / 0');
select pt.check('the coach sees them', pt.q(pt.u('coach_a'), 'select count(*)::text from public.workout_assignment_feedback'), '2');
select pt.check('a reply tells the client in the app', pt.q(pt.u('m1'), 'select count(*)::text from public.member_notifications where notification_type = ''workout_feedback'''), '2');
select pt.check('the client can mark the feedback as seen', pt.q(pt.u('m1'), format('update public.workout_assignments set feedback_seen_at = now() where id = %L returning (feedback_seen_at is not null)::text', pt.asg())), 'true');
select pt.check('the client can mark notifications read', pt.q(pt.u('m1'), 'with u as (update public.member_notifications set read_at = now() where read_at is null returning 1) select count(*)::text from u'), '3');
select pt.check('a client cannot delete a reply', pt.q(pt.u('m1'), 'with d as (delete from public.workout_assignment_feedback returning 1) select count(*)::text from d'), '0');
select pt.check('the author can delete their own reply', pt.q(pt.u('staff_a'), 'with d as (delete from public.workout_assignment_feedback where body = ''Looks good'' returning 1) select count(*)::text from d'), '1');
select pt.check('a coach cannot delete someone else''s reply', pt.q(pt.u('staff_a'), 'with d as (delete from public.workout_assignment_feedback returning 1) select count(*)::text from d'), '0');
select pt.check('an owner can delete any reply', pt.q(pt.u('owner_a'), 'with d as (delete from public.workout_assignment_feedback returning 1) select count(*)::text from d'), '1');
select pt.check('anonymous cannot read replies', pt.anon('select count(*)::text from public.workout_assignment_feedback'), 'ERROR:permission denied for table workout_assignment_feedback');

\o
do $$
declare bad integer;
begin
  select count(*) into bad from pt.results where not ok;
  raise notice 'training feedback loop: % checks, % failed', (select count(*) from pt.results), bad;
  if bad > 0 then
    raise exception 'FAILED: %', (select string_agg(seq || ' ' || label || ' [got ' || coalesce(got,'NULL') || ' / want ' || coalesce(want,'NULL') || ']', E'\n') from pt.results where not ok);
  end if;
end $$;
rollback;
