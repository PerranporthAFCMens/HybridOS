-- Undo 20261016120000_pt_clients.sql. Puts the old staff rules back exactly (any staff or coach sees every member's workouts)
-- and removes the clients list and the switch.
begin;
drop policy "staff_view_gym_workout_sessions" on public.workout_sessions;
create policy "staff_view_gym_workout_sessions" on public.workout_sessions for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM gym_members gm
  WHERE ((gm.gym_id = workout_sessions.gym_id) AND (gm.user_id = auth.uid()) AND (gm.is_active = true) AND (gm.role = ANY (ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role]))))));

drop policy "staff_view_gym_workout_entries" on public.workout_entries;
create policy "staff_view_gym_workout_entries" on public.workout_entries for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM gym_members gm
  WHERE ((gm.gym_id = workout_entries.gym_id) AND (gm.user_id = auth.uid()) AND (gm.is_active = true) AND (gm.role = ANY (ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role]))))));

drop policy "staff_view_sets_for_gym_entries" on public.workout_sets;
create policy "staff_view_sets_for_gym_entries" on public.workout_sets for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM (workout_entries we
     JOIN gym_members gm ON ((gm.gym_id = we.gym_id)))
  WHERE ((we.id = workout_sets.entry_id) AND (gm.user_id = auth.uid()) AND (gm.is_active = true) AND (gm.role = ANY (ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role]))))));

drop policy "staff_view_gym_personal_bests" on public.personal_bests;
create policy "staff_view_gym_personal_bests" on public.personal_bests for select to public using ((EXISTS ( SELECT 1
   FROM gym_members gm
  WHERE ((gm.gym_id = personal_bests.gym_id) AND (gm.user_id = auth.uid()) AND (gm.is_active = true) AND (gm.role = ANY (ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role]))))));

drop policy "staff manage member workout assignments" on public.workout_assignments;
create policy "staff manage member workout assignments" on public.workout_assignments for all to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role])) with check ((private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role]) AND (EXISTS ( SELECT 1
   FROM gym_members gm
  WHERE ((gm.gym_id = workout_assignments.gym_id) AND (gm.user_id = workout_assignments.member_user_id) AND gm.is_active)))));

drop policy "coaches and the client read workout feedback" on public.workout_assignment_feedback;
create policy "coaches and the client read workout feedback" on public.workout_assignment_feedback for select to authenticated
  using (
    private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role, 'staff'::public.gym_member_role, 'coach'::public.gym_member_role])
    or exists (select 1 from public.workout_assignments a where a.id = assignment_id and a.member_user_id = (select auth.uid()) and private.is_gym_member(a.gym_id))
  );
drop policy "coaches write workout feedback" on public.workout_assignment_feedback;
create policy "coaches write workout feedback" on public.workout_assignment_feedback for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and private.has_gym_role(gym_id, array['owner'::public.gym_member_role, 'admin'::public.gym_member_role, 'staff'::public.gym_member_role, 'coach'::public.gym_member_role])
    and exists (select 1 from public.workout_assignments a where a.id = assignment_id and a.gym_id = workout_assignment_feedback.gym_id)
  );

drop function if exists private.is_my_pt_client(uuid, uuid);
drop table if exists public.gym_pt_settings;
drop table if exists public.pt_clients;
commit;
