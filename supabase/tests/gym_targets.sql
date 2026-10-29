-- Targets: persona tests (rolled back at the end; leaves nothing behind).
-- Runs on a FRESH local database after the migrations are applied (never on the live project).
-- Usage:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/gym_targets.sql
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
 ('owner_a','00000000-0000-4000-8000-000000000001'), ('coach_a','00000000-0000-4000-8000-000000000003'), ('coach_a2','00000000-0000-4000-8000-000000000004'), ('m1','00000000-0000-4000-8000-000000000011'),
 ('owner_b','00000000-0000-4000-8000-000000000022');
insert into auth.users(id,email) select uid, name||'@targets.invalid' from pt.persona;
insert into public.profiles(id,display_name) select uid,name from pt.persona on conflict (id) do nothing;
create function pt.u(n text) returns uuid language sql as $$ select uid from pt.persona where name = n $$;
create function pt.gym_a() returns uuid language sql as $$ select 'a0000000-0000-4000-8000-00000000000a'::uuid $$;
create function pt.gym_b() returns uuid language sql as $$ select 'b0000000-0000-4000-8000-00000000000b'::uuid $$;
insert into public.gyms(id,name,slug,created_by) values (pt.gym_a(),'Targets Gym A','tg-a',pt.u('owner_a')),(pt.gym_b(),'Targets Gym B','tg-b',pt.u('owner_b'));
insert into public.gym_members(gym_id,user_id,role,is_active,access_status) values
 (pt.gym_a(),pt.u('owner_a'),'owner',true,'active'),(pt.gym_a(),pt.u('coach_a'),'coach',true,'active'),(pt.gym_a(),pt.u('coach_a2'),'coach',true,'active'),(pt.gym_a(),pt.u('m1'),'member',true,'active'),
 (pt.gym_b(),pt.u('owner_b'),'owner',true,'active');
grant usage on schema pt to authenticated;

create function pt.setg(uid uuid, gym uuid, who uuid, m text, v int) returns text language sql as $$
  select pt.q(uid, format('insert into public.gym_targets(gym_id, user_id, metric, target_value) values (%L, %L, %L, %s) returning target_value::text', gym, who, m, v)) $$;

select pt.check('an owner sets a gym income target', pt.setg(pt.u('owner_a'), pt.gym_a(), null, 'income_pence', 500000), '500000');
select pt.check('an owner sets a coach''s class target', pt.setg(pt.u('owner_a'), pt.gym_a(), pt.u('coach_a'), 'classes_taught', 20), '20');
select pt.check('an owner sets another coach''s target', pt.setg(pt.u('owner_a'), pt.gym_a(), pt.u('coach_a2'), 'pt_sessions', 12), '12');
select pt.check('only one target per measure', pt.setg(pt.u('owner_a'), pt.gym_a(), null, 'income_pence', 1), 'ERROR:duplicate key value violates unique constraint "gym_targets_one_each"');
select pt.check('a gym measure cannot be put on a person', pt.setg(pt.u('owner_a'), pt.gym_a(), pt.u('coach_a'), 'income_pence', 1), 'ERROR:new row for relation "gym_targets" violates check constraint "gym_targets_who"');
select pt.check('a staff measure cannot be put on the whole gym', pt.setg(pt.u('owner_a'), pt.gym_a(), null, 'classes_taught', 1), 'ERROR:new row for relation "gym_targets" violates check constraint "gym_targets_who"');
select pt.check('a target cannot be negative', pt.setg(pt.u('owner_a'), pt.gym_a(), null, 'members_joined', -1), 'ERROR:new row for relation "gym_targets" violates check constraint "gym_targets_value"');
select pt.check('an unknown measure is refused', pt.setg(pt.u('owner_a'), pt.gym_a(), null, 'nonsense', 1), 'ERROR:new row for relation "gym_targets" violates check constraint "gym_targets_metric"');
select pt.check('a coach cannot set a target', pt.setg(pt.u('coach_a'), pt.gym_a(), pt.u('coach_a'), 'pt_sessions', 99), 'ERROR:new row violates row-level security policy for table "gym_targets"');
select pt.check('a member cannot set a target', pt.setg(pt.u('m1'), pt.gym_a(), null, 'members_joined', 99), 'ERROR:new row violates row-level security policy for table "gym_targets"');
select pt.check('another gym''s owner cannot set one here', pt.setg(pt.u('owner_b'), pt.gym_a(), null, 'members_joined', 99), 'ERROR:new row violates row-level security policy for table "gym_targets"');
select pt.check('signed-out people cannot set one', pt.anon(format('insert into public.gym_targets(gym_id, metric, target_value) values (%L, ''members_joined'', 5) returning 1', pt.gym_a())), 'ERROR:permission denied for table gym_targets');

select pt.check('an owner reads all three', pt.q(pt.u('owner_a'), 'select count(*)::text from public.gym_targets'), '3');
select pt.check('a coach reads only their own', pt.q(pt.u('coach_a'), 'select string_agg(metric, '','') from public.gym_targets'), 'classes_taught');
select pt.check('the other coach reads only theirs', pt.q(pt.u('coach_a2'), 'select string_agg(metric, '','') from public.gym_targets'), 'pt_sessions');
select pt.check('a member reads none', pt.q(pt.u('m1'), 'select count(*)::text from public.gym_targets'), '0');
select pt.check('another gym''s owner reads none', pt.q(pt.u('owner_b'), 'select count(*)::text from public.gym_targets'), '0');
select pt.check('a coach cannot change their own target', pt.q(pt.u('coach_a'), 'update public.gym_targets set target_value = 1 returning 1'), null);
select pt.check('an owner can change one', pt.q(pt.u('owner_a'), 'update public.gym_targets set target_value = 600000 where metric = ''income_pence'' returning target_value::text'), '600000');

\o
do $$
declare bad integer;
begin
  select count(*) into bad from pt.results where not ok;
  raise notice 'gym targets: % checks, % failed', (select count(*) from pt.results), bad;
  if bad > 0 then
    raise exception 'FAILED: %', (select string_agg(seq || ' ' || label || ' [got ' || coalesce(got,'NULL') || ' / want ' || coalesce(want,'NULL') || ']', E'\n') from pt.results where not ok);
  end if;
end $$;
rollback;
