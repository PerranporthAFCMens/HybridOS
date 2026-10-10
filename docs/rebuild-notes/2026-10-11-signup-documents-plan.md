# Gym terms and waiver, signed at sign-up: plan (SQL for approval, not applied)

Owner decisions: the gym uploads its own terms and its own waiver as PDFs; the member signs by drawing their signature and typing their full name; the two documents go in one email, with the signed copies attached; Resend sends the email; the signed copies are also kept in the database's storage.

## Journey
In the join journey the old "Terms and health declaration" step becomes "Read and sign": each current PDF is shown (with an open-in-new-tab link), the member types their full name, draws their signature, ticks "I have read and agree" and signs once for both. For an under-18 the signer is the parent or guardian (the step says so). After signing, the server stamps each PDF with a signature page (typed name, drawn signature, date and time, document title and version), stores the signed copies, and emails both to the member. Joining is refused until the member has signed the gym's CURRENT versions. If the gym uploads a new version, existing members are not locked out; only new joiners and anyone asked to re-sign see it.

## Gym side: Settings, "Sign-up process"
Upload or replace the Terms PDF and the Waiver PDF (each optional, PDF only, up to 10 MB), see the current version and when it was uploaded, remove one to stop requiring it, and see who has signed (name, date, version, download the signed copy). Every old version is kept, so a signature always points at the exact document that was signed.

## Database (this SQL: `supabase/migrations/20261011120000_signup_documents.sql`)
- `gym_signup_documents`: the PDFs, one current per kind, all old versions kept. Written only through `add_gym_signup_document` / `remove_gym_signup_document` (owner or admin).
- `member_signatures`: who signed which versions, typed name, drawn signature (PNG, stored in the row), whether the signer is a guardian, paths of the signed copies, when it was emailed. Written only through `sign_gym_documents`; the server fills in the paths and email time.
- Storage `gym-signup-documents` (public read PDFs; owner or admin writes inside their own gym's folder) and `signed-documents` (private; the member and the gym's owner, admin and staff read; only the server writes).
- `private.member_gaps` now needs a signature on every current document, so `join_public_gym_with_membership` refuses without it.
- The typed-wording tables from the previous SQL (`gyms.terms_text`, `member_declarations`) stay for now, unused, and are dropped in a later clean-up.

## Build order (each its own PR)
1. This SQL (approve, apply, check).
2. Gym settings: "Sign-up process" page (upload, versions, who has signed).
3. Join journey: the "Read and sign" step with the signature pad (replaces the typed terms step in #203).
4. Edge function `finalise-signature`: stamps and stores the signed PDFs, emails them through Resend, marks the row. A failed email does not stop the join; it is recorded and can be re-sent from the gym's list.
5. Staff "missing details" list and the clean `/join/<slug>` link with a copy button.

## What the owner needs to do for the email
Create a Resend account, verify the gym's sending address or domain, and add two settings to the Supabase project's Edge Function secrets: `RESEND_API_KEY` and `SIGNED_DOCS_FROM` (the "from" address). Nothing is sent until those exist; the join still works, and the copy is saved and can be sent later.

## Decisions to note
- Signature image is stored in the database row (about 5 to 40 KB), the signed PDFs in storage. Both are kept for as long as the member's record.
- A drawn signature plus typed name, date, time and exact document version is a normal electronic signature for a gym waiver. Whether a particular clause is enforceable is for the gym's own solicitor; this system only records what was signed, when, and by whom.
