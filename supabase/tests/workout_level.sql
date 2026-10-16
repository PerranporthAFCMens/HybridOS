-- Workout level and movement link: persona tests (rolled back at the end; leaves nothing behind).
-- Runs on a FRESH local database after the migrations are applied (never on the live project).
-- Real calls run as the `authenticated` role with that user's JWT claims, so Row Level Security and the functions
-- are exercised exactly as the app would.
-- Usage:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/workout_level.sql
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
  insert into pt.results(label,got,want,ok) values(label, got, want, got is not distinct from want);
end $f$;

create table pt.persona(name text primary key, uid uuid);
insert into pt.persona values
 ('owner_a','00000000-0000-4000-8000-000000000001'), ('coach_a','00000000-0000-4000-8000-000000000003'), ('m1','00000000-0000-4000-8000-000000000011'),
 ('owner_b','00000000-0000-4000-8000-000000000022'), ('mb','00000000-0000-4000-8000-000000000021'), ('stranger','00000000-0000-4000-8000-000000000099');
insert into auth.users(id,email) select uid, name||'@wlevel.invalid' from pt.persona;
insert into public.profiles(id,display_name) select uid,name from pt.persona on conflict (id) do nothing;
create function pt.u(n text) returns uuid language sql as $$ select uid from pt.persona where name = n $$;
create function pt.gym_a() returns uuid language sql as $$ select 'a0000000-0000-4000-8000-00000000000a'::uuid $$;
create function pt.gym_b() returns uuid language sql as $$ select 'b0000000-0000-4000-8000-00000000000b'::uuid $$;
insert into public.gyms(id,name,slug,created_by) values (pt.gym_a(),'Level Gym A','wl-a',pt.u('owner_a')),(pt.gym_b(),'Level Gym B','wl-b',pt.u('owner_b'));
insert into public.gym_members(gym_id,user_id,role,is_active,access_status) values
 (pt.gym_a(),pt.u('owner_a'),'owner',true,'active'),(pt.gym_a(),pt.u('coach_a'),'coach',true,'active'),(pt.gym_a(),pt.u('m1'),'member',true,'active'),
 (pt.gym_b(),pt.u('owner_b'),'owner',true,'active'),(pt.gym_b(),pt.u('mb'),'member',true,'active');

insert into public.membership_plans(id,gym_id,name,price_pence,billing_interval) values
 ('c0000000-0000-4000-8000-000000000001',pt.gym_a(),'Basic',3000,'monthly'),('c0000000-0000-4000-8000-000000000002',pt.gym_b(),'Basic',3000,'monthly');
insert into public.memberships(gym_id,user_id,plan_id,status,starts_on) values
 (pt.gym_a(),pt.u('m1'),'c0000000-0000-4000-8000-000000000001','active',current_date-30),
 (pt.gym_b(),pt.u('mb'),'c0000000-0000-4000-8000-000000000002','active',current_date-30);

create table pt.ids(k text primary key, v uuid);
with x as (insert into public.movements(gym_id, name) values (pt.gym_a(), 'Sled Push') returning id) insert into pt.ids select 'a', id from x;
with x as (insert into public.movements(gym_id, name) values (pt.gym_b(), 'Sled Push') returning id) insert into pt.ids select 'b', id from x;
grant select on pt.ids to authenticated;
grant usage on schema pt to authenticated;

create function pt.sess(uid uuid, gym uuid, lv text) returns text language sql as $$
  select pt.q(uid, format('insert into public.workout_sessions(gym_id, user_id, title, level) values (%L, %L, ''T'', %L) returning coalesce(level, ''none'')', gym, uid, lv)) $$;
create function pt.ent(uid uuid, gym uuid, mv uuid) returns text language sql as $$
  select pt.q(uid, format('insert into public.workout_entries(session_id, gym_id, user_id, exercise_name, tracking_type, movement_id) values ((select id from public.workout_sessions where user_id = %L limit 1), %L, %L, ''Sled Push'', ''strength'', %L) returning ''ok''', uid, gym, uid, mv)) $$;

-- ---------- the level on a finished workout ----------
select pt.check('a member saves a workout at Scaled', pt.sess(pt.u('m1'), pt.gym_a(), 'scaled'), 'scaled');
select pt.check('and Rx', pt.sess(pt.u('m1'), pt.gym_a(), 'rx'), 'rx');
select pt.check('and Foundations', pt.sess(pt.u('m1'), pt.gym_a(), 'foundations'), 'foundations');
select pt.check('no level is still fine', pt.sess(pt.u('m1'), pt.gym_a(), null), 'none');
select pt.check('only the three fixed level names', pt.sess(pt.u('m1'), pt.gym_a(), 'elite'), 'ERROR:new row for relation "workout_sessions" violates check constraint "workout_sessions_level_check"');
select pt.check('a member cannot save a workout into a gym they are not in', pt.sess(pt.u('m1'), pt.gym_b(), 'rx'), 'ERROR:new row violates row-level security policy for table "workout_sessions"');
select pt.check('a member changes their own level', pt.q(pt.u('m1'), 'update public.workout_sessions set level = ''rx'' where level = ''scaled'' returning level'), 'rx');
select pt.check('another gym''s member cannot change it', pt.q(pt.u('mb'), format('update public.workout_sessions set level = ''scaled'' where user_id = %L returning 1', pt.u('m1'))), null);
select pt.check('a coach who is not their trainer cannot read the level', pt.q(pt.u('coach_a'), 'select count(*)::text from public.workout_sessions where level is not null'), '0');

-- ---------- the movement link on an exercise ----------
select pt.check('an exercise links to its gym''s movement', pt.ent(pt.u('m1'), pt.gym_a(), (select v from pt.ids where k = 'a')), 'ok');
select pt.check('no link is fine', pt.ent(pt.u('m1'), pt.gym_a(), null), 'ok');
select pt.check('a link to another gym''s movement is refused', pt.ent(pt.u('m1'), pt.gym_a(), (select v from pt.ids where k = 'b')), 'ERROR:That movement belongs to another gym');
select pt.check('moving a link to another gym''s movement is refused', pt.q(pt.u('m1'), format('update public.workout_entries set movement_id = %L where movement_id is not null returning 1', (select v from pt.ids where k = 'b'))), 'ERROR:That movement belongs to another gym');
select pt.check('a made-up movement is refused', pt.ent(pt.u('m1'), pt.gym_a(), '00000000-0000-4000-8000-0000000000ff'), 'ERROR:That movement belongs to another gym');
select pt.check('nobody can call the check directly', pt.q(pt.u('m1'), 'select private.check_entry_movement_gym()::text'), 'ERROR:permission denied for function check_entry_movement_gym');
select pt.check('switching a movement off keeps the link', pt.q(pt.u('owner_a'), format('update public.movements set is_active = false where id = %L returning is_active::text', (select v from pt.ids where k = 'a'))), 'false');
select pt.check('and the exercise still points at it', (select count(*)::text from public.workout_entries where movement_id = (select v from pt.ids where k = 'a')), '1');

\o
do $$
declare bad integer;
begin
  select count(*) into bad from pt.results where not ok;
  raise notice 'workout level: % checks, % failed', (select count(*) from pt.results), bad;
  if bad > 0 then
    raise exception 'FAILED: %', (select string_agg(seq || ' ' || label || ' [got ' || coalesce(got,'NULL') || ' / want ' || coalesce(want,'NULL') || ']', E'\n') from pt.results where not ok);
  end if;
end $$;
rollback;
