-- Rollback for 20261006130000_calendar_feed_service_grants.sql
revoke select on public.calendar_feed_tokens, public.class_bookings, public.class_sessions, public.memberships, public.gyms from service_role;
