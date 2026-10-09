-- Membership status rules, Stage 2a: persona tests (rolled back at the end; leaves nothing behind).
-- Runs on a FRESH local database after `supabase db reset --local` (never on the live project).
-- Twelve personas, two gyms. Each persona runs real queries as the `authenticated` role with that user's JWT claims,
-- so Row Level Security and the booking RPCs are exercised exactly as the app would.
-- Usage:  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/membership_status_personas.sql
begin;
\o /dev/null
create schema pt;

create table pt.results(seq serial, label text, got text, want text, ok boolean);

-- Run one statement as a user (JWT claims + authenticated role). Returns the single scalar result, or 'ERROR:<sqlstate>:<message>'.
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
    r := 'ERROR:' || sqlstate || ':' || sqlerrm;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claims','',true);
  perform set_config('request.jwt.claim.sub','',true);
  return r;
end $f$;

create function pt.check(label text, got text, want text) returns void language plpgsql as $f$
begin
  insert into pt.results(label,got,want,ok) values(label, got, want, got is not distinct from want or (want like '%\%' and got like want));
end $f$;

-- ---------- fixtures (as the database owner) ----------
create table pt.persona(name text primary key, uid uuid, class text);
insert into pt.persona values
 ('owner_a',    '00000000-0000-4000-8000-000000000001','priv'),
 ('admin_a',    '00000000-0000-4000-8000-000000000002','priv'),
 ('staff_a',    '00000000-0000-4000-8000-000000000003','priv'),   -- also holds a CANCELLED membership row: role still bypasses
 ('coach_a',    '00000000-0000-4000-8000-000000000004','priv'),
 ('active_a',   '00000000-0000-4000-8000-000000000005','active'), -- older cancelled row, NEWEST row active
 ('paused_a',   '00000000-0000-4000-8000-000000000006','paused'),
 ('pending_a',  '00000000-0000-4000-8000-000000000007','pending'),
 ('norow_a',    '00000000-0000-4000-8000-000000000008','pending'),-- member role, no membership row at all
 ('cancelled_a','00000000-0000-4000-8000-000000000009','ended'),  -- older ACTIVE row (with classes), NEWEST row cancelled (same created_at: id breaks the tie)
 ('expired_a',  '00000000-0000-4000-8000-00000000000a','ended'),
 ('endeddate_a','00000000-0000-4000-8000-00000000000b','ended'),  -- status active but ends_on yesterday
 ('split_a',    '00000000-0000-4000-8000-00000000000c','active'); -- active in gym A (plan WITHOUT classes), cancelled in gym B

insert into auth.users(id,email) select uid, name||'@persona.invalid' from pt.persona;
insert into public.profiles(id,display_name) select uid,name from pt.persona on conflict (id) do nothing;

insert into public.gyms(id,name,slug,created_by) values
 ('a0000000-0000-4000-8000-00000000000a','Persona Gym A','persona-gym-a','00000000-0000-4000-8000-000000000001'),
 ('b0000000-0000-4000-8000-00000000000b','Persona Gym B','persona-gym-b','00000000-0000-4000-8000-000000000001');

create function pt.gym_a() returns uuid language sql as $$ select 'a0000000-0000-4000-8000-00000000000a'::uuid $$;
create function pt.gym_b() returns uuid language sql as $$ select 'b0000000-0000-4000-8000-00000000000b'::uuid $$;

insert into public.gym_members(gym_id,user_id,role,is_active,access_status)
select pt.gym_a(), uid,
       case name when 'owner_a' then 'owner' when 'admin_a' then 'admin' when 'staff_a' then 'staff' when 'coach_a' then 'coach' else 'member' end::public.gym_member_role,
       true,'active' from pt.persona;
insert into public.gym_members(gym_id,user_id,role,is_active,access_status)
select pt.gym_b(), uid, 'member', true, 'active' from pt.persona where name in ('split_a','owner_a');

insert into public.membership_plans(id,gym_id,name,price_pence,includes_classes) values
 ('c0000000-0000-4000-8000-000000000001',pt.gym_a(),'With classes',5000,true),
 ('c0000000-0000-4000-8000-000000000002',pt.gym_a(),'No classes',2000,false),
 ('c0000000-0000-4000-8000-000000000003',pt.gym_b(),'B plan',2000,true);

-- memberships (explicit ids/created_at so the "newest row governs" ordering is deterministic)
insert into public.memberships(id,gym_id,user_id,plan_id,status,starts_on,ends_on,created_at) values
 ('d0000000-0000-4000-8000-000000000101',pt.gym_a(),'00000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000001','cancelled',null,null,'2026-01-01'),
 ('d0000000-0000-4000-8000-000000000102',pt.gym_a(),'00000000-0000-4000-8000-000000000005','c0000000-0000-4000-8000-000000000001','cancelled',null,null,'2026-01-01'),
 ('d0000000-0000-4000-8000-000000000103',pt.gym_a(),'00000000-0000-4000-8000-000000000005','c0000000-0000-4000-8000-000000000001','active',null,null,'2026-02-01'),
 ('d0000000-0000-4000-8000-000000000104',pt.gym_a(),'00000000-0000-4000-8000-000000000006','c0000000-0000-4000-8000-000000000001','paused',null,null,'2026-02-01'),
 ('d0000000-0000-4000-8000-000000000105',pt.gym_a(),'00000000-0000-4000-8000-000000000007','c0000000-0000-4000-8000-000000000001','pending',null,null,'2026-02-01'),
 ('d0000000-0000-4000-8000-000000000106',pt.gym_a(),'00000000-0000-4000-8000-000000000009','c0000000-0000-4000-8000-000000000001','active',null,null,'2026-03-01'),
 ('d0000000-0000-4000-8000-000000000107',pt.gym_a(),'00000000-0000-4000-8000-000000000009','c0000000-0000-4000-8000-000000000001','cancelled',null,null,'2026-03-01'), -- same created_at, higher id wins
 ('d0000000-0000-4000-8000-000000000108',pt.gym_a(),'00000000-0000-4000-8000-00000000000a','c0000000-0000-4000-8000-000000000001','expired',null,null,'2026-02-01'),
 ('d0000000-0000-4000-8000-000000000109',pt.gym_a(),'00000000-0000-4000-8000-00000000000b','c0000000-0000-4000-8000-000000000001','active',null,current_date-1,'2026-02-01'),
 ('d0000000-0000-4000-8000-00000000010a',pt.gym_a(),'00000000-0000-4000-8000-00000000000c','c0000000-0000-4000-8000-000000000002','active',null,null,'2026-02-01'),
 ('d0000000-0000-4000-8000-00000000010b',pt.gym_b(),'00000000-0000-4000-8000-00000000000c','c0000000-0000-4000-8000-000000000003','cancelled',null,null,'2026-02-01');

-- class data
insert into public.class_types(id,gym_id,name) values ('e0000000-0000-4000-8000-000000000001',pt.gym_a(),'Persona class type'),('e0000000-0000-4000-8000-000000000002',pt.gym_b(),'B class type');
insert into public.class_sessions(id,gym_id,name,starts_at,ends_at,capacity,drop_in_price_pence) values
 ('f0000000-0000-4000-8000-000000000001',pt.gym_a(),'Session one',now()+interval '3 days',now()+interval '3 days 1 hour',30,1000),
 ('f0000000-0000-4000-8000-000000000002',pt.gym_a(),'Session two (booking RPC tests)',now()+interval '4 days',now()+interval '4 days 1 hour',30,1000),
 ('f0000000-0000-4000-8000-000000000003',pt.gym_b(),'B session',now()+interval '3 days',now()+interval '3 days 1 hour',30,1000);
insert into public.class_bookings(gym_id,session_id,user_id,status) select pt.gym_a(),'f0000000-0000-4000-8000-000000000001',uid,'booked' from pt.persona;
-- paid drop-ins on session two for every non-active persona (plus split_a, a legitimate active drop-in buyer): the loophole fixture
insert into public.class_booking_purchases(gym_id,session_id,user_id,amount_pence,status)
select pt.gym_a(),'f0000000-0000-4000-8000-000000000002',uid,1000,'paid' from pt.persona
 where name in ('paused_a','pending_a','norow_a','cancelled_a','expired_a','endeddate_a','split_a');

-- member data: one row per persona (so every probe can ask "can I see my own row?")
insert into public.workout_sessions(gym_id,user_id,title) select pt.gym_a(),uid,'own session' from pt.persona;
insert into public.workout_sessions(gym_id,user_id,title) values (pt.gym_b(),'00000000-0000-4000-8000-00000000000c','split own B session');
insert into public.workout_entries(session_id,gym_id,user_id,exercise_name) select id,gym_id,user_id,'Squat' from public.workout_sessions where gym_id=pt.gym_a();
insert into public.workout_sets(entry_id,set_number) select id,1 from public.workout_entries;
insert into public.personal_bests(gym_id,user_id,exercise_name,metric_type,value_numeric) select pt.gym_a(),uid,'Deadlift','weight',100 from pt.persona;
insert into public.workout_assignments(gym_id,member_user_id,source,title) select pt.gym_a(),uid,'self','Assigned workout' from pt.persona;
insert into public.member_training_preferences(gym_id,user_id) select pt.gym_a(),uid from pt.persona;
insert into public.member_notifications(gym_id,user_id,notification_type,title) select pt.gym_a(),uid,'test','Hello' from pt.persona;
insert into public.payment_records(gym_id,user_id,amount_pence) select pt.gym_a(),uid,5000 from pt.persona;
insert into public.social_posts(id,gym_id,user_id,body) select gen_random_uuid(),pt.gym_a(),uid,'post by '||name from pt.persona;
insert into public.social_comments(gym_id,post_id,user_id,body) select pt.gym_a(),(select id from public.social_posts limit 1),'00000000-0000-4000-8000-000000000005','a comment';
insert into public.channels(id,gym_id,name) values ('90000000-0000-4000-8000-000000000001',pt.gym_a(),'general');
insert into public.messages(channel_id,sender_id,body) values ('90000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000005','hi');
insert into public.gym_access_settings(gym_id) values (pt.gym_a());
insert into public.pt_appointments(gym_id,staff_user_id,member_user_id,starts_at,ends_at) select pt.gym_a(),'00000000-0000-4000-8000-000000000003',uid,now()+interval '2 days',now()+interval '2 days 1 hour' from pt.persona where name not in ('owner_a','admin_a','staff_a','coach_a');

-- training group fixtures (group tables have RLS with no policies: reachable only through the RPCs)
insert into public.training_groups(id,gym_id,owner_user_id,name,invite_code) values ('77000000-0000-4000-8000-000000000001',pt.gym_a(),'00000000-0000-4000-8000-000000000005','Persona group','PERSONA1');
insert into public.training_group_members(group_id,user_id) select '77000000-0000-4000-8000-000000000001',uid from pt.persona where name in ('active_a','owner_a','staff_a','paused_a','pending_a','cancelled_a');
insert into public.training_group_challenges(id,group_id,created_by,name,activity_name,metric_type) values ('77000000-0000-4000-8000-0000000000c1','77000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000005','Persona challenge','Rowing','reps');
-- two extra accounts that are NOT personas: a brand-new user (no gym rows) and a REVOKED staff account (is_active but access_status revoked)
insert into auth.users(id,email) values ('00000000-0000-4000-8000-0000000000d1','newcomer@persona.invalid'),('00000000-0000-4000-8000-0000000000d2','revoked-staff@persona.invalid');
insert into public.profiles(id,display_name) values ('00000000-0000-4000-8000-0000000000d1','newcomer'),('00000000-0000-4000-8000-0000000000d2','revoked staff') on conflict (id) do nothing;
insert into public.gym_members(gym_id,user_id,role,is_active,access_status) values (pt.gym_a(),'00000000-0000-4000-8000-0000000000d2','staff',true,'revoked');

-- ---------- helper to run a probe for every persona with an expectation per class ----------
-- classes: priv | active | paused | pending | ended   (expected strings in that order)
create function pt.probe(label text, stmt text, w_priv text, w_active text, w_paused text, w_pending text, w_ended text) returns void language plpgsql as $f$
declare p record; want text;
begin
  for p in select * from pt.persona order by name loop
    want := case p.class when 'priv' then w_priv when 'active' then w_active when 'paused' then w_paused when 'pending' then w_pending else w_ended end;
    perform pt.check(label||' :: '||p.name, pt.q(p.uid, replace(replace(replace(replace(stmt,'{ALL}',(select 'array['||string_agg(quote_literal(uid::text),',')||']::uuid[]' from pt.persona)),'{uid}',quote_literal(p.uid::text)||'::uuid'),'{A}',quote_literal(pt.gym_a()::text)||'::uuid'),'{B}',quote_literal(pt.gym_b()::text)||'::uuid')), want);
  end loop;
end $f$;

-- ===== READS (counts of what each persona can see) =====
select pt.probe('R own gym_members row','select count(*)::text from public.gym_members where gym_id={A} and user_id={uid}','1','1','1','1','1');
select pt.probe('R other gym_members rows','select count(*)::text from public.gym_members where gym_id={A} and user_id<>{uid}','12','12','0','0','0'); -- 11 other personas + the revoked-staff fixture row
select pt.probe('R membership plans','select count(*)::text from public.membership_plans where gym_id={A}','2','2','2','2','0');
select pt.probe('R gyms row','select count(*)::text from public.gyms where id={A}','1','1','1','1','1');
select pt.probe('R own workout sessions','select count(*)::text from public.workout_sessions where gym_id={A} and user_id={uid}','1','1','1','0','0');
select pt.probe('R own workout entries','select count(*)::text from public.workout_entries where gym_id={A} and user_id={uid}','1','1','1','0','0');
select pt.probe('R own workout sets','select count(*)::text from public.workout_sets s join public.workout_entries e on e.id=s.entry_id where e.gym_id={A} and e.user_id={uid}','1','1','1','0','0');
select pt.probe('R own personal bests','select count(*)::text from public.personal_bests where gym_id={A} and user_id={uid}','1','1','1','0','0');
select pt.probe('R own workout assignments','select count(*)::text from public.workout_assignments where gym_id={A} and member_user_id={uid}','1','1','1','0','0');
select pt.probe('R own training preferences','select count(*)::text from public.member_training_preferences where gym_id={A} and user_id={uid}','1','1','1','0','0');
select pt.probe('R class sessions','select count(*)::text from public.class_sessions where gym_id={A}','2','2','0','0','0');
select pt.probe('R class types','select count(*)::text from public.class_types where gym_id={A}','1','1','0','0','0');
select pt.probe('R own class bookings','select count(*)::text from public.class_bookings where gym_id={A} and user_id={uid}','1','1','0','0','0');
select pt.probe('R social posts','select count(*)::text from public.social_posts where gym_id={A}','12','12','0','0','0');
select pt.probe('R social comments','select count(*)::text from public.social_comments where gym_id={A}','1','1','0','0','0');
select pt.probe('R channels','select count(*)::text from public.channels where gym_id={A}','1','1','0','0','0');
select pt.probe('R messages','select count(*)::text from public.messages m join public.channels c on c.id=m.channel_id where c.gym_id={A}','1','1','0','0','0');
select pt.probe('R own payment records','select count(*)::text from public.payment_records where gym_id={A} and user_id={uid}','1','1','0','0','0');
-- member_notifications: the baseline revokes SELECT from `authenticated` (no direct table access), so its RLS policies are not reachable; nothing to probe.
select pt.probe('R gym access settings','select count(*)::text from public.gym_access_settings where gym_id={A}','1','1','0','0','0');
select pt.probe('R own pt appointments','select count(*)::text from public.pt_appointments where gym_id={A} and member_user_id={uid}','0','1','0','0','0');
select pt.probe('R other profiles','select count(*)::text from public.profiles p where p.id<>{uid} and p.id = any ({ALL})','11','11','0','0','0');
select pt.probe('R own profile','select count(*)::text from public.profiles where id={uid}','1','1','1','1','1');

-- own membership rows are readable at EVERY status (the app needs them to explain why access is blocked)
do $$ declare p record; begin
  for p in select * from pt.persona order by name loop
    perform pt.check('R own membership rows :: '||p.name,
      pt.q(p.uid, format('select count(*)::text from public.memberships where gym_id=%L and user_id=%L', pt.gym_a(), p.uid)),
      (select count(*)::text from public.memberships where gym_id=pt.gym_a() and user_id=p.uid));
  end loop;
end $$;

-- ===== cross-gym: only the SELECTED gym counts, never another gym =====
select pt.check('X split_a gym A sessions (active in A)', pt.q('00000000-0000-4000-8000-00000000000c','select count(*)::text from public.class_sessions where gym_id=''a0000000-0000-4000-8000-00000000000a'''),'2');
select pt.check('X split_a gym B sessions (cancelled in B)', pt.q('00000000-0000-4000-8000-00000000000c','select count(*)::text from public.class_sessions where gym_id=''b0000000-0000-4000-8000-00000000000b'''),'0');
select pt.check('X split_a gym B own workouts (cancelled in B)', pt.q('00000000-0000-4000-8000-00000000000c','select count(*)::text from public.workout_sessions where gym_id=''b0000000-0000-4000-8000-00000000000b'''),'0');
select pt.check('X split_a gym B plans (cancelled in B)', pt.q('00000000-0000-4000-8000-00000000000c','select count(*)::text from public.membership_plans where gym_id=''b0000000-0000-4000-8000-00000000000b'''),'0');
select pt.check('X split_a gym B gym row (cancelled in B: every status may read its own gym row)', pt.q('00000000-0000-4000-8000-00000000000c','select count(*)::text from public.gyms where id=''b0000000-0000-4000-8000-00000000000b'''),'1');
select pt.check('X active_a cannot read gym B row (not a member of B)', pt.q('00000000-0000-4000-8000-000000000005','select count(*)::text from public.gyms where id=''b0000000-0000-4000-8000-00000000000b'''),'0');
select pt.check('X gyms row: a user with no gym_members row at all sees nothing', (select pt.q(u.id,'select count(*)::text from public.gyms') from (select gen_random_uuid() id) u),'0');
select pt.check('X split_a gym B own gym_members row still visible', pt.q('00000000-0000-4000-8000-00000000000c','select count(*)::text from public.gym_members where gym_id=''b0000000-0000-4000-8000-00000000000b'' and user_id=''00000000-0000-4000-8000-00000000000c'''),'1');
select pt.check('X active_a is not in gym B', pt.q('00000000-0000-4000-8000-000000000005','select count(*)::text from public.class_sessions where gym_id=''b0000000-0000-4000-8000-00000000000b'''),'0');
select pt.check('X owner_a (owner of A and a plain member of B) bypass applies to A only: B sessions', pt.q('00000000-0000-4000-8000-000000000001','select count(*)::text from public.class_sessions where gym_id=''b0000000-0000-4000-8000-00000000000b'''),'0');

-- ===== governing status per persona (helper function, as the owner) =====
do $$ declare r record; begin
  for r in select * from (values
    ('owner_a','pending'),('admin_a','pending'),('staff_a','cancelled'),('coach_a','pending'),('active_a','active'),('paused_a','paused'),
    ('pending_a','pending'),('norow_a','pending'),('cancelled_a','cancelled'),('expired_a','expired'),('endeddate_a','expired'),('split_a','active')) v(n,s) loop
    perform pt.check('S current_membership_status gym A :: '||r.n, private.current_membership_status(pt.gym_a(),(select uid from pt.persona where name=r.n)), r.s);
  end loop;
  perform pt.check('S current_membership_status gym B :: split_a', private.current_membership_status(pt.gym_b(),'00000000-0000-4000-8000-00000000000c'),'cancelled');
  perform pt.check('S member_has_class_access :: active_a (classes plan)', private.member_has_class_access(pt.gym_a(),'00000000-0000-4000-8000-000000000005')::text,'true');
  perform pt.check('S member_has_class_access :: cancelled_a (older ACTIVE row must not leak)', private.member_has_class_access(pt.gym_a(),'00000000-0000-4000-8000-000000000009')::text,'false');
  perform pt.check('S member_has_class_access :: endeddate_a', private.member_has_class_access(pt.gym_a(),'00000000-0000-4000-8000-00000000000b')::text,'false');
  perform pt.check('S member_has_class_access :: paused_a', private.member_has_class_access(pt.gym_a(),'00000000-0000-4000-8000-000000000006')::text,'false');
  perform pt.check('S member_has_class_access :: split_a (no-classes plan)', private.member_has_class_access(pt.gym_a(),'00000000-0000-4000-8000-00000000000c')::text,'false');
end $$;

-- ===== RPCs that only read =====
select pt.probe('RPC member_class_schedule','select count(*)::text from public.member_class_schedule({A})','2','2','ERROR:P0001:Not an active gym member','ERROR:P0001:Not an active gym member','ERROR:P0001:Not an active gym member');
select pt.probe('RPC get_member_home_settings','select ''ok'' from (select public.get_member_home_settings({A})) x','ok','ok','ERROR:P0001:Not authorised for this gym','ERROR:P0001:Not authorised for this gym','ERROR:P0001:Not authorised for this gym');
select pt.probe('RPC get_class_booking_options','select (public.get_class_booking_options(''f0000000-0000-4000-8000-000000000001''))->>''session_id''','f0000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000001','ERROR:P0001:Not a member of this gym','ERROR:P0001:Not a member of this gym','ERROR:P0001:Not a member of this gym');
select pt.probe('RPC prepare_class_drop_in_purchase','select ''ok'' from (select public.prepare_class_drop_in_purchase(''f0000000-0000-4000-8000-000000000001'')) x','ok','ok','ERROR:P0001:Not a member of this gym','ERROR:P0001:Not a member of this gym','ERROR:P0001:Not a member of this gym');

-- ===== WRITES =====
select pt.probe('W insert own workout session','with x as (insert into public.workout_sessions(gym_id,user_id,title) values({A},{uid},''probe'') returning 1) select count(*)::text from x','1','1','ERROR:42501:%','ERROR:42501:%','ERROR:42501:%');
select pt.probe('W update own workout session','with x as (update public.workout_sessions set notes=''probe'' where gym_id={A} and user_id={uid} returning 1) select count(*)::text from x','2','2','0','0','0');
select pt.probe('W insert own personal best','with x as (insert into public.personal_bests(gym_id,user_id,exercise_name,metric_type,value_numeric) values({A},{uid},''Probe'',''weight'',1) returning 1) select count(*)::text from x','1','1','ERROR:42501:%','ERROR:42501:%','ERROR:42501:%');
select pt.probe('W delete own personal bests','with x as (delete from public.personal_bests where gym_id={A} and user_id={uid} returning 1) select count(*)::text from x','2','2','0','0','0');
select pt.probe('W insert own social post','with x as (insert into public.social_posts(gym_id,user_id,body) values({A},{uid},''probe'') returning 1) select count(*)::text from x','1','1','ERROR:42501:%','ERROR:42501:%','ERROR:42501:%');
select pt.probe('W update own training preferences','with x as (update public.member_training_preferences set weekly_goal=4 where gym_id={A} and user_id={uid} returning 1) select count(*)::text from x','1','1','0','0','0');
select pt.probe('W insert own self-service workout assignment','with x as (insert into public.workout_assignments(gym_id,member_user_id,source,title) values({A},{uid},''self'',''probe'') returning 1) select count(*)::text from x','1','1','ERROR:42501:%','ERROR:42501:%','ERROR:42501:%');
-- a member can never promote their own membership (staff-only policies); privileged roles are excluded from these two
do $$ declare p record; begin
  for p in select * from pt.persona where class<>'priv' order by name loop
    perform pt.check('W member cannot reactivate own membership :: '||p.name, pt.q(p.uid, format('with x as (update public.memberships set status=''active'' where gym_id=%L and user_id=%L returning 1) select count(*)::text from x', pt.gym_a(), p.uid)),'0');
    perform pt.check('W member cannot create own membership :: '||p.name, pt.q(p.uid, format('with x as (insert into public.memberships(gym_id,user_id,plan_id,status) values(%L,%L,%L,''active'') returning 1) select count(*)::text from x', pt.gym_a(), p.uid, 'c0000000-0000-4000-8000-000000000001')),'ERROR:42501:%');
  end loop;
end $$;

-- ===== BOOKING RPCs, including the paid-drop-in loophole =====
-- Every non-active persona below holds a PAID drop-in for session two; none may book, cancel, or buy.
do $$ declare p record; want text;
begin
  for p in select * from pt.persona where name in ('active_a','split_a','paused_a','pending_a','norow_a','cancelled_a','expired_a','endeddate_a') order by name loop
    want := case when p.name in ('active_a','split_a') then 'ok' else 'ERROR:P0001:%' end;
    perform pt.check('B book_class_session (paid drop-in held) :: '||p.name, pt.q(p.uid,'select ''ok'' from (select (public.book_class_session(''f0000000-0000-4000-8000-000000000002'')).id) x'), want);
    perform pt.check('B member_book_class (paid drop-in held) :: '||p.name, pt.q(p.uid,'select ''ok'' from (select public.member_book_class(''f0000000-0000-4000-8000-000000000002'')) x'), want);
  end loop;
  -- a class-less ACTIVE member with a paid drop-in legitimately holds a booking now
  perform pt.check('B split_a booking exists after paid drop-in (legit)', (select count(*)::text from public.class_bookings where session_id='f0000000-0000-4000-8000-000000000002' and user_id='00000000-0000-4000-8000-00000000000c' and status='booked'),'1');
  perform pt.check('B active_a booking exists', (select count(*)::text from public.class_bookings where session_id='f0000000-0000-4000-8000-000000000002' and user_id='00000000-0000-4000-8000-000000000005' and status='booked'),'1');
  perform pt.check('B no non-active persona holds a booking on session two', (select count(*)::text from public.class_bookings b join pt.persona pp on pp.uid=b.user_id where b.session_id='f0000000-0000-4000-8000-000000000002' and pp.name in ('paused_a','pending_a','norow_a','cancelled_a','expired_a','endeddate_a')),'0');
  -- a class-less member WITHOUT a paid drop-in is still refused (unchanged behaviour)
end $$;
-- cancelling: paused/pending/ended members cannot cancel; active can
do $$ declare p record; begin
  -- give the non-active personas an existing booking on session two, as if they booked before their status changed
  insert into public.class_bookings(gym_id,session_id,user_id,status)
  select pt.gym_a(),'f0000000-0000-4000-8000-000000000002',uid,'booked' from pt.persona where name in ('paused_a','pending_a','norow_a','cancelled_a','expired_a','endeddate_a');
  for p in select * from pt.persona where name in ('paused_a','pending_a','norow_a','cancelled_a','expired_a','endeddate_a') order by name loop
    perform pt.check('B cancel_class_booking blocked :: '||p.name, pt.q(p.uid,'select ''ok'' from (select (public.cancel_class_booking(''f0000000-0000-4000-8000-000000000002'')).id) x'),'ERROR:P0001:Read-only access');
    perform pt.check('B member_cancel_class blocked :: '||p.name, pt.q(p.uid,'select ''ok'' from (select public.member_cancel_class(''f0000000-0000-4000-8000-000000000002'')) x'),'ERROR:P0001:Read-only access');
  end loop;
  perform pt.check('B active_a cancel_class_booking', pt.q('00000000-0000-4000-8000-000000000005','select ''ok'' from (select (public.cancel_class_booking(''f0000000-0000-4000-8000-000000000002'')).id) x'),'ok');
  perform pt.check('B split_a member_cancel_class', pt.q('00000000-0000-4000-8000-00000000000c','select ''ok'' from (select public.member_cancel_class(''f0000000-0000-4000-8000-000000000002'')) x'),'ok');
end $$;

-- ===== GROUP, CALENDAR AND JOIN RPCs (found by the function audit) =====
-- "allowed" = active member or owner/admin/staff/coach. Group members: active_a, owner_a, staff_a (allowed) and paused_a, pending_a, cancelled_a (members before their status changed).
create function pt.allowed(p pt.persona) returns boolean language sql immutable as $$ select p.class in ('priv','active') $$;
create function pt.in_group(p pt.persona) returns boolean language sql immutable as $$ select p.name in ('active_a','owner_a','staff_a','paused_a','pending_a','cancelled_a') $$;
do $$ declare p pt.persona; want text; ex_not_allowed text;
begin
  for p in select * from pt.persona order by name loop
    perform pt.check('G get_my_training_groups :: '||p.name, pt.q(p.uid,'select jsonb_array_length(public.get_my_training_groups(''a0000000-0000-4000-8000-00000000000a''))::text'),
      case when pt.allowed(p) and pt.in_group(p) then '1' else '0' end);
    want := case when pt.allowed(p) and pt.in_group(p) then 'Persona group'
                 when pt.in_group(p) then 'ERROR:P0001:Active gym membership required'
                 else 'ERROR:P0001:You are not a member of this group' end;
    perform pt.check('G get_training_group_dashboard :: '||p.name, pt.q(p.uid,'select (public.get_training_group_dashboard(''77000000-0000-4000-8000-000000000001''))->''group''->>''name'''), want);
    perform pt.check('G dashboard shows other members workouts only when allowed :: '||p.name, pt.q(p.uid,'select jsonb_array_length((public.get_training_group_dashboard(''77000000-0000-4000-8000-000000000001''))->''members'')::text'),
      case when pt.allowed(p) and pt.in_group(p) then '6' else 'ERROR:P0001:%' end);
    perform pt.check('G preview_training_group_invite :: '||p.name, pt.q(p.uid,'select (public.preview_training_group_invite(''PERSONA1''))->>''name'''),
      case when pt.allowed(p) then 'Persona group' else 'ERROR:P0001:You need an active membership at this gym to join this group' end);
    perform pt.check('K get_class_calendar :: '||p.name, pt.q(p.uid,'select count(*)::text from public.get_class_calendar(''a0000000-0000-4000-8000-00000000000a'', now(), now()+interval ''30 days'')'),
      case when pt.allowed(p) then '2' else '0' end);
  end loop;
  -- joining a group needs an ACTIVE membership
  for p in select * from pt.persona order by name loop
    perform pt.check('G join_training_group_by_code :: '||p.name, pt.q(p.uid,'select (public.join_training_group_by_code(''PERSONA1''))->>''name'''),
      case when pt.allowed(p) then 'Persona group' else 'ERROR:P0001:You need an active membership at this gym to join this group' end);
  end loop;
  for p in select * from pt.persona order by name loop
    perform pt.check('G create_training_group :: '||p.name, pt.q(p.uid,'select (public.create_training_group(''a0000000-0000-4000-8000-00000000000a'',''Probe group''))->>''name'''),
      case when pt.allowed(p) then 'Probe group' else 'ERROR:P0001:Active gym membership required' end);
    perform pt.check('G create_training_group_challenge :: '||p.name, pt.q(p.uid,'select ''ok'' from (select public.create_training_group_challenge(''77000000-0000-4000-8000-000000000001'',''Probe'',''Run'',''reps'',null)) x'),
      case when pt.allowed(p) then 'ok' else 'ERROR:P0001:Read-only access' end);
    perform pt.check('G submit_training_group_challenge_result :: '||p.name, pt.q(p.uid,'select ''ok'' from (select public.submit_training_group_challenge_result(''77000000-0000-4000-8000-0000000000c1'', 5, null)) x'),
      case when pt.allowed(p) then 'ok' else 'ERROR:P0001:Read-only access' end);
  end loop;
end $$;

-- the public join must never change an existing membership or reactivate a revoked account
do $$ declare p pt.persona;
begin
  for p in select * from pt.persona where class<>'priv' order by name loop
    perform pt.check('J join_public_gym_with_membership :: '||p.name, pt.q(p.uid,'select (public.join_public_gym_with_membership(''persona-gym-a'',''c0000000-0000-4000-8000-000000000001''))->>''status'''),
      case when p.name='norow_a' then 'active' else 'ERROR:P0001:You already have a membership at this gym. Contact your gym to change it.' end);
  end loop;
  perform pt.check('J join: membership rows unchanged for paused_a (still paused)', private.current_membership_status(pt.gym_a(),'00000000-0000-4000-8000-000000000006'),'paused');
  perform pt.check('J join: cancelled_a still cancelled', private.current_membership_status(pt.gym_a(),'00000000-0000-4000-8000-000000000009'),'cancelled');
  perform pt.check('J join: expired_a still expired', private.current_membership_status(pt.gym_a(),'00000000-0000-4000-8000-00000000000a'),'expired');
  perform pt.check('J join: pending_a still pending (row untouched)', (select status::text from public.memberships where id='d0000000-0000-4000-8000-000000000105'),'pending');
  perform pt.check('J join: a brand-new user can still join', pt.q('00000000-0000-4000-8000-0000000000d1','select (public.join_public_gym_with_membership(''persona-gym-a'',''c0000000-0000-4000-8000-000000000001''))->>''status'''),'active');
  perform pt.check('J join: revoked account cannot reactivate itself', pt.q('00000000-0000-4000-8000-0000000000d2','select (public.join_public_gym_with_membership(''persona-gym-a'',''c0000000-0000-4000-8000-000000000001''))->>''status'''),'ERROR:P0001:This account no longer has access to this gym. Contact your gym.');
  perform pt.check('J join: revoked staff row still revoked and inactive-equivalent', (select access_status from public.gym_members where user_id='00000000-0000-4000-8000-0000000000d2'),'revoked');
  -- a revoked staff account does NOT get the role bypass
  perform pt.check('X revoked staff gets no role bypass (class sessions)', pt.q('00000000-0000-4000-8000-0000000000d2','select count(*)::text from public.class_sessions where gym_id=''a0000000-0000-4000-8000-00000000000a'''),'0');
  perform pt.check('X revoked staff gets no role bypass (can_write_gym)', pt.q('00000000-0000-4000-8000-0000000000d2','select private.can_write_gym(''a0000000-0000-4000-8000-00000000000a'')::text'),'false');
end $$;

-- ===== FUNCTION AUDIT: every SECURITY DEFINER function that `authenticated` can execute must gate on a reviewed helper, or be on the explicit allowlist =====
create table pt.fn_allow(fn text primary key, reason text);
insert into pt.fn_allow values
 ('claim_access_invite(text)','invite-token flow: the one-time token is the credential'),
 ('claim_admin_invite(text)','invite-token flow: the one-time token is the credential'),
 ('get_access_invite(text)','invite-token flow: the one-time token is the credential'),
 ('get_admin_invite(text)','invite-token flow: the one-time token is the credential'),
 ('get_gym_team_accounts(uuid)','inline owner/admin role check (equivalent to has_gym_role); returns staff accounts only'),
 ('remove_gym_staff_access(uuid,uuid)','inline owner/admin role check (equivalent to has_gym_role)'),
 ('get_public_gym_join_options(text)','public join page: returns public plans by design (anon callable)'),
 ('join_public_gym_with_membership(text,uuid)','join for NEW members only: refuses when any membership row exists or the account is revoked (tested above)'),
 ('private.active_owner_count(uuid)','internal ownership helper; private schema is not exposed over the API'),
 ('private.has_active_owner(uuid)','internal ownership helper; private schema is not exposed over the API'),
 ('private.execute_ownership_action(uuid)','internal; called only from the owner-gated approve_ownership_action; private schema not exposed'),
 ('private.member_has_paid_class(uuid,uuid)','internal helper for the booking RPCs; private schema not exposed'),
 ('get_my_membership_options(uuid)','scoped to the caller''s own membership by auth.uid(); returns nothing for anyone else (tested in membership_rules.sql)'),
 ('request_membership_pause(uuid,date,date,text)','scoped to the caller''s own membership by auth.uid(); refuses anyone else''s (tested in membership_rules.sql)'),
 ('request_membership_cancel(uuid,text)','scoped to the caller''s own membership by auth.uid(); refuses anyone else''s (tested in membership_rules.sql)'),
 ('request_membership_change(uuid,uuid)','scoped to the caller''s own membership by auth.uid(); refuses anyone else''s (tested in membership_rules.sql)'),
 ('withdraw_membership_request(uuid)','scoped to the caller''s own request by auth.uid(); refuses anyone else''s (tested in membership_rules.sql)');
create table pt.fn_audit as
select p.oid::regprocedure::text as fn,
       case when p.prorettype = 'trigger'::regtype then 'trigger function'
            when pg_get_functiondef(p.oid) ~ 'member_status_allows|is_gym_member|can_write_gym|has_gym_role|has_gym_staff_permission|staff_has_permission|is_pending_admin|can_manage_gym_member|can_view_profile|member_has_class_access' then 'gates on helper'
            when exists (select 1 from pt.fn_allow a where a.fn = p.oid::regprocedure::text) then 'allowlisted'
            else 'NO GATE' end as gate
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public','private') and p.prokind = 'f' and p.prosecdef and has_function_privilege('authenticated', p.oid, 'EXECUTE');
do $$ declare r record; offenders text; stale text;
begin
  for r in select * from pt.fn_audit order by gate, fn loop raise notice 'FUNCTION AUDIT | % | %', rpad(r.gate,16), r.fn; end loop;
  select coalesce(string_agg(fn, '; ' order by fn),'none') into offenders from pt.fn_audit where gate = 'NO GATE';
  perform pt.check('F every authenticated SECURITY DEFINER function gates on a helper or is allowlisted', offenders, 'none');
  select coalesce(string_agg(a.fn, '; ' order by a.fn),'none') into stale from pt.fn_allow a where not exists (select 1 from pt.fn_audit f where f.fn = a.fn);
  perform pt.check('F allowlist has no stale entries', stale, 'none');
  perform pt.check('F the three group read RPCs now gate on the helper', (select count(*)::text from pt.fn_audit where gate='gates on helper' and fn in ('get_my_training_groups(uuid)','preview_training_group_invite(text)','get_training_group_dashboard(uuid)')),'3');
end $$;

-- ===== POLICY AUDIT: no old permissive policy survives =====
-- 1. every policy this migration replaced is gone (exact old names)

-- 1. every policy this migration replaced is gone (exact old names), and every new policy exists exactly once
do $$ declare r record; begin
  for r in select * from (values
    ('membership_plans','gym members can read plans'),
    ('gyms','authorized users can read gyms'),
    ('workout_sessions','members_manage_own_workout_sessions'),
    ('workout_entries','members_manage_own_workout_entries'),
    ('workout_sets','members_manage_sets_for_own_entries'),
    ('personal_bests','members_manage_own_personal_bests'),
    ('workout_assignments','members read own workout assignments'),
    ('member_training_preferences','members read own training preferences'),
    ('class_bookings','users can view own class bookings'),
    ('pt_appointments','members can view own pt appointments'),
    ('payment_records','gym users can read relevant payments'),
    ('social_posts','gym members read social posts'),
    ('social_comments','gym members read social comments'),
    ('social_reactions','gym members read social reactions'),
    ('gym_access_settings','gym members can view access settings')
  ) v(tbl,pol) loop
    perform pt.check('P old policy removed :: '||r.tbl||' / '||r.pol, (select count(*)::text from pg_policies where schemaname='public' and tablename=r.tbl and policyname=r.pol),'0');
  end loop;
  for r in select * from (values
    ('membership_plans','plans readable by active paused and pending members'),
    ('gym_members','members read own gym member row'),
    ('gyms','gyms readable by creator and members of any status'),
    ('workout_sessions','own workout sessions readable when active or paused'),
    ('workout_sessions','own workout sessions insertable when active'),
    ('workout_sessions','own workout sessions updatable when active'),
    ('workout_sessions','own workout sessions deletable when active'),
    ('workout_entries','own workout entries readable when active or paused'),
    ('workout_entries','own workout entries insertable when active'),
    ('workout_entries','own workout entries updatable when active'),
    ('workout_entries','own workout entries deletable when active'),
    ('workout_sets','own workout sets readable when active or paused'),
    ('workout_sets','own workout sets insertable when active'),
    ('workout_sets','own workout sets updatable when active'),
    ('workout_sets','own workout sets deletable when active'),
    ('personal_bests','own personal bests readable when active or paused'),
    ('personal_bests','own personal bests insertable when active'),
    ('personal_bests','own personal bests updatable when active'),
    ('personal_bests','own personal bests deletable when active'),
    ('workout_assignments','own workout assignments readable when active or paused'),
    ('member_training_preferences','own training preferences readable when active or paused'),
    ('class_bookings','own class bookings readable when active'),
    ('pt_appointments','own pt appointments readable when active'),
    ('payment_records','own payments readable when active or admin reads'),
    ('social_posts','social posts readable by active members'),
    ('social_comments','social comments readable by active members'),
    ('social_reactions','social reactions readable by active members'),
    ('gym_access_settings','access settings readable by active members')
  ) v(tbl,pol) loop
    perform pt.check('P new policy present :: '||r.tbl||' / '||r.pol, (select count(*)::text from pg_policies where schemaname='public' and tablename=r.tbl and policyname=r.pol),'1');
  end loop;
end $$;

-- 2. no policy may still grant gym-member access by checking gym_members inline without a role list (the old permissive pattern).
--    The one allowed exception only uses gym_members to validate the TARGET of a staff-role-gated assignment.
select pt.check('P no inline gym_members membership check without a role list',
  (select coalesce(string_agg(tablename||' / '||policyname, '; ' order by tablename, policyname),'none') from pg_policies
    where schemaname='public' and (coalesce(qual,'')||' '||coalesce(with_check,'')) ~* 'gym_members' and (coalesce(qual,'')||' '||coalesce(with_check,'')) !~ 'role = ANY'
      and not (tablename='workout_assignments' and policyname='staff manage member workout assignments')),
  'none');

-- 3. every policy that keys on auth.uid() must also call a status/role helper, except this reviewed list (role-restricted staff views, non-gym data, and the deliberate own-gym-member-row policy).
select pt.check('P ungated auth.uid() policies are exactly the reviewed list',
  (select coalesce(string_agg(tablename||' / '||policyname, '; ' order by tablename, policyname),'none') from pg_policies
    where schemaname='public' and (coalesce(qual,'')||' '||coalesce(with_check,'')) ~ 'auth.uid'
      and (coalesce(qual,'')||' '||coalesce(with_check,'')) !~ 'private\.(member_status_allows|is_gym_member|can_write_gym|has_gym_role|is_pending_admin|staff_has_permission|has_gym_staff_permission|can_manage_gym_member|can_view_profile)'),
  'class_bookings / assigned class staff can view bookings; class_sessions / coaches can view assigned session details; gym_communication_settings / Gym admins manage communication settings; gym_email_templates / Gym admins manage email templates; gym_members / members read own gym member row; gyms / authenticated users can create gyms; membership_requests / members read their own membership requests; personal_bests / staff_view_gym_personal_bests; profiles / users can update own profile; pt_appointments / pt appointments select; staff_profiles / staff can view own profile; strava_activities / users_view_own_strava_activities; strava_connections / users_disconnect_own_strava_connection; strava_connections / users_view_own_strava_connection; workout_entries / staff_view_gym_workout_entries; workout_sessions / staff_view_gym_workout_sessions; workout_sets / staff_view_sets_for_gym_entries');

-- 4. helper functions are status aware (guards against someone restoring the permissive bodies)
select pt.check('P is_gym_member is status aware', (pg_get_functiondef('private.is_gym_member(uuid)'::regprocedure) like '%member_status_allows%')::text,'true');
select pt.check('P can_write_gym is status aware', (pg_get_functiondef('private.can_write_gym(uuid)'::regprocedure) like '%member_status_allows%')::text,'true');
select pt.check('P new helpers are not executable by anon', (has_function_privilege('anon','private.member_status_allows(uuid,text[])','EXECUTE') or has_function_privilege('anon','private.current_membership_status(uuid,uuid)','EXECUTE'))::text,'false');
select pt.check('P current_membership_status is not executable by authenticated (no status oracle)', has_function_privilege('authenticated','private.current_membership_status(uuid,uuid)','EXECUTE')::text,'false');

\o
-- ===== summary =====
do $$ declare total int; failed int; r record; begin
  select count(*), count(*) filter (where not ok) into total, failed from pt.results;
  for r in select * from pt.results where not ok order by seq loop
    raise warning 'FAIL: % | got=% | want=%', r.label, r.got, r.want;
  end loop;
  raise notice 'MEMBERSHIP STATUS PERSONA TESTS: % checks, % passed, % failed', total, total-failed, failed;
  if failed > 0 then raise exception 'membership status persona tests failed: % of % checks', failed, total; end if;
end $$;
rollback;
