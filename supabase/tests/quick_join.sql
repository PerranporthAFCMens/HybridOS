-- Quick join: persona tests (rolled back at the end; leaves nothing behind).
-- Runs on a FRESH local database after the migrations are applied (never on the live project).
-- Real queries run as the `authenticated` role with that user's JWT claims, so Row Level Security and the functions
-- are exercised exactly as the app would.
-- Usage:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/quick_join.sql
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
insert into auth.users(id,email) select uid, name||'@qj.invalid' from pt.persona;
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




create function pt.su(stmt text) returns text language plpgsql as $f$
declare r text;
begin
  begin execute stmt into r; exception when others then r := 'ERROR:' || sqlerrm; end;
  return r;
end $f$;
create function pt.plan(n int) returns uuid language sql as $$ select ('c0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
create function pt.today() returns date language sql as $$ select private.gym_today() $$;


create function pt.gaps(uid uuid) returns text language sql as $$ select array_to_string(private.member_gaps(uid, pt.gym_a()), ', ') $$;
create function pt.sees_code(uid uuid) returns text language sql as $$
  select pt.q(uid, format($s$select count(*)::text from public.gym_access_settings where gym_id = %L$s$, pt.gym_a())) $$;
create function pt.status(uid uuid, k text) returns text language sql as $$
  select pt.q(uid, format($s$select (public.get_my_ready_status(%L))->>%L$s$, pt.gym_a(), k)) $$;
create function pt.set_style(who text, style text, addr text default 'optional', emerg text default 'required', docs text default 'required', hold boolean default true) returns text language sql as $$
  select pt.q(pt.u(who), format($s$select (public.save_join_settings(%L, %L, %L, %L, %L, %L))::text$s$, pt.gym_a(), style, addr, emerg, docs, hold)) $$;

-- Gym A: a plan, everybody a member with an active membership, a waiver to sign, and a door code.
insert into public.membership_plans(id, gym_id, name, price_pence, billing_interval, is_active, is_public) values (pt.plan(1), pt.gym_a(), 'Monthly', 3000, 'monthly', true, true);
insert into public.memberships(gym_id, user_id, plan_id, status, starts_on)
select pt.gym_a(), pt.u(n), pt.plan(1), 'active', current_date from (values ('m1'), ('m2'), ('m3'), ('m4'), ('m5'), ('m6')) v(n);
insert into public.gym_signup_documents(id, gym_id, kind, version, title, source, body_text, is_current)
values ('e0000000-0000-4000-8000-000000000001', pt.gym_a(), 'waiver', 1, 'Waiver', 'text', 'I accept the risks.', true);
insert into public.gym_access_settings(gym_id, access_enabled, access_code) values (pt.gym_a(), true, '1234');
-- m1 joined long before Quick join was switched on
update public.gym_members set created_at = now() - interval '30 days' where gym_id = pt.gym_a() and user_id = pt.u('m1');

-- ---------- before anything is switched on, joining is as it was ----------
select pt.check('a gym with no settings row is a full-join gym', (public.get_public_gym_join_style('tr-a'))->>'join_style', 'full');
select pt.check('...and a signed-out visitor can read that', pt.anon($s$select (public.get_public_gym_join_style('tr-a'))->>'join_style'$s$), 'full');
select pt.check('a brand-new person is asked for everything, in the usual order', pt.gaps(pt.u('m3')), 'first name, last name, date of birth, mobile number, address, emergency contact, signature on the terms and waiver');
select pt.check('a member sees the door code', pt.sees_code(pt.u('m2')), '1');
select pt.check('an unknown gym slug gives nothing', coalesce(pt.anon($s$select (public.get_public_gym_join_style('no-such-gym'))::text$s$), 'none'), 'none');

-- ---------- who may change how people join ----------
select pt.check('a member cannot switch Quick join on', pt.set_style('m1', 'quick'), 'ERROR:Only the gym''s owners and admins can change how people join.');
select pt.check('staff cannot either', pt.set_style('staff_a', 'quick'), 'ERROR:Only the gym''s owners and admins can change how people join.');
select pt.check('another gym''s owner cannot', pt.set_style('admin_b', 'quick'), 'ERROR:Only the gym''s owners and admins can change how people join.');
select pt.check('a signed-out visitor cannot', pt.anon(format($s$select public.save_join_settings(%L, 'quick', 'optional', 'required', 'required', true)::text$s$, pt.gym_a())) like 'ERROR:%', true);
select pt.check('an unknown style is refused', pt.set_style('admin_a', 'speedy'), 'ERROR:Choose quick join or full join.');
select pt.check('an unknown choice for the address is refused', pt.set_style('admin_a', 'quick', 'maybe'), 'ERROR:Choose whether to ask for an address.');
select pt.check('nothing was saved by the refusals', (select count(*) from public.gym_join_settings)::text, '0');
select pt.check('an admin switches Quick join on', pt.set_style('admin_a', 'quick') like 'ERROR:%', false);
select pt.check('...it is saved with the date it began', (select join_style || ':' || (quick_since is not null)::text from public.gym_join_settings where gym_id = pt.gym_a()), 'quick:true');
select pt.check('...and the sign-up page now sees it', pt.anon($s$select (public.get_public_gym_join_style('tr-a'))->>'join_style'$s$), 'quick');
select pt.check('...for this gym only', (public.get_public_gym_join_style('tr-b'))->>'join_style', 'full');
select pt.check('staff can read the settings', pt.q(pt.u('staff_a'), format($s$select count(*)::text from public.gym_join_settings where gym_id = %L$s$, pt.gym_a())), '1');
select pt.check('a member cannot', pt.q(pt.u('m1'), format($s$select count(*)::text from public.gym_join_settings where gym_id = %L$s$, pt.gym_a())), '0');
select pt.check('another gym''s owner cannot', pt.q(pt.u('admin_b'), format($s$select count(*)::text from public.gym_join_settings where gym_id = %L$s$, pt.gym_a())), '0');
select pt.check('nobody writes the settings directly', pt.q(pt.u('admin_a'), format($s$update public.gym_join_settings set join_style = 'full' where gym_id = %L returning 1$s$, pt.gym_a())) like 'ERROR:%permission denied%', true);

-- ---------- Quick join asks only for the basics before paying ----------
select pt.check('a brand-new person is asked only for the basics', pt.gaps(pt.u('m3')), 'first name, last name, date of birth, mobile number');
select pt.check('bad mobile number is refused', pt.q(pt.u('m3'), $s$select public.save_my_basics('Sam', 'Penrose', date '1990-04-12', '07700 900123', '', '')::text$s$), 'ERROR:Enter a valid mobile number.');
select pt.check('a missing name is refused', pt.q(pt.u('m3'), $s$select public.save_my_basics('', 'Penrose', date '1990-04-12', '+447700900123', '', '')::text$s$), 'ERROR:Enter your first name.');
select pt.check('a date of birth in the future is refused', pt.q(pt.u('m3'), $s$select public.save_my_basics('Sam', 'Penrose', current_date + 1, '+447700900123', '', '')::text$s$), 'ERROR:Enter a valid date of birth.');
select pt.check('under 18 needs a parent or guardian', pt.q(pt.u('m4'), format($s$select public.save_my_basics('Kit', 'Jones', %L, '+447700900125', '', '')::text$s$, (current_date - interval '14 years')::date)), 'ERROR:Enter a parent or guardian name and phone number.');
select pt.check('...and nothing was saved for them', (select count(*) from public.member_details where user_id = pt.u('m4'))::text, '0');
select pt.check('the basics save', pt.q(pt.u('m3'), $s$select (public.save_my_basics('Sam', 'Penrose', date '1990-04-12', '+447700900123', '', ''))->>'under_18'$s$), 'false');
select pt.check('...a person with the basics can now join', pt.gaps(pt.u('m3')), '');
select pt.check('...their display name became First Last', (select display_name from public.profiles where id = pt.u('m3')), 'Sam Penrose');
select pt.check('...no address or emergency contact is held for them yet', (select (address_line1 is null)::text || ':' || (emergency_name is null)::text from public.member_details where user_id = pt.u('m3')), 'true:true');
select pt.check('a parent or guardian is accepted under 18', pt.q(pt.u('m4'), format($s$select (public.save_my_basics('Kit', 'Jones', %L, '+447700900125', 'Pat Jones', '+447700900126'))->>'under_18'$s$, (current_date - interval '14 years')::date)), 'true');
select pt.check('...and then they can join', pt.gaps(pt.u('m4')), '');
update public.member_details set guardian_name = null, guardian_phone = null where user_id = pt.u('m4');
select pt.check('a minor with no guardian on record is still stopped', pt.gaps(pt.u('m4')), 'parent or guardian');
select pt.check('a signed-out visitor cannot save details', pt.anon($s$select public.save_my_basics('A', 'B', date '1990-01-01', '+447700900123', '', '')::text$s$) like 'ERROR:%', true);

-- ---------- after paying: the checklist and the door code ----------
select pt.check('m3 is told what is left (emergency contact and waiver are required; the address is optional)', pt.q(pt.u('m3'), format($s$select (select string_agg(i->>'key' || '=' || (i->>'required') || '/' || (i->>'done'), ', ' order by i->>'key') from jsonb_array_elements((public.get_my_ready_status(%L))->'items') i)$s$, pt.gym_a())), 'address=false/false, documents=true/false, emergency=true/false');
select pt.check('...not ready', pt.status(pt.u('m3'), 'ready'), 'false');
select pt.check('...and the door code is being held', pt.status(pt.u('m3'), 'held'), 'true');
select pt.check('...so the door code is not shown to them', pt.sees_code(pt.u('m3')), '0');
select pt.check('an older member is not held', pt.sees_code(pt.u('m1')), '1');
select pt.check('...and is not told to finish anything they never owed', pt.status(pt.u('m1'), 'held'), 'false');
select pt.check('owner, admin, staff and coach always see the code', pt.sees_code(pt.u('owner_a')) || pt.sees_code(pt.u('admin_a')) || pt.sees_code(pt.u('staff_a')) || pt.sees_code(pt.u('coach_a')), '1111');
select pt.check('a bad emergency phone is refused', pt.q(pt.u('m3'), $s$select public.save_my_emergency('Alex Penrose', '01234', 'Partner')::text$s$), 'ERROR:Enter a valid phone number for your emergency contact.');
select pt.check('a missing relationship is refused', pt.q(pt.u('m3'), $s$select public.save_my_emergency('Alex Penrose', '+447700900199', '')::text$s$), 'ERROR:Enter your emergency contact''s relationship to you.');
select pt.check('the emergency contact saves', pt.q(pt.u('m3'), $s$select public.save_my_emergency('Alex Penrose', '+447700900199', 'Partner')::text$s$) like 'ERROR:%', false);
select pt.check('...the earlier details are kept', (select phone from public.member_details where user_id = pt.u('m3')), '+447700900123');
select pt.check('...still held until the waiver is signed', pt.status(pt.u('m3'), 'held'), 'true');
insert into public.member_signatures(gym_id, user_id, signer_name, signature_png, waiver_document_id)
values (pt.gym_a(), pt.u('m3'), 'Sam Penrose', 'data:image/png;base64,AAAA', 'e0000000-0000-4000-8000-000000000001');
select pt.check('once the waiver is signed they are ready', pt.status(pt.u('m3'), 'ready'), 'true');
select pt.check('...the hold is lifted', pt.status(pt.u('m3'), 'held'), 'false');
select pt.check('...and the door code is shown', pt.sees_code(pt.u('m3')), '1');
select pt.check('an optional address is still accepted', pt.q(pt.u('m3'), $s$select public.save_my_address('1 High Street', '', 'Truro', 'tr1 1aa')::text$s$) like 'ERROR:%', false);
select pt.check('...and tidied up', (select postcode from public.member_details where user_id = pt.u('m3')), 'TR1 1AA');
select pt.check('a bad postcode is refused', pt.q(pt.u('m3'), $s$select public.save_my_address('1 High Street', '', 'Truro', 'nope')::text$s$), 'ERROR:Enter a valid UK postcode.');

-- ---------- the team's list of people who have paid but not finished ----------
select pt.check('the team sees people who have not finished', pt.q(pt.u('staff_a'), format($s$select count(*)::text from public.get_unfinished_members(%L) where user_id = %L$s$, pt.gym_a(), pt.u('m4'))), '1');
select pt.check('...with what is missing', pt.q(pt.u('staff_a'), format($s$select array_to_string(missing, ', ') from public.get_unfinished_members(%L) where user_id = %L$s$, pt.gym_a(), pt.u('m4'))), 'emergency contact, health questions and waiver');
select pt.check('...but not people who have finished', pt.q(pt.u('admin_a'), format($s$select count(*)::text from public.get_unfinished_members(%L) where user_id = %L$s$, pt.gym_a(), pt.u('m3'))), '0');
select pt.check('...nor people who joined before Quick join', pt.q(pt.u('admin_a'), format($s$select count(*)::text from public.get_unfinished_members(%L) where user_id = %L$s$, pt.gym_a(), pt.u('m1'))), '0');
select pt.check('a member cannot see the list', pt.q(pt.u('m1'), format($s$select count(*)::text from public.get_unfinished_members(%L)$s$, pt.gym_a())), 'ERROR:Not allowed');
select pt.check('another gym''s owner cannot', pt.q(pt.u('admin_b'), format($s$select count(*)::text from public.get_unfinished_members(%L)$s$, pt.gym_a())), 'ERROR:Not allowed');

-- ---------- the gym's other choices ----------
select pt.check('the gym can choose not to hold the door code', pt.set_style('admin_a', 'quick', 'optional', 'required', 'required', false) like 'ERROR:%', false);
select pt.check('...and then an unfinished member sees it', pt.sees_code(pt.u('m4')), '1');
select pt.check('the gym can turn the emergency contact off and the waiver to optional', pt.set_style('admin_a', 'quick', 'off', 'off', 'optional', true) like 'ERROR:%', false);
select pt.check('...so a member with nothing required is ready', pt.status(pt.u('m4'), 'ready'), 'true');
select pt.check('...and is not held', pt.sees_code(pt.u('m4')), '1');
select pt.check('...the emergency contact and address are left off the checklist', pt.q(pt.u('m4'), format($s$select (select string_agg(i->>'key', ',') from jsonb_array_elements((public.get_my_ready_status(%L))->'items') i)$s$, pt.gym_a())), 'documents');
select pt.check('...and the switch date did not move when only the choices changed', (select (quick_since = now())::text from public.gym_join_settings where gym_id = pt.gym_a()), 'true');
select pt.check('required address holds the door code too', pt.set_style('admin_a', 'quick', 'required', 'off', 'optional', true) like 'ERROR:%', false);
select pt.check('...m4 is held until the address is in', pt.sees_code(pt.u('m4')), '0');
select pt.check('...and m3 who gave an address is not', pt.sees_code(pt.u('m3')), '1');

-- ---------- switching back to full join ----------
update public.member_details set phone = '+447700900124' where user_id = pt.u('m4');
update public.profiles set first_name = 'Kit', last_name = 'Jones', date_of_birth = '1990-01-01' where id = pt.u('m4');
select pt.check('under Quick join, m4 now only needs the basics', pt.gaps(pt.u('m4')), '');
select pt.check('the gym can go back to full join', pt.set_style('admin_a', 'full') like 'ERROR:%', false);
select pt.check('...nobody is held any more', pt.sees_code(pt.u('m4')), '1');
select pt.check('...the list of unfinished members is empty', pt.q(pt.u('admin_a'), format($s$select count(*)::text from public.get_unfinished_members(%L)$s$, pt.gym_a())), '0');
select pt.check('...a half-filled person is asked for the rest, as before', pt.gaps(pt.u('m4')), 'address, emergency contact, signature on the terms and waiver');
select pt.check('...and a complete person is asked for nothing', pt.gaps(pt.u('m3')), '');

\o
do $$
declare bad integer;
begin
  select count(*) into bad from pt.results where not ok;
  raise notice 'quick join: % checks, % failed', (select count(*) from pt.results), bad;
  if bad > 0 then
    raise exception 'FAILED: %', (select string_agg(seq || ' ' || label || ' [got ' || coalesce(got,'NULL') || ' / want ' || coalesce(want,'NULL') || ']', E'\n') from pt.results where not ok);
  end if;
end $$;
rollback;
