-- Lift leaderboard: persona tests (rolled back at the end; leaves nothing behind).
-- Runs on a FRESH local database after the migrations are applied (never on the live project).
-- Real queries run as the `authenticated` role with that user's JWT claims, so Row Level Security and the functions
-- are exercised exactly as the app would.
-- Usage:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/lift_leaderboard.sql
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
insert into auth.users(id,email) select uid, name||'@lifts.invalid' from pt.persona;
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
insert into public.memberships(gym_id,user_id,plan_id,status,starts_on) select pt.gym_a(), pt.u(n), 'c0000000-0000-4000-8000-000000000001', 'active', current_date-30 from unnest(array['m1','m2','m3','m4','m6','m7','m8']) n;
insert into public.memberships(gym_id,user_id,plan_id,status,starts_on) values (pt.gym_a(), pt.u('m5'), 'c0000000-0000-4000-8000-000000000001', 'cancelled', current_date-60);


update public.profiles set first_name = 'Priya', last_name = 'Nair' where id = pt.u('m1');
update public.profiles set first_name = 'Sam', last_name = 'Lee' where id = pt.u('m2');
update public.profiles set first_name = null, last_name = null, display_name = 'Dee' where id = pt.u('m3');
update public.profiles set first_name = null, last_name = null, display_name = 'Quinn' where id = pt.u('m4');
update public.profiles set first_name = 'Cancelled', last_name = 'Person' where id = pt.u('m5');
update public.profiles set first_name = 'Coach', last_name = 'Alpha' where id = pt.u('coach_a');
update public.memberships set status = 'cancelled', ends_on = current_date - 1 where user_id = pt.u('m5');

insert into public.personal_bests(gym_id, user_id, exercise_name, metric_type, comparison_direction, value_numeric, unit) values
 (pt.gym_a(), pt.u('m1'), 'Deadlift', 'weight', 'higher', 150, 'kg'),
 (pt.gym_a(), pt.u('m2'), 'Deadlift', 'weight', 'higher', 150, 'kg'),
 (pt.gym_a(), pt.u('m3'), 'Deadlift', 'weight', 'higher', 120, 'kg'),
 (pt.gym_a(), pt.u('m4'), 'Deadlift', 'weight', 'higher', 100, 'kg'),
 (pt.gym_a(), pt.u('m5'), 'Deadlift', 'weight', 'higher', 200, 'kg'),
 (pt.gym_a(), pt.u('coach_a'), 'Deadlift', 'weight', 'higher', 180, 'kg'),
 (pt.gym_a(), pt.u('m1'), 'Deadlift', 'reps', 'higher', 30, 'reps'),
 (pt.gym_a(), pt.u('m1'), 'Bench Press', 'weight', 'higher', 90, 'kg'),
 (pt.gym_b(), pt.u('mb'), 'Deadlift', 'weight', 'higher', 250, 'kg');

create function pt.lb(uid uuid, gym uuid, k text) returns text language sql as $$
  select pt.q(uid, format($s$select coalesce(string_agg(rank || ':' || display_name || ':' || value::numeric(10,1) || case when is_me then '*' else '' end, ' | ' order by rank, display_name), '') from public.get_lift_leaderboard(%L, %L)$s$, gym, k)) $$;
create function pt.tick(uid uuid, gym uuid, k text) returns text language sql as $$
  select pt.q(uid, format($s$insert into public.tracked_lifts(gym_id, exercise_key, exercise_name) values (%L, %L, initcap(%L)) returning exercise_key$s$, gym, k, k)) $$;

-- ---------- ticking lifts ----------
select pt.check('an admin can tick a lift', pt.tick(pt.u('admin_a'), pt.gym_a(), 'deadlift'), 'deadlift');
select pt.check('an owner can tick a lift', pt.tick(pt.u('owner_a'), pt.gym_a(), 'back squat'), 'back squat');
select pt.check('the key must be lower case', pt.q(pt.u('admin_a'), format($s$insert into public.tracked_lifts(gym_id, exercise_key, exercise_name) values (%L, 'Bench Press', 'Bench Press') returning 1$s$, pt.gym_a())) like 'ERROR:%', true);
select pt.check('staff cannot tick a lift', pt.tick(pt.u('staff_a'), pt.gym_a(), 'bench press') like 'ERROR:%', true);
select pt.check('a coach cannot tick a lift', pt.tick(pt.u('coach_a'), pt.gym_a(), 'bench press') like 'ERROR:%', true);
select pt.check('a member cannot tick a lift', pt.tick(pt.u('m1'), pt.gym_a(), 'bench press') like 'ERROR:%', true);
select pt.check('an admin of another gym cannot tick a lift here', pt.tick(pt.u('admin_b'), pt.gym_a(), 'bench press') like 'ERROR:%', true);
select pt.check('a member can read the ticked lifts', pt.q(pt.u('m1'), format($s$select string_agg(exercise_key, ',' order by exercise_key) from public.tracked_lifts where gym_id = %L$s$, pt.gym_a())), 'back squat,deadlift');
select pt.check('a member of another gym cannot read them', pt.q(pt.u('mb'), format($s$select count(*) from public.tracked_lifts where gym_id = %L$s$, pt.gym_a())), '0');
select pt.check('a cancelled member cannot read them', pt.q(pt.u('m5'), format($s$select count(*) from public.tracked_lifts where gym_id = %L$s$, pt.gym_a())), '0');
select pt.check('someone not signed in cannot read them', pt.anon('select count(*) from public.tracked_lifts') like 'ERROR:%', true);
select pt.check('a member cannot untick a lift', pt.q(pt.u('m1'), format($s$with d as (delete from public.tracked_lifts where gym_id = %L returning 1) select count(*) from d$s$, pt.gym_a())), '0');
select pt.check('an admin can untick a lift', pt.q(pt.u('admin_a'), format($s$with d as (delete from public.tracked_lifts where gym_id = %L and exercise_key = 'back squat' returning 1) select count(*) from d$s$, pt.gym_a())), '1');

-- ---------- who is listed: shown unless they opt out ----------
select pt.check('with nothing set, everyone active is listed; ties share a place; the cancelled member is not; you are marked',
  pt.lb(pt.u('m4'), pt.gym_a(), 'deadlift'), '1:Coach A.:180.0 | 2:Priya N.:150.0 | 2:Sam L.:150.0 | 4:Dee:120.0 | 5:Quinn:100.0*');
select pt.check('only the heaviest weight counts, not reps', pt.lb(pt.u('m1'), pt.gym_a(), 'deadlift') like '%Priya N.:150.0*%', true);
select pt.check('a lift that is not ticked has no leaderboard', pt.lb(pt.u('m1'), pt.gym_a(), 'bench press'), '');
select pt.check('the key is matched without caring about case or spaces', pt.lb(pt.u('m4'), pt.gym_a(), '  DEADLIFT ') like '1:Coach A.:180.0%', true);
select pt.check('someone from another gym sees nothing', pt.lb(pt.u('mb'), pt.gym_a(), 'deadlift'), '');
select pt.check('a cancelled member sees nothing', pt.lb(pt.u('m5'), pt.gym_a(), 'deadlift'), '');
select pt.check('someone not signed in cannot call it', pt.anon(format($s$select count(*) from public.get_lift_leaderboard(%L, 'deadlift')$s$, pt.gym_a())) like 'ERROR:%', true);
select pt.check('another gym''s boards are separate', pt.lb(pt.u('admin_b'), pt.gym_b(), 'deadlift'), '');

-- ---------- a member opts out ----------
select pt.check('a member can hide themselves', pt.q(pt.u('m2'), format($s$insert into public.member_lift_choice(gym_id, user_id, show) values (%L, auth.uid(), false) returning show$s$, pt.gym_a())), 'false');
select pt.check('then they are gone from other people''s view', pt.lb(pt.u('m4'), pt.gym_a(), 'deadlift'), '1:Coach A.:180.0 | 2:Priya N.:150.0 | 3:Dee:120.0 | 4:Quinn:100.0*');
select pt.check('but still see their own row', pt.lb(pt.u('m2'), pt.gym_a(), 'deadlift') like '%Sam L.:150.0*%', true);
select pt.check('a member cannot change someone else''s choice', pt.q(pt.u('m1'), format($s$insert into public.member_lift_choice(gym_id, user_id, show) values (%L, %L, false) returning 1$s$, pt.gym_a(), pt.u('m3'))) like 'ERROR:%', true);
select pt.check('a member cannot read someone else''s choice', pt.q(pt.u('m1'), 'select count(*) from public.member_lift_choice'), '0');
select pt.check('an admin cannot read it either', pt.q(pt.u('admin_a'), 'select count(*) from public.member_lift_choice'), '0');
select pt.check('a member can change their mind', pt.q(pt.u('m2'), format($s$update public.member_lift_choice set show = true where gym_id = %L and user_id = auth.uid() returning show$s$, pt.gym_a())), 'true');
select pt.check('and they are back', pt.lb(pt.u('m4'), pt.gym_a(), 'deadlift') like '%2:Sam L.:150.0%', true);
select pt.check('a cancelled member cannot save a choice', pt.q(pt.u('m5'), format($s$insert into public.member_lift_choice(gym_id, user_id, show) values (%L, auth.uid(), true) returning 1$s$, pt.gym_a())) like 'ERROR:%', true);

-- ---------- the gym's switch: flip it and the people who never chose follow ----------
select pt.check('a member cannot change the gym''s switch', pt.q(pt.u('m1'), format($s$insert into public.gym_lift_settings(gym_id, show_by_default) values (%L, false) returning 1$s$, pt.gym_a())) like 'ERROR:%', true);
select pt.check('staff cannot change it', pt.q(pt.u('staff_a'), format($s$insert into public.gym_lift_settings(gym_id, show_by_default) values (%L, false) returning 1$s$, pt.gym_a())) like 'ERROR:%', true);
select pt.check('an admin can switch to opt-in', pt.q(pt.u('admin_a'), format($s$insert into public.gym_lift_settings(gym_id, show_by_default) values (%L, false) returning show_by_default$s$, pt.gym_a())), 'false');
select pt.check('now only people who chose to show (m2) and you are listed',
  pt.lb(pt.u('m4'), pt.gym_a(), 'deadlift'), '1:Sam L.:150.0 | 2:Quinn:100.0*');
select pt.check('a member can still read the gym''s switch', pt.q(pt.u('m1'), format($s$select show_by_default from public.gym_lift_settings where gym_id = %L$s$, pt.gym_a())), 'false');
select pt.check('another gym''s member cannot', pt.q(pt.u('mb'), format($s$select count(*) from public.gym_lift_settings where gym_id = %L$s$, pt.gym_a())), '0');
select pt.check('an admin can switch back', pt.q(pt.u('admin_a'), format($s$update public.gym_lift_settings set show_by_default = true where gym_id = %L returning show_by_default$s$, pt.gym_a())), 'true');
select pt.check('and everyone who never chose is listed again',
  pt.lb(pt.u('m4'), pt.gym_a(), 'deadlift'), '1:Coach A.:180.0 | 2:Priya N.:150.0 | 2:Sam L.:150.0 | 4:Dee:120.0 | 5:Quinn:100.0*');
select pt.check('an explicit hide beats the gym default', (select pt.q(pt.u('m3'), format($s$insert into public.member_lift_choice(gym_id, user_id, show) values (%L, auth.uid(), false) returning show$s$, pt.gym_a()))), 'false');
select pt.check('...and the board follows it', pt.lb(pt.u('m4'), pt.gym_a(), 'deadlift') like '%Dee%', false);

-- ---------- long boards: top 50 plus you ----------
insert into auth.users(id,email) select ('00000000-0000-4000-8000-0000000001' || lpad(g::text, 2, '0'))::uuid, 'bulk' || g || '@lifts.invalid' from generate_series(1, 55) g;
insert into public.profiles(id,display_name) select ('00000000-0000-4000-8000-0000000001' || lpad(g::text, 2, '0'))::uuid, 'Bulk ' || g from generate_series(1, 55) g on conflict (id) do nothing;
insert into public.gym_members(gym_id,user_id,role,is_active,access_status) select pt.gym_a(), ('00000000-0000-4000-8000-0000000001' || lpad(g::text, 2, '0'))::uuid, 'member', true, 'active' from generate_series(1, 55) g;
insert into public.memberships(gym_id,user_id,plan_id,status,starts_on) select pt.gym_a(), ('00000000-0000-4000-8000-0000000001' || lpad(g::text, 2, '0'))::uuid, 'c0000000-0000-4000-8000-000000000001', 'active', current_date-30 from generate_series(1, 55) g;
insert into public.personal_bests(gym_id, user_id, exercise_name, metric_type, comparison_direction, value_numeric, unit) select pt.gym_a(), ('00000000-0000-4000-8000-0000000001' || lpad(g::text, 2, '0'))::uuid, 'Deadlift', 'weight', 'higher', 300 + g, 'kg' from generate_series(1, 55) g;
select pt.check('a long board shows 50 people', pt.q(pt.u('m1'), format($s$select count(*) from public.get_lift_leaderboard(%L, 'deadlift')$s$, pt.gym_a())), '51');
select pt.check('...which is the top 50 plus you if you are lower down', pt.q(pt.u('m1'), format($s$select count(*) from public.get_lift_leaderboard(%L, 'deadlift') where is_me$s$, pt.gym_a())), '1');
select pt.check('someone in the top 50 has no extra row', pt.q((select ('00000000-0000-4000-8000-0000000001' || lpad('55', 2, '0'))::uuid), format($s$select count(*) from public.get_lift_leaderboard(%L, 'deadlift')$s$, pt.gym_a())), '50');

\o
do $$
declare bad integer;
begin
  select count(*) into bad from pt.results where not ok;
  raise notice 'lift leaderboard: % checks, % failed', (select count(*) from pt.results), bad;
  if bad > 0 then
    raise exception 'FAILED: %', (select string_agg(seq || ' ' || label || ' [got ' || coalesce(got,'NULL') || ' / want ' || coalesce(want,'NULL') || ']', E'\n') from pt.results where not ok);
  end if;
end $$;
rollback;
