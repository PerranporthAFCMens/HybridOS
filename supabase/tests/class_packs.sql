-- Class packs: persona tests (rolled back at the end; leaves nothing behind).
-- Runs on a FRESH local database after the migrations are applied (never on the live project).
-- Real calls run as the `authenticated` role with that user's JWT claims, so Row Level Security and the functions
-- are exercised exactly as the app would.
-- Usage:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/class_packs.sql
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
insert into auth.users(id,email) select uid, name||'@cpacks.invalid' from pt.persona;
insert into public.profiles(id,display_name) select uid,name from pt.persona on conflict (id) do nothing;
create function pt.u(n text) returns uuid language sql as $$ select uid from pt.persona where name = n $$;
create function pt.gym_a() returns uuid language sql as $$ select 'a0000000-0000-4000-8000-00000000000a'::uuid $$;
create function pt.gym_b() returns uuid language sql as $$ select 'b0000000-0000-4000-8000-00000000000b'::uuid $$;
insert into public.gyms(id,name,slug,created_by) values (pt.gym_a(),'Packs Gym A','cp-a',pt.u('owner_a')),(pt.gym_b(),'Packs Gym B','cp-b',pt.u('owner_b'));
insert into public.gym_members(gym_id,user_id,role,is_active,access_status) values
 (pt.gym_a(),pt.u('owner_a'),'owner',true,'active'),(pt.gym_a(),pt.u('coach_a'),'coach',true,'active'),(pt.gym_a(),pt.u('m1'),'member',true,'active'),
 (pt.gym_b(),pt.u('owner_b'),'owner',true,'active'),(pt.gym_b(),pt.u('mb'),'member',true,'active');

insert into public.membership_plans(id,gym_id,name,price_pence,billing_interval) values
 ('c0000000-0000-4000-8000-000000000001',pt.gym_a(),'Basic',3000,'monthly'),('c0000000-0000-4000-8000-000000000002',pt.gym_b(),'Basic',3000,'monthly');
insert into public.memberships(gym_id,user_id,plan_id,status,starts_on) values
 (pt.gym_a(),pt.u('m1'),'c0000000-0000-4000-8000-000000000001','active',current_date-30),
 (pt.gym_b(),pt.u('mb'),'c0000000-0000-4000-8000-000000000002','active',current_date-30);


create table pt.ids(k text primary key, v uuid);
create function pt.id(k text) returns uuid language sql as $$ select v from pt.ids where pt.ids.k = $1 $$;
grant usage on schema pt to authenticated;
grant select on pt.ids to authenticated;

-- ---------- pack types: who can set them up ----------
create function pt.ptype(uid uuid, gym uuid, n text, credits int, price int, days text default 'null') returns text language sql as $$
  select pt.q(uid, format('insert into public.class_pack_types(gym_id, name, credits, price_pence, valid_days) values (%L, %L, %s, %s, %s) returning id::text', gym, n, credits, price, days)) $$;
insert into pt.ids select 'tenA', pt.ptype(pt.u('owner_a'), pt.gym_a(), '10 classes', 10, 6000, '90')::uuid;
select pt.check('an owner made a pack type', (select count(*)::text from public.class_pack_types where gym_id = pt.gym_a()), '1');
select pt.check('a coach cannot make one', pt.ptype(pt.u('coach_a'), pt.gym_a(), 'Coach pack', 5, 3000), 'ERROR:new row violates row-level security policy for table "class_pack_types"');
select pt.check('a member cannot make one', pt.ptype(pt.u('m1'), pt.gym_a(), 'Member pack', 5, 3000), 'ERROR:new row violates row-level security policy for table "class_pack_types"');
select pt.check('another gym''s owner cannot make one here', pt.ptype(pt.u('owner_b'), pt.gym_a(), 'Other pack', 5, 3000), 'ERROR:new row violates row-level security policy for table "class_pack_types"');
select pt.check('a pack needs at least one class', pt.ptype(pt.u('owner_a'), pt.gym_a(), 'Zero', 0, 100), 'ERROR:new row for relation "class_pack_types" violates check constraint "class_pack_types_credits_check"');
select pt.check('a price cannot be negative', pt.ptype(pt.u('owner_a'), pt.gym_a(), 'Minus', 5, -1), 'ERROR:new row for relation "class_pack_types" violates check constraint "class_pack_types_price_pence_check"');
select pt.check('a pack needs a name', pt.ptype(pt.u('owner_a'), pt.gym_a(), '   ', 5, 100), 'ERROR:new row for relation "class_pack_types" violates check constraint "class_pack_types_name_check"');
insert into pt.ids select 'offA', pt.ptype(pt.u('owner_a'), pt.gym_a(), 'Switched off', 5, 100)::uuid;
insert into pt.ids select 'tenB', pt.ptype(pt.u('owner_b'), pt.gym_b(), 'Gym B pack', 10, 5000)::uuid;
select pt.q(pt.u('owner_a'), format('update public.class_pack_types set is_active = false where id = %L returning 1', pt.id('offA')));

-- ---------- pack types: who can read ----------
select pt.check('a member sees only the packs that are on', pt.q(pt.u('m1'), 'select string_agg(name, '','' order by name) from public.class_pack_types'), '10 classes');
select pt.check('an owner sees all of their gym''s packs', pt.q(pt.u('owner_a'), 'select count(*)::text from public.class_pack_types'), '2');
select pt.check('another gym''s member sees none of them', pt.q(pt.u('mb'), 'select string_agg(name, '','') from public.class_pack_types'), 'Gym B pack');
select pt.check('signed-out people read none', pt.anon('select count(*)::text from public.class_pack_types'), 'ERROR:permission denied for table class_pack_types');
select pt.check('a member cannot change a pack type', pt.q(pt.u('m1'), format('update public.class_pack_types set price_pence = 1 where id = %L returning 1', pt.id('tenA'))), null);

-- ---------- giving a pack ----------
create function pt.give(uid uuid, gym uuid, who uuid, typ uuid) returns text language sql as $$
  select pt.q(uid, format('select public.owner_give_class_pack(%L, %L, %L)::text', gym, who, typ)) $$;
insert into pt.ids select 'pack1', pt.give(pt.u('owner_a'), pt.gym_a(), pt.u('m1'), pt.id('tenA'))::uuid;
select pt.check('an owner gave a member a pack with all its classes', (select credits_left || '/' || credits_total || '/' || source from public.class_packs where id = pt.id('pack1')), '10/10/owner');
select pt.check('it expires after the pack''s days', (select (expires_at between now() + interval '89 days' and now() + interval '91 days')::text from public.class_packs where id = pt.id('pack1')), 'true');
select pt.check('it remembers the name it was given', (select name from public.class_packs where id = pt.id('pack1')), '10 classes');
select pt.check('giving a second pack from the same type works', (pt.give(pt.u('owner_a'), pt.gym_a(), pt.u('m1'), pt.id('tenA')) ~ '^[0-9a-f-]{36}$')::text, 'true');
select pt.check('a coach cannot give a pack', pt.give(pt.u('coach_a'), pt.gym_a(), pt.u('m1'), pt.id('tenA')), 'ERROR:Only an owner or admin can give a class pack.');
select pt.check('a member cannot give themselves one', pt.give(pt.u('m1'), pt.gym_a(), pt.u('m1'), pt.id('tenA')), 'ERROR:Only an owner or admin can give a class pack.');
select pt.check('another gym''s owner cannot give one here', pt.give(pt.u('owner_b'), pt.gym_a(), pt.u('m1'), pt.id('tenA')), 'ERROR:Only an owner or admin can give a class pack.');
select pt.check('signed-out people cannot give one', pt.anon(format('select public.owner_give_class_pack(%L, %L, %L)::text', pt.gym_a(), pt.u('m1'), pt.id('tenA'))), 'ERROR:permission denied for function owner_give_class_pack');
select pt.check('a pack from another gym is refused', pt.give(pt.u('owner_a'), pt.gym_a(), pt.u('m1'), pt.id('tenB')), 'ERROR:That class pack is not available.');
select pt.check('a pack that is switched off is refused', pt.give(pt.u('owner_a'), pt.gym_a(), pt.u('m1'), pt.id('offA')), 'ERROR:That class pack is not available.');
select pt.check('someone from another gym cannot be given one', pt.give(pt.u('owner_a'), pt.gym_a(), pt.u('mb'), pt.id('tenA')), 'ERROR:That person is not a member of this gym.');
select pt.check('a stranger cannot be given one', pt.give(pt.u('owner_a'), pt.gym_a(), pt.u('stranger'), pt.id('tenA')), 'ERROR:That person is not a member of this gym.');

-- ---------- reading packs ----------
select pt.check('a member sees their own packs', pt.q(pt.u('m1'), 'select count(*)::text from public.class_packs'), '2');
select pt.check('an owner sees the gym''s packs', pt.q(pt.u('owner_a'), 'select count(*)::text from public.class_packs'), '2');
select pt.check('a coach sees none', pt.q(pt.u('coach_a'), 'select count(*)::text from public.class_packs'), '0');
select pt.check('another gym''s people see none', pt.q(pt.u('mb'), 'select count(*)::text from public.class_packs') || pt.q(pt.u('owner_b'), 'select count(*)::text from public.class_packs'), '00');
select pt.check('signed-out people read none', pt.anon('select count(*)::text from public.class_packs'), 'ERROR:permission denied for table class_packs');

-- ---------- nobody writes a pack directly ----------
select pt.check('a member cannot give themselves credits', pt.q(pt.u('m1'), format('update public.class_packs set credits_left = 10 where id = %L returning 1', pt.id('pack1'))), 'ERROR:permission denied for table class_packs');
select pt.check('an owner cannot edit a pack directly either', pt.q(pt.u('owner_a'), format('update public.class_packs set credits_left = 10 where id = %L returning 1', pt.id('pack1'))), 'ERROR:permission denied for table class_packs');
select pt.check('nobody inserts one directly', pt.q(pt.u('owner_a'), format('insert into public.class_packs(gym_id, user_id, name, credits_total, credits_left, source) values (%L, %L, ''x'', 5, 5, ''owner'') returning 1', pt.gym_a(), pt.u('m1'))), 'ERROR:permission denied for table class_packs');
select pt.check('credits left can never exceed the total', (select (select 1 from pg_constraint where conname = 'class_packs_credits_left_check')::text), '1');
select pt.check('one payment makes one pack only', (select count(*)::text from pg_indexes where indexname = 'class_packs_payment_unique'), '1');

-- ---------- cancelling a pack ----------
select pt.check('a member cannot cancel a pack', pt.q(pt.u('m1'), format('select public.owner_void_class_pack(%L)::text', pt.id('pack1'))), 'ERROR:Only an owner or admin can cancel a class pack.');
select pt.check('another gym''s owner cannot', pt.q(pt.u('owner_b'), format('select public.owner_void_class_pack(%L)::text', pt.id('pack1'))), 'ERROR:Only an owner or admin can cancel a class pack.');
select pt.check('an unknown pack is refused', pt.q(pt.u('owner_a'), format('select public.owner_void_class_pack(%L)::text', 'ffffffff-ffff-4fff-8fff-ffffffffffff')), 'ERROR:Only an owner or admin can cancel a class pack.');
select pt.q(pt.u('owner_a'), format('select public.owner_void_class_pack(%L)::text', pt.id('pack1')));
select pt.check('an owner cancelled it', (select (voided_at is not null)::text from public.class_packs where id = pt.id('pack1')), 'true');
select pt.check('cancelling again changes nothing and is not an error', pt.q(pt.u('owner_a'), format('select public.owner_void_class_pack(%L)::text', pt.id('pack1'))) || '|' || (select count(*)::text from public.class_packs where voided_at is not null), '|1');

\o
do $$
declare bad integer;
begin
  select count(*) into bad from pt.results where not ok;
  raise notice 'class packs: % checks, % failed', (select count(*) from pt.results), bad;
  if bad > 0 then
    raise exception 'FAILED: %', (select string_agg(seq || ' ' || label || ' [got ' || coalesce(got,'NULL') || ' / want ' || coalesce(want,'NULL') || ']', E'\n') from pt.results where not ok);
  end if;
end $$;
rollback;
