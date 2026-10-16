-- Movement library: persona tests (rolled back at the end; leaves nothing behind).
-- Runs on a FRESH local database after the migrations are applied (never on the live project).
-- Real calls run as the `authenticated` role with that user's JWT claims, so Row Level Security and the functions
-- are exercised exactly as the app would.
-- Usage:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/movement_library.sql
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
insert into auth.users(id,email) select uid, name||'@movements.invalid' from pt.persona;
insert into public.profiles(id,display_name) select uid,name from pt.persona on conflict (id) do nothing;
create function pt.u(n text) returns uuid language sql as $$ select uid from pt.persona where name = n $$;
create function pt.gym_a() returns uuid language sql as $$ select 'a0000000-0000-4000-8000-00000000000a'::uuid $$;
create function pt.gym_b() returns uuid language sql as $$ select 'b0000000-0000-4000-8000-00000000000b'::uuid $$;
insert into public.gyms(id,name,slug,created_by) values (pt.gym_a(),'Movements Gym A','mv-a',pt.u('owner_a')),(pt.gym_b(),'Movements Gym B','mv-b',pt.u('owner_b'));
insert into public.gym_members(gym_id,user_id,role,is_active,access_status) values
 (pt.gym_a(),pt.u('owner_a'),'owner',true,'active'),(pt.gym_a(),pt.u('coach_a'),'coach',true,'active'),(pt.gym_a(),pt.u('m1'),'member',true,'active'),
 (pt.gym_b(),pt.u('owner_b'),'owner',true,'active'),(pt.gym_b(),pt.u('mb'),'member',true,'active');

insert into public.membership_plans(id,gym_id,name,price_pence,billing_interval) values
 ('c0000000-0000-4000-8000-000000000001',pt.gym_a(),'Basic',3000,'monthly'),('c0000000-0000-4000-8000-000000000002',pt.gym_b(),'Basic',3000,'monthly');
insert into public.memberships(gym_id,user_id,plan_id,status,starts_on) values
 (pt.gym_a(),pt.u('m1'),'c0000000-0000-4000-8000-000000000001','active',current_date-30),
 (pt.gym_b(),pt.u('mb'),'c0000000-0000-4000-8000-000000000002','active',current_date-30);

create function pt.ins(uid uuid, gym uuid, nm text) returns text language sql as $$
  select pt.q(uid, format('insert into public.movements(gym_id, name) values (%L, %L) returning key', gym, nm)) $$;
create function pt.lvl(uid uuid, gym uuid, mv uuid, lv text) returns text language sql as $$
  select pt.q(uid, format('insert into public.movement_levels(movement_id, gym_id, level) values (%L, %L, %L) returning level', mv, gym, lv)) $$;
create function pt.mid(gym uuid, k text) returns uuid language sql as $$ select id from public.movements where gym_id = gym and key = k $$;

-- ---------- who can add ----------
select pt.check('a coach adds a movement', pt.ins(pt.u('coach_a'), pt.gym_a(), '  Sled Push '), 'sled push');
select pt.check('an owner adds one', pt.ins(pt.u('owner_a'), pt.gym_a(), 'Wall Ball'), 'wall ball');
select pt.check('a member cannot', pt.ins(pt.u('m1'), pt.gym_a(), 'Burpee'), 'ERROR:new row violates row-level security policy for table "movements"');
select pt.check('another gym''s owner cannot add to this gym', pt.ins(pt.u('owner_b'), pt.gym_a(), 'Burpee'), 'ERROR:new row violates row-level security policy for table "movements"');
select pt.check('a signed-in stranger cannot', pt.ins(pt.u('stranger'), pt.gym_a(), 'Burpee'), 'ERROR:new row violates row-level security policy for table "movements"');
select pt.check('signed-out people cannot', pt.anon('insert into public.movements(gym_id, name) values (''a0000000-0000-4000-8000-00000000000a'', ''x'') returning key'), 'ERROR:permission denied for table movements');
select pt.check('the same name again is refused, ignoring case and spaces', pt.ins(pt.u('owner_a'), pt.gym_a(), 'SLED PUSH'), 'ERROR:duplicate key value violates unique constraint "movements_gym_key_unique"');
select pt.check('another gym can use the same name', pt.ins(pt.u('owner_b'), pt.gym_b(), 'Sled Push'), 'sled push');
select pt.check('a blank name is refused', pt.ins(pt.u('owner_a'), pt.gym_a(), '   '), 'ERROR:new row for relation "movements" violates check constraint "movements_name_check"');
select pt.check('a video link must be https', pt.q(pt.u('owner_a'), format('insert into public.movements(gym_id, name, video_url) values (%L, ''Row'', ''http://x.test/v'') returning key', pt.gym_a())), 'ERROR:new row for relation "movements" violates check constraint "movements_video_url_check"');
select pt.check('an unknown tracking type is refused', pt.q(pt.u('owner_a'), format('insert into public.movements(gym_id, name, default_tracking) values (%L, ''Row'', ''magic'') returning key', pt.gym_a())), 'ERROR:new row for relation "movements" violates check constraint "movements_default_tracking_check"');

-- ---------- who can read ----------
select pt.check('a member reads their gym''s list', pt.q(pt.u('m1'), 'select count(*)::text from public.movements'), '2');
select pt.check('another gym''s member sees only their own gym''s', pt.q(pt.u('mb'), 'select count(*)::text from public.movements'), '1');
select pt.check('a stranger sees none', pt.q(pt.u('stranger'), 'select count(*)::text from public.movements'), '0');
select pt.check('signed-out people read none', pt.anon('select count(*)::text from public.movements'), 'ERROR:permission denied for table movements');

-- ---------- editing and switching off ----------
select pt.check('a coach edits the cue', pt.q(pt.u('coach_a'), format('update public.movements set cue = ''Drive through the legs'' where gym_id = %L and key = ''sled push'' returning cue', pt.gym_a())), 'Drive through the legs');
select pt.check('a member cannot edit', pt.q(pt.u('m1'), format('update public.movements set cue = ''x'' where gym_id = %L returning 1', pt.gym_a())), null);
select pt.check('another gym''s owner cannot edit', pt.q(pt.u('owner_b'), format('update public.movements set cue = ''x'' where gym_id = %L returning 1', pt.gym_a())), null);
select pt.check('and nothing was changed', (select count(*)::text from public.movements where cue = 'x'), '0');
select pt.check('a movement can be switched off', pt.q(pt.u('owner_a'), format('update public.movements set is_active = false where gym_id = %L and key = ''wall ball'' returning is_active::text', pt.gym_a())), 'false');
select pt.check('but nobody can delete one', pt.q(pt.u('owner_a'), format('delete from public.movements where gym_id = %L returning 1', pt.gym_a())), 'ERROR:permission denied for table movements');
select pt.check('moving a movement to another gym is refused', pt.q(pt.u('owner_a'), format('update public.movements set gym_id = %L where gym_id = %L and key = ''sled push'' returning 1', pt.gym_b(), pt.gym_a())), 'ERROR:new row violates row-level security policy for table "movements"');

-- ---------- levels ----------
select pt.check('a coach adds a Scaled level', pt.q(pt.u('coach_a'), format('insert into public.movement_levels(movement_id, gym_id, level, prescription) values (%L, %L, ''scaled'', ''{"display":"2 x 20 m"}'') returning level', pt.mid(pt.gym_a(), 'sled push'), pt.gym_a())), 'scaled');
select pt.check('and an Rx level', pt.lvl(pt.u('coach_a'), pt.gym_a(), pt.mid(pt.gym_a(), 'sled push'), 'rx'), 'rx');
select pt.check('only the three fixed level names', pt.lvl(pt.u('coach_a'), pt.gym_a(), pt.mid(pt.gym_a(), 'sled push'), 'elite'), 'ERROR:new row for relation "movement_levels" violates check constraint "movement_levels_level_check"');
select pt.check('one row per level per movement', pt.lvl(pt.u('coach_a'), pt.gym_a(), pt.mid(pt.gym_a(), 'sled push'), 'rx'), 'ERROR:duplicate key value violates unique constraint "movement_levels_pkey"');
select pt.check('a member cannot add a level', pt.lvl(pt.u('m1'), pt.gym_a(), pt.mid(pt.gym_a(), 'sled push'), 'foundations'), 'ERROR:new row violates row-level security policy for table "movement_levels"');
select pt.check('another gym''s owner cannot write into this gym''s movement, even naming their own gym', pt.lvl(pt.u('owner_b'), pt.gym_b(), pt.mid(pt.gym_a(), 'sled push'), 'foundations'), 'ERROR:new row violates row-level security policy for table "movement_levels"');
select pt.check('nor naming this gym', pt.lvl(pt.u('owner_b'), pt.gym_a(), pt.mid(pt.gym_a(), 'sled push'), 'foundations'), 'ERROR:new row violates row-level security policy for table "movement_levels"');
select pt.check('a member reads the levels', pt.q(pt.u('m1'), 'select count(*)::text from public.movement_levels'), '2');
select pt.check('another gym''s member reads none of them', pt.q(pt.u('mb'), 'select count(*)::text from public.movement_levels'), '0');
select pt.check('a coach changes a prescription', pt.q(pt.u('coach_a'), format('update public.movement_levels set prescription = ''{"display":"2 x 25 m"}'' where gym_id = %L and level = ''scaled'' returning prescription->>''display''', pt.gym_a())), '2 x 25 m');
select pt.check('a prescription must be an object', pt.q(pt.u('coach_a'), format('update public.movement_levels set prescription = ''[1]'' where gym_id = %L and level = ''scaled'' returning 1', pt.gym_a())), 'ERROR:new row for relation "movement_levels" violates check constraint "movement_levels_prescription_check"');
select pt.check('a member cannot remove a level', pt.q(pt.u('m1'), format('delete from public.movement_levels where gym_id = %L returning 1', pt.gym_a())), null);
select pt.check('a coach removes one', pt.q(pt.u('coach_a'), format('delete from public.movement_levels where gym_id = %L and level = ''rx'' returning level', pt.gym_a())), 'rx');
select pt.check('signed-out people read no levels', pt.anon('select count(*)::text from public.movement_levels'), 'ERROR:permission denied for table movement_levels');

\o
do $$
declare bad integer;
begin
  select count(*) into bad from pt.results where not ok;
  raise notice 'movement library: % checks, % failed', (select count(*) from pt.results), bad;
  if bad > 0 then
    raise exception 'FAILED: %', (select string_agg(seq || ' ' || label || ' [got ' || coalesce(got,'NULL') || ' / want ' || coalesce(want,'NULL') || ']', E'\n') from pt.results where not ok);
  end if;
end $$;
rollback;
