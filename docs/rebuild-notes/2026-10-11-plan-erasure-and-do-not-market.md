# Plan: erasing a member (right to be forgotten) and "do not market" (2026-10-11)

Status: PLAN ONLY. Nothing is built. Owner approval needed before any code or database change.
This is not legal advice. The final design and the privacy-policy wording should be checked by someone qualified.

## Owner decisions so far
- Erase personal data; keep what the law lets us keep; keep reports adding up.
- Keep the signed waiver/terms and billing records, WITH the person's name, so they stay searchable, in a separate owner-only archive.
- Keep them for 6 years after the member leaves (longer for anyone who signed under 18). Delete automatically at the end. (Owner has agreed 6 years; the under-18 period still to be confirmed with the insurer.)
- A "do not market" flag. It stops marketing only. Staff may still contact the member for genuine reasons.
- Explicit and irreversible: owner only, typed confirmation, a permanent log with no personal details.

## Part A: Erase a member
Three groups.
1. Erased at once: profile, contact details, address, date of birth, photo, bio, emergency contact, posts, comments, reactions, workouts, personal bests, bookings, notifications and preferences, calendar links, Strava data and tokens, training-group entries, membership requests, and the sign-in account (when no other gym still holds the person).
2. Kept in the owner-only Legal records archive until the retention date: signed waiver and terms (PDF, signature, signer name, date and time, document version) and billing and payment records (name, amount, date, plan). Searchable by name and date; opening a record is logged.
3. Kept anonymous: counts and totals for reports, with the member shown as "Erased member <reference>".

How it runs
- One all-or-nothing database function, owner only, scoped to one gym.
- The owner sees exactly what will be erased and kept, types the member's full name, and ticks a permanent-action box.
- A permanent erasure log: date, gym, who asked, reference, counts. No personal data.
- A scheduled job deletes archive records past their retention date.
- A test fails if a table holding personal data is not handled by the erasure, so it cannot go stale.
- Files: signed-documents and avatar storage removed or moved to the restricted archive bucket.
- Signing-in account deleted by an Edge Function (needs the service key), only after the last gym has erased the person.

Out of our control (stated in the policy): emails already sent stay in Resend's logs for a limited time; backups age out on the provider's schedule.

## Part B: Do not market
- One flag per member. Blocks marketing only. Service messages (cancellations, payment problems, membership changes, safety, signed copies, replies) and genuine phone calls are allowed.
- Set by the member in the app, by an unsubscribe link in marketing email, or by staff on request (who, when and how recorded).
- Every message sent from the system is labelled marketing or service; marketing is the default. The block is enforced on the server for marketing only.
- Member record shows a "Do not market" badge; staff still see phone and email.
- Survives erasure as a minimal suppression entry so the person is not marketed to again.
- Report: how many on the flag, and who set it and when. A report of service messages by sender, so mislabelling can be spotted.
- NOTE: the app does not yet have bulk marketing messages (communications today only sets up the sender and the invite email). The flag, badge, member control and unsubscribe are built now; server enforcement attaches to the first bulk-send feature.

## Part C: Active members by default, and automatic anonymising after 2 years
Today the Members tab lists every gym user (members and team) with a "Show" filter of all / members / team and a name-only search. There is no active/inactive split.

- The Members tab shows only people with a current (active) membership by default, plus the team.
- A "Show" choice for former members (anyone whose membership has ended, expired, or been cancelled) and a search that reaches them, so details can be pulled when needed. Search covers name, and later email, phone and date range.
- Sorting: newest/oldest and A-Z/Z-A, in both lists.
- Automatic anonymising: when someone has been inactive for 2 years, a scheduled job runs the SAME erasure as Part A (personal details erased; waiver, terms and billing kept in the owner-only archive until their retention date; anonymous counts kept). The member record then reads "Erased member <reference>".
- Safeguards: a warning shown on the former-member record from about 60 days before; the owner can pause or exclude someone (for example during a dispute or claim); every automatic run is written to the same permanent erasure log, marked "automatic".
- "Inactive for 2 years" (owner confirmed): the clock runs from the LATER of the end of their last membership period and their last activity in the system (a class booking or a check-in). Signing in alone is not counted unless the owner says so.

## Proposed order (each its own PR, owner approves each)
1. Do-not-market flag and member control, badge, report (database change + app).
2. Legal records archive: where waivers and billing are kept after erasure, with search (database change + app).
3. Erasure function, owner screen, log, test, and the retention clean-up job (database change + Edge Function + app).
4. Members tab: active by default, former-member search and sorting (app only, no database change expected).
5. Automatic anonymising after 2 years inactive (database job; depends on step 3).
6. Policy and deletion-page wording updated to match.

Every database change comes with a rollback file, a verification script, a note recording it, and a stop for owner approval before it is applied. Expected size: each step touches more than five files, so each will be listed before it is built.

## Still to confirm
- Retention for anyone who signed while under 18 (insurer or solicitor).
- Whether members can also request erasure themselves from the app (owner approves) or only gym owners start it.
