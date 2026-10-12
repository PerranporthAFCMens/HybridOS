-- Community broadcasts: persona tests (rolled back at the end; leaves nothing behind).
-- Runs on a FRESH local database after the migrations are applied (never on the live project).
-- Real queries run as the `authenticated` role with that user's JWT claims, so Row Level Security and the functions
-- are exercised exactly as the app would.
-- Usage:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/community_broadcasts.sql
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
 ('owner_a','00000000-0000-4000-8000-000000000001'), ('admin_a','00000000-0000-4000-8000-000000000002'), ('staff_a','00000000-0000-4000-8000-000000000003'),
 ('m1','00000000-0000-4000-8000-000000000011'), ('m2','00000000-0000-4000-8000-000000000012'),
 ('admin_b','00000000-0000-4000-8000-000000000022'), ('mb','00000000-0000-4000-8000-000000000021');
insert into auth.users(id,email) select uid, name||'@broadcast.invalid' from pt.persona;
insert into public.profiles(id,display_name) select uid,name from pt.persona on conflict (id) do nothing;

create function pt.u(n text) returns uuid language sql as $$ select uid from pt.persona where name = n $$;
create function pt.gym_a() returns uuid language sql as $$ select 'a0000000-0000-4000-8000-00000000000a'::uuid $$;
create function pt.gym_b() returns uuid language sql as $$ select 'b0000000-0000-4000-8000-00000000000b'::uuid $$;

insert into public.gyms(id,name,slug,created_by) values (pt.gym_a(),'Broadcast Gym A','bc-a',pt.u('owner_a')),(pt.gym_b(),'Broadcast Gym B','bc-b',pt.u('admin_b'));
insert into public.gym_members(gym_id,user_id,role,is_active,access_status) values
 (pt.gym_a(),pt.u('owner_a'),'owner',true,'active'),(pt.gym_a(),pt.u('admin_a'),'admin',true,'active'),(pt.gym_a(),pt.u('staff_a'),'staff',true,'active'),
 (pt.gym_a(),pt.u('m1'),'member',true,'active'),(pt.gym_a(),pt.u('m2'),'member',true,'active'),
 (pt.gym_b(),pt.u('admin_b'),'owner',true,'active'),(pt.gym_b(),pt.u('mb'),'member',true,'active');
insert into public.membership_plans(id,gym_id,name,price_pence,billing_interval) values ('c0000000-0000-4000-8000-000000000001',pt.gym_a(),'Basic',3000,'monthly');
insert into public.memberships(id,gym_id,user_id,plan_id,status,starts_on) values
 ('d0000000-0000-4000-8000-000000000001',pt.gym_a(),pt.u('m1'),'c0000000-0000-4000-8000-000000000001','active',current_date-30),
 ('d0000000-0000-4000-8000-000000000002',pt.gym_a(),pt.u('m2'),'c0000000-0000-4000-8000-000000000001','active',current_date-30);

create function pt.post(uid uuid, kind text, body text) returns text language sql as $$
  select pt.q(uid, format('insert into public.social_posts(gym_id, user_id, body, kind) values (%L, %L, %L, %L) returning kind', pt.gym_a(), uid, body, kind)) $$;

-- ---------- who may post what ----------
select pt.check('a member can post an ordinary post', pt.post(pt.u('m1'), 'post', 'member post'), 'post');
select pt.check('a post without a kind is an ordinary post', pt.q(pt.u('m1'), format('insert into public.social_posts(gym_id, user_id, body) values (%L, %L, %L) returning kind', pt.gym_a(), pt.u('m1'), 'no kind')), 'post');
select pt.check('a member cannot post a broadcast', pt.post(pt.u('m1'), 'broadcast', 'fake announcement'), 'ERROR:new row violates row-level security policy for table "social_posts"');
select pt.check('staff cannot post a broadcast', pt.post(pt.u('staff_a'), 'broadcast', 'staff announcement'), 'ERROR:new row violates row-level security policy for table "social_posts"');
select pt.check('another gym''s admin cannot broadcast here', pt.q(pt.u('admin_b'), format('insert into public.social_posts(gym_id, user_id, body, kind) values (%L, %L, %L, %L) returning kind', pt.gym_a(), pt.u('admin_b'), 'x', 'broadcast')), 'ERROR:new row violates row-level security policy for table "social_posts"');
select pt.check('an admin can post a broadcast', pt.post(pt.u('admin_a'), 'broadcast', 'admin announcement'), 'broadcast');
select pt.check('an owner can post a broadcast', pt.post(pt.u('owner_a'), 'broadcast', 'owner announcement'), 'broadcast');
select pt.check('an owner can still post an ordinary post', pt.post(pt.u('owner_a'), 'post', 'owner chat'), 'post');
select pt.check('an unknown kind is refused', pt.post(pt.u('owner_a'), 'pinned', 'x'), 'ERROR:new row for relation "social_posts" violates check constraint "social_posts_kind_check"');
select pt.check('a member cannot post as someone else', pt.q(pt.u('m1'), format('insert into public.social_posts(gym_id, user_id, body) values (%L, %L, %L) returning kind', pt.gym_a(), pt.u('m2'), 'forged')), 'ERROR:new row violates row-level security policy for table "social_posts"');

-- ---------- turning a post into a broadcast ----------
select pt.check('a member cannot turn their own post into a broadcast', pt.q(pt.u('m1'), format('update public.social_posts set kind = %L where user_id = %L and body = %L returning kind', 'broadcast', pt.u('m1'), 'member post')), 'ERROR:new row violates row-level security policy for table "social_posts"');
select pt.check('a member can still edit their own post', pt.q(pt.u('m1'), format('update public.social_posts set body = %L where user_id = %L and body = %L returning body', 'member post (edited)', pt.u('m1'), 'member post')), 'member post (edited)');
select pt.check('an admin can turn a post into a broadcast', pt.q(pt.u('admin_a'), format('update public.social_posts set kind = %L where body = %L returning kind', 'broadcast', 'owner chat')), 'broadcast');
select pt.check('a member cannot edit a broadcast', pt.q(pt.u('m1'), format('with u as (update public.social_posts set body = %L where body = %L returning 1) select count(*)::text from u', 'defaced', 'admin announcement')), '0');

-- ---------- what members can do with a broadcast ----------
select pt.check('members read broadcasts', pt.q(pt.u('m2'), format('select count(*)::text from public.social_posts where gym_id = %L and kind = %L', pt.gym_a(), 'broadcast')), '3');
select pt.check('another gym''s member cannot read them', pt.q(pt.u('mb'), format('select count(*)::text from public.social_posts where gym_id = %L', pt.gym_a())), '0');
select pt.check('a member can comment on a broadcast', pt.q(pt.u('m1'), format('insert into public.social_comments(gym_id, post_id, user_id, body) select %L, id, %L, %L from public.social_posts where body = %L returning body', pt.gym_a(), pt.u('m1'), 'thanks!', 'admin announcement')), 'thanks!');
select pt.check('a member can like a broadcast', pt.q(pt.u('m2'), format('insert into public.social_reactions(gym_id, user_id, post_id) select %L, %L, id from public.social_posts where body = %L returning reaction', pt.gym_a(), pt.u('m2'), 'admin announcement')), 'like');
select pt.check('a member cannot delete a broadcast', pt.q(pt.u('m1'), format('with d as (delete from public.social_posts where body = %L returning 1) select count(*)::text from d', 'admin announcement')), '0');
select pt.check('an admin can delete any post', pt.q(pt.u('admin_a'), format('with d as (delete from public.social_posts where body = %L returning 1) select count(*)::text from d', 'member post (edited)')), '1');
select pt.check('the author of a broadcast can delete it', pt.q(pt.u('owner_a'), format('with d as (delete from public.social_posts where body = %L returning 1) select count(*)::text from d', 'owner announcement')), '1');

\o
do $$
declare bad integer;
begin
  select count(*) into bad from pt.results where not ok;
  raise notice 'community broadcasts: % checks, % failed', (select count(*) from pt.results), bad;
  if bad > 0 then
    raise exception 'FAILED: %', (select string_agg(seq || ' ' || label || ' [got ' || coalesce(got,'NULL') || ' / want ' || coalesce(want,'NULL') || ']', E'\n') from pt.results where not ok);
  end if;
end $$;
rollback;
