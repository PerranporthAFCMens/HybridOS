-- Class blocks and the leaderboard: persona tests (rolled back at the end; leaves nothing behind).
-- Runs on a FRESH local database after the migrations are applied (never on the live project).
-- Real queries run as the `authenticated` role with that user's JWT claims, so Row Level Security and the functions
-- are exercised exactly as the app would.
-- Usage:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/class_blocks_and_leaderboard.sql
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
 (pt.gym_a(),pt.u('m1'),'member',true,'active'),(pt.gym_a(),pt.u('m2'),'member',true,'active'),(pt.gym_a(),pt.u('m3'),'member',true,'active'),(pt.gym_a(),pt.u('m4'),'member',true,'active'),(pt.gym_a(),pt.u('m5'),'member',true,'active'),(pt.gym_a(),pt.u('m6'),'member',true,'active'),(pt.gym_a(),pt.u('m7'),'member',true,'active'),(pt.gym_a(),pt.u('m8'),'member',true,'active'),
 (pt.gym_b(),pt.u('admin_b'),'owner',true,'active'),(pt.gym_b(),pt.u('mb'),'member',true,'active');

insert into public.membership_plans(id,gym_id,name,price_pence,billing_interval) values ('c0000000-0000-4000-8000-000000000001',pt.gym_a(),'Basic',3000,'monthly');
insert into public.memberships(gym_id,user_id,plan_id,status,starts_on) select pt.gym_a(), pt.u(n), 'c0000000-0000-4000-8000-000000000001', 'active', current_date-30 from unnest(array['m1','m2','m3','m4','m6','m7','m8']) n;
insert into public.memberships(gym_id,user_id,plan_id,status,starts_on) values (pt.gym_a(), pt.u('m5'), 'c0000000-0000-4000-8000-000000000001', 'cancelled', current_date-60);


update public.profiles set first_name = 'Priya', last_name = 'Nair' where id = pt.u('m2');
-- gym B's own class, for the other-gym checks
insert into public.class_sessions(id, gym_id, name, starts_at, ends_at, capacity) values
 (pt.c1(), pt.gym_a(), 'Hybrid 6pm', now() + interval '1 day', now() + interval '1 day 1 hour', 20),
 (pt.c2(), pt.gym_a(), 'Hybrid 7pm', now() + interval '2 days', now() + interval '2 days 1 hour', 20),
 ('f0000000-0000-4000-8000-000000000003', pt.gym_a(), 'Far future', now() + interval '300 days', now() + interval '300 days 1 hour', 20),
 ('f0000000-0000-4000-8000-000000000004', pt.gym_b(), 'Gym B class', now() + interval '1 day', now() + interval '1 day 1 hour', 20);
insert into public.class_session_staff(session_id, gym_id, user_id, assignment_role, is_lead) values (pt.c1(), pt.gym_a(), pt.u('coach_a'), 'coach', true);
-- everyone in the class: m1 booked, m2 attended, m6, m7, m8 booked, m3 no-show, m5 attended with a cancelled membership; m4 never booked
insert into public.class_bookings(gym_id, session_id, user_id, status) values
 (pt.gym_a(), pt.c1(), pt.u('m1'), 'booked'), (pt.gym_a(), pt.c1(), pt.u('m2'), 'attended'), (pt.gym_a(), pt.c1(), pt.u('m6'), 'booked'),
 (pt.gym_a(), pt.c1(), pt.u('m7'), 'booked'), (pt.gym_a(), pt.c1(), pt.u('m8'), 'booked'), (pt.gym_a(), pt.c1(), pt.u('m3'), 'no_show'),
 (pt.gym_a(), pt.c1(), pt.u('m5'), 'attended'),
 (pt.gym_a(), pt.c2(), pt.u('m1'), 'booked'), (pt.gym_a(), pt.c2(), pt.u('m2'), 'booked');
update public.memberships set status = 'cancelled', ends_on = current_date - 1 where user_id = pt.u('m5');

create function pt.blk(uid uuid, gym uuid, nm text, wks int) returns text language sql as $$
  select pt.q(uid, format('insert into public.class_blocks(gym_id, name, starts_on, weeks) values (%L, %L, current_date - 1, %s) returning name', gym, nm, wks)) $$;
create function pt.join_blk(uid uuid, blk uuid, sess uuid, gym uuid) returns text language sql as $$
  select pt.q(uid, format('insert into public.class_block_sessions(session_id, block_id, gym_id) values (%L, %L, %L) returning session_id::text', sess, blk, gym)) $$;
create function pt.board(uid uuid, sess uuid) returns text language sql as $$
  select pt.q(uid, format('select coalesce(string_agg(rank || '':'' || display_name || '':'' || value::text || '':'' || is_me::text, '' / '' order by rank, display_name), ''none'') from public.get_class_leaderboard(%L)', sess)) $$;
create function pt.rec(uid uuid, sess uuid, ex text, reps int[], secs int[], share boolean default true) returns void language plpgsql as $$
declare s uuid; e uuid; i int;
begin
  insert into public.workout_sessions(gym_id, user_id, title, performed_at, class_session_id, share_score) values (pt.gym_a(), uid, 'Class', now(), sess, share) returning id into s;
  insert into public.workout_entries(session_id, gym_id, user_id, exercise_name, tracking_type, position) values (s, pt.gym_a(), uid, ex, 'strength', 0) returning id into e;
  for i in 1 .. greatest(coalesce(array_length(reps,1),0), coalesce(array_length(secs,1),0)) loop
    insert into public.workout_sets(entry_id, set_number, reps, duration_seconds) values (e, i, reps[i], secs[i]);
  end loop;
end $$;

-- ---------- blocks ----------
select pt.check('an admin can create a block', pt.blk(pt.u('admin_a'), pt.gym_a(), 'Hybrid Uppers', 6), 'Hybrid Uppers');
select pt.check('an owner can', pt.blk(pt.u('owner_a'), pt.gym_a(), 'Lower block', 4), 'Lower block');
select pt.check('a coach cannot', pt.blk(pt.u('coach_a'), pt.gym_a(), 'x', 6), 'ERROR:new row violates row-level security policy for table "class_blocks"');
select pt.check('staff cannot', pt.blk(pt.u('staff_a'), pt.gym_a(), 'x', 6), 'ERROR:new row violates row-level security policy for table "class_blocks"');
select pt.check('a member cannot', pt.blk(pt.u('m1'), pt.gym_a(), 'x', 6), 'ERROR:new row violates row-level security policy for table "class_blocks"');
select pt.check('another gym''s admin cannot', pt.blk(pt.u('admin_b'), pt.gym_a(), 'x', 6), 'ERROR:new row violates row-level security policy for table "class_blocks"');
select pt.check('a block needs a name and 1 to 52 weeks', pt.blk(pt.u('admin_a'), pt.gym_a(), ' ', 6) || ' / ' || pt.blk(pt.u('admin_a'), pt.gym_a(), 'x', 0) || ' / ' || pt.blk(pt.u('admin_a'), pt.gym_a(), 'x', 53),
  'ERROR:new row for relation "class_blocks" violates check constraint "class_blocks_name_check" / ERROR:new row for relation "class_blocks" violates check constraint "class_blocks_weeks_check" / ERROR:new row for relation "class_blocks" violates check constraint "class_blocks_weeks_check"');
select pt.check('members of the gym can read blocks', pt.q(pt.u('m1'), 'select count(*)::text from public.class_blocks'), '2');
select pt.check('another gym''s member cannot', pt.q(pt.u('mb'), 'select count(*)::text from public.class_blocks'), '0');
select pt.check('a member whose membership has ended cannot', pt.q(pt.u('m5'), 'select count(*)::text from public.class_blocks'), '0');
select pt.check('anonymous cannot', pt.anon('select count(*)::text from public.class_blocks'), 'ERROR:permission denied for table class_blocks');
create function pt.b1() returns uuid language sql as $$ select id from public.class_blocks where name = 'Hybrid Uppers' $$;

select pt.check('an admin puts a class in the block', pt.join_blk(pt.u('admin_a'), pt.b1(), pt.c1(), pt.gym_a()), pt.c1()::text);
select pt.check('and a second class (the coach picks one class or several)', pt.join_blk(pt.u('admin_a'), pt.b1(), pt.c2(), pt.gym_a()), pt.c2()::text);
select pt.check('a coach cannot', pt.q(pt.u('coach_a'), format('delete from public.class_block_sessions where session_id = %L returning 1', pt.c1())), NULL);
select pt.check('a class outside the block''s weeks is refused', pt.join_blk(pt.u('admin_a'), pt.b1(), 'f0000000-0000-4000-8000-000000000003', pt.gym_a()), 'ERROR:That class is outside the weeks of this block');
select pt.check('a class from another gym is refused', pt.join_blk(pt.u('admin_a'), pt.b1(), 'f0000000-0000-4000-8000-000000000004', pt.gym_a()), 'ERROR:That class is not in the same gym as the block');
select pt.check('a class can be in only one block', pt.join_blk(pt.u('owner_a'), (select id from public.class_blocks where name = 'Lower block'), pt.c1(), pt.gym_a()), 'ERROR:duplicate key value violates unique constraint "class_block_sessions_pkey"');
select pt.check('members can see which classes are in a block', pt.q(pt.u('m1'), 'select count(*)::text from public.class_block_sessions'), '2');
select pt.check('another gym''s member cannot', pt.q(pt.u('mb'), 'select count(*)::text from public.class_block_sessions'), '0');
select pt.check('a member cannot take a class out', pt.q(pt.u('m1'), 'with d as (delete from public.class_block_sessions returning 1) select count(*)::text from d'), '0');

-- ---------- the score on a class workout ----------
insert into public.class_session_workouts(session_id, gym_id, title, workout_snapshot, published_at, published_by) values
 (pt.c1(), pt.gym_a(), 'Push-up test', '{}', now(), pt.u('coach_a')),
 (pt.c2(), pt.gym_a(), 'Row test', '{}', null, pt.u('coach_a'));
select pt.check('a score needs both an exercise and what counts', pt.q(pt.u('coach_a'), format('update public.class_session_workouts set score_exercise = %L where session_id = %L returning 1', 'Push-ups', pt.c1())), 'ERROR:new row for relation "class_session_workouts" violates check constraint "class_session_workouts_score_pair"');
select pt.check('only known kinds of score are allowed', pt.q(pt.u('coach_a'), format('update public.class_session_workouts set score_exercise = %L, score_metric = %L where session_id = %L returning 1', 'Push-ups', 'vibes', pt.c1())), 'ERROR:new row for relation "class_session_workouts" violates check constraint "class_session_workouts_score_metric_check"');
select pt.check('the coach sets the score: most reps of Push-ups', pt.q(pt.u('coach_a'), format('update public.class_session_workouts set score_exercise = %L, score_metric = %L where session_id = %L returning score_metric', 'Push-ups', 'reps', pt.c1())), 'reps');

-- recorded results
select pt.rec(pt.u('m1'), pt.c1(), 'Push-ups', array[30, 25], array[null, null]::int[]);
select pt.rec(pt.u('m2'), pt.c1(), 'Push-ups', array[35], array[null]::int[]);
select pt.rec(pt.u('m6'), pt.c1(), 'push-UPS', array[35], array[null]::int[]);
select pt.rec(pt.u('m7'), pt.c1(), 'Push-ups', array[50], array[null]::int[]);
select pt.rec(pt.u('m8'), pt.c1(), 'Push-ups', array[60], array[null]::int[], false);
insert into public.member_score_settings(user_id, share_scores) values (pt.u('m7'), false);
-- someone who did a different exercise instead has no score for this one
select pt.rec(pt.u('m2'), pt.c1(), 'Knee push-ups', array[99], array[null]::int[]);

select pt.check('a member in the class sees the ranked list: names shortened, ties share a place, opt-outs left out', pt.board(pt.u('m1'), pt.c1()), '1:Priya N.:35:false / 1:m6:35:false / 3:m1:30:true');
select pt.check('the exercise is matched whatever the capital letters', pt.q(pt.u('m1'), format('select count(*)::text from public.get_class_leaderboard(%L) where display_name = %L', pt.c1(), 'm6')), '1');
select pt.check('someone who opted out is not listed for others but sees their own row', pt.board(pt.u('m7'), pt.c1()), '1:m7:50:true / 2:Priya N.:35:false / 2:m6:35:false / 4:m1:30:false');
select pt.check('someone who left one workout off is not listed for others but sees their own', pt.board(pt.u('m8'), pt.c1()), '1:m8:60:true / 2:Priya N.:35:false / 2:m6:35:false / 4:m1:30:false');
select pt.check('someone marked attended sees it', pt.board(pt.u('m2'), pt.c1()), '1:Priya N.:35:true / 1:m6:35:false / 3:m1:30:false');
select pt.check('a no-show sees nothing', pt.board(pt.u('m3'), pt.c1()), 'none');
select pt.check('someone who never booked sees nothing', pt.board(pt.u('m4'), pt.c1()), 'none');
select pt.check('someone whose membership has ended sees nothing', pt.board(pt.u('m5'), pt.c1()), 'none');
select pt.check('another gym''s member sees nothing', pt.board(pt.u('mb'), pt.c1()), 'none');
select pt.check('the assigned coach sees the list', pt.board(pt.u('coach_a'), pt.c1()), '1:Priya N.:35:false / 1:m6:35:false / 3:m1:30:false');
select pt.check('an admin and an owner do too', pt.board(pt.u('admin_a'), pt.c1()) || ' | ' || pt.board(pt.u('owner_a'), pt.c1()), '1:Priya N.:35:false / 1:m6:35:false / 3:m1:30:false | 1:Priya N.:35:false / 1:m6:35:false / 3:m1:30:false');
select pt.check('staff not assigned to that class do not', pt.board(pt.u('staff_a'), pt.c1()), 'none');
select pt.check('a draft workout has no leaderboard', pt.board(pt.u('m1'), pt.c2()), 'none');
select pt.check('anonymous cannot call it', pt.anon(format('select count(*)::text from public.get_class_leaderboard(%L)', pt.c1())), 'ERROR:permission denied for function get_class_leaderboard');

-- changing the choice takes effect straight away
select pt.check('a member turns their sharing off', pt.q(pt.u('m6'), format('insert into public.member_score_settings(user_id, share_scores) values (%L, false) on conflict (user_id) do update set share_scores = false returning share_scores::text', pt.u('m6'))), 'false');
select pt.check('and drops off the list', pt.board(pt.u('m1'), pt.c1()), '1:Priya N.:35:false / 2:m1:30:true');
select pt.check('turning it back on puts them back', pt.q(pt.u('m6'), format('update public.member_score_settings set share_scores = true where user_id = %L returning share_scores::text', pt.u('m6'))) || ' / ' || pt.board(pt.u('m1'), pt.c1()), 'true / 1:Priya N.:35:false / 1:m6:35:false / 3:m1:30:true');
select pt.check('a member cannot change someone else''s choice', pt.q(pt.u('m1'), format('insert into public.member_score_settings(user_id, share_scores) values (%L, false) returning 1', pt.u('m2'))), 'ERROR:new row violates row-level security policy for table "member_score_settings"');
select pt.check('and cannot read it', pt.q(pt.u('m1'), 'select count(*)::text from public.member_score_settings'), '0');
select pt.check('sharing is on unless a member turns it off', (select share_score from public.workout_sessions limit 1)::text, 'true');

-- fastest time wins
update public.class_session_workouts set published_at = now(), published_by = pt.u('coach_a'), score_exercise = 'Row 500m', score_metric = 'time' where session_id = pt.c2();
select pt.rec(pt.u('m1'), pt.c2(), 'Row 500m', array[null, null]::int[], array[130, 120]);
select pt.rec(pt.u('m2'), pt.c2(), 'Row 500m', array[null]::int[], array[100]);
select pt.check('for a time, the fastest is first', pt.board(pt.u('m1'), pt.c2()), '1:Priya N.:100:false / 2:m1:120:true');
\o
do $$
declare bad integer;
begin
  select count(*) into bad from pt.results where not ok;
  raise notice 'class blocks and leaderboard: % checks, % failed', (select count(*) from pt.results), bad;
  if bad > 0 then
    raise exception 'FAILED: %', (select string_agg(seq || ' ' || label || ' [got ' || coalesce(got,'NULL') || ' / want ' || coalesce(want,'NULL') || ']', E'\n') from pt.results where not ok);
  end if;
end $$;
rollback;
