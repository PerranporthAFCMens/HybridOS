# Member file PDF: Download PDF and Send to customer (2026-10-12)

Two buttons at the top of a member's file.

- **Download PDF** builds a PDF in the browser from what is on screen (details, membership, signed agreements with exact times, answers and signature, gym name, when it was made) and saves it as `<gym>-<name>-member-file-<date>.pdf`. It never goes to a server. It shows only what that person is allowed to see: a mobile number or address the owner hid from the team stays hidden. It says it is a copy.
- **Send to customer** asks first, then asks `finalise-signature` to email the most recent signing's signed copies to the address on the person's account (`send_email` and `resend`). Nothing is built in the browser for this. Disabled when they have signed nothing.

Legal position agreed with the owner (not legal advice; see the chat for sources): the evidence is the complete signing record plus the signed copy made at the moment of signing, which stays with the record. Anything else is generated fresh on request and labelled as a copy.

Not here: the member's own Export in the member app (next), a log of who sent what.

Files: `web/src/members/filePdf.ts` (new), `MemberFile.tsx`, `members.css`, `web/src/reports/download.ts` (`save` exported), `web/tests/memberfilepdf.test.ts` (new), `web/browser/members.mjs`. No database change and no Edge Function change. Roll back by reverting the PR.
