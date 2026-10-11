# Signed documents on the member's file (2026-10-11)

The member record (Members › open a person) now has a **Signed documents** section: each signature with who signed, the exact moment to the second with the UK time zone, the document versions, whether the copy was emailed (or why not), the signed PDFs, View signature, and for the team Make PDF / Send email / Resend email. It is the same row as on the Signed documents page (one shared component), filtered to this person.

- The small "Signed documents" lines inside Personal details are gone; this replaces them.
- No database change. Files: `web/src/signup/SignedDocumentItem.tsx` (new, shared), `web/src/members/MemberSignedDocuments.tsx` (new), `web/src/signup/SignedDocuments.tsx`, `web/src/data/signup.ts` (`listSignatures` can filter to one person), `web/src/members/MemberRecord.tsx`, `web/src/members/MemberDetailsCard.tsx`, `web/browser/members.mjs`.
- Roll back by reverting the PR.
