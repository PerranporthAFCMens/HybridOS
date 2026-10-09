-- Member details required to join (name, date of birth, mobile, address, emergency contact and relationship, a guardian
-- for under-18s, and acceptance of the gym's terms and health declaration), checked by the database.
--
-- Address, emergency contact and guardian are NOT put on public.profiles: any active member of a gym can read the profile
-- of any other member of that gym (private.can_view_profile), so an address there would be visible to the whole gym.
-- They go in public.member_details, readable only by the member and by owners, admins and staff of a gym they belong to.
--
-- New: public.member_details, public.member_declarations, gyms.terms_text / health_declaration_text / terms_version (a
-- trigger raises the version whenever the wording changes), and these functions:
--   public.save_my_join_details(...)        member saves all their details in one call; the database validates them
--   public.get_public_gym_join_terms(slug)  the gym's terms and declaration wording and its current version
--   public.accept_gym_terms(slug)           records that the member accepted the current version (the member cannot write the table)
--   public.get_members_missing_details(gym) owner / admin / staff: members who lack any required detail
--   private.member_gaps(user, gym)          list of what is missing (used by the join function and the staff list)
--   private.can_view_member_details(user)   used by the row security policies
-- And a changed public.join_public_gym_with_membership: it now refuses unless private.member_gaps is empty.
--
-- No existing row is changed. The platform has no real customers yet, so nothing needs back-filling.
-- Rollback: supabase/rollback/20261011_drop_member_join_details.sql. Check: supabase/verification/20261011_member_join_details_check.sql.
begin;

-- ---------------------------------------------------------------------------------------------------------------
-- Gym wording
-- ---------------------------------------------------------------------------------------------------------------
alter table public.gyms
  add column terms_text text,
  add column health_declaration_text text,
  add column terms_version integer not null default 1;

create function private.bump_terms_version() returns trigger
language plpgsql set search_path to 'public', 'pg_temp' as $$
begin
  if new.terms_text is distinct from old.terms_text
     or new.health_declaration_text is distinct from old.health_declaration_text then
    new.terms_version := old.terms_version + 1;
  else
    new.terms_version := old.terms_version;
  end if;
  return new;
end$$;
revoke all on function private.bump_terms_version() from public, anon, authenticated;

create trigger gyms_bump_terms_version before update on public.gyms
  for each row execute function private.bump_terms_version();

-- ---------------------------------------------------------------------------------------------------------------
-- Who may read a member's private details
-- ---------------------------------------------------------------------------------------------------------------
create function private.can_view_member_details(target_user_id uuid) returns boolean
language sql stable security definer set search_path to '' as $$
  select exists (
    select 1
    from public.gym_members mine
    join public.gym_members theirs on theirs.gym_id = mine.gym_id
    where mine.user_id = (select auth.uid())
      and mine.is_active = true
      and mine.role in ('owner', 'admin', 'staff')
      and theirs.user_id = target_user_id
      and theirs.is_active = true
  );
$$;
revoke all on function private.can_view_member_details(uuid) from public, anon, authenticated;
grant execute on function private.can_view_member_details(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Private details, one row per person. Written only by public.save_my_join_details.
-- ---------------------------------------------------------------------------------------------------------------
create table public.member_details (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  address_line1 text not null check (char_length(address_line1) between 1 and 120),
  address_line2 text check (address_line2 is null or char_length(address_line2) <= 120),
  town text not null check (char_length(town) between 1 and 80),
  postcode text not null check (postcode ~ '^[A-Z]{1,2}[0-9][A-Z0-9]? [0-9][A-Z]{2}$'),
  emergency_name text not null check (char_length(emergency_name) between 1 and 80),
  emergency_phone text not null check (emergency_phone ~ '^\+[1-9][0-9]{6,14}$'),
  emergency_relationship text not null check (char_length(emergency_relationship) between 2 and 40),
  guardian_name text check (guardian_name is null or char_length(guardian_name) between 1 and 80),
  guardian_phone text check (guardian_phone is null or guardian_phone ~ '^\+[1-9][0-9]{6,14}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger member_details_set_updated_at before update on public.member_details
  for each row execute function public.set_updated_at();

alter table public.member_details enable row level security;
revoke all on table public.member_details from anon, authenticated;
grant select on table public.member_details to authenticated;

create policy "members and gym staff read member details" on public.member_details for select to authenticated
  using (user_id = (select auth.uid()) or private.can_view_member_details(user_id));

-- ---------------------------------------------------------------------------------------------------------------
-- Terms acceptance, one row per person, gym and version. Written only by public.accept_gym_terms.
-- ---------------------------------------------------------------------------------------------------------------
create table public.member_declarations (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  terms_version integer not null,
  accepted_at timestamptz not null default now(),
  constraint member_declarations_once unique (gym_id, user_id, terms_version)
);

alter table public.member_declarations enable row level security;
revoke all on table public.member_declarations from anon, authenticated;
grant select on table public.member_declarations to authenticated;

create policy "members and gym staff read declarations" on public.member_declarations for select to authenticated
  using (user_id = (select auth.uid())
         or private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role, 'staff'::public.gym_member_role]));

-- ---------------------------------------------------------------------------------------------------------------
-- What is missing for this person at this gym (empty array = complete)
-- ---------------------------------------------------------------------------------------------------------------
create function private.member_gaps(p_user_id uuid, p_gym_id uuid) returns text[]
language plpgsql stable security definer set search_path to 'public', 'private', 'pg_temp' as $$
declare
  p public.profiles%rowtype;
  d public.member_details%rowtype;
  g public.gyms%rowtype;
  gaps text[] := '{}';
begin
  select * into p from public.profiles where id = p_user_id;
  select * into d from public.member_details where user_id = p_user_id;
  select * into g from public.gyms where id = p_gym_id;

  if coalesce(btrim(p.first_name), '') = '' then gaps := array_append(gaps, 'first name'); end if;
  if coalesce(btrim(p.last_name), '') = '' then gaps := array_append(gaps, 'last name'); end if;
  if p.date_of_birth is null or p.date_of_birth < date '1900-01-01' or p.date_of_birth > current_date then
    gaps := array_append(gaps, 'date of birth');
  end if;
  if coalesce(p.phone, '') = '' then gaps := array_append(gaps, 'mobile number'); end if;

  if d.user_id is null then
    gaps := array_append(array_append(gaps, 'address'), 'emergency contact');
  else
    -- the table's own constraints guarantee the fields are filled in once the row exists
    if p.date_of_birth is not null and p.date_of_birth > (current_date - interval '18 years')::date
       and (coalesce(d.guardian_name, '') = '' or coalesce(d.guardian_phone, '') = '') then
      gaps := array_append(gaps, 'parent or guardian');
    end if;
  end if;

  if (coalesce(btrim(g.terms_text), '') <> '' or coalesce(btrim(g.health_declaration_text), '') <> '')
     and not exists (
       select 1 from public.member_declarations md
       where md.gym_id = p_gym_id and md.user_id = p_user_id and md.terms_version = g.terms_version
     ) then
    gaps := array_append(gaps, 'terms and health declaration');
  end if;

  return gaps;
end$$;
revoke all on function private.member_gaps(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Member saves all their details in one call
-- ---------------------------------------------------------------------------------------------------------------
create function public.save_my_join_details(
  p_first_name text, p_last_name text, p_date_of_birth date, p_phone text,
  p_address_line1 text, p_address_line2 text, p_town text, p_postcode text,
  p_emergency_name text, p_emergency_phone text, p_emergency_relationship text,
  p_guardian_name text, p_guardian_phone text
) returns jsonb
language plpgsql security definer set search_path to 'public', 'private', 'pg_temp' as $$
declare
  v_uid uuid := auth.uid();
  v_first text := btrim(coalesce(p_first_name, ''));
  v_last text := btrim(coalesce(p_last_name, ''));
  v_line1 text := btrim(coalesce(p_address_line1, ''));
  v_line2 text := nullif(btrim(coalesce(p_address_line2, '')), '');
  v_town text := btrim(coalesce(p_town, ''));
  v_pc text := upper(regexp_replace(btrim(coalesce(p_postcode, '')), '\s+', '', 'g'));
  v_ec_name text := btrim(coalesce(p_emergency_name, ''));
  v_ec_rel text := btrim(coalesce(p_emergency_relationship, ''));
  v_g_name text := nullif(btrim(coalesce(p_guardian_name, '')), '');
  v_g_phone text := nullif(btrim(coalesce(p_guardian_phone, '')), '');
  v_under_18 boolean;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  if v_first = '' or char_length(v_first) > 80 then raise exception 'Enter your first name.'; end if;
  if v_last = '' or char_length(v_last) > 80 then raise exception 'Enter your last name.'; end if;
  if p_date_of_birth is null or p_date_of_birth < date '1900-01-01' or p_date_of_birth > current_date then
    raise exception 'Enter a valid date of birth.';
  end if;
  if p_phone is null or p_phone !~ '^\+[1-9][0-9]{6,14}$' then
    raise exception 'Enter a valid mobile number.';
  end if;
  if v_line1 = '' or char_length(v_line1) > 120 or char_length(coalesce(v_line2, '')) > 120 then
    raise exception 'Enter the first line of your address.';
  end if;
  if v_town = '' or char_length(v_town) > 80 then raise exception 'Enter your town or city.'; end if;
  if v_pc !~ '^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$' then raise exception 'Enter a valid UK postcode.'; end if;
  v_pc := substr(v_pc, 1, char_length(v_pc) - 3) || ' ' || substr(v_pc, char_length(v_pc) - 2);
  if v_ec_name = '' or char_length(v_ec_name) > 80 then raise exception 'Enter your emergency contact''s name.'; end if;
  if p_emergency_phone is null or p_emergency_phone !~ '^\+[1-9][0-9]{6,14}$' then
    raise exception 'Enter a valid phone number for your emergency contact.';
  end if;
  if char_length(v_ec_rel) < 2 or char_length(v_ec_rel) > 40 then
    raise exception 'Enter your emergency contact''s relationship to you.';
  end if;

  v_under_18 := p_date_of_birth > (current_date - interval '18 years')::date;
  if v_under_18 and (v_g_name is null or v_g_phone is null) then
    raise exception 'Enter a parent or guardian name and phone number.';
  end if;
  if v_g_phone is not null and v_g_phone !~ '^\+[1-9][0-9]{6,14}$' then
    raise exception 'Enter a valid phone number for the parent or guardian.';
  end if;
  if char_length(coalesce(v_g_name, '')) > 80 then raise exception 'That guardian name is too long.'; end if;

  insert into public.profiles(id, first_name, last_name, display_name, date_of_birth, phone)
  values (v_uid, v_first, v_last, v_first || ' ' || v_last, p_date_of_birth, p_phone)
  on conflict (id) do update
    set first_name = excluded.first_name,
        last_name = excluded.last_name,
        display_name = coalesce(nullif(btrim(public.profiles.display_name), ''), excluded.display_name),
        date_of_birth = excluded.date_of_birth,
        phone = excluded.phone,
        updated_at = now();

  insert into public.member_details(
    user_id, address_line1, address_line2, town, postcode,
    emergency_name, emergency_phone, emergency_relationship, guardian_name, guardian_phone
  ) values (
    v_uid, v_line1, v_line2, v_town, v_pc,
    v_ec_name, p_emergency_phone, v_ec_rel,
    case when v_under_18 then v_g_name end, case when v_under_18 then v_g_phone end
  )
  on conflict (user_id) do update
    set address_line1 = excluded.address_line1, address_line2 = excluded.address_line2,
        town = excluded.town, postcode = excluded.postcode,
        emergency_name = excluded.emergency_name, emergency_phone = excluded.emergency_phone,
        emergency_relationship = excluded.emergency_relationship,
        guardian_name = excluded.guardian_name, guardian_phone = excluded.guardian_phone;

  return jsonb_build_object('ok', true, 'under_18', v_under_18);
end$$;
revoke all on function public.save_my_join_details(text, text, date, text, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.save_my_join_details(text, text, date, text, text, text, text, text, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Terms wording and acceptance
-- ---------------------------------------------------------------------------------------------------------------
create function public.get_public_gym_join_terms(p_gym_slug text) returns jsonb
language plpgsql stable security definer set search_path to 'public', 'private', 'pg_temp' as $$
declare g public.gyms%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into g from public.gyms where slug = p_gym_slug limit 1;
  if g.id is null then raise exception 'Gym not found'; end if;
  return jsonb_build_object(
    'gym_id', g.id,
    'terms_text', g.terms_text,
    'health_declaration_text', g.health_declaration_text,
    'terms_version', g.terms_version
  );
end$$;
revoke all on function public.get_public_gym_join_terms(text) from public, anon;
grant execute on function public.get_public_gym_join_terms(text) to authenticated;

create function public.accept_gym_terms(p_gym_slug text) returns jsonb
language plpgsql security definer set search_path to 'public', 'private', 'pg_temp' as $$
declare
  v_uid uuid := auth.uid();
  g public.gyms%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into g from public.gyms where slug = p_gym_slug limit 1;
  if g.id is null then raise exception 'Gym not found'; end if;
  if coalesce(btrim(g.terms_text), '') = '' and coalesce(btrim(g.health_declaration_text), '') = '' then
    raise exception 'This gym has no terms to accept.';
  end if;
  insert into public.member_declarations(gym_id, user_id, terms_version)
  values (g.id, v_uid, g.terms_version)
  on conflict (gym_id, user_id, terms_version) do nothing;
  return jsonb_build_object('ok', true, 'terms_version', g.terms_version);
end$$;
revoke all on function public.accept_gym_terms(text) from public, anon;
grant execute on function public.accept_gym_terms(text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Staff list of members with something missing
-- ---------------------------------------------------------------------------------------------------------------
create function public.get_members_missing_details(p_gym_id uuid)
returns table(user_id uuid, member_name text, missing text[])
language plpgsql stable security definer set search_path to 'public', 'private', 'pg_temp' as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not private.has_gym_role(p_gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role, 'staff'::public.gym_member_role]) then
    raise exception 'Not allowed';
  end if;
  return query
  select m.user_id,
         coalesce(nullif(btrim(pr.display_name), ''), nullif(btrim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), ''), 'Member'),
         private.member_gaps(m.user_id, p_gym_id)
  from public.gym_members m
  left join public.profiles pr on pr.id = m.user_id
  where m.gym_id = p_gym_id and m.is_active = true and m.role = 'member'
    and coalesce(array_length(private.member_gaps(m.user_id, p_gym_id), 1), 0) > 0
  order by 2;
end$$;
revoke all on function public.get_members_missing_details(uuid) from public, anon;
grant execute on function public.get_members_missing_details(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Join: refuse unless the details are complete (the rest of the function is unchanged from 20261005120000)
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_public_gym_with_membership(p_gym_slug text, p_plan_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
declare
  v_uid uuid := auth.uid();
  v_gym_id uuid;
  v_gym_name text;
  v_plan public.membership_plans%rowtype;
  v_membership_id uuid;
  v_existing_role public.gym_member_role;
  v_gaps text[];
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select id, name into v_gym_id, v_gym_name
  from public.gyms
  where slug = p_gym_slug
  limit 1;

  if v_gym_id is null then
    raise exception 'Gym not found';
  end if;

  select * into v_plan
  from public.membership_plans
  where id = p_plan_id
    and gym_id = v_gym_id
    and is_active = true
    and is_public = true;

  if not found then
    raise exception 'Membership plan is not available';
  end if;

  -- Status gate: this (manual/test payment) join is for NEW members only. It must never change an existing membership
  -- (paused/pending -> active, cancelled/expired -> new active row, plan swaps) or reactivate a revoked account.
  if exists (select 1 from public.memberships ms where ms.gym_id = v_gym_id and ms.user_id = v_uid) then
    raise exception 'You already have a membership at this gym. Contact your gym to change it.';
  end if;
  if exists (select 1 from public.gym_members gx where gx.gym_id = v_gym_id and gx.user_id = v_uid and gx.access_status <> 'active') then
    raise exception 'This account no longer has access to this gym. Contact your gym.';
  end if;

  -- Every member must give their details and accept the gym's terms before a membership is created.
  v_gaps := private.member_gaps(v_uid, v_gym_id);
  if coalesce(array_length(v_gaps, 1), 0) > 0 then
    raise exception 'Complete your details before joining: %', array_to_string(v_gaps, ', ');
  end if;

  select role into v_existing_role
  from public.gym_members
  where gym_id = v_gym_id
    and user_id = v_uid
  limit 1;

  if v_existing_role is null then
    insert into public.gym_members(gym_id,user_id,role,is_active)
    values(v_gym_id,v_uid,'member',true);
  else
    update public.gym_members
    set is_active = true, updated_at = now()
    where gym_id = v_gym_id and user_id = v_uid;
  end if;

  select id into v_membership_id
  from public.memberships
  where gym_id = v_gym_id
    and user_id = v_uid
    and status in ('active','pending','paused')
  order by created_at desc
  limit 1;

  if v_membership_id is null then
    insert into public.memberships(
      gym_id,user_id,plan_id,status,starts_on,payment_provider,payment_status
    )
    values(
      v_gym_id,v_uid,v_plan.id,'active',current_date,'manual','confirmed'
    )
    returning id into v_membership_id;
  else
    update public.memberships
    set plan_id = v_plan.id,
        status = 'active',
        starts_on = coalesce(starts_on,current_date),
        ends_on = null,
        payment_provider = 'manual',
        payment_status = 'confirmed',
        provider_customer_id = null,
        provider_mandate_id = null,
        provider_subscription_id = null,
        provider_status = 'test_manual_active',
        provider_last_synced_at = now(),
        updated_at = now()
    where id = v_membership_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'gym_id', v_gym_id,
    'gym_name', v_gym_name,
    'plan_id', v_plan.id,
    'plan_name', v_plan.name,
    'membership_id', v_membership_id,
    'status', 'active',
    'payment_mode', 'manual_test'
  );
end;
$$;

commit;
