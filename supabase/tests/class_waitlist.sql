-- Class waitlist: persona tests (rolled back at the end; leaves nothing behind).
-- Runs on a FRESH local database after the migrations are applied (never on the live project).
-- Real calls run as the `authenticated` role with that user's JWT claims, so Row Level Security and the functions
-- are exercised exactly as the app would.
-- Usage:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/class_waitlist.sql
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
 ('owner_a','00000000-0000-4000-8000-000000000001'), ('admin_a','00000000-0000-4000-8000-000000000002'),
 ('m1','00000000-0000-4000-8000-000000000011'), ('m2','00000000-0000-4000-8000-000000000012'), ('m3','00000000-0000-4000-8000-000000000013'),
 ('m4','00000000-0000-4000-8000-000000000014'), ('m5','00000000-0000-4000-8000-000000000015'), ('m6','00000000-0000-4000-8000-000000000016'),
 ('m7','00000000-0000-4000-8000-000000000017'), ('admin_b','00000000-0000-4000-8000-000000000022'), ('mb','00000000-0000-4000-8000-000000000021');
insert into auth.users(id,email) select uid, name||'@waitlist.invalid' from pt.persona;
insert into public.profiles(id,display_name) select uid,name from pt.persona on conflict (id) do nothing;

create function pt.u(n text) returns uuid language sql as $$ select uid from pt.persona where name = n $$;
create function pt.gym_a() returns uuid language sql as $$ select 'a0000000-0000-4000-8000-00000000000a'::uuid $$;
create function pt.gym_b() returns uuid language sql as $$ select 'b0000000-0000-4000-8000-00000000000b'::uuid $$;
create function pt.c1() returns uuid language sql as $$ select 'f0000000-0000-4000-8000-000000000001'::uuid $$;
create function pt.c2() returns uuid language sql as $$ select 'f0000000-0000-4000-8000-000000000002'::uuid $$;
create function pt.c3() returns uuid language sql as $$ select 'f0000000-0000-4000-8000-000000000003'::uuid $$;

insert into public.gyms(id,name,slug,created_by) values (pt.gym_a(),'Waitlist Gym A','wl-a',pt.u('owner_a')),(pt.gym_b(),'Waitlist Gym B','wl-b',pt.u('admin_b'));
insert into public.gym_members(gym_id,user_id,role,is_active,access_status) values
 (pt.gym_a(),pt.u('owner_a'),'owner',true,'active'),(pt.gym_a(),pt.u('admin_a'),'admin',true,'active'),
 (pt.gym_a(),pt.u('m1'),'member',true,'active'),(pt.gym_a(),pt.u('m2'),'member',true,'active'),(pt.gym_a(),pt.u('m3'),'member',true,'active'),
 (pt.gym_a(),pt.u('m4'),'member',true,'active'),(pt.gym_a(),pt.u('m5'),'member',true,'active'),(pt.gym_a(),pt.u('m6'),'member',true,'active'),(pt.gym_a(),pt.u('m7'),'member',true,'active'),
 (pt.gym_b(),pt.u('admin_b'),'owner',true,'active'),(pt.gym_b(),pt.u('mb'),'member',true,'active');
insert into public.membership_plans(id,gym_id,name,price_pence,billing_interval) values ('c0000000-0000-4000-8000-000000000001',pt.gym_a(),'Basic',3000,'monthly');
insert into public.memberships(gym_id,user_id,plan_id,status,starts_on) select pt.gym_a(), pt.u(n), 'c0000000-0000-4000-8000-000000000001', 'active', current_date-30 from unnest(array['m1','m2','m3','m4','m6','m7']) n;
insert into public.memberships(gym_id,user_id,plan_id,status,starts_on,ends_on) values (pt.gym_a(), pt.u('m5'), 'c0000000-0000-4000-8000-000000000001', 'cancelled', current_date-60, current_date-1);

-- c1: two places. c2: twenty places (never fills). c3: gym B's class.
insert into public.class_sessions(id, gym_id, name, starts_at, ends_at, capacity) values
 (pt.c1(), pt.gym_a(), 'Hybrid 6pm', now() + interval '1 day', now() + interval '1 day 1 hour', 2),
 (pt.c2(), pt.gym_a(), 'Hybrid 7pm', now() + interval '2 days', now() + interval '2 days 1 hour', 20),
 (pt.c3(), pt.gym_b(), 'Gym B class', now() + interval '1 day', now() + interval '1 day 1 hour', 2);

create function pt.book(uid uuid, sess uuid) returns text language sql as $$ select pt.q(uid, format('select (public.member_book_class(%L)->>''status'')', sess)) $$;
create function pt.legacy_book(uid uuid, sess uuid) returns text language sql as $$ select pt.q(uid, format('select (public.book_class_session(%L)).status', sess)) $$;
create function pt.cancel(uid uuid, sess uuid) returns text language sql as $$ select pt.q(uid, format('select (public.member_cancel_class(%L)->>''status'')', sess)) $$;
create function pt.join(uid uuid, sess uuid) returns text language sql as $$ select pt.q(uid, format('select concat_ws('' '', public.member_join_waitlist(%L)->>''status'', public.member_join_waitlist(%L)->>''position'')', sess, sess)) $$;
create function pt.mine(uid uuid, sess uuid) returns text language sql as $$ select pt.q(uid, format('select concat_ws('' '', public.get_my_waitlist(%L)->>''status'', public.get_my_waitlist(%L)->>''position'')', sess, sess)) $$;
create function pt.leave(uid uuid, sess uuid) returns text language sql as $$ select pt.q(uid, format('select public.member_leave_waitlist(%L)->>''status''', sess)) $$;
create function pt.wl(sess uuid, uid uuid) returns text language sql as $$ select status from public.class_waitlist where session_id = sess and user_id = uid $$;

-- ---------- a class with places free has no waitlist ----------
select pt.check('joining the line for a class with places free is refused', pt.join(pt.u('m1'), pt.c1()), 'ERROR:This class has a place free. Book it instead.');

-- ---------- fill the class ----------
select pt.check('m1 books', pt.book(pt.u('m1'), pt.c1()), 'booked');
select pt.check('m2 books', pt.book(pt.u('m2'), pt.c1()), 'booked');
select pt.check('m3 is told the class is full', pt.book(pt.u('m3'), pt.c1()), 'ERROR:This class is full');

-- ---------- joining ----------
select pt.check('m3 joins the line and is first', pt.join(pt.u('m3'), pt.c1()), 'waiting 1');
select pt.check('m4 joins and is second', pt.join(pt.u('m4'), pt.c1()), 'waiting 2');
select pt.check('joining twice keeps the same place', pt.join(pt.u('m3'), pt.c1()), 'waiting 1');
select pt.check('someone already booked cannot join', pt.join(pt.u('m1'), pt.c1()), 'ERROR:You are already booked into this class');
select pt.check('a member whose membership has ended cannot join', pt.join(pt.u('m5'), pt.c1()), 'ERROR:Not an active gym member');
select pt.check('another gym''s member cannot join', pt.join(pt.u('mb'), pt.c1()), 'ERROR:Not an active gym member');
select pt.check('a class with plenty of places has nothing to wait for', pt.join(pt.u('m3'), pt.c2()), 'ERROR:This class has a place free. Book it instead.');
select pt.check('m3 sees position 1', pt.mine(pt.u('m3'), pt.c1()), 'waiting 1');
select pt.check('m1 sees no place in line', pt.mine(pt.u('m1'), pt.c1()), 'none');

-- ---------- a place opens: the first in line is offered it and it is held ----------
select pt.check('m1 cancels', pt.cancel(pt.u('m1'), pt.c1()), 'cancelled');
select pt.check('m3 is offered the place', pt.wl(pt.c1(), pt.u('m3')), 'offered');
select pt.check('m4 is still waiting', pt.wl(pt.c1(), pt.u('m4')), 'waiting');
select pt.check('m3 was told, in the app', (select count(*)::text from public.member_notifications where user_id = pt.u('m3') and notification_type = 'waitlist_offer'), '1');
select pt.check('m4 was not told', (select count(*)::text from public.member_notifications where user_id = pt.u('m4') and notification_type = 'waitlist_offer'), '0');
select pt.check('m3 sees the offer', pt.mine(pt.u('m3'), pt.c1()), 'offered');
select pt.check('the held place cannot be booked by m4', pt.book(pt.u('m4'), pt.c1()), 'ERROR:This class is full');
select pt.check('nor by m6 who was never on the list', pt.book(pt.u('m6'), pt.c1()), 'ERROR:This class is full');
select pt.check('nor through the older booking function', pt.legacy_book(pt.u('m6'), pt.c1()), 'ERROR:This class is full');
select pt.check('m3 books the held place', pt.book(pt.u('m3'), pt.c1()), 'booked');
select pt.check('and is marked booked on the list', pt.wl(pt.c1(), pt.u('m3')), 'booked');
select pt.check('two people booked, no more', (select count(*)::text from public.class_bookings where session_id = pt.c1() and status = 'booked'), '2');
select pt.check('m4 is still waiting', pt.mine(pt.u('m4'), pt.c1()), 'waiting 1');

-- ---------- an offer that is not taken moves on ----------
select pt.check('m6 joins behind m4', pt.join(pt.u('m6'), pt.c1()), 'waiting 2');
select pt.check('m3 cancels again', pt.cancel(pt.u('m3'), pt.c1()), 'cancelled');
select pt.check('m4 is offered the place', pt.wl(pt.c1(), pt.u('m4')), 'offered');
update public.class_waitlist set offer_expires_at = now() - interval '1 minute' where session_id = pt.c1() and user_id = pt.u('m4');
select pt.check('after the 15 minutes m6 asking where they are is enough to move the line on', pt.mine(pt.u('m6'), pt.c1()), 'offered');
select pt.check('m4''s offer expired', pt.wl(pt.c1(), pt.u('m4')), 'expired');
select pt.check('an expired offer cannot be used to book', pt.book(pt.u('m4'), pt.c1()), 'ERROR:This class is full');
select pt.check('m4 can join the line again, at the back', pt.join(pt.u('m4'), pt.c1()), 'waiting 1');

-- ---------- leaving ----------
select pt.check('m6 turns down the offer', pt.leave(pt.u('m6'), pt.c1()), 'left');
select pt.check('so m4 is offered it', pt.wl(pt.c1(), pt.u('m4')), 'offered');
select pt.check('m4 leaves too, and nobody is left to offer it to', pt.leave(pt.u('m4'), pt.c1()), 'left');
select pt.check('a free place can then be booked by anyone', pt.book(pt.u('m7'), pt.c1()), 'booked');

-- ---------- a bigger class offers the extra place ----------
select pt.check('m1 joins the line again', pt.join(pt.u('m1'), pt.c1()), 'waiting 1');
update public.class_sessions set capacity = 3 where id = pt.c1();
select pt.check('raising the capacity offers the new place', pt.wl(pt.c1(), pt.u('m1')), 'offered');

-- ---------- who can see the list ----------
select pt.check('an admin can read the list', pt.q(pt.u('admin_a'), format('select count(*)::text from public.get_class_waitlist(%L, %L)', pt.gym_a(), pt.c1())), '1');
select pt.check('a member cannot', pt.q(pt.u('m1'), format('select count(*)::text from public.get_class_waitlist(%L, %L)', pt.gym_a(), pt.c1())), 'ERROR:Not authorised');
select pt.check('another gym''s owner cannot', pt.q(pt.u('admin_b'), format('select count(*)::text from public.get_class_waitlist(%L, %L)', pt.gym_a(), pt.c1())), 'ERROR:Not authorised');
select pt.check('get_my_waitlists lists the member''s open place', pt.q(pt.u('m1'), format('select count(*)::text || '' '' || min(status) from public.get_my_waitlists(%L)', pt.gym_a())), '1 offered');
select pt.check('a member with no place gets an empty list', pt.q(pt.u('m2'), format('select count(*)::text from public.get_my_waitlists(%L)', pt.gym_a())), '0');
select pt.check('get_my_waitlists refuses another gym''s member', pt.q(pt.u('mb'), format('select count(*)::text from public.get_my_waitlists(%L)', pt.gym_a())), 'ERROR:Not a member of this gym');
select pt.check('signed-out people cannot call get_my_waitlists', pt.anon(format('select count(*)::text from public.get_my_waitlists(%L)', pt.gym_a())), 'ERROR:permission denied for function get_my_waitlists');
select pt.check('a member reads only their own row', pt.q(pt.u('m1'), 'select count(*)::text from public.class_waitlist'), '1');
select pt.check('an admin reads the gym''s rows', pt.q(pt.u('admin_a'), 'select (count(*) > 1)::text from public.class_waitlist'), 'true');
select pt.check('another gym''s member reads none', pt.q(pt.u('mb'), 'select count(*)::text from public.class_waitlist'), '0');
select pt.check('nobody writes the list directly', pt.q(pt.u('m1'), format('insert into public.class_waitlist(gym_id, session_id, user_id) values (%L, %L, %L) returning 1', pt.gym_a(), pt.c2(), pt.u('m1'))), 'ERROR:permission denied for table class_waitlist');
select pt.check('nor updates it', pt.q(pt.u('m1'), 'update public.class_waitlist set status = ''offered'' returning 1'), 'ERROR:permission denied for table class_waitlist');
select pt.check('signed-out people cannot join', pt.anon(format('select public.member_join_waitlist(%L)::text', pt.c1())), 'ERROR:permission denied for function member_join_waitlist');
select pt.check('or read the list', pt.anon('select count(*)::text from public.class_waitlist'), 'ERROR:permission denied for table class_waitlist');

-- ---------- a cancelled class closes the line ----------
update public.class_sessions set is_cancelled = true where id = pt.c1();
select pt.check('cancelling the class closes the line', (select count(*)::text from public.class_waitlist where session_id = pt.c1() and status in ('waiting', 'offered')), '0');

\o
do $$
declare bad integer;
begin
  select count(*) into bad from pt.results where not ok;
  raise notice 'class waitlist: % checks, % failed', (select count(*) from pt.results), bad;
  if bad > 0 then
    raise exception 'FAILED: %', (select string_agg(seq || ' ' || label || ' [got ' || coalesce(got,'NULL') || ' / want ' || coalesce(want,'NULL') || ']', E'\n') from pt.results where not ok);
  end if;
end $$;
rollback;
