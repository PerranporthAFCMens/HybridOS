# Membership status Stage 2a: policies before and after

Generated from databases rebuilt from the repo migrations (before = baseline + the 3 later migrations; after = plus `20261005120000_membership_status_enforcement.sql`).
These 16 tables are the ones whose POLICY TEXT changed. Other policies that call `private.is_gym_member(...)` or `private.can_write_gym(...)` keep their text but now run the status-aware helper bodies (see the migration).
Rows marked **REMOVED** are the old permissive policies; the persona tests fail if any of them survives. Rows marked unchanged are kept as they are.

## public.class_bookings

| | policy | command | roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| before: unchanged | assigned class staff can view bookings | SELECT | {authenticated} | `(EXISTS ( SELECT 1 FROM class_session_staff css WHERE ((css.session_id = class_bookings.session_id) AND (css.user_id = auth.uid()) AND (css.gym_id = class_bookings.gym_id))))` | `-` |
| before: unchanged | gym managers can view class bookings | SELECT | {authenticated} | `private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role])` | `-` |
| before: unchanged | pending admins can read class bookings | SELECT | {authenticated} | `private.is_pending_admin(gym_id)` | `-` |
| before: **REMOVED** | users can view own class bookings | SELECT | {authenticated} | `(user_id = auth.uid())` | `-` |
| before: unchanged | assigned staff can mark attendance | UPDATE | {authenticated} | `((EXISTS ( SELECT 1 FROM class_session_staff css WHERE ((css.session_id = class_bookings.session_id) AND (css.user_id = auth.uid()) AND (css.gym_id = class_bookings.gym_id)))) AND private.staff_has_permission(gym_id, auth.uid(), 'mark_attendance'::text))` | `((EXISTS ( SELECT 1 FROM class_session_staff css WHERE ((css.session_id = class_bookings.session_id) AND (css.user_id = auth.uid()) AND (css.gym_id = class_bookings.gym_id)))) AND private.staff_has_permission(gym_id, auth.uid(), 'mark_attendance'::text) AND (status = ANY (ARRAY['booked'::text, 'attended'::text, 'no_show'::text])))` |
| after: **NEW** | own class bookings readable when active | SELECT | {authenticated} | `((user_id = auth.uid()) AND private.member_status_allows(gym_id, ARRAY['active'::text]))` | `-` |

## public.gym_access_settings

| | policy | command | roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| before: unchanged | gym admins can insert access settings | INSERT | {authenticated} | `-` | `private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])` |
| before: **REMOVED** | gym members can view access settings | SELECT | {authenticated} | `(EXISTS ( SELECT 1 FROM gym_members gm WHERE ((gm.gym_id = gym_access_settings.gym_id) AND (gm.user_id = auth.uid()) AND (gm.is_active = true))))` | `-` |
| before: unchanged | gym admins can update access settings | UPDATE | {authenticated} | `private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])` | `private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])` |
| after: **NEW** | access settings readable by active members | SELECT | {authenticated} | `private.is_gym_member(gym_id)` | `-` |

## public.gym_members

| | policy | command | roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| before: unchanged | admins can delete gym members | DELETE | {authenticated} | `private.can_manage_gym_member(gym_id, user_id, role)` | `-` |
| before: unchanged | authorized users can insert gym members | INSERT | {authenticated} | `-` | `((private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role]) AND (role <> 'owner'::gym_member_role)) OR (private.has_gym_role(gym_id, ARRAY['admin'::gym_member_role]) AND (role = ANY (ARRAY['member'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role]))) OR ((user_id = ( SELECT auth.uid() AS uid)) AND (role = 'owner'::gym_member_role) AND (NOT private.has_active_owner(gym_id)) AND (EXISTS ( SELECT 1 FROM gyms g WHERE ((g.id = gym_members.gym_id) AND (g.created_by = ( SELECT auth.uid() AS uid)))))))` |
| before: unchanged | gym users can read members | SELECT | {authenticated} | `private.is_gym_member(gym_id)` | `-` |
| before: unchanged | admins can update gym members | UPDATE | {authenticated} | `private.can_manage_gym_member(gym_id, user_id, role)` | `private.can_manage_gym_member(gym_id, user_id, role)` |
| after: **NEW** | members read own gym member row | SELECT | {authenticated} | `((user_id = ( SELECT auth.uid() AS uid)) AND (is_active = true))` | `-` |

## public.gyms

| | policy | command | roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| before: unchanged | authenticated users can create gyms | INSERT | {authenticated} | `-` | `(created_by = ( SELECT auth.uid() AS uid))` |
| before: **REMOVED** | authorized users can read gyms | SELECT | {authenticated} | `((created_by = ( SELECT auth.uid() AS uid)) OR private.is_gym_member(id))` | `-` |
| before: unchanged | admins can update their gym | UPDATE | {authenticated} | `private.has_gym_role(id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])` | `private.has_gym_role(id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])` |
| after: **NEW** | gyms readable by creator and non-ended members | SELECT | {authenticated} | `((created_by = ( SELECT auth.uid() AS uid)) OR private.member_status_allows(id, ARRAY['active'::text, 'paused'::text, 'pending'::text]))` | `-` |

## public.member_training_preferences

| | policy | command | roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| before: unchanged | members insert own training preferences | INSERT | {authenticated} | `-` | `((user_id = auth.uid()) AND private.can_write_gym(gym_id))` |
| before: **REMOVED** | members read own training preferences | SELECT | {authenticated} | `((user_id = auth.uid()) AND (EXISTS ( SELECT 1 FROM gym_members gm WHERE ((gm.gym_id = member_training_preferences.gym_id) AND (gm.user_id = auth.uid()) AND (gm.is_active = true)))))` | `-` |
| before: unchanged | members update own training preferences | UPDATE | {authenticated} | `((user_id = auth.uid()) AND private.can_write_gym(gym_id))` | `((user_id = auth.uid()) AND private.can_write_gym(gym_id))` |
| after: **NEW** | own training preferences readable when active or paused | SELECT | {authenticated} | `((user_id = auth.uid()) AND private.member_status_allows(gym_id, ARRAY['active'::text, 'paused'::text]))` | `-` |

## public.membership_plans

| | policy | command | roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| before: unchanged | admins can delete plans | DELETE | {authenticated} | `private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])` | `-` |
| before: unchanged | admins can insert plans | INSERT | {authenticated} | `-` | `private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])` |
| before: **REMOVED** | gym members can read plans | SELECT | {authenticated} | `private.is_gym_member(gym_id)` | `-` |
| before: unchanged | admins can update plans | UPDATE | {authenticated} | `private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])` | `private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])` |
| after: **NEW** | plans readable by active paused and pending members | SELECT | {authenticated} | `private.member_status_allows(gym_id, ARRAY['active'::text, 'paused'::text, 'pending'::text])` | `-` |

## public.payment_records

| | policy | command | roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| before: unchanged | admins can insert payments | INSERT | {authenticated} | `-` | `( SELECT private.has_gym_role(payment_records.gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]) AS has_gym_role)` |
| before: **REMOVED** | gym users can read relevant payments | SELECT | {authenticated} | `((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.has_gym_role(payment_records.gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]) AS has_gym_role))` | `-` |
| before: unchanged | pending admins can read payments | SELECT | {authenticated} | `private.is_pending_admin(gym_id)` | `-` |
| before: unchanged | admins can update payments | UPDATE | {authenticated} | `( SELECT private.has_gym_role(payment_records.gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]) AS has_gym_role)` | `( SELECT private.has_gym_role(payment_records.gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]) AS has_gym_role)` |
| after: **NEW** | own payments readable when active or admin reads | SELECT | {authenticated} | `(((user_id = ( SELECT auth.uid() AS uid)) AND private.member_status_allows(gym_id, ARRAY['active'::text])) OR ( SELECT private.has_gym_role(payment_records.gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]) AS has_gym_role))` | `-` |

## public.personal_bests

| | policy | command | roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| before: **REMOVED** | members_manage_own_personal_bests | ALL | {public} | `((user_id = auth.uid()) AND private.can_write_gym(gym_id))` | `((user_id = auth.uid()) AND private.can_write_gym(gym_id))` |
| before: unchanged | staff_view_gym_personal_bests | SELECT | {public} | `(EXISTS ( SELECT 1 FROM gym_members gm WHERE ((gm.gym_id = personal_bests.gym_id) AND (gm.user_id = auth.uid()) AND (gm.is_active = true) AND (gm.role = ANY (ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role])))))` | `-` |
| after: **NEW** | own personal bests deletable when active | DELETE | {public} | `((user_id = auth.uid()) AND private.can_write_gym(gym_id))` | `-` |
| after: **NEW** | own personal bests insertable when active | INSERT | {public} | `-` | `((user_id = auth.uid()) AND private.can_write_gym(gym_id))` |
| after: **NEW** | own personal bests readable when active or paused | SELECT | {public} | `((user_id = auth.uid()) AND private.member_status_allows(gym_id, ARRAY['active'::text, 'paused'::text]))` | `-` |
| after: **NEW** | own personal bests updatable when active | UPDATE | {public} | `((user_id = auth.uid()) AND private.can_write_gym(gym_id))` | `((user_id = auth.uid()) AND private.can_write_gym(gym_id))` |

## public.pt_appointments

| | policy | command | roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| before: unchanged | pt appointments delete | DELETE | {public} | `(private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]) OR (EXISTS ( SELECT 1 FROM gym_members gm WHERE ((gm.gym_id = pt_appointments.gym_id) AND (gm.user_id = auth.uid()) AND gm.is_active AND (gm.access_status = 'active'::text) AND (gm.role = ANY (ARRAY['staff'::gym_member_role, 'coach'::gym_member_role])) AND (pt_appointments.staff_user_id = auth.uid())))))` | `-` |
| before: unchanged | pt appointments insert | INSERT | {public} | `-` | `(private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]) OR (EXISTS ( SELECT 1 FROM gym_members gm WHERE ((gm.gym_id = pt_appointments.gym_id) AND (gm.user_id = auth.uid()) AND gm.is_active AND (gm.access_status = 'active'::text) AND (gm.role = ANY (ARRAY['staff'::gym_member_role, 'coach'::gym_member_role])) AND (pt_appointments.staff_user_id = auth.uid())))))` |
| before: **REMOVED** | members can view own pt appointments | SELECT | {authenticated} | `(member_user_id = auth.uid())` | `-` |
| before: unchanged | pt appointments select | SELECT | {public} | `(EXISTS ( SELECT 1 FROM gym_members gm WHERE ((gm.gym_id = pt_appointments.gym_id) AND (gm.user_id = auth.uid()) AND gm.is_active AND ((gm.role = ANY (ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])) OR (pt_appointments.staff_user_id = auth.uid())))))` | `-` |
| before: unchanged | pt appointments update | UPDATE | {public} | `(private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]) OR (EXISTS ( SELECT 1 FROM gym_members gm WHERE ((gm.gym_id = pt_appointments.gym_id) AND (gm.user_id = auth.uid()) AND gm.is_active AND (gm.access_status = 'active'::text) AND (gm.role = ANY (ARRAY['staff'::gym_member_role, 'coach'::gym_member_role])) AND (pt_appointments.staff_user_id = auth.uid())))))` | `(private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]) OR (EXISTS ( SELECT 1 FROM gym_members gm WHERE ((gm.gym_id = pt_appointments.gym_id) AND (gm.user_id = auth.uid()) AND gm.is_active AND (gm.access_status = 'active'::text) AND (gm.role = ANY (ARRAY['staff'::gym_member_role, 'coach'::gym_member_role])) AND (pt_appointments.staff_user_id = auth.uid())))))` |
| after: **NEW** | own pt appointments readable when active | SELECT | {authenticated} | `((member_user_id = auth.uid()) AND private.member_status_allows(gym_id, ARRAY['active'::text]))` | `-` |

## public.social_comments

| | policy | command | roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| before: unchanged | authors or admins delete social comments | DELETE | {authenticated} | `(((user_id = auth.uid()) AND private.can_write_gym(gym_id)) OR private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]))` | `-` |
| before: unchanged | gym members create social comments | INSERT | {public} | `-` | `((user_id = auth.uid()) AND private.can_write_gym(gym_id))` |
| before: **REMOVED** | gym members read social comments | SELECT | {public} | `(EXISTS ( SELECT 1 FROM gym_members gm WHERE ((gm.gym_id = social_comments.gym_id) AND (gm.user_id = auth.uid()) AND gm.is_active)))` | `-` |
| before: unchanged | authors or admins update social comments | UPDATE | {authenticated} | `(((user_id = auth.uid()) AND private.can_write_gym(gym_id)) OR private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]))` | `(((user_id = auth.uid()) AND private.can_write_gym(gym_id)) OR private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]))` |
| after: **NEW** | social comments readable by active members | SELECT | {public} | `private.is_gym_member(gym_id)` | `-` |

## public.social_posts

| | policy | command | roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| before: unchanged | authors or admins delete social posts | DELETE | {authenticated} | `(((user_id = auth.uid()) AND private.can_write_gym(gym_id)) OR private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]))` | `-` |
| before: unchanged | gym members create social posts | INSERT | {public} | `-` | `((user_id = auth.uid()) AND private.can_write_gym(gym_id))` |
| before: **REMOVED** | gym members read social posts | SELECT | {public} | `(EXISTS ( SELECT 1 FROM gym_members gm WHERE ((gm.gym_id = social_posts.gym_id) AND (gm.user_id = auth.uid()) AND gm.is_active)))` | `-` |
| before: unchanged | authors or admins update social posts | UPDATE | {authenticated} | `(((user_id = auth.uid()) AND private.can_write_gym(gym_id)) OR private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]))` | `(((user_id = auth.uid()) AND private.can_write_gym(gym_id)) OR private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]))` |
| after: **NEW** | social posts readable by active members | SELECT | {public} | `private.is_gym_member(gym_id)` | `-` |

## public.social_reactions

| | policy | command | roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| before: unchanged | users delete own social reactions | DELETE | {public} | `((user_id = auth.uid()) AND private.can_write_gym(gym_id))` | `-` |
| before: unchanged | gym members create social reactions | INSERT | {public} | `-` | `((user_id = auth.uid()) AND private.can_write_gym(gym_id))` |
| before: **REMOVED** | gym members read social reactions | SELECT | {public} | `(EXISTS ( SELECT 1 FROM gym_members gm WHERE ((gm.gym_id = social_reactions.gym_id) AND (gm.user_id = auth.uid()) AND gm.is_active)))` | `-` |
| before: unchanged | users update own social reactions | UPDATE | {public} | `((user_id = auth.uid()) AND private.can_write_gym(gym_id))` | `((user_id = auth.uid()) AND private.can_write_gym(gym_id))` |
| after: **NEW** | social reactions readable by active members | SELECT | {public} | `private.is_gym_member(gym_id)` | `-` |

## public.workout_assignments

| | policy | command | roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| before: unchanged | staff manage member workout assignments | ALL | {authenticated} | `private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role])` | `(private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role]) AND (EXISTS ( SELECT 1 FROM gym_members gm WHERE ((gm.gym_id = workout_assignments.gym_id) AND (gm.user_id = workout_assignments.member_user_id) AND gm.is_active))))` |
| before: unchanged | members create own optional workouts | INSERT | {authenticated} | `-` | `((member_user_id = ( SELECT auth.uid() AS uid)) AND (source = ANY (ARRAY['self'::text, 'wod'::text])) AND private.can_write_gym(gym_id))` |
| before: **REMOVED** | members read own workout assignments | SELECT | {authenticated} | `((member_user_id = ( SELECT auth.uid() AS uid)) AND private.is_gym_member(gym_id))` | `-` |
| before: unchanged | pending admins can read workout assignments | SELECT | {authenticated} | `private.is_pending_admin(gym_id)` | `-` |
| before: unchanged | members update own workout assignments | UPDATE | {authenticated} | `((member_user_id = ( SELECT auth.uid() AS uid)) AND private.can_write_gym(gym_id))` | `((member_user_id = ( SELECT auth.uid() AS uid)) AND private.can_write_gym(gym_id))` |
| after: **NEW** | own workout assignments readable when active or paused | SELECT | {authenticated} | `((member_user_id = ( SELECT auth.uid() AS uid)) AND private.member_status_allows(gym_id, ARRAY['active'::text, 'paused'::text]))` | `-` |

## public.workout_entries

| | policy | command | roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| before: **REMOVED** | members_manage_own_workout_entries | ALL | {authenticated} | `((user_id = auth.uid()) AND private.can_write_gym(gym_id))` | `((user_id = auth.uid()) AND private.can_write_gym(gym_id) AND (EXISTS ( SELECT 1 FROM workout_sessions ws WHERE ((ws.id = workout_entries.session_id) AND (ws.user_id = auth.uid()) AND (ws.gym_id = workout_entries.gym_id)))))` |
| before: unchanged | staff_view_gym_workout_entries | SELECT | {authenticated} | `(EXISTS ( SELECT 1 FROM gym_members gm WHERE ((gm.gym_id = workout_entries.gym_id) AND (gm.user_id = auth.uid()) AND (gm.is_active = true) AND (gm.role = ANY (ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role])))))` | `-` |
| after: **NEW** | own workout entries deletable when active | DELETE | {authenticated} | `((user_id = auth.uid()) AND private.can_write_gym(gym_id))` | `-` |
| after: **NEW** | own workout entries insertable when active | INSERT | {authenticated} | `-` | `((user_id = auth.uid()) AND private.can_write_gym(gym_id) AND (EXISTS ( SELECT 1 FROM workout_sessions ws WHERE ((ws.id = workout_entries.session_id) AND (ws.user_id = auth.uid()) AND (ws.gym_id = workout_entries.gym_id)))))` |
| after: **NEW** | own workout entries readable when active or paused | SELECT | {authenticated} | `((user_id = auth.uid()) AND private.member_status_allows(gym_id, ARRAY['active'::text, 'paused'::text]))` | `-` |
| after: **NEW** | own workout entries updatable when active | UPDATE | {authenticated} | `((user_id = auth.uid()) AND private.can_write_gym(gym_id))` | `((user_id = auth.uid()) AND private.can_write_gym(gym_id) AND (EXISTS ( SELECT 1 FROM workout_sessions ws WHERE ((ws.id = workout_entries.session_id) AND (ws.user_id = auth.uid()) AND (ws.gym_id = workout_entries.gym_id)))))` |

## public.workout_sessions

| | policy | command | roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| before: **REMOVED** | members_manage_own_workout_sessions | ALL | {authenticated} | `((user_id = auth.uid()) AND private.can_write_gym(gym_id))` | `((user_id = auth.uid()) AND private.can_write_gym(gym_id))` |
| before: unchanged | staff_view_gym_workout_sessions | SELECT | {authenticated} | `(EXISTS ( SELECT 1 FROM gym_members gm WHERE ((gm.gym_id = workout_sessions.gym_id) AND (gm.user_id = auth.uid()) AND (gm.is_active = true) AND (gm.role = ANY (ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role])))))` | `-` |
| after: **NEW** | own workout sessions deletable when active | DELETE | {authenticated} | `((user_id = auth.uid()) AND private.can_write_gym(gym_id))` | `-` |
| after: **NEW** | own workout sessions insertable when active | INSERT | {authenticated} | `-` | `((user_id = auth.uid()) AND private.can_write_gym(gym_id))` |
| after: **NEW** | own workout sessions readable when active or paused | SELECT | {authenticated} | `((user_id = auth.uid()) AND private.member_status_allows(gym_id, ARRAY['active'::text, 'paused'::text]))` | `-` |
| after: **NEW** | own workout sessions updatable when active | UPDATE | {authenticated} | `((user_id = auth.uid()) AND private.can_write_gym(gym_id))` | `((user_id = auth.uid()) AND private.can_write_gym(gym_id))` |

## public.workout_sets

| | policy | command | roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| before: **REMOVED** | members_manage_sets_for_own_entries | ALL | {authenticated} | `(EXISTS ( SELECT 1 FROM workout_entries we WHERE ((we.id = workout_sets.entry_id) AND (we.user_id = auth.uid()) AND private.can_write_gym(we.gym_id))))` | `(EXISTS ( SELECT 1 FROM workout_entries we WHERE ((we.id = workout_sets.entry_id) AND (we.user_id = auth.uid()) AND private.can_write_gym(we.gym_id))))` |
| before: unchanged | staff_view_sets_for_gym_entries | SELECT | {authenticated} | `(EXISTS ( SELECT 1 FROM (workout_entries we JOIN gym_members gm ON ((gm.gym_id = we.gym_id))) WHERE ((we.id = workout_sets.entry_id) AND (gm.user_id = auth.uid()) AND (gm.is_active = true) AND (gm.role = ANY (ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role])))))` | `-` |
| after: **NEW** | own workout sets deletable when active | DELETE | {authenticated} | `(EXISTS ( SELECT 1 FROM workout_entries we WHERE ((we.id = workout_sets.entry_id) AND (we.user_id = auth.uid()) AND private.can_write_gym(we.gym_id))))` | `-` |
| after: **NEW** | own workout sets insertable when active | INSERT | {authenticated} | `-` | `(EXISTS ( SELECT 1 FROM workout_entries we WHERE ((we.id = workout_sets.entry_id) AND (we.user_id = auth.uid()) AND private.can_write_gym(we.gym_id))))` |
| after: **NEW** | own workout sets readable when active or paused | SELECT | {authenticated} | `(EXISTS ( SELECT 1 FROM workout_entries we WHERE ((we.id = workout_sets.entry_id) AND (we.user_id = auth.uid()) AND private.member_status_allows(we.gym_id, ARRAY['active'::text, 'paused'::text]))))` | `-` |
| after: **NEW** | own workout sets updatable when active | UPDATE | {authenticated} | `(EXISTS ( SELECT 1 FROM workout_entries we WHERE ((we.id = workout_sets.entry_id) AND (we.user_id = auth.uid()) AND private.can_write_gym(we.gym_id))))` | `(EXISTS ( SELECT 1 FROM workout_entries we WHERE ((we.id = workout_sets.entry_id) AND (we.user_id = auth.uid()) AND private.can_write_gym(we.gym_id))))` |

