# Signed copies: make the PDFs, keep them, email them

After a member signs (`sign_gym_documents`), the join page asks the edge function `finalise-signature` (file `supabase/functions/finalise-signature/index.ts`) to do the rest. It is called with the member's own sign-in and only ever acts on that member's own signature.

**What it does**
1. Reads the signature, the gym, the documents that were signed, their questions and the member's answers.
2. Makes one signed PDF per document: the gym's uploaded PDF with a signature page added, or typed wording turned into pages (gym name, title, version) plus a signature page. The signature page has the tick-box wording agreed, the questions and answers, who signed (and "as parent or guardian of ..." for under-18s), the date and time in UK time, the drawn signature, and a reference.
3. Saves the PDFs in the private `signed-documents` storage bucket at `<member id>/<gym id>/<signature id>-terms.pdf` (and `-waiver.pdf`) and records the paths on the signature, so the member and the gym's owner, admin and staff can open them (Settings › Sign-up process › Who has signed).
4. Emails both PDFs, attached, to the member through Resend. The sender is the gym's verified sender if it has one, otherwise `noreply@hybridone.co.uk` (the same rule as the sign-in emails, and the same `RESEND_API_KEY` secret). The reply-to is the gym's reply-to if set.

**Failure handling:** the signature is already saved before this runs, so a failure never stops anyone joining. If the email fails, the reason is written to `member_signatures.email_error` (shown in the who-has-signed list) and the PDFs stay saved. Running it again for the same signature rebuilds the PDFs and tries the email again; it will not send twice once `emailed_at` is set.

**Not done:** a button for staff to re-send a copy (the function only accepts the member's own sign-in); the email text is fixed (not per-gym).
