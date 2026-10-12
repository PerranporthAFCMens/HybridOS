# Member file: Download PDF and Send to customer (2026-10-12)

Two buttons at the top of a member's file.

- **Download PDF** hands over the signed copy that was made when they signed: the original record, never rebuilt. If a signing has two documents (terms and waiver) their stored copies are put together in one PDF, page for page as they were made; one copy is handed over untouched. If, unusually, the copy was never made, it is made then (one click, no separate step) and then handed over. It is named `<gym>-<name>-signed-copy-<signing date>.pdf`.
- **Send to customer** asks first, then asks `finalise-signature` to email the most recent signing's signed copies to the address on the person's account. Disabled when they have signed nothing.

Owner decision (12 October 2026): since the signed copy is already made and kept at signing, Download must not generate anything new. The first version built a fresh PDF of the whole file in the browser; that was removed.

Legal position agreed with the owner (not legal advice): the evidence is the complete signing record plus the signed copy made at the moment of signing, kept with the record on the same keep-and-delete schedule.

Not here: the member's own Export in the member app (next), and a log of who sent what. Details such as phone and address are on the file itself; they are not part of the signed copy.

Files: `web/src/members/signedCopy.ts` (new), `MemberFile.tsx`, `members.css`, `web/src/data/signup.ts` (the signing carries its stored paths), `web/src/reports/download.ts` (`save` exported), `web/package.json` and lock (`pdf-lib` is now a normal dependency, loaded only when two copies are joined), `web/tests/signedcopy.test.ts` (new), `web/browser/members.mjs`. No database change and no Edge Function change. Roll back by reverting the PR.
