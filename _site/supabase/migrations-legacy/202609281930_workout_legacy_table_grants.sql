-- Restore Data API grants for the legacy member workout log.
-- RLS remains authoritative: members can only manage their own rows in their active gym,
-- while staff read access continues to be governed by the existing policies.

grant select, insert, update, delete
on public.workout_sessions,
   public.workout_entries,
   public.workout_sets
to authenticated;
