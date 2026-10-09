-- Behaviour test for 20261011090000_member_join_details.sql. Run on a scratch database only (it inserts test users and a gym).
-- Expected: join refused until details + terms exist; under-18 needs a guardian; direct writes refused; a fellow member sees 0 rows, the owner sees 1, a plain member is refused the missing-details list.
insert into auth.users(id,email) values ('00000000-0000-0000-0000-0000000000a1','m@x'),('00000000-0000-0000-0000-0000000000a2','k@x'),('00000000-0000-0000-0000-0000000000a3','o@x') on conflict do nothing;
insert into public.profiles(id) values ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000a2'),('00000000-0000-0000-0000-0000000000a3') on conflict do nothing;
insert into public.gyms(id,name,slug) values ('00000000-0000-0000-0000-0000000000f1','G','g') on conflict do nothing;
insert into public.gym_members(gym_id,user_id,role,is_active) values ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000a3','owner',true),('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000a2','member',true) on conflict do nothing;
insert into public.membership_plans(id,gym_id,name,is_active,is_public,price_pence) values ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000f1','Std',true,true,1000) on conflict do nothing;
update public.gyms set terms_text='T', health_declaration_text='H' where slug='g';
select 'version after wording change', terms_version from public.gyms where slug='g';
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
do $$ begin begin perform public.join_public_gym_with_membership('g','00000000-0000-0000-0000-0000000000b1'); raise notice 'BAD joined'; exception when others then raise notice 'refused: %', sqlerrm; end; end $$;
do $$ begin begin perform public.save_my_join_details('A','B',date '2015-01-01','+447700900123','1 St',null,'Town','pl28 8ab','C','+447700900124','Mum',null,null); exception when others then raise notice 'refused: %', sqlerrm; end; end $$;
select public.save_my_join_details('A','B',date '2015-01-01','+447700900123','1 St',null,'Town','pl28 8ab','C','+447700900124','Mum','G','+447700900125');
select postcode, guardian_name from public.member_details;
do $$ begin begin perform public.join_public_gym_with_membership('g','00000000-0000-0000-0000-0000000000b1'); raise notice 'BAD joined'; exception when others then raise notice 'refused: %', sqlerrm; end; end $$;
select public.accept_gym_terms('g');
select public.join_public_gym_with_membership('g','00000000-0000-0000-0000-0000000000b1')->>'status' as joined;
do $$ begin begin insert into public.member_details(user_id,address_line1,town,postcode,emergency_name,emergency_phone,emergency_relationship) values (gen_random_uuid(),'a','b','PL28 8AB','c','+447700900124','Mum'); exception when others then raise notice 'direct write refused: %', sqlerrm; end; end $$;
select 'other member sees', count(*) from public.member_details;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a2',false);
select 'fellow member sees', count(*) from public.member_details;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a3',false);
select 'owner sees', count(*) from public.member_details;
select user_id, missing from public.get_members_missing_details('00000000-0000-0000-0000-0000000000f1');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a2',false);
do $$ begin begin perform * from public.get_members_missing_details('00000000-0000-0000-0000-0000000000f1'); exception when others then raise notice 'member refused: %', sqlerrm; end; end $$;
