# The member file as a page (2026-10-11)

Design decision (owner, 11 October 2026): everything about a person lives on their member file, in one place, visible when it opens. No separate lists of signed documents, no Make PDF or Resend buttons.

## What changed
- A member's file is now a page at `/members/<id>` (it was a pop-up). The Members list opens it; Back returns to the list.
- Layout: name, role and status chips; a summary strip (plan, status, member since); left column personal details, membership and assigning a membership; right column Signed agreements and customer lifecycle. One column on a phone.
- **Signed agreements** shows each signing in full: the exact time to the second (UK time zone), who signed (and as parent or guardian), the document title and version, what they agreed to, their answers, their signature, and whether the signed copy was emailed (or why not).
- Removed: the Signed documents page and its button on Members, its entry in Settings, the "Who has signed" card in Settings › Sign-up process, and the small signed-document lines inside Personal details. The Signed documents report PR and the member-file-section PR were closed unmerged.
- Kept: the automatic signed copy email at sign-up, the membership number plan, and `makeSignedCopies` in the data layer for the Export PDF step.

## Not in this change
- Export PDF (next step): one combined PDF of the file, built when clicked.
- Membership number, do-not-market chip and recent activity (shown in the design sketch, not built yet).

## Files
`web/src/members/MemberFile.tsx` (was `MemberRecord.tsx`), `MemberAgreements.tsx` (new), `MemberDetailsCard.tsx`, `Members.tsx`, `members.css`; `web/src/data/signup.ts`; `web/src/app/App.tsx`; `web/src/shell/Shell.tsx` (Back goes to Members from a member file), `legacy.ts`; `web/src/staff/Settings.tsx`; `web/src/signup/SignupProcess.tsx`, `calc.ts`, `signup.css`, and `SignedDocuments.tsx` removed; `vercel.json`; tests and browser checks. No database change.

Roll back by reverting the PR.
