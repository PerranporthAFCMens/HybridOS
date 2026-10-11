# Live database changes since the 9 October release, and what the next release must check (11 October 2026)

Written because these live changes were not recorded when they were made (AI_WORKING_RULES.md, database rules: every live change is recorded with its rollback).

## Live database changes applied by the owner in the SQL editor (all approved as exact text)
| Migration | What it did | Rollback file |
|---|---|---|
| `20261011090000_member_join_details.sql` | Address, emergency contact and parent or guardian stored per member; joining refuses until all details exist. | `supabase/rollback/20261011_drop_member_join_details.sql` |
| `20261011120000_signup_documents.sql` | Gym terms and waiver (PDF or typed), questions, signatures, signed copies, two storage buckets. | `supabase/rollback/20261011_drop_signup_documents.sql` |
| `20261011150000_acceptance_text_longer.sql` | Tick-box wording allowed up to 2,000 characters. | `supabase/rollback/20261011_acceptance_text_300.sql` |
| `20261011180000_member_details_edit_and_privacy.sql` | Staff can edit a member's details; owner chooses whether the team sees mobile numbers and addresses; mobile number moved off `profiles`; date of birth and gender no longer readable by other members; the older `members` contact table team-only. | `supabase/rollback/20261011_drop_member_details_edit_and_privacy.sql` (proven to restore the catalog exactly) |
| `20261011200000_join_display_name.sql` | A new member's display name becomes "First Last" when it was empty or an email address; one-off repair of profiles already showing an email. Applied 11 October 2026 (evening); check query all `ok`. The "before" listing was not taken (no real information lost: emails stay on the login account). | `supabase/rollback/20261011_restore_join_display_name.sql` (restores the function only; repaired names are not restored) |
| `20261011210000_finalise_signature_service_access.sql` | Grants only: the signed-copy function's service role can read signatures, answers, sign-up documents and questions, and write the four result columns. Applied 11 October 2026 (evening). Check: four rows `ok`; the gyms row said WRONG because the live service role could already read every gyms column (live grants differ from the baseline file). Make PDF and Send email then worked. | `supabase/rollback/20261011_revoke_finalise_signature_service_access.sql` |

## Known gap until the next production release (owner decision, 11 October 2026: leave the lock on; no one is using the live site)
The live site (`main`) still runs the old pages. Four of them read date of birth and gender straight from the `profiles` table, which the last migration closes: the old owner dashboard member list (`index.html`), the old member app (`member.html`), the account menu (`account-menu.js`) and old reports (`reporting.html`). Until the release they show gaps (missing names or blank ages), they do not crash. The fixed versions are on `dev` and go live with the release. If the live site is needed before then, the quick undo of just this gap is `grant select on public.profiles to authenticated;` (it reopens date of birth and gender to fellow members, as before).

## What the next release carries
140 files, 6,500 lines since the 9 October release: member sign-up journey and per-gym join link, terms and waiver with signatures and emailed copies, birthdays, income-by-class chart, clean addresses (no `/next/`, no `#`), personal details on the member record with editing, the owner's visibility setting, member privacy, and the every-day-of-the-week check. `vercel.json` gains the clean-address rewrites, so the production routing check must pass.

## Before the release (owner and builder)
1. Real end-to-end sign-up on the dev site, on a phone: both signed PDFs arrive by email and open from Settings, Sign-up process, Who has signed; the member's record shows their details.
2. Supabase: the allowed redirect addresses include `<site>/join/<gym>`.
3. Old pages on the dev site: account menu name, old owner dashboard member list, old reports ages.
4. Lift the production hold (its own PR), four gates on that exact commit, rollback tag first, run the release, check the exact SHA and the live site on a phone, then restore the hold.
