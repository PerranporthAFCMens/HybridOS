-- Removes everything puffin_demo_data.sql and puffin_demo_members_part2.sql added to Puffin Performance, and nothing else.
begin;
delete from public.class_sessions where gym_id = 'aec16956-3793-4543-873b-4412646ca1eb' and name like 'Demo %'
  and class_type_id in (select id from public.class_types where gym_id = 'aec16956-3793-4543-873b-4412646ca1eb' and name like 'Demo %');
delete from public.class_types where gym_id = 'aec16956-3793-4543-873b-4412646ca1eb' and name like 'Demo %';
delete from public.payment_records where membership_id in (
  select id from public.memberships where member_id in (select id from public.members where gym_id = 'aec16956-3793-4543-873b-4412646ca1eb' and email like '%@demo.hybridone.invalid'));
delete from public.memberships where member_id in (select id from public.members where gym_id = 'aec16956-3793-4543-873b-4412646ca1eb' and email like '%@demo.hybridone.invalid');
-- Part 2 sign-in records (cascade removes their profile and gym member record). Only the demo emails.
delete from auth.users where email like '%@demo.hybridone.invalid'
  and id in (select user_id from public.members where gym_id = 'aec16956-3793-4543-873b-4412646ca1eb' and email like '%@demo.hybridone.invalid' and user_id is not null);
delete from public.members where gym_id = 'aec16956-3793-4543-873b-4412646ca1eb' and email like '%@demo.hybridone.invalid';
delete from public.membership_plans where gym_id = 'aec16956-3793-4543-873b-4412646ca1eb' and name like 'Demo %';
commit;
