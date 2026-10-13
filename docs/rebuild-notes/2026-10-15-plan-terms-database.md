# Plan terms and cancelling, part 1: the database (2026-10-15)

Builds on the existing membership rules (pause, cancel, change plan), it does not replace them.

- **Per-plan terms.** `membership_plans.min_term_months` and `notice_days` (both optional). A plan with nothing set uses the gym-wide rule in Settings > Membership rules, as before. Any values are accepted (term 0-60 months, notice 0-365 days); the screen will only warn about long terms.
- **Terms travel with the member.** A new membership copies its plan's terms (`memberships.term_months` / `notice_days`). Blank means "the gym-wide rule, live". Editing a plan later changes nothing for existing members.
- **Cancelling uses the member's own terms**, else the gym-wide rule (`request_membership_cancel`, `get_my_membership_options`). Early-leaver behaviour (wait, or pay a fee) is still the gym-wide setting.
- **Staff overrides**, owner or admin only, a reason is required and recorded in `membership_staff_actions`:
  - `staff_end_membership(membership, last_day, reason)`: ends it today (last_day blank) or on a date, ignoring term and notice, and replaces any cancellation the member had asked for.
  - `staff_release_from_term(membership, reason)`: removes the minimum term for one member.
  - `apply_plan_terms_to_members(plan, reason)`: passes a plan's terms to its existing members, only where the same or better for them (shorter or equal term and notice). Worse terms are never applied to existing members.
- **Shown before paying.** `get_public_gym_join_options` and `stripe_join_context` carry each plan's terms (own, else the gym rule when the gym has one).

Not in this part: the plan editor fields, the join page wording, the member app text, the staff buttons, and telling Stripe to stop billing when a membership ends (next parts). Until Stripe is told, ending a Stripe member here does not stop their card being charged. Staff permissions per access level (who may override) come with discounts permissions; for now owner or admin only.

Owner steps after merge: run `20261015090000_plan_terms.sql`, then `20261015091000_plan_terms_functions.sql`, then the check `supabase/verification/20261015_plan_terms_check.sql` (every row `ok`).
