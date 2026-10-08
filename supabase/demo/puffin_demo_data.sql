-- DEMO DATA for Puffin Performance (the test gym) ONLY. Never Hybrid Hub.
-- Adds: 4 plans, 24 members (no logins) with memberships and payments, 4 class types, ~2 weeks back and 2 weeks ahead of classes.
-- Every demo row is marked so it can be removed cleanly: plans, class types and class names start with "Demo ";
-- demo members have an email ending @demo.hybridone.invalid.
-- Safe to run once. Running it twice stops with a message rather than doubling the data.
-- To remove it all: run puffin_demo_data_remove.sql
begin;

do $$
declare
  g constant uuid := 'aec16956-3793-4543-873b-4412646ca1eb';
begin
  if not exists (select 1 from public.gyms where id = g) then
    raise exception 'Puffin Performance gym not found in this database';
  end if;
  if exists (select 1 from public.members where gym_id = g and email like '%@demo.hybridone.invalid') then
    raise exception 'Demo data is already there. Run puffin_demo_data_remove.sql first if you want to reset it.';
  end if;
end $$;

-- Plans
insert into public.membership_plans (gym_id, name, description, price_pence, billing_interval, access_type, includes_open_gym, includes_classes, includes_pt, classes_per_week)
values
 ('aec16956-3793-4543-873b-4412646ca1eb','Demo Hybrid','Gym floor and unlimited classes',5900,'monthly','hybrid',true,true,false,null),
 ('aec16956-3793-4543-873b-4412646ca1eb','Demo Classes','Classes only, up to 3 a week',3900,'monthly','classes',false,true,false,3),
 ('aec16956-3793-4543-873b-4412646ca1eb','Demo Gym','Open gym only',2900,'monthly','gym',true,false,false,null),
 ('aec16956-3793-4543-873b-4412646ca1eb','Demo Annual Hybrid','Hybrid, paid yearly',59000,'annual','hybrid',true,true,false,null);

-- Members: 24 people, no logins. Mix: 6 in 8 active, 1 paused, 1 cancelled; the last two joined recently.
with names(n, first_name, last_name) as (values
 (0,'Amelia','Hart'),(1,'Jack','Pengelly'),(2,'Priya','Nair'),(3,'Tom','Trevorrow'),(4,'Sophie','Carne'),(5,'Liam','Jago'),
 (6,'Chloe','Bray'),(7,'Ben','Rowe'),(8,'Isla','Tregear'),(9,'Noah','Penrose'),(10,'Grace','Oates'),(11,'Ollie','Kitto'),
 (12,'Maya','Hocking'),(13,'Callum','Roscorla'),(14,'Ellie','Nance'),(15,'Harry','Bolitho'),(16,'Zara','Menhenitt'),(17,'Sam','Polkinghorne'),
 (18,'Freya','Angove'),(19,'Dan','Trebilcock'),(20,'Lucy','Hosking'),(21,'Mo','Said'),(22,'Hannah','Pascoe'),(23,'Rory','Thomas'))
insert into public.members (gym_id, first_name, last_name, display_name, email, status, joined_at)
select 'aec16956-3793-4543-873b-4412646ca1eb', first_name, last_name, first_name||' '||last_name,
       lower(first_name||'.'||last_name)||'@demo.hybridone.invalid',
       case when n % 8 = 6 then 'paused' when n % 8 = 7 then 'cancelled' else 'active' end,
       now() - make_interval(days => case when n >= 22 then 10 + n else 20 + (n * 29) % 340 end)
from names;

-- Memberships: one per member, spread across the four plans.
insert into public.memberships (gym_id, member_id, plan_id, status, starts_on, ends_on, payment_provider, payment_status)
select m.gym_id, m.id, p.id,
       case m.status when 'paused' then 'paused' when 'cancelled' then 'cancelled' else 'active' end::public.membership_status,
       m.joined_at::date,
       case when m.status = 'cancelled' then current_date - 12 end,
       'manual'::public.payment_provider,
       'confirmed'::public.payment_state
from (select m.*, row_number() over (order by m.email) - 1 as rn from public.members m
      where m.gym_id = 'aec16956-3793-4543-873b-4412646ca1eb' and m.email like '%@demo.hybridone.invalid') m
join (select id, row_number() over (order by name) - 1 as pn from public.membership_plans
      where gym_id = 'aec16956-3793-4543-873b-4412646ca1eb' and name like 'Demo %') p on p.pn = m.rn % 4;

-- Payments: up to 3 monthly payments each (annual plan: one). A few failed, two still pending.
insert into public.payment_records (gym_id, membership_id, provider, amount_pence, state, charge_date, paid_out_at, failure_code, failure_message)
select ms.gym_id, ms.id, 'manual', pl.price_pence,
       case when ms.status = 'cancelled' and k = 0 then 'failed'
            when k = 0 and (row_number() over (order by ms.id) % 9 = 0) then 'failed'
            when k = 0 and (row_number() over (order by ms.id) % 9 = 4) then 'pending'
            else 'paid_out' end::public.payment_state,
       (date_trunc('month', current_date) + interval '1 day' - make_interval(months => k))::date + 0,
       case when k > 0 then (date_trunc('month', current_date) + interval '4 days' - make_interval(months => k)) end,
       null, null
from public.memberships ms
join public.membership_plans pl on pl.id = ms.plan_id
cross join generate_series(0, 2) k
where ms.gym_id = 'aec16956-3793-4543-873b-4412646ca1eb' and pl.name like 'Demo %'
  and (pl.billing_interval = 'monthly' or k = 0)
  and (date_trunc('month', current_date) + interval '1 day' - make_interval(months => k))::date >= ms.starts_on - 31;

update public.payment_records set failure_code = 'insufficient_funds', failure_message = 'Demo failed payment'
 where gym_id = 'aec16956-3793-4543-873b-4412646ca1eb' and state = 'failed' and failure_code is null
   and membership_id in (select id from public.memberships where plan_id in (select id from public.membership_plans where name like 'Demo %'));
update public.payment_records set paid_out_at = now() - interval '2 days'
 where gym_id = 'aec16956-3793-4543-873b-4412646ca1eb' and state = 'paid_out' and paid_out_at is null
   and membership_id in (select id from public.memberships where plan_id in (select id from public.membership_plans where name like 'Demo %'));

-- Class types
insert into public.class_types (gym_id, name, description, duration_minutes, default_capacity, difficulty_level, drop_in_price_pence)
values
 ('aec16956-3793-4543-873b-4412646ca1eb','Demo HIIT','High intensity intervals',45,16,'intermediate',800),
 ('aec16956-3793-4543-873b-4412646ca1eb','Demo Spin','Indoor cycling',45,12,'all_levels',800),
 ('aec16956-3793-4543-873b-4412646ca1eb','Demo Yoga','Slow flow and stretch',60,20,'beginner',700),
 ('aec16956-3793-4543-873b-4412646ca1eb','Demo Strength Foundations','Barbell basics',60,10,'beginner',900);

-- Classes: Monday to Saturday, 14 days back to 14 days ahead, at UK gym time (06:30, 12:15, 18:00).
insert into public.class_sessions (gym_id, class_type_id, name, starts_at, ends_at, capacity)
select ct.gym_id, ct.id, ct.name,
       ((d::date + t.at) at time zone 'Europe/London'),
       ((d::date + t.at) at time zone 'Europe/London') + make_interval(mins => ct.duration_minutes),
       ct.default_capacity
from generate_series(current_date - 14, current_date + 14, interval '1 day') d
join (values (1,time '06:30','Demo HIIT'),(1,time '18:00','Demo Yoga'),
             (2,time '12:15','Demo Spin'),(2,time '18:00','Demo Strength Foundations'),
             (3,time '06:30','Demo Spin'),(3,time '18:00','Demo HIIT'),
             (4,time '12:15','Demo Yoga'),(4,time '18:00','Demo Spin'),
             (5,time '06:30','Demo Strength Foundations'),(5,time '17:30','Demo HIIT'),
             (6,time '09:00','Demo HIIT'),(6,time '10:00','Demo Yoga')) t(dow, at, cname)
  on extract(isodow from d) = t.dow
join public.class_types ct on ct.gym_id = 'aec16956-3793-4543-873b-4412646ca1eb' and ct.name = t.cname;

-- What went in:
select 'plans' as what, count(*) from public.membership_plans where gym_id = 'aec16956-3793-4543-873b-4412646ca1eb' and name like 'Demo %'
union all select 'members', count(*) from public.members where email like '%@demo.hybridone.invalid'
union all select 'memberships', count(*) from public.memberships where member_id in (select id from public.members where email like '%@demo.hybridone.invalid')
union all select 'payments', count(*) from public.payment_records where membership_id in (select id from public.memberships where member_id in (select id from public.members where email like '%@demo.hybridone.invalid'))
union all select 'class types', count(*) from public.class_types where gym_id = 'aec16956-3793-4543-873b-4412646ca1eb' and name like 'Demo %'
union all select 'classes', count(*) from public.class_sessions where gym_id = 'aec16956-3793-4543-873b-4412646ca1eb' and name like 'Demo %';

commit;
