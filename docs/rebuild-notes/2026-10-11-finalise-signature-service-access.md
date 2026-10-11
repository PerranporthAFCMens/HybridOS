# Why no signed copy was ever made or emailed (2026-10-11)

Status: migration written; NOT applied to the live database. Needs the owner's go-ahead.

## What was wrong
`finalise-signature` runs as the project's service role. This project strips the service role's table access on purpose, so the function could not read `member_signatures`: every call failed with "permission denied for table member_signatures". The function treated that as "no such signature", so nothing was made, nothing was emailed, and no reason was recorded (it only started recording reasons after the later fixes). Found when the Signed documents page's Make PDF showed "Could not read the signature: permission denied for table member_signatures".

## The change (grants only, no data touched)
Read: `member_signatures`, `member_signature_answers`, `gym_signup_documents`, `gym_signup_questions`, and only `id` and `name` of `gyms`.
Write: only the four result columns of `member_signatures` (the two PDF paths, `emailed_at`, `email_error`).
Already allowed and unchanged: `profiles`, `gym_members`, `gym_communication_settings`.
Nobody else (signed-in members, the public) gains anything.

## How to apply (owner, Supabase SQL editor)
1. Run `supabase/migrations/20261011210000_finalise_signature_service_access.sql`.
2. Run `supabase/verification/20261011_finalise_signature_service_access_check.sql`. Every row should say `ok`.
3. On Signed documents, click Make PDF.

## Undo
`supabase/rollback/20261011_revoke_finalise_signature_service_access.sql`.
