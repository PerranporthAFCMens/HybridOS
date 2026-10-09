-- OPTIONAL, run after the migration. Starts approved pauses, cancellations and plan changes on their date, and ends
-- finished pauses, once a day at 00:05 UK time, even when nobody opens the app.
-- Needs the pg_cron extension. In Supabase: Database > Extensions > pg_cron > enable. If it is not enabled this fails and
-- changes nothing. Without it everything still works: the same job runs whenever a member opens their membership
-- options or an admin decides a request.
-- UTC times: 00:05 UK is 23:05 UTC in summer and 00:05 UTC in winter, so this runs at 00:05 UTC and 23:05 UTC, harmless twice.
select cron.schedule('hybridone-membership-rules-midnight', '5 0 * * *', $$select public.apply_due_membership_requests()$$);
select cron.schedule('hybridone-membership-rules-late', '5 23 * * *', $$select public.apply_due_membership_requests()$$);
-- To remove: select cron.unschedule('hybridone-membership-rules-midnight'); select cron.unschedule('hybridone-membership-rules-late');
