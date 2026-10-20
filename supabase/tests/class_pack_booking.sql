-- Class pack booking: persona tests (rolled back at the end; leaves nothing behind).
-- Runs on a FRESH local database after the migrations are applied (never on the live project).
-- Real calls run as the `authenticated` role with that user's JWT claims, so Row Level Security and the functions
-- are exercised exactly as the app would.
-- Usage:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/class_pack_booking.sql
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
 ('owner_a','00000000-0000-4000-8000-000000000001'), ('m1','00000000-0000-4000-8000-000000000011'), ('m2','00000000-0000-4000-8000-000000000012'),
 ('m3','00000000-0000-4000-8000-000000000013'), ('m4','00000000-0000-4000-8000-000000000014'), ('m5','00000000-0000-4000-8000-000000000015'),
 ('m6','00000000-0000-4000-8000-000000000016'), ('m7','00000000-0000-4000-8000-000000000017'), ('m8','00000000-0000-4000-8000-000000000018'),
 ('owner_b','00000000-0000-4000-8000-000000000022');
insert into auth.users(id,email) select uid, name||'@cpbook.invalid' from pt.persona;
insert into public.profiles(id,display_name) select uid,name from pt.persona on conflict (id) do nothing;
create function pt.u(n text) returns uuid language sql as $$ select uid from pt.persona where name = n $$;
create function pt.gym_a() returns uuid language sql as $$ select 'a0000000-0000-4000-8000-00000000000a'::uuid $$;
create function pt.gym_b() returns uuid language sql as $$ select 'b0000000-0000-4000-8000-00000000000b'::uuid $$;
insert into public.gyms(id,name,slug,created_by) values (pt.gym_a(),'Pack Booking Gym A','cpb-a',pt.u('owner_a')),(pt.gym_b(),'Pack Booking Gym B','cpb-b',pt.u('owner_b'));
insert into public.gym_members(gym_id,user_id,role,is_active,access_status) select pt.gym_a(), pt.u(n), 'member', true, 'active' from unnest(array['m1','m2','m3','m4','m5','m6','m7','m8']) n;
insert into public.gym_members(gym_id,user_id,role,is_active,access_status) values (pt.gym_a(),pt.u('owner_a'),'owner',true,'active'),(pt.gym_b(),pt.u('owner_b'),'owner',true,'active');

-- Plan "Open gym" does not include classes. Plan "Classes" does.
insert into public.membership_plans(id,gym_id,name,price_pence,billing_interval,includes_classes) values
 ('c0000000-0000-4000-8000-000000000001',pt.gym_a(),'Open gym',2000,'monthly',false),
 ('c0000000-0000-4000-8000-000000000002',pt.gym_a(),'Classes',4000,'monthly',true);
insert into public.memberships(gym_id,user_id,plan_id,status,starts_on) select pt.gym_a(), pt.u(n), 'c0000000-0000-4000-8000-000000000001', 'active', current_date-30 from unnest(array['m1','m3','m4','m5','m6','m7','m8']) n;
insert into public.memberships(gym_id,user_id,plan_id,status,starts_on) values (pt.gym_a(), pt.u('m2'), 'c0000000-0000-4000-8000-000000000002', 'active', current_date-30);

create function pt.s(n int) returns uuid language sql as $$ select ('f0000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;
insert into public.class_sessions(id, gym_id, name, starts_at, ends_at, capacity) values
 (pt.s(1), pt.gym_a(), 'Far 1', now() + interval '3 days', now() + interval '3 days 1 hour', 20),
 (pt.s(2), pt.gym_a(), 'Far 2', now() + interval '4 days', now() + interval '4 days 1 hour', 20),
 (pt.s(3), pt.gym_a(), 'Far 3', now() + interval '5 days', now() + interval '5 days 1 hour', 20),
 (pt.s(4), pt.gym_a(), 'Near', now() + interval '2 hours', now() + interval '3 hours', 20),
 (pt.s(5), pt.gym_a(), 'Just outside the window', now() + interval '12 hours 5 minutes', now() + interval '13 hours', 20),
 (pt.s(6), pt.gym_a(), 'Just inside the window', now() + interval '11 hours 55 minutes', now() + interval '13 hours', 20);

-- Packs are written directly here (as the database owner) only to set up the test. Members and owners never can.
create table pt.packs(k text primary key, id uuid default gen_random_uuid());
create function pt.mkpack(pk text, uid uuid, total int, left_ int, expires interval default null, gym uuid default null, voided boolean default false) returns void language plpgsql as $$
begin
  insert into pt.packs(k) values (pk);
  insert into public.class_packs(id, gym_id, user_id, name, credits_total, credits_left, expires_at, source, voided_at)
  select p.id, coalesce(gym, pt.gym_a()), uid, pk, total, left_, case when expires is null then null else now() + expires end, 'owner', case when voided then now() end from pt.packs p where p.k = pk;
end $$;
create function pt.left_(k text) returns text language sql as $$ select credits_left::text from public.class_packs where name = k $$;
create function pt.link(uid uuid, sess uuid) returns text language sql as $$ select coalesce((select p.name from public.class_bookings b join public.class_packs p on p.id = b.class_pack_id where b.session_id = sess and b.user_id = uid), 'none') $$;
create function pt.book(uid uuid, sess uuid) returns text language sql as $$ select pt.q(uid, format('select concat_ws(''|'', r->>''status'', r->>''used_pack'') from (select public.member_book_class(%L) r) x', sess)) $$;
create function pt.legacy_book(uid uuid, sess uuid) returns text language sql as $$ select pt.q(uid, format('select (public.book_class_session(%L)).status', sess)) $$;
create function pt.cancel(uid uuid, sess uuid) returns text language sql as $$ select pt.q(uid, format('select concat_ws(''|'', r->>''status'', r->>''class_returned'') from (select public.member_cancel_class(%L) r) x', sess)) $$;
create function pt.legacy_cancel(uid uuid, sess uuid) returns text language sql as $$ select pt.q(uid, format('select (public.cancel_class_booking(%L)).status', sess)) $$;
create function pt.admin(uid uuid, member uuid, sess uuid, act text) returns text language sql as $$ select pt.q(uid, format('select public.admin_manage_class_booking(%L, %L, %L, %L)::text', pt.gym_a(), sess, member, act)) $$;

select pt.mkpack('m1 ten', pt.u('m1'), 10, 3);
select pt.mkpack('m2 five', pt.u('m2'), 5, 5);
select pt.mkpack('m4 old', pt.u('m4'), 10, 10, interval '-1 day');
select pt.mkpack('m5 voided', pt.u('m5'), 10, 10, null, null, true);
select pt.mkpack('m6 single', pt.u('m6'), 1, 1);
select pt.mkpack('m7 other gym', pt.u('m7'), 10, 10, null, pt.gym_b());
select pt.mkpack('m8 soon', pt.u('m8'), 1, 1, interval '10 days');
select pt.mkpack('m8 later', pt.u('m8'), 5, 5);

-- ---------- who can book ----------
select pt.check('a member with no classes in their plan and no pack is still refused', pt.book(pt.u('m3'), pt.s(1)), 'ERROR:Your membership does not include classes. Upgrade to a class-inclusive membership to book this class.');
select pt.check('an out-of-date pack does not count', pt.book(pt.u('m4'), pt.s(1)), 'ERROR:Your membership does not include classes. Upgrade to a class-inclusive membership to book this class.');
select pt.check('a cancelled pack does not count', pt.book(pt.u('m5'), pt.s(1)), 'ERROR:Your membership does not include classes. Upgrade to a class-inclusive membership to book this class.');
select pt.check('a pack from another gym does not count', pt.book(pt.u('m7'), pt.s(1)), 'ERROR:Your membership does not include classes. Upgrade to a class-inclusive membership to book this class.');
select pt.check('refusals used nothing', pt.left_('m4 old') || pt.left_('m5 voided') || pt.left_('m7 other gym'), '101010');

-- ---------- booking with a pack ----------
select pt.check('a pack holder books and is told a pack class was used', pt.book(pt.u('m1'), pt.s(1)), 'booked|true');
select pt.check('one class comes off the pack', pt.left_('m1 ten'), '2');
select pt.check('the booking knows which pack paid', pt.link(pt.u('m1'), pt.s(1)), 'm1 ten');
select pt.check('booking the same class again costs nothing more', pt.book(pt.u('m1'), pt.s(1)), 'booked');
select pt.check('still two left', pt.left_('m1 ten'), '2');
select pt.check('the older booking function uses a pack too', pt.legacy_book(pt.u('m1'), pt.s(2)), 'booked');
select pt.check('and takes a class off', pt.left_('m1 ten'), '1');
select pt.check('a plan that includes classes never touches a pack', pt.book(pt.u('m2'), pt.s(1)), 'booked|false');
select pt.check('so the pack is untouched', pt.left_('m2 five'), '5');
select pt.check('and the booking has no pack', pt.link(pt.u('m2'), pt.s(1)), 'none');
select pt.check('the last class on a pack can be used', pt.book(pt.u('m6'), pt.s(1)), 'booked|true');
select pt.check('then it is empty', pt.left_('m6 single'), '0');
select pt.check('and the next booking is refused', pt.book(pt.u('m6'), pt.s(2)), 'ERROR:Your membership does not include classes. Upgrade to a class-inclusive membership to book this class.');
select pt.check('the pack that runs out soonest is used first', pt.book(pt.u('m8'), pt.s(1)), 'booked|true');
select pt.check('so the dated one is empty', pt.left_('m8 soon') || pt.left_('m8 later'), '05');

-- ---------- cancelling in time gives the class back ----------
select pt.check('cancelling days ahead returns the class', pt.cancel(pt.u('m1'), pt.s(2)), 'cancelled|true');
select pt.check('the pack is back up', pt.left_('m1 ten'), '2');
select pt.check('the booking is gone', (select count(*)::text from public.class_bookings where session_id = pt.s(2) and user_id = pt.u('m1')), '0');
select pt.check('cancelling the other way also returns it', pt.legacy_cancel(pt.u('m1'), pt.s(1)), 'cancelled');
select pt.check('the pack is back up again', pt.left_('m1 ten'), '3');
select pt.check('the cancelled booking no longer points at the pack', pt.link(pt.u('m1'), pt.s(1)), 'none');
select pt.check('booking the same class again uses a class again', pt.book(pt.u('m1'), pt.s(1)), 'booked|true');
select pt.check('two left', pt.left_('m1 ten'), '2');
select pt.check('cancelling a class that was not paid by a pack changes no pack', pt.cancel(pt.u('m2'), pt.s(1)) || pt.left_('m2 five'), 'cancelled|false5');

-- ---------- cancelling too late ----------
select pt.check('booking a class starting in two hours uses a class', pt.book(pt.u('m1'), pt.s(4)), 'booked|true');
select pt.check('one left', pt.left_('m1 ten'), '1');
select pt.check('cancelling too late keeps it used', pt.cancel(pt.u('m1'), pt.s(4)), 'cancelled|false');
select pt.check('still one left', pt.left_('m1 ten'), '1');
select pt.check('a class just outside the 12 hours: cancelling in time returns it', (select pt.book(pt.u('m1'), pt.s(5))) || ' ' || pt.cancel(pt.u('m1'), pt.s(5)) || ' ' || pt.left_('m1 ten'), 'booked|true cancelled|true 1');
select pt.check('a class just inside the 12 hours: cancelling does not', (select pt.book(pt.u('m1'), pt.s(6))) || ' ' || pt.cancel(pt.u('m1'), pt.s(6)) || ' ' || pt.left_('m1 ten'), 'booked|true cancelled|false 0');
select pt.check('with nothing left, booking is refused', pt.book(pt.u('m1'), pt.s(3)), 'ERROR:Your membership does not include classes. Upgrade to a class-inclusive membership to book this class.');

-- ---------- the gym cancels or removes ----------
update public.class_packs set credits_left = 3 where name = 'm1 ten';
select pt.check('m1 books Far 3', pt.book(pt.u('m1'), pt.s(3)), 'booked|true');
select pt.check('an owner taking them off the list returns the class', pt.admin(pt.u('owner_a'), pt.u('m1'), pt.s(3), 'cancel') || ' ' || pt.left_('m1 ten'), '{"ok": true, "warnings": []} 3');
select pt.check('a second cancel finds nobody on the list and returns nothing more', pt.admin(pt.u('owner_a'), pt.u('m1'), pt.s(3), 'cancel') || ' ' || pt.left_('m1 ten'), '{"ok": false, "errors": ["That person is not on the list."]} 3');
select pt.check('m1 books Far 3 again', pt.book(pt.u('m1'), pt.s(3)), 'booked|true');
select pt.check('2 left', pt.left_('m1 ten'), '2');
update public.class_sessions set is_cancelled = true where id = pt.s(3);
select pt.check('when the gym cancels the class, the class comes back', pt.left_('m1 ten'), '3');
select pt.check('and the booking forgets the pack', pt.link(pt.u('m1'), pt.s(3)), 'none');
update public.class_sessions set is_cancelled = false where id = pt.s(3);
update public.class_sessions set is_cancelled = true where id = pt.s(3);
select pt.check('cancelling the class twice never returns a class twice', pt.left_('m1 ten'), '3');
update public.class_sessions set is_cancelled = false where id = pt.s(3);
delete from public.class_bookings where session_id = pt.s(3) and user_id = pt.u('m1');
select pt.check('m1 books Far 3 once more', pt.book(pt.u('m1'), pt.s(3)) || ' ' || pt.left_('m1 ten'), 'booked|true 2');
delete from public.class_sessions where id = pt.s(3);
select pt.check('deleting the class returns the class', pt.left_('m1 ten'), '3');

-- ---------- a pack can never hold more than it started with ----------
select pt.check('m2 (plan includes classes) books Far 2', pt.book(pt.u('m2'), pt.s(2)), 'booked|false');
update public.class_bookings set class_pack_id = (select id from public.class_packs where name = 'm2 five') where session_id = pt.s(2) and user_id = pt.u('m2');
select pt.check('a return onto an already full pack stays at the total', (pt.admin(pt.u('owner_a'), pt.u('m2'), pt.s(2), 'cancel') is not null)::text || pt.left_('m2 five'), 'true5');

-- ---------- a cancelled pack never gets a class back ----------
select pt.mkpack('m3 to cancel', pt.u('m3'), 5, 5);
select pt.check('m3 books with their pack', pt.book(pt.u('m3'), pt.s(2)), 'booked|true');
select pt.q(pt.u('owner_a'), format('select public.owner_void_class_pack(%L)::text', (select id from pt.packs where k = 'm3 to cancel')));
select pt.check('the owner cancelled the pack', (select (voided_at is not null)::text from public.class_packs where name = 'm3 to cancel'), 'true');
select pt.check('cancelling the booking does not refill a cancelled pack', pt.cancel(pt.u('m3'), pt.s(2)) || ' ' || pt.left_('m3 to cancel'), 'cancelled|true 4');

-- ---------- nobody tampers ----------
select pt.check('a member cannot reach the helper that spends a class', left(pt.q(pt.u('m3'), format('select private.spend_pack_credit(%L, %L)::text', pt.gym_a(), pt.u('m3'))), 23), 'ERROR:permission denied');
select pt.check('nor the helper that gives one back', left(pt.q(pt.u('m3'), format('select private.refund_pack_credit(%L)::text', gen_random_uuid())), 23), 'ERROR:permission denied');
select pt.check('a member cannot edit their own booking to hide a pack', pt.q(pt.u('m6'), format('update public.class_bookings set class_pack_id = null where user_id = %L returning 1', pt.u('m6'))), 'ERROR:permission denied for table class_bookings');
select pt.check('and cannot edit a pack', pt.q(pt.u('m6'), format('update public.class_packs set credits_left = 99 where user_id = %L returning 1', pt.u('m6'))), 'ERROR:permission denied for table class_packs');

\o
do $$
declare bad integer;
begin
  select count(*) into bad from pt.results where not ok;
  raise notice 'class pack booking: % checks, % failed', (select count(*) from pt.results), bad;
  if bad > 0 then
    raise exception 'FAILED: %', (select string_agg(seq || ' ' || label || ' [got ' || coalesce(got,'NULL') || ' / want ' || coalesce(want,'NULL') || ']', E'\n') from pt.results where not ok);
  end if;
end $$;
rollback;
