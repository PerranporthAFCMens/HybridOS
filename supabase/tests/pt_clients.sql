-- PT clients: persona tests (rolled back at the end; leaves nothing behind).
-- Runs on a FRESH local database after the migrations are applied (never on the live project).
-- Real queries run as the `authenticated` role with that user's JWT claims, so Row Level Security and the functions
-- are exercised exactly as the app would.
-- Usage:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/pt_clients.sql
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
 ('m1','00000000-0000-4000-8000-000000000011'), ('m2','00000000-0000-4000-8000-000000000012'), ('m3','00000000-0000-4000-8000-000000000013'),
 ('admin_b','00000000-0000-4000-8000-000000000022'), ('mb','00000000-0000-4000-8000-000000000021');
insert into auth.users(id,email) select uid, name||'@ptclients.invalid' from pt.persona;
insert into public.profiles(id,display_name) select uid,name from pt.persona on conflict (id) do nothing;

create function pt.u(n text) returns uuid language sql as $$ select uid from pt.persona where name = n $$;
create function pt.gym_a() returns uuid language sql as $$ select 'a0000000-0000-4000-8000-00000000000a'::uuid $$;
create function pt.gym_b() returns uuid language sql as $$ select 'b0000000-0000-4000-8000-00000000000b'::uuid $$;
create function pt.asg() returns uuid language sql as $$ select 'e0000000-0000-4000-8000-000000000001'::uuid $$;
create function pt.seen(who text) returns text language sql as $$ select pt.q(pt.u(who), 'select count(*)::text from public.workout_sessions') $$;

insert into public.gyms(id,name,slug,created_by) values (pt.gym_a(),'PT Gym A','ptc-a',pt.u('owner_a')),(pt.gym_b(),'PT Gym B','ptc-b',pt.u('admin_b'));
insert into public.gym_members(gym_id,user_id,role,is_active,access_status) values
 (pt.gym_a(),pt.u('owner_a'),'owner',true,'active'),(pt.gym_a(),pt.u('admin_a'),'admin',true,'active'),(pt.gym_a(),pt.u('staff_a'),'staff',true,'active'),(pt.gym_a(),pt.u('coach_a'),'coach',true,'active'),
 (pt.gym_a(),pt.u('m1'),'member',true,'active'),(pt.gym_a(),pt.u('m2'),'member',true,'active'),(pt.gym_a(),pt.u('m3'),'member',true,'active'),
 (pt.gym_b(),pt.u('admin_b'),'owner',true,'active'),(pt.gym_b(),pt.u('mb'),'member',true,'active');
insert into public.membership_plans(id,gym_id,name,price_pence,billing_interval) values ('c0000000-0000-4000-8000-000000000001',pt.gym_a(),'Basic',3000,'monthly');
insert into public.memberships(gym_id,user_id,plan_id,status,starts_on) select pt.gym_a(), pt.u(n), 'c0000000-0000-4000-8000-000000000001', 'active', current_date-30 from unnest(array['m1','m2','m3']) n;

-- One finished workout each for m1, m2, m3. staff_a has m1 on their list and a booked session with m3; nobody has m2; coach_a has nobody.
insert into public.workout_sessions(gym_id, user_id, title) values (pt.gym_a(), pt.u('m1'), 'm1 workout'), (pt.gym_a(), pt.u('m2'), 'm2 workout'), (pt.gym_a(), pt.u('m3'), 'm3 workout');
insert into public.pt_clients(gym_id, staff_user_id, client_user_id) values (pt.gym_a(), pt.u('staff_a'), pt.u('m1'));
insert into public.pt_appointments(gym_id, staff_user_id, member_user_id, starts_at, ends_at, status) values (pt.gym_a(), pt.u('staff_a'), pt.u('m3'), now() + interval '1 day', now() + interval '1 day 1 hour', 'booked');

-- ---------- who sees whose workouts (default: own clients only) ----------
select pt.check('owner and admin see every member', pt.seen('owner_a') || ' / ' || pt.seen('admin_a'), '3 / 3');
select pt.check('a PT sees a client on their list and a client they have a session booked with', pt.seen('staff_a'), '2');
select pt.check('a PT with no clients sees nobody', pt.seen('coach_a'), '0');
select pt.check('a member sees only their own', pt.seen('m1'), '1');
select pt.check('another gym sees none', pt.seen('admin_b') || ' / ' || pt.seen('mb'), '0 / 0');
update public.pt_appointments set status = 'cancelled';
select pt.check('once the session is cancelled that member drops off', pt.seen('staff_a'), '1');
update public.pt_appointments set status = 'completed';
select pt.check('a completed session still counts', pt.seen('staff_a'), '2');

-- ---------- assigning ----------
select pt.check('a PT can set a workout for their client', pt.q(pt.u('staff_a'), format('insert into public.workout_assignments(id, gym_id, member_user_id, assigned_by, source, title) values (%L, %L, %L, %L, %L, %L) returning source', pt.asg(), pt.gym_a(), pt.u('m1'), pt.u('staff_a'), 'pt', 'Squats')), 'pt');
select pt.check('a PT cannot set a workout for someone who is not their client', pt.q(pt.u('coach_a'), format('insert into public.workout_assignments(gym_id, member_user_id, assigned_by, source, title) values (%L, %L, %L, %L, %L) returning source', pt.gym_a(), pt.u('m1'), pt.u('coach_a'), 'pt', 'Nope')), 'ERROR:new row violates row-level security policy for table "workout_assignments"');
select pt.check('an admin can set a workout for anyone', pt.q(pt.u('admin_a'), format('insert into public.workout_assignments(gym_id, member_user_id, assigned_by, source, title) values (%L, %L, %L, %L, %L) returning source', pt.gym_a(), pt.u('m2'), pt.u('admin_a'), 'pt', 'From admin')), 'pt');
select pt.check('a PT does not see workouts set for other clients', pt.q(pt.u('staff_a'), 'select count(*)::text from public.workout_assignments'), '1');
select pt.check('a PT who is not their coach cannot reply on it', pt.q(pt.u('coach_a'), format('insert into public.workout_assignment_feedback(gym_id, assignment_id, author_id, body) values (%L, %L, %L, %L) returning body', pt.gym_a(), pt.asg(), pt.u('coach_a'), 'hi')), 'ERROR:new row violates row-level security policy for table "workout_assignment_feedback"');
select pt.check('but a PT can reply on their own client''s', pt.q(pt.u('staff_a'), format('insert into public.workout_assignment_feedback(gym_id, assignment_id, author_id, body) values (%L, %L, %L, %L) returning body', pt.gym_a(), pt.asg(), pt.u('staff_a'), 'Nice work')), 'Nice work');
select pt.check('and the client reads it', pt.q(pt.u('m1'), 'select count(*)::text from public.workout_assignment_feedback'), '1');

-- ---------- the clients list ----------
select pt.check('a PT can add a client of their own', pt.q(pt.u('coach_a'), format('insert into public.pt_clients(gym_id, staff_user_id, client_user_id) values (%L, %L, %L) returning client_user_id = %L', pt.gym_a(), pt.u('coach_a'), pt.u('m2'), pt.u('m2'))), 'true');
select pt.check('and then sees that client''s workouts', pt.seen('coach_a'), '1');
select pt.check('a PT cannot add a client to someone else''s list', pt.q(pt.u('coach_a'), format('insert into public.pt_clients(gym_id, staff_user_id, client_user_id) values (%L, %L, %L)', pt.gym_a(), pt.u('staff_a'), pt.u('m2'))), 'ERROR:new row violates row-level security policy for table "pt_clients"');
select pt.check('a PT cannot add someone from another gym', pt.q(pt.u('coach_a'), format('insert into public.pt_clients(gym_id, staff_user_id, client_user_id) values (%L, %L, %L)', pt.gym_a(), pt.u('coach_a'), pt.u('mb'))), 'ERROR:new row violates row-level security policy for table "pt_clients"');
select pt.check('a member cannot add themselves to a PT''s list', pt.q(pt.u('m2'), format('insert into public.pt_clients(gym_id, staff_user_id, client_user_id) values (%L, %L, %L)', pt.gym_a(), pt.u('staff_a'), pt.u('m2'))), 'ERROR:new row violates row-level security policy for table "pt_clients"');
select pt.check('a PT reads only their own list', pt.q(pt.u('staff_a'), 'select count(*)::text from public.pt_clients'), '1');
select pt.check('a member reads only the row about them', pt.q(pt.u('m1'), 'select count(*)::text from public.pt_clients'), '1');
select pt.check('an admin reads every list', pt.q(pt.u('admin_a'), 'select count(*)::text from public.pt_clients'), '2');
select pt.check('a PT cannot remove someone else''s client', pt.q(pt.u('coach_a'), format('with d as (delete from public.pt_clients where staff_user_id = %L returning 1) select count(*)::text from d', pt.u('staff_a'))), '0');
select pt.check('a PT can remove their own client', pt.q(pt.u('coach_a'), 'with d as (delete from public.pt_clients where staff_user_id = auth.uid() returning 1) select count(*)::text from d'), '1');
select pt.check('and then no longer sees them', pt.seen('coach_a'), '0');

-- ---------- the gym switch ----------
select pt.check('a PT cannot change the switch', pt.q(pt.u('staff_a'), format('insert into public.gym_pt_settings(gym_id, own_clients_only) values (%L, false)', pt.gym_a())), 'ERROR:new row violates row-level security policy for table "gym_pt_settings"');
select pt.check('another gym''s owner cannot change it', pt.q(pt.u('admin_b'), format('insert into public.gym_pt_settings(gym_id, own_clients_only) values (%L, false)', pt.gym_a())), 'ERROR:new row violates row-level security policy for table "gym_pt_settings"');
select pt.check('an admin can turn "own clients only" off', pt.q(pt.u('admin_a'), format('insert into public.gym_pt_settings(gym_id, own_clients_only) values (%L, false) returning own_clients_only::text', pt.gym_a())), 'false');
select pt.check('then every PT sees every member', pt.seen('coach_a') || ' / ' || pt.seen('staff_a'), '3 / 3');
select pt.check('a member still sees only their own', pt.seen('m2'), '1');
select pt.check('a PT can read the switch but not change it', pt.q(pt.u('coach_a'), 'select own_clients_only::text from public.gym_pt_settings') || ' / ' || pt.q(pt.u('coach_a'), 'with u as (update public.gym_pt_settings set own_clients_only = true returning 1) select count(*)::text from u'), 'false / 0');
select pt.check('a member cannot read the switch', pt.q(pt.u('m1'), 'select count(*)::text from public.gym_pt_settings'), '0');
select pt.check('an admin can turn it back on', pt.q(pt.u('admin_a'), 'update public.gym_pt_settings set own_clients_only = true returning own_clients_only::text'), 'true');
select pt.check('and PTs are limited again', pt.seen('coach_a'), '0');
select pt.check('anonymous cannot read the list', pt.anon('select count(*)::text from public.pt_clients'), 'ERROR:permission denied for table pt_clients');

\o
do $$
declare bad integer;
begin
  select count(*) into bad from pt.results where not ok;
  raise notice 'pt clients: % checks, % failed', (select count(*) from pt.results), bad;
  if bad > 0 then
    raise exception 'FAILED: %', (select string_agg(seq || ' ' || label || ' [got ' || coalesce(got,'NULL') || ' / want ' || coalesce(want,'NULL') || ']', E'\n') from pt.results where not ok);
  end if;
end $$;
rollback;
