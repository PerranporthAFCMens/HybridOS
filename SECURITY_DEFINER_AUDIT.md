# HybridOne SECURITY DEFINER exposure audit

Date: 30 September 2026  
Scope: live Supabase project, read-only inspection only. No database changes were made.

## Executive summary

The live `public` schema has **44 SECURITY DEFINER functions executable by `authenticated`**. Of those, **21 are also executable by `anon`**.

The important distinction is between **grant exposure** and **body authorization**:

- Most sensitive admin/owner functions that are callable by `anon` still check the caller inside the body using `auth.uid()`, `private.has_gym_role(...)`, or another membership/permission helper. That means anonymous execution generally fails, but the grant is broader than necessary.
- Three functions appear to have a genuine public/anonymous use case: `get_access_invite`, `get_admin_invite`, and `get_public_gym_join_options`.
- `hybridone_auth_journey_test_membership_role` is callable by `anon` and `authenticated`, but its body explicitly checks the JWT role is `service_role`. The grant is still unnecessary and should be restricted as defense in depth. That change is isolated in the separate PR A.
- Several authenticated-only functions are appropriately exposed to signed-in users and then perform gym membership, owner/admin, staff-permission, or self-user checks inside the body.

This report does **not** change any grants or functions.

## Audit table

| Function | Current callers | What it does | Caller check inside body | Does anon really need EXECUTE? |
|---|---|---|---|---|
| `approve_admin_access` | anon, authenticated | Activates pending admin access and marks matching invite approved. | **Yes** — requires current caller to be an Owner via `private.has_gym_role`. | **No.** Owner action; anonymous callers cannot satisfy the role check. |
| `approve_email_owner_invite` | anon, authenticated | Records an Owner approval for an emailed Owner invite and opens it once the approval threshold is met. | **Yes** — Owner role check; approval recorded against `auth.uid()`. | **No.** |
| `approve_ownership_action` | anon, authenticated | Approves a pending ownership action and invokes the ownership-action executor. | **Yes** — Owner role check against the action's gym. | **No.** |
| `approve_pending_access` | anon, authenticated | Approves pending Admin access or routes pending Owner access through the ownership workflow. | **Yes** — Owner role check. | **No.** |
| `approve_shareable_owner_invite` | anon, authenticated | Records Owner approval for a shareable Owner invite and generates the token once all Owners approve. | **Yes** — Owner role check; approval tied to `auth.uid()`. | **No.** |
| `assign_staff_access_level` | authenticated | Assigns an active staff/coach account to a configured access level and copies its permissions. | **Yes** — Owner/Admin or `manage_staff` permission. | No — anon is not currently granted. |
| `book_class_session` | authenticated | Books the signed-in member into a class, enforcing membership entitlement, capacity and reserved-space rules. | **Yes** — explicit authentication plus active gym write/membership checks; booking tied to `auth.uid()`. | No — anon is not currently granted. |
| `cancel_class_booking` | authenticated | Cancels the signed-in member's own class booking. | **Yes** — explicit authentication, gym write check, and row restricted to `auth.uid()`. | No — anon is not currently granted. |
| `claim_access_invite` | anon, authenticated | Accepts an access invite for the currently signed-in user and creates/updates gym membership. | **Yes** — explicitly rejects `auth.uid() is null`; also verifies the signed-in user's email matches the invite. | **No.** The body requires authentication, so anon EXECUTE adds no useful capability. |
| `claim_admin_invite` | anon, authenticated | Accepts an Admin invite for the signed-in user. | **Yes** — explicitly requires authentication and validates invite/user identity. | **No.** |
| `create_access_invite` | anon, authenticated | Creates a gym access invite and token. | **Yes** — explicit authentication plus Owner role check. | **No.** |
| `create_admin_invite` | anon, authenticated | Creates an Admin invite and token. | **Yes** — explicit authentication plus Owner role check. | **No.** |
| `create_email_access_invite` | anon, authenticated | Creates an email-delivered access invite, including Owner approval handling where needed. | **Yes** — explicit authentication plus Owner role check. | **No.** |
| `create_shareable_access_invite` | anon, authenticated | Creates a shareable-link access invite and handles Owner approval requirements. | **Yes** — explicit authentication plus Owner role check. | **No.** |
| `create_training_group` | authenticated | Creates a training group and adds the caller as its initial member/owner. | **Yes** — requires `auth.uid()` and active writable gym membership. | No — anon is not currently granted. |
| `create_training_group_challenge` | authenticated | Creates a challenge within a training group. | **Yes** — requires signed-in caller, active gym access, and group ownership/membership conditions in the body. | No — anon is not currently granted. |
| `create_validated_class_session` | authenticated | Creates a class session after validating schedule, staff, resources, capacity and related rules. | **Yes** — Owner/Admin gym-role check. | No — anon is not currently granted. |
| `delete_admin_invite` | anon, authenticated | Deletes/revokes an unapproved Admin/Owner invite and cleans pending access where applicable. | **Yes** — Owner role check for the invite's gym. | **No.** |
| `get_access_invite` | anon, authenticated | Returns invite details when presented with the matching invite token hash. | **No user/role check.** Possession of the high-entropy invite token is the access gate. | **Likely yes.** This supports viewing an invite landing page before sign-in. Keep only if that public preview is intentional. |
| `get_admin_invite` | anon, authenticated | Returns Admin-invite details by invite token. | **No user/role check.** Token possession is the gate. | **Likely yes.** Same public invite-preview rationale; verify the legacy/admin invite flow is still required. |
| `get_class_booking_options` | authenticated | Returns whether the member's plan includes the class, any paid drop-in state, drop-in price and upgrade plans. | **Yes** — explicit authentication and gym membership check. | No — anon is not currently granted. |
| `get_class_calendar` | authenticated | Returns the member-facing class calendar, availability, booking state and reserved-plan information. | **Yes** — query is gated by `private.is_gym_member(p_gym_id)` and uses `auth.uid()` for member-specific data. | No — anon is not currently granted. |
| `get_gym_team_accounts` | authenticated | Returns non-member team accounts, including email, display name, role and access status. | **Yes** — explicit active Owner/Admin membership check. | No — anon is not currently granted. |
| `get_member_home_settings` | authenticated | Returns member-home layout and CTA configuration for a gym. | **Yes** — explicit authentication and active gym membership check. | No — anon is not currently granted. |
| `get_my_training_groups` | authenticated | Returns training groups the caller belongs to within the selected gym. | **Yes** — joins groups to `auth.uid()` and requires active gym membership. | No — anon is not currently granted. |
| `get_public_gym_join_options` | anon, authenticated | Returns public gym details and public membership plans for a gym slug. | **No caller check**, intentionally reads only public join information. | **Yes, if public gym signup/join pages remain supported.** This is the clearest legitimate anonymous SECURITY DEFINER RPC. |
| `get_training_group_dashboard` | authenticated | Returns group details/dashboard data for a training-group member. | **Yes** — requires signed-in caller and membership of the group. | No — anon is not currently granted. |
| `hybridone_auth_journey_test_membership_role` | anon, authenticated | Test-only helper that creates/changes/removes fixture memberships for the Auth browser journey. | **Yes** — explicitly requires JWT role `service_role`. | **No.** PR A removes anon/authenticated EXECUTE and leaves service_role. |
| `join_public_gym_with_membership` | authenticated | Enrols the signed-in user into a public gym/membership plan. | **Yes** — requires `auth.uid()`; validates gym/plan and current membership state. | No — anon is not currently granted. |
| `join_training_group_by_code` | authenticated | Joins the signed-in member to a training group using an invite code. | **Yes** — authentication and active writable gym membership check. | No — anon is not currently granted. |
| `member_book_class` | authenticated | Member-facing class booking RPC. | **Yes** — explicit authentication, gym membership/write check, capacity and entitlement checks. | No — anon is not currently granted. |
| `member_cancel_class` | authenticated | Member-facing cancellation of the caller's class booking. | **Yes** — explicit authentication and gym membership/write check; affects caller's booking. | No — anon is not currently granted. |
| `member_class_schedule` | authenticated | Returns class schedule and caller-specific booking state for a gym. | **Yes** — explicit authentication and active gym membership check. | No — anon is not currently granted. |
| `prepare_class_drop_in_purchase` | authenticated | Prepares/returns a pending drop-in class purchase when a membership does not already include access. | **Yes** — authentication plus active gym membership/write check. | No — anon is not currently granted. |
| `preview_training_group_invite` | authenticated | Previews training-group invite details for a signed-in user. | **Yes** — explicitly requires authentication; reports membership state using `auth.uid()`. | No — anon is not currently granted. |
| `propose_gym_deletion` | anon, authenticated | Creates/approves a governed gym-deletion ownership action. | **Yes** — Owner role check. | **No.** |
| `propose_owner_promotion` | anon, authenticated | Starts/approves promotion or activation of an Owner account. | **Yes** — Owner role check. | **No.** |
| `propose_owner_removal` | anon, authenticated | Starts/approves removal of an Owner while protecting the last remaining Owner. | **Yes** — Owner role check. | **No.** |
| `provision_staff_membership_with_level` | authenticated | Creates/updates staff profile, staff-access record and gym membership using a selected access level. | **Yes** — Owner/Admin or `manage_staff` permission. | No — anon is not currently granted. |
| `remove_admin_access` | anon, authenticated | Revokes an Admin's gym access and related invite status. | **Yes** — Owner role check. | **No.** |
| `remove_gym_staff_access` | authenticated | Revokes Staff/Coach access, disables staff profile and removes staff-access record. | **Yes** — explicit active Owner/Admin membership check. | No — anon is not currently granted. |
| `revoke_admin_invite` | anon, authenticated | Revokes an Admin/Owner invite and any still-pending claimed access. | **Yes** — Owner role check. | **No.** |
| `submit_training_group_challenge_result` | authenticated | Creates or updates the caller's result for an active training-group challenge. | **Yes** — authentication, active gym access and membership in the challenge's group. | No — anon is not currently granted. |
| `validate_class_schedule` | authenticated | Validates class timing, staff qualifications/working hours, resource availability and conflicts. | **Yes** — Owner/Admin gym-role check. | No — anon is not currently granted. |

## Findings

### 1. Anonymous grants are broader than the application needs

Of the **21 functions currently executable by `anon`**, only these three have a clear or plausible anonymous use case:

1. `get_access_invite` — token-based invite preview.
2. `get_admin_invite` — token-based legacy/Admin invite preview.
3. `get_public_gym_join_options` — deliberately public gym/plan discovery.

The other **18 anonymous grants appear unnecessary**. Their bodies either require a signed-in user, require Owner permissions, or in the Auth-test helper's case require the `service_role` JWT role.

This does not mean those 18 are automatically exploitable: the internal checks generally stop an anonymous caller. It means the database grant surface is wider than required and should be tightened in later, individually reviewed migrations.

### 2. PR A is a clear defense-in-depth fix

`hybridone_auth_journey_test_membership_role` already contains:

- a `SECURITY DEFINER` declaration, and
- an internal JWT-role check requiring `service_role`.

However, PostgreSQL currently still grants EXECUTE through `PUBLIC`, so both `anon` and `authenticated` can reach the function and receive the internal rejection.

That test helper has no member-facing reason to be exposed. Restricting its ACL to `service_role` matches its sibling helper and reduces exposed RPC surface without changing intended behaviour.

### 3. Token-preview functions deserve a separate privacy review

`get_access_invite` and `get_admin_invite` return invite metadata, including the invite email address, to anyone holding the token.

That may be an intentional invite-landing design, and the token is hashed at rest, but these two functions should eventually be reviewed for the minimum fields necessary before authentication. This audit does not change them.

### 4. Authenticated SECURITY DEFINER functions are not automatically unsafe

Many member/staff functions need to cross RLS boundaries in a controlled way and contain meaningful caller checks. Examples include class booking, team account management, training groups, staff provisioning and class scheduling.

The preferred hardening sequence is therefore **not** “remove SECURITY DEFINER everywhere”. It is:

1. Remove obviously unnecessary role grants.
2. Keep explicit caller authorization inside the function body.
3. Revisit whether each function truly needs SECURITY DEFINER or could safely become SECURITY INVOKER.
4. Add regression tests for the permission boundary before changing sensitive RPCs.

## Recommended next hardening work

Report only; none of the following is implemented here.

1. Merge PR A after its local rebuild check is green.
2. Create a later migration to revoke `anon` EXECUTE from the 17 additional non-test functions identified above, in small grouped changes with browser-flow coverage.
3. Verify whether both token-preview RPCs are still needed; retire the legacy one if the old invite path is no longer used.
4. Review returned invite fields and avoid exposing invite email before authentication unless the UX genuinely requires it.
5. Review authenticated-only SECURITY DEFINER functions one domain at a time (invites/ownership, classes, staff, training groups) to determine which can become SECURITY INVOKER without breaking RLS-controlled behaviour.
