-- PT clients, part 2: the coach replies (workout_assignment_feedback) follow the same own-clients rule as the rest.
-- Needs 20261016120000_pt_clients.sql. Staff and coach only; owners, admins and the client keep what they have.
-- Rollback: supabase/rollback/20261016_drop_pt_clients.sql (undoes both parts).

drop policy "coaches and the client read workout feedback" on public.workout_assignment_feedback;
create policy "coaches and the client read workout feedback" on public.workout_assignment_feedback for select to authenticated
  using (
    exists (select 1 from public.workout_assignments a where a.id = assignment_id and private.is_my_pt_client(a.gym_id, a.member_user_id))
    or exists (select 1 from public.workout_assignments a where a.id = assignment_id and a.member_user_id = (select auth.uid()) and private.is_gym_member(a.gym_id))
  );
drop policy "coaches write workout feedback" on public.workout_assignment_feedback;
create policy "coaches write workout feedback" on public.workout_assignment_feedback for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.workout_assignments a where a.id = assignment_id and a.gym_id = workout_assignment_feedback.gym_id
                and private.is_my_pt_client(a.gym_id, a.member_user_id))
  );
