# Signed documents list (2026-10-11)

A page at `/signed-documents` (Members › Signed documents, and Settings › Members) listing everyone who has signed the gym's terms and waiver.

- Search by member or signer name; sort newest, oldest, A to Z, Z to A. Up to 1,000 signatures are loaded and searched in the browser; a server-side search is the next step if a gym passes that.
- Each row shows who signed (and as a parent or guardian when that applies), the exact moment to the second with the UK time zone, the document versions, and whether the copy was emailed (or why not).
- "View signature" opens the saved signature image and what they agreed to. The image is fetched only when a row is opened.
- "Terms PDF" and "Waiver PDF" open the signed copies where they exist. Rows with none say "No PDF made yet". Making the PDF from this page is the next PR.
- Settings › Sign-up process keeps the documents, questions and sign-up link; its long "Who has signed" list is now a count and a link.
- No database change. Files: `web/src/signup/SignedDocuments.tsx` (new), `signup.css`, `calc.ts`, `web/src/data/signup.ts`, `web/src/app/App.tsx`, `web/src/shell/legacy.ts`, `web/src/members/Members.tsx`, `members.css`, `web/src/signup/SignupProcess.tsx`, `web/src/staff/Settings.tsx`, `vercel.json`, `web/tests/signup.test.ts`, `web/browser/signed-documents.mjs`, `web/browser/signup.mjs`, `web/package.json`.
- Roll back by reverting the PR.

## Make PDF and Resend email (follow-up PR)
- Rows with no PDF get a "Make PDF" button. Rows that have one get "Send email" (never emailed) or "Resend email".
- `finalise-signature` now also accepts an owner, admin or staff member of the same gym. Staff asking only for the copies get the PDFs made and saved with nothing emailed and the email record untouched; the email is sent only when `send_email: true` is asked for, to the member's own address. `resend: true` sends again after a previous send.
- The member's own call right after signing is unchanged.
- The function change takes effect only when `finalise-signature` is redeployed in Supabase. It could not be run here (no Deno): it was syntax-checked only. First live use is the real test.
- Roll back by reverting the PR and redeploying the function.
