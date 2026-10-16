-- Block benchmarks: persona tests (rolled back at the end; leaves nothing behind).
-- Runs on a FRESH local database after the migrations are applied (never on the live project).
-- Real calls run as the `authenticated` role with that user's JWT claims, so Row Level Security and the functions
-- are exercised exactly as the app would.
-- Usage:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/block_benchmarks.sql
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
insert into auth.users(id,email) select uid, name||'@bbench.invalid' from pt.persona;
insert into public.profiles(id,display_name) select uid,name from pt.persona on conflict (id) do nothing;
create function pt.u(n text) returns uuid language sql as $$ select uid from pt.persona where name = n $$;
create function pt.gym_a() returns uuid language sql as $$ select 'a0000000-0000-4000-8000-00000000000a'::uuid $$;
create function pt.gym_b() returns uuid language sql as $$ select 'b0000000-0000-4000-8000-00000000000b'::uuid $$;
insert into public.gyms(id,name,slug,created_by) values (pt.gym_a(),'Bench Gym A','bb-a',pt.u('owner_a')),(pt.gym_b(),'Bench Gym B','bb-b',pt.u('owner_b'));
insert into public.gym_members(gym_id,user_id,role,is_active,access_status) values
 (pt.gym_a(),pt.u('owner_a'),'owner',true,'active'),(pt.gym_a(),pt.u('coach_a'),'coach',true,'active'),(pt.gym_a(),pt.u('m1'),'member',true,'active'),
 (pt.gym_b(),pt.u('owner_b'),'owner',true,'active'),(pt.gym_b(),pt.u('mb'),'member',true,'active');

insert into public.membership_plans(id,gym_id,name,price_pence,billing_interval) values
 ('c0000000-0000-4000-8000-000000000001',pt.gym_a(),'Basic',3000,'monthly'),('c0000000-0000-4000-8000-000000000002',pt.gym_b(),'Basic',3000,'monthly');
insert into public.memberships(gym_id,user_id,plan_id,status,starts_on) values
 (pt.gym_a(),pt.u('m1'),'c0000000-0000-4000-8000-000000000001','active',current_date-30),
 (pt.gym_b(),pt.u('mb'),'c0000000-0000-4000-8000-000000000002','active',current_date-30);

create table pt.ids(k text primary key, v uuid);
with x as (insert into public.movements(gym_id, name) values (pt.gym_a(), '1 km Row') returning id) insert into pt.ids select 'ma', id from x;
with x as (insert into public.movements(gym_id, name) values (pt.gym_a(), 'Back Squat') returning id) insert into pt.ids select 'ma2', id from x;
with x as (insert into public.movements(gym_id, name) values (pt.gym_b(), '1 km Row') returning id) insert into pt.ids select 'mb', id from x;
with x as (insert into public.class_blocks(gym_id, name, starts_on, weeks) values (pt.gym_a(), 'Hybrid Uppers', current_date, 6) returning id) insert into pt.ids select 'ba', id from x;
with x as (insert into public.class_blocks(gym_id, name, starts_on, weeks) values (pt.gym_b(), 'Other block', current_date, 6) returning id) insert into pt.ids select 'bb', id from x;
grant usage on schema pt to authenticated;
grant select on pt.ids to authenticated;

create function pt.id(k text) returns uuid language sql as $$ select v from pt.ids where pt.ids.k = $1 $$;
create function pt.bench(uid uuid, gym uuid, blk uuid, mv uuid, s date, e date, better text default 'lower') returns text language sql as $$
  select pt.q(uid, format('insert into public.block_benchmarks(gym_id, block_id, movement_id, test_start_on, test_end_on, better) values (%L, %L, %L, %L, %L, %L) returning better', gym, blk, mv, s, e, better)) $$;

-- ---------- who can set one up ----------
select pt.check('an owner adds a benchmark', pt.bench(pt.u('owner_a'), pt.gym_a(), pt.id('ba'), pt.id('ma'), current_date, current_date + 35), 'lower');
select pt.check('a coach cannot', pt.bench(pt.u('coach_a'), pt.gym_a(), pt.id('ba'), pt.id('ma2'), current_date, current_date + 35), 'ERROR:new row violates row-level security policy for table "block_benchmarks"');
select pt.check('a member cannot', pt.bench(pt.u('m1'), pt.gym_a(), pt.id('ba'), pt.id('ma2'), current_date, current_date + 35), 'ERROR:new row violates row-level security policy for table "block_benchmarks"');
select pt.check('another gym''s owner cannot add to this gym', pt.bench(pt.u('owner_b'), pt.gym_a(), pt.id('ba'), pt.id('ma2'), current_date, current_date + 35), 'ERROR:new row violates row-level security policy for table "block_benchmarks"');
select pt.check('a stranger cannot', pt.bench(pt.u('stranger'), pt.gym_a(), pt.id('ba'), pt.id('ma2'), current_date, current_date + 35), 'ERROR:new row violates row-level security policy for table "block_benchmarks"');
select pt.check('signed-out people cannot', pt.anon(format('insert into public.block_benchmarks(gym_id, block_id, movement_id, test_start_on, test_end_on) values (%L, %L, %L, current_date, current_date + 7) returning 1', pt.gym_a(), pt.id('ba'), pt.id('ma2'))), 'ERROR:permission denied for table block_benchmarks');
select pt.check('the same movement twice in a block is refused', pt.bench(pt.u('owner_a'), pt.gym_a(), pt.id('ba'), pt.id('ma'), current_date, current_date + 35), 'ERROR:duplicate key value violates unique constraint "block_benchmarks_block_movement_unique"');
select pt.check('the end test must be after the start test', pt.bench(pt.u('owner_a'), pt.gym_a(), pt.id('ba'), pt.id('ma2'), current_date + 5, current_date + 5), 'ERROR:new row for relation "block_benchmarks" violates check constraint "block_benchmarks_dates_check"');
select pt.check('better is higher or lower only', pt.bench(pt.u('owner_a'), pt.gym_a(), pt.id('ba'), pt.id('ma2'), current_date, current_date + 35, 'bigger'), 'ERROR:new row for relation "block_benchmarks" violates check constraint "block_benchmarks_better_check"');
select pt.check('a block from another gym is refused', pt.bench(pt.u('owner_a'), pt.gym_a(), pt.id('bb'), pt.id('ma2'), current_date, current_date + 35), 'ERROR:new row violates row-level security policy for table "block_benchmarks"');
select pt.check('a movement from another gym is refused', pt.bench(pt.u('owner_a'), pt.gym_a(), pt.id('ba'), pt.id('mb'), current_date, current_date + 35), 'ERROR:new row violates row-level security policy for table "block_benchmarks"');
select pt.check('a second movement is fine', pt.bench(pt.u('owner_a'), pt.gym_a(), pt.id('ba'), pt.id('ma2'), current_date, current_date + 35, 'higher'), 'higher');

-- ---------- who can read ----------
select pt.check('a member reads their gym''s benchmarks', pt.q(pt.u('m1'), 'select count(*)::text from public.block_benchmarks'), '2');
select pt.check('a coach reads them', pt.q(pt.u('coach_a'), 'select count(*)::text from public.block_benchmarks'), '2');
select pt.check('another gym''s member sees none', pt.q(pt.u('mb'), 'select count(*)::text from public.block_benchmarks'), '0');
select pt.check('a stranger sees none', pt.q(pt.u('stranger'), 'select count(*)::text from public.block_benchmarks'), '0');
select pt.check('signed-out people read none', pt.anon('select count(*)::text from public.block_benchmarks'), 'ERROR:permission denied for table block_benchmarks');

-- ---------- changing and removing ----------
select pt.check('an owner changes the dates', pt.q(pt.u('owner_a'), format('update public.block_benchmarks set test_end_on = current_date + 40 where block_id = %L and better = ''lower'' returning better', pt.id('ba'))), 'lower');
select pt.check('moving a benchmark to another gym''s movement is refused', pt.q(pt.u('owner_a'), format('update public.block_benchmarks set movement_id = %L where block_id = %L and better = ''lower'' returning 1', pt.id('mb'), pt.id('ba'))), 'ERROR:new row violates row-level security policy for table "block_benchmarks"');
select pt.check('a coach cannot change one', pt.q(pt.u('coach_a'), format('update public.block_benchmarks set better = ''higher'' where block_id = %L returning 1', pt.id('ba'))), null);
select pt.check('a member cannot remove one', pt.q(pt.u('m1'), format('delete from public.block_benchmarks where block_id = %L returning 1', pt.id('ba'))), null);
select pt.check('and nothing was lost', (select count(*)::text from public.block_benchmarks), '2');
select pt.check('an owner removes one', pt.q(pt.u('owner_a'), format('delete from public.block_benchmarks where block_id = %L and better = ''higher'' returning better', pt.id('ba'))), 'higher');
delete from public.class_blocks where id = pt.id('ba');
select pt.check('deleting the block removes its benchmarks', (select count(*)::text from public.block_benchmarks), '0');

\o
do $$
declare bad integer;
begin
  select count(*) into bad from pt.results where not ok;
  raise notice 'block benchmarks: % checks, % failed', (select count(*) from pt.results), bad;
  if bad > 0 then
    raise exception 'FAILED: %', (select string_agg(seq || ' ' || label || ' [got ' || coalesce(got,'NULL') || ' / want ' || coalesce(want,'NULL') || ']', E'\n') from pt.results where not ok);
  end if;
end $$;
rollback;
