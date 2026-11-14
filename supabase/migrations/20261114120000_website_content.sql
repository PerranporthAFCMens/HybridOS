-- Website content: lets a gym's owners and admins edit the text and photos on the gym's public website
-- (the Hybrid Hub site in preview/hybrid-hub-nqy/ is the first one) and publish the change to every visitor.
-- Gym touched: all gyms (per-gym table). It starts empty, so every site shows its built-in wording until an owner edits it.
--
-- What this adds:
--   website_pages   one row per gym and page (for example 'index', 'train'). content holds the edited text and photos
--                   for that page as {"t": {"<slot>": {"o": "<original text>", "h": "<edited html>"}}, "i": {"<slot>": {"o": "<original url>", "u": "<new photo url>"}}}.
--                   The site keeps its own wording for any slot not in the row.
--   website-media   a public storage bucket for photos the owners upload, inside their own gym's folder: <gym id>/<file>.
-- Who can do what:
--   Anyone, signed in or not, can READ website_pages and the photos: it is the public website.
--   Only an active owner or admin of that gym can add, change or remove its pages and photos.
--   Members, staff and coaches cannot change anything.
-- It changes nothing else.
-- Undo: supabase/rollback/20261114_drop_website_content.sql

create table public.website_pages (
  gym_id uuid not null references public.gyms(id) on delete cascade,
  page text not null,
  content jsonb not null default '{}'::jsonb,
  updated_by uuid default auth.uid() references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (gym_id, page),
  constraint website_pages_page check (page ~ '^[a-z0-9-]{1,40}$'),
  constraint website_pages_content_object check (jsonb_typeof(content) = 'object'),
  constraint website_pages_content_size check (pg_column_size(content) <= 200000)
);

-- A fresh local database hands new tables to every role; the live project does not. Say exactly what is wanted.
revoke all on table public.website_pages from anon, authenticated;
grant select on table public.website_pages to anon;
grant select, insert, update, delete on table public.website_pages to authenticated;

alter table public.website_pages enable row level security;

create policy "anyone reads website pages" on public.website_pages for select to anon, authenticated
  using (true);
create policy "owners admins add website pages" on public.website_pages for insert to authenticated
  with check (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));
create policy "owners admins change website pages" on public.website_pages for update to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]))
  with check (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));
create policy "owners admins remove website pages" on public.website_pages for delete to authenticated
  using (private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));

-- Keep updated_at and updated_by honest whoever writes the row.
create function private.stamp_website_page() returns trigger
  language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
revoke all on function private.stamp_website_page() from public, anon, authenticated, service_role;
create trigger website_pages_stamp before insert or update on public.website_pages
  for each row execute function private.stamp_website_page();

-- ---------------------------------------------------------------------------------------------------------------
-- Storage: photos for the website, at <gym id>/<file>. Public read (they appear on the public site).
-- ---------------------------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('website-media', 'website-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "gym owners and admins upload website media" on storage.objects for insert to authenticated
  with check (bucket_id = 'website-media'
              and private.has_gym_role(private.safe_uuid((storage.foldername(name))[1]), array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));
create policy "gym owners and admins replace website media" on storage.objects for update to authenticated
  using (bucket_id = 'website-media'
         and private.has_gym_role(private.safe_uuid((storage.foldername(name))[1]), array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));
create policy "gym owners and admins delete website media" on storage.objects for delete to authenticated
  using (bucket_id = 'website-media'
         and private.has_gym_role(private.safe_uuid((storage.foldername(name))[1]), array['owner'::public.gym_member_role, 'admin'::public.gym_member_role]));
