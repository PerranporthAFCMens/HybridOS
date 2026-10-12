-- Class blocks: persona tests (rolled back at the end; leaves nothing behind).
-- Runs on a FRESH local database after the migrations are applied (never on the live project).
-- Real queries run as the `authenticated` role with that user's JWT claims, so Row Level Security and the functions
-- are exercised exactly as the app would.
-- Usage:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/class_blocks.sql
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


-- gym B's own class, for the other-gym checks
insert into public.class_sessions(id, gym_id, name, starts_at, ends_at, capacity) values
 (pt.c1(), pt.gym_a(), 'Hybrid 6pm', now() + interval '1 day', now() + interval '1 day 1 hour', 20),
 (pt.c2(), pt.gym_a(), 'Hybrid 7pm', now() + interval '2 days', now() + interval '2 days 1 hour', 20),
 ('f0000000-0000-4000-8000-000000000003', pt.gym_a(), 'Far future', now() + interval '300 days', now() + interval '300 days 1 hour', 20),
 ('f0000000-0000-4000-8000-000000000004', pt.gym_b(), 'Gym B class', now() + interval '1 day', now() + interval '1 day 1 hour', 20);
insert into public.class_session_staff(session_id, gym_id, user_id, assignment_role, is_lead) values (pt.c1(), pt.gym_a(), pt.u('coach_a'), 'coach', true);
-- m1 booked, m2 attended, m5 attended with a cancelled membership
insert into public.class_bookings(gym_id, session_id, user_id, status) values (pt.gym_a(), pt.c1(), pt.u('m1'), 'booked'), (pt.gym_a(), pt.c1(), pt.u('m2'), 'attended'), (pt.gym_a(), pt.c1(), pt.u('m5'), 'attended');
update public.memberships set status = 'cancelled', ends_on = current_date - 1 where user_id = pt.u('m5');

create function pt.blk(uid uuid, gym uuid, nm text, wks int) returns text language sql as $$
  select pt.q(uid, format('insert into public.class_blocks(gym_id, name, starts_on, weeks) values (%L, %L, current_date - 1, %s) returning name', gym, nm, wks)) $$;
create function pt.join_blk(uid uuid, blk uuid, sess uuid, gym uuid) returns text language sql as $$
  select pt.q(uid, format('insert into public.class_block_sessions(session_id, block_id, gym_id) values (%L, %L, %L) returning session_id::text', sess, blk, gym)) $$;

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

\o
do $$
declare bad integer;
begin
  select count(*) into bad from pt.results where not ok;
  raise notice 'class blocks: % checks, % failed', (select count(*) from pt.results), bad;
  if bad > 0 then
    raise exception 'FAILED: %', (select string_agg(seq || ' ' || label || ' [got ' || coalesce(got,'NULL') || ' / want ' || coalesce(want,'NULL') || ']', E'\n') from pt.results where not ok);
  end if;
end $$;
rollback;
