-- Staff tables access: persona tests (rolled back at the end; leaves nothing behind).
-- Runs on a FRESH local database after the migrations are applied (never on the live project).
-- Real queries run as the `authenticated` role with that user's JWT claims, so Row Level Security and the functions
-- are exercised exactly as the app would.
-- Usage:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/staff_tables_access.sql
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

insert into public.gyms(id,name,slug,created_by) values (pt.gym_a(),'Staff Gym A','st-a',pt.u('owner_a')),(pt.gym_b(),'Staff Gym B','st-b',pt.u('admin_b'));
insert into public.gym_members(gym_id,user_id,role,is_active,access_status) values
 (pt.gym_a(),pt.u('owner_a'),'owner',true,'active'),(pt.gym_a(),pt.u('admin_a'),'admin',true,'active'),(pt.gym_a(),pt.u('staff_a'),'staff',true,'active'),(pt.gym_a(),pt.u('coach_a'),'coach',true,'active'),
 (pt.gym_a(),pt.u('m1'),'member',true,'active'),
 (pt.gym_b(),pt.u('admin_b'),'owner',true,'active'),(pt.gym_b(),pt.u('mb'),'member',true,'active');

-- Two staff details rows and two working-hours rows in gym A, one of each in gym B (set up as the database owner, so RLS does not apply)
insert into public.staff_profiles(gym_id,user_id,job_title,gross_hourly_rate_pence,employment_type) values
 (pt.gym_a(),pt.u('staff_a'),'Front desk',1200,'hourly'),(pt.gym_a(),pt.u('coach_a'),'Coach',2500,'hourly'),(pt.gym_b(),pt.u('admin_b'),'Owner',null,'salary');
insert into public.staff_working_hours(gym_id,user_id,weekday,is_working,start_time,end_time) values
 (pt.gym_a(),pt.u('staff_a'),1,true,'09:00','17:00'),(pt.gym_a(),pt.u('coach_a'),2,true,'06:00','12:00'),(pt.gym_b(),pt.u('admin_b'),1,true,'09:00','17:00');

-- Reading hours: the team of the gym, nobody else
select pt.check('owner reads the hours of their gym', pt.q(pt.u('owner_a'), format($s$select count(*)::text from public.staff_working_hours where gym_id=%L$s$, pt.gym_a())), '2');
select pt.check('admin reads the hours', pt.q(pt.u('admin_a'), format($s$select count(*)::text from public.staff_working_hours where gym_id=%L$s$, pt.gym_a())), '2');
select pt.check('staff reads the hours', pt.q(pt.u('staff_a'), format($s$select count(*)::text from public.staff_working_hours where gym_id=%L$s$, pt.gym_a())), '2');
select pt.check('coach reads the hours', pt.q(pt.u('coach_a'), format($s$select count(*)::text from public.staff_working_hours where gym_id=%L$s$, pt.gym_a())), '2');
select pt.check('an ordinary member reads none of the hours', pt.q(pt.u('m1'), format($s$select count(*)::text from public.staff_working_hours where gym_id=%L$s$, pt.gym_a())), '0');
select pt.check('another gym''s owner reads none of them', pt.q(pt.u('admin_b'), format($s$select count(*)::text from public.staff_working_hours where gym_id=%L$s$, pt.gym_a())), '0');
select pt.check('the public cannot read the hours', pt.anon($s$select count(*)::text from public.staff_working_hours$s$), 'ERROR:permission denied%');

-- Writing hours: owners and admins only
select pt.check('owner adds a day of hours', pt.q(pt.u('owner_a'), format($s$with x as (insert into public.staff_working_hours(gym_id,user_id,weekday,is_working,start_time,end_time) values (%L,%L,3,true,'10:00','14:00') returning 1) select count(*)::text from x$s$, pt.gym_a(), pt.u('staff_a'))), '1');
select pt.check('owner saves the same day again (the screen upserts)', pt.q(pt.u('owner_a'), format($s$with x as (insert into public.staff_working_hours(gym_id,user_id,weekday,is_working,start_time,end_time) values (%L,%L,3,true,'11:00','15:00') on conflict (gym_id,user_id,weekday) do update set start_time=excluded.start_time, end_time=excluded.end_time returning 1) select count(*)::text from x$s$, pt.gym_a(), pt.u('staff_a'))), '1');
select pt.check('staff cannot add hours', pt.q(pt.u('staff_a'), format($s$with x as (insert into public.staff_working_hours(gym_id,user_id,weekday,is_working,start_time,end_time) values (%L,%L,4,true,'10:00','14:00') returning 1) select count(*)::text from x$s$, pt.gym_a(), pt.u('staff_a'))), 'ERROR:new row violates%');
select pt.check('a member cannot add hours', pt.q(pt.u('m1'), format($s$with x as (insert into public.staff_working_hours(gym_id,user_id,weekday,is_working,start_time,end_time) values (%L,%L,4,true,'10:00','14:00') returning 1) select count(*)::text from x$s$, pt.gym_a(), pt.u('m1'))), 'ERROR:new row violates%');
select pt.check('another gym''s owner cannot add hours here', pt.q(pt.u('admin_b'), format($s$with x as (insert into public.staff_working_hours(gym_id,user_id,weekday,is_working,start_time,end_time) values (%L,%L,4,true,'10:00','14:00') returning 1) select count(*)::text from x$s$, pt.gym_a(), pt.u('staff_a'))), 'ERROR:new row violates%');
select pt.check('nobody can delete hours (no delete right)', pt.q(pt.u('owner_a'), format($s$with x as (delete from public.staff_working_hours where gym_id=%L returning 1) select count(*)::text from x$s$, pt.gym_a())), 'ERROR:permission denied%');

-- Staff details (these include pay): owners and admins see all, a team member sees only their own, members and the public see none
select pt.check('owner reads every staff detail row of their gym', pt.q(pt.u('owner_a'), format($s$select count(*)::text from public.staff_profiles where gym_id=%L$s$, pt.gym_a())), '2');
select pt.check('admin reads them', pt.q(pt.u('admin_a'), format($s$select count(*)::text from public.staff_profiles where gym_id=%L$s$, pt.gym_a())), '2');
select pt.check('staff reads only their own row', pt.q(pt.u('staff_a'), format($s$select count(*)::text from public.staff_profiles where gym_id=%L$s$, pt.gym_a())), '1');
select pt.check('and cannot see a colleague''s pay', pt.q(pt.u('staff_a'), format($s$select count(*)::text from public.staff_profiles where gym_id=%L and user_id=%L$s$, pt.gym_a(), pt.u('coach_a'))), '0');
select pt.check('an ordinary member reads none', pt.q(pt.u('m1'), format($s$select count(*)::text from public.staff_profiles where gym_id=%L$s$, pt.gym_a())), '0');
select pt.check('another gym''s owner reads none', pt.q(pt.u('admin_b'), format($s$select count(*)::text from public.staff_profiles where gym_id=%L$s$, pt.gym_a())), '0');
select pt.check('the public cannot read them', pt.anon($s$select count(*)::text from public.staff_profiles$s$), 'ERROR:permission denied%');
select pt.check('owner saves a staff member''s details (the screen upserts)', pt.q(pt.u('owner_a'), format($s$with x as (insert into public.staff_profiles(gym_id,user_id,job_title,gross_hourly_rate_pence,employment_type,is_active) values (%L,%L,'Head coach',3000,'hourly',true) on conflict (gym_id,user_id) do update set job_title=excluded.job_title, gross_hourly_rate_pence=excluded.gross_hourly_rate_pence returning 1) select count(*)::text from x$s$, pt.gym_a(), pt.u('coach_a'))), '1');
select pt.check('and it is saved', pt.q(pt.u('owner_a'), format($s$select gross_hourly_rate_pence::text from public.staff_profiles where gym_id=%L and user_id=%L$s$, pt.gym_a(), pt.u('coach_a'))), '3000');
select pt.check('staff cannot change their own pay', pt.q(pt.u('staff_a'), format($s$with x as (update public.staff_profiles set gross_hourly_rate_pence=9999 where gym_id=%L and user_id=%L returning 1) select count(*)::text from x$s$, pt.gym_a(), pt.u('staff_a'))), '0');
select pt.check('and cannot add a row for someone else', pt.q(pt.u('staff_a'), format($s$with x as (insert into public.staff_profiles(gym_id,user_id,job_title) values (%L,%L,'x') returning 1) select count(*)::text from x$s$, pt.gym_a(), pt.u('m1'))), 'ERROR:new row violates%');
select pt.check('nobody can delete staff details (no delete right)', pt.q(pt.u('owner_a'), format($s$with x as (delete from public.staff_profiles where gym_id=%L returning 1) select count(*)::text from x$s$, pt.gym_a())), 'ERROR:permission denied%');

\o
do $$
declare bad integer;
begin
  select count(*) into bad from pt.results where not ok;
  raise notice 'staff tables access: % checks, % failed', (select count(*) from pt.results), bad;
  if bad > 0 then
    raise exception 'FAILED: %', (select string_agg(seq || ' ' || label || ' [got ' || coalesce(got,'NULL') || ' / want ' || coalesce(want,'NULL') || ']', E'\n') from pt.results where not ok);
  end if;
end $$;
rollback;
