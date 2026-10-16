-- OPTIONAL. Not applied by merging. Makes waitlist offers expire on time even when nobody opens that class.
-- Needs the pg_cron extension. In Supabase: Database > Extensions > pg_cron > enable. If it is not enabled this fails and
-- changes nothing. Without this, an expired offer is cleaned up (and the next person offered the place) the next time anyone
-- books, joins or looks at that class, so it is only needed for classes that may sit quiet while an offer runs out.
select cron.schedule(
  'class-waitlist-advance',
  '* * * * *',
  $$ select private.advance_waitlist(s.id) from public.class_sessions s
     where s.starts_at > now() and exists (select 1 from public.class_waitlist w where w.session_id = s.id and w.status in ('waiting', 'offered')) $$
);
-- To remove it:  select cron.unschedule('class-waitlist-advance');
