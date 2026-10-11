-- Behaviour test for 20261011180000_member_details_edit_and_privacy.sql. Run on a scratch database only (it inserts test users and gyms).
-- Expected: (part 1) owner, admin and staff can save a member's details; a plain member, another gym's owner and anonymous cannot;
-- staff cannot edit an owner or admin; the same validation as the member's own form applies; the saved values are what was sent.
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-0000000000c1','member@x'),('00000000-0000-0000-0000-0000000000c2','owner@x'),('00000000-0000-0000-0000-0000000000c3','staff@x'),
 ('00000000-0000-0000-0000-0000000000c4','admin@x'),('00000000-0000-0000-0000-0000000000c5','other@x'),('00000000-0000-0000-0000-0000000000c6','plain@x') on conflict do nothing;
insert into public.profiles(id) values
 ('00000000-0000-0000-0000-0000000000c1'),('00000000-0000-0000-0000-0000000000c2'),('00000000-0000-0000-0000-0000000000c3'),
 ('00000000-0000-0000-0000-0000000000c4'),('00000000-0000-0000-0000-0000000000c5'),('00000000-0000-0000-0000-0000000000c6') on conflict do nothing;
insert into public.gyms(id,name,slug) values ('00000000-0000-0000-0000-0000000000d1','G1','g1'),('00000000-0000-0000-0000-0000000000d2','G2','g2') on conflict do nothing;
insert into public.gym_members(gym_id,user_id,role,is_active) values
 ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','member',true),
 ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c2','owner',true),
 ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c3','staff',true),
 ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c4','admin',true),
 ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c6','member',true),
 ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000c5','owner',true) on conflict do nothing;

create temp table t(who text, what text, outcome text);
grant all on t to authenticated, anon;

set role authenticated;
-- a call helper: who, then the member, then the first name (everything else valid unless a case changes it)
create or replace function pg_temp.try(p_sub text, p_gym uuid, p_user uuid, p_first text, p_dob date, p_phone text, p_pc text, p_g_name text, p_g_phone text, p_label text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_sub, false);
  begin
    perform public.staff_save_member_details(p_gym, p_user, p_first, 'Smith', p_dob, p_phone, '1 High St', null, 'Truro', p_pc, 'Jo Smith', '+447700900456', 'Mother', p_g_name, p_g_phone);
    insert into t values (p_label, 'saved', 'yes');
  exception when others then
    insert into t values (p_label, 'refused', sqlerrm);
  end;
end$$;

select pg_temp.try('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','Ada',date '1990-03-14','+447700900123','tr1 2ab',null,null,'owner edits a member');
select pg_temp.try('00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','Adaline',date '1990-03-14','+447700900123','TR12AB',null,null,'staff edits a member');
select pg_temp.try('00000000-0000-0000-0000-0000000000c4','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c6','Bea',date '1990-03-14','+447700900123','TR1 2AB',null,null,'admin edits a member');
select pg_temp.try('00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c2','Owner',date '1980-01-01','+447700900123','TR1 2AB',null,null,'staff edits an owner');
select pg_temp.try('00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c4','Admin',date '1980-01-01','+447700900123','TR1 2AB',null,null,'staff edits an admin');
select pg_temp.try('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','Self',date '1990-03-14','+447700900123','TR1 2AB',null,null,'a plain member edits themselves here');
select pg_temp.try('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c6','Other',date '1990-03-14','+447700900123','TR1 2AB',null,null,'a plain member edits someone else');
select pg_temp.try('00000000-0000-0000-0000-0000000000c5','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','Hack',date '1990-03-14','+447700900123','TR1 2AB',null,null,'another gym''s owner, this gym');
select pg_temp.try('00000000-0000-0000-0000-0000000000c5','00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000c1','Hack',date '1990-03-14','+447700900123','TR1 2AB',null,null,'another gym''s owner, own gym id, this gym''s member');
select pg_temp.try('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','Ada',date '1990-03-14','07700 900123','TR1 2AB',null,null,'bad mobile (not +44 form)');
select pg_temp.try('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','Ada',date '1990-03-14','+447700900123','NOTAPOSTCODE',null,null,'bad postcode');
select pg_temp.try('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','Ada',(current_date - interval '10 years')::date,'+447700900123','TR1 2AB',null,null,'under 18 without a guardian');
select pg_temp.try('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','Ada',(current_date - interval '10 years')::date,'+447700900123','TR1 2AB','Parent One','+447700900789','under 18 with a guardian');
select pg_temp.try('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','',date '1990-03-14','+447700900123','TR1 2AB',null,null,'empty first name');
select pg_temp.try('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','Ada',date '2999-01-01','+447700900123','TR1 2AB',null,null,'date of birth in the future');
select pg_temp.try('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000ff','Ada',date '1990-03-14','+447700900123','TR1 2AB',null,null,'someone who is not a member');
reset role;
-- anonymous
set role anon;
do $$ begin begin perform public.staff_save_member_details('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','A','B',date '1990-01-01','+447700900123','1 St',null,'T','TR1 2AB','C','+447700900456','Mum',null,null); insert into t values ('anonymous','saved','yes'); exception when others then insert into t values ('anonymous','refused',sqlerrm); end; end $$;
reset role;
select who, what, outcome from t order by 1;
-- what is stored after the last good save (under 18 with a guardian, member c1), and that the failed cases changed nothing
select p.first_name, p.last_name, p.display_name, p.date_of_birth, p.phone, d.address_line1, d.town, d.postcode, d.emergency_name, d.emergency_relationship, d.guardian_name, d.guardian_phone
  from public.profiles p join public.member_details d on d.user_id = p.id where p.id = '00000000-0000-0000-0000-0000000000c1';
select 'staff edit of the owner or admin changed nothing', count(*) from public.profiles where first_name in ('Owner','Admin');
select 'the other gym''s attempts changed nothing', count(*) from public.profiles where first_name = 'Hack';

-- ---------------------------------------------------------------------------------------------------------------
-- Part 2: who can see the mobile number and address
-- ---------------------------------------------------------------------------------------------------------------
create temp table v(who text, what text, value text);
grant all on v to authenticated, anon;
set role authenticated;

-- nothing chosen yet: the team sees everything, the owner too
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c3',false);
insert into v select 'staff, nothing chosen yet', 'phone / town', (public.get_member_details('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1')->>'phone') || ' / ' || (public.get_member_details('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1')->>'town');

-- only the owner can change the setting
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c3',false);
do $$ begin begin perform public.set_member_contact_visibility('00000000-0000-0000-0000-0000000000d1', false, false); insert into v values ('staff sets visibility','saved','BAD'); exception when others then insert into v values ('staff sets visibility','refused',sqlerrm); end; end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c4',false);
do $$ begin begin perform public.set_member_contact_visibility('00000000-0000-0000-0000-0000000000d1', false, false); insert into v values ('admin sets visibility','saved','BAD'); exception when others then insert into v values ('admin sets visibility','refused',sqlerrm); end; end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c5',false);
do $$ begin begin perform public.set_member_contact_visibility('00000000-0000-0000-0000-0000000000d1', false, false); insert into v values ('another gym''s owner sets visibility','saved','BAD'); exception when others then insert into v values ('another gym''s owner sets visibility','refused',sqlerrm); end; end $$;

-- the owner hides the phone only
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c2',false);
select public.set_member_contact_visibility('00000000-0000-0000-0000-0000000000d1', false, true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c3',false);
insert into v select 'staff, phone hidden', 'phone / town / hidden flags', coalesce(j->>'phone','(none)') || ' / ' || (j->>'town') || ' / ' || (j->>'phone_hidden') || ',' || (j->>'address_hidden') from (select public.get_member_details('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1') j) x;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c4',false);
insert into v select 'admin, phone hidden', 'phone', coalesce(j->>'phone','(none)') from (select public.get_member_details('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1') j) x;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c2',false);
insert into v select 'owner, phone hidden from team', 'phone', coalesce(j->>'phone','(none)') from (select public.get_member_details('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1') j) x;
-- emergency contact stays visible to the team even when both are hidden
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c2',false);
select public.set_member_contact_visibility('00000000-0000-0000-0000-0000000000d1', false, false);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c3',false);
insert into v select 'staff, both hidden', 'phone / town / emergency', coalesce(j->>'phone','(none)') || ' / ' || coalesce(j->>'town','(none)') || ' / ' || (j->>'emergency_name') from (select public.get_member_details('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1') j) x;
-- and staff cannot edit what they cannot see; the owner can
do $$ begin begin perform public.staff_save_member_details('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','Blind','Smith',date '1990-03-14','+447700900123','1 High St',null,'Truro','TR1 2AB','Jo Smith','+447700900456','Mother',null,null); insert into v values ('staff edits while hidden','saved','BAD'); exception when others then insert into v values ('staff edits while hidden','refused',sqlerrm); end; end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c2',false);
do $$ begin begin perform public.staff_save_member_details('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','Seen','Smith',date '1990-03-14','+447700900123','1 High St',null,'Truro','TR1 2AB','Jo Smith','+447700900456','Mother',null,null); insert into v values ('owner edits while hidden','saved','yes'); exception when others then insert into v values ('owner edits while hidden','refused',sqlerrm); end; end $$;

-- a plain member cannot read the team's view, nor another member's details table row; a fellow member sees no phone on profiles
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c6',false);
do $$ begin begin perform public.get_member_details('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1'); insert into v values ('plain member calls get_member_details','saved','BAD'); exception when others then insert into v values ('plain member calls get_member_details','refused',sqlerrm); end; end $$;
insert into v select 'plain member reads the details table', 'rows seen', count(*)::text from public.member_details where user_id = '00000000-0000-0000-0000-0000000000c1';
insert into v select 'plain member reads profiles', 'phones seen', count(phone)::text from public.profiles;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false);
insert into v select 'the member reads their own details', 'rows seen', count(*)::text from public.member_details;
-- the team cannot read the table directly any more
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c3',false);
insert into v select 'staff reads the details table directly', 'rows seen', count(*)::text from public.member_details;
-- a member writing their own profile phone is dropped
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false);
update public.profiles set phone = '+447700900999' where id = '00000000-0000-0000-0000-0000000000c1';
reset role;
insert into v select 'profiles.phone after a member writes one', 'phone', coalesce(phone,'(empty)') from public.profiles where id = '00000000-0000-0000-0000-0000000000c1';
select who, what, value from v order by 1, 2;

-- ---------------------------------------------------------------------------------------------------------------
-- Part 3: members cannot read each other's date of birth, gender, email or phone; the team can; people can read their own
-- ---------------------------------------------------------------------------------------------------------------
reset role;
update public.profiles set date_of_birth = date '1990-03-14', gender = 'female' where id = '00000000-0000-0000-0000-0000000000c1';
insert into public.members(gym_id, user_id, first_name, last_name, display_name, email, phone, status)
  values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'Ada', 'Smith', 'Ada Smith', 'ada@example.test', '+447700900123', 'active') on conflict do nothing;
create temp table w(who text, what text, value text);
grant all on w to authenticated, anon;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c6',false);
do $$ begin begin perform date_of_birth from public.profiles; insert into w values ('a fellow member reads date of birth','read','BAD'); exception when others then insert into w values ('a fellow member reads date of birth','refused',sqlerrm); end; end $$;
do $$ begin begin perform gender from public.profiles; insert into w values ('a fellow member reads gender','read','BAD'); exception when others then insert into w values ('a fellow member reads gender','refused',sqlerrm); end; end $$;
do $$ begin begin perform * from public.profiles; insert into w values ('a fellow member reads select *','read','BAD'); exception when others then insert into w values ('a fellow member reads select *','refused',sqlerrm); end; end $$;
insert into w select 'a fellow member reads a name', 'first names seen', count(first_name)::text from public.profiles where id = '00000000-0000-0000-0000-0000000000c1';
insert into w select 'a fellow member reads the contact table', 'rows seen', count(*)::text from public.members where gym_id = '00000000-0000-0000-0000-0000000000d1' and user_id <> '00000000-0000-0000-0000-0000000000c6';
do $$ begin begin perform * from public.get_gym_member_demographics('00000000-0000-0000-0000-0000000000d1'); insert into w values ('a fellow member asks for demographics','returned','BAD'); exception when others then insert into w values ('a fellow member asks for demographics','refused',sqlerrm); end; end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false);
insert into w select 'the person reads their own', 'dob / gender', (public.get_my_private_profile()->>'date_of_birth') || ' / ' || (public.get_my_private_profile()->>'gender');
insert into w select 'the person reads their own contact record', 'rows seen', count(*)::text from public.members where user_id = '00000000-0000-0000-0000-0000000000c1';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c3',false);
insert into w select 'staff reads demographics', 'rows with a date of birth', count(date_of_birth)::text from public.get_gym_member_demographics('00000000-0000-0000-0000-0000000000d1');
insert into w select 'staff reads the contact table', 'rows seen', count(*)::text from public.members where gym_id = '00000000-0000-0000-0000-0000000000d1';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c5',false);
do $$ begin begin perform * from public.get_gym_member_demographics('00000000-0000-0000-0000-0000000000d1'); insert into w values ('another gym''s owner asks for demographics','returned','BAD'); exception when others then insert into w values ('another gym''s owner asks for demographics','refused',sqlerrm); end; end $$;
insert into w select 'another gym''s owner reads the contact table', 'rows seen', count(*)::text from public.members where gym_id = '00000000-0000-0000-0000-0000000000d1';
reset role;
select who, what, value from w order by 1;

-- The results above are for reading; these are the ones that must hold. The test fails (non-zero exit) if any does not.
do $$
declare bad text := '';
begin
  if (select outcome from t where who = 'staff edits an owner') is null or (select what from t where who = 'staff edits an owner') <> 'refused' then bad := bad || ' staff-edits-owner'; end if;
  if (select what from t where who = 'a plain member edits someone else') <> 'refused' then bad := bad || ' member-edits-other'; end if;
  if (select what from t where who = 'anonymous') <> 'refused' then bad := bad || ' anonymous'; end if;
  if (select what from t where who = 'another gym''s owner, this gym') <> 'refused' then bad := bad || ' other-gym-owner'; end if;
  if (select value from v where who = 'staff, phone hidden' and what like 'phone / town%') not like '(none) / Truro / true,false' then bad := bad || ' hidden-phone'; end if;
  if (select value from v where who = 'owner, phone hidden from team') = '(none)' then bad := bad || ' owner-sees-all'; end if;
  if (select value from v where who = 'staff, both hidden' and what like 'phone / town%') not like '(none) / (none) / %' then bad := bad || ' both-hidden'; end if;
  if (select what from v where who = 'staff edits while hidden') <> 'refused' then bad := bad || ' blind-edit'; end if;
  if (select value from v where who = 'plain member reads the details table') <> '0' then bad := bad || ' member-reads-details'; end if;
  if (select value from v where who = 'plain member reads profiles') <> '0' then bad := bad || ' member-reads-phones'; end if;
  if (select value from v where who = 'staff reads the details table directly') <> '0' then bad := bad || ' staff-direct-read'; end if;
  if (select value from w where who = 'a fellow member reads date of birth') not like 'permission denied%' then bad := bad || ' member-reads-dob'; end if;
  if (select value from w where who = 'a fellow member reads gender') not like 'permission denied%' then bad := bad || ' member-reads-gender'; end if;
  if (select value from w where who = 'a fellow member reads the contact table') <> '0' then bad := bad || ' member-reads-contact-table'; end if;
  if (select what from w where who = 'a fellow member asks for demographics') <> 'refused' then bad := bad || ' member-demographics'; end if;
  if (select what from w where who = 'another gym''s owner asks for demographics') <> 'refused' then bad := bad || ' other-gym-demographics'; end if;
  if (select value from w where who = 'the person reads their own') not like '1990-03-14 / female' then bad := bad || ' own-profile'; end if;
  if (select value from w where who = 'staff reads the contact table') <> '1' then bad := bad || ' team-contact-table'; end if;
  if bad <> '' then raise exception 'Member details privacy test failed:%', bad; end if;
  raise notice 'MEMBER DETAILS PRIVACY TESTS PASSED';
end $$;

-- Display name after the member's own join form (20261011200000_join_display_name.sql)
reset role;
update public.profiles set display_name = 'member@x' where id = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select public.save_my_join_details('Ada','Lovelace',date '1990-03-14','+447700900123','1 High St',null,'Truro','TR1 1AA','Jo Smith','+447700900456','Mother',null,null);
do $$ begin
  if (select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000c1') <> 'Ada Lovelace' then
    raise exception 'Display name test failed: an email display name was not replaced';
  end if;
end $$;
reset role;
update public.profiles set display_name = 'Ace' where id = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select public.save_my_join_details('Ada','Lovelace',date '1990-03-14','+447700900123','1 High St',null,'Truro','TR1 1AA','Jo Smith','+447700900456','Mother',null,null);
do $$ begin
  if (select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000c1') <> 'Ace' then
    raise exception 'Display name test failed: a name the person chose was overwritten';
  end if;
  raise notice 'JOIN DISPLAY NAME TESTS PASSED';
end $$;
