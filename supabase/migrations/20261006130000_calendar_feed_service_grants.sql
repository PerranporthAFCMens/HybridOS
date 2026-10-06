-- The calendar feed Edge Function (class-calendar) reads with the service role, but the service role
-- has no table privileges on the tables it reads, so every feed request returned "not found" (404).
-- Found by the Stage 3 persona test on 6 Oct 2026. Read-only: SELECT only, service_role only.
-- Rollback: supabase/rollback/20261006_revoke_calendar_feed_service_grants.sql
grant select on public.calendar_feed_tokens, public.class_bookings, public.class_sessions, public.memberships, public.gyms to service_role;
