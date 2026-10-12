# Member export in the member app (2026-10-12)

The member can download their own signed copy from the app: **Me → Your signed documents → Download my signed copy**.

- It hands over the copy that was made and stored at signing (terms and waiver joined into one PDF). Nothing is regenerated.
- The card shows when they signed (full date and time). If no stored copy exists yet, it says "Your signed copy is not ready yet. Ask {gym} to send it to you."
- No database or function change. It relies on the member being able to read their own `member_signatures` row and their own folder in storage (existing policies). This has not been checked against the live project; if the download fails the page shows the "not ready" message and the real error would be needed.

Files: `web/src/data/signup.ts` (`getMySignedCopies`), `web/src/member/Me.tsx`, `web/browser/member.mjs` (download equals the stored PDF).

## Follow-up: the card is always shown
The first version hid the whole card when the account had no signed record (or the lookup failed), so it looked like the feature was missing. The card now always appears on Me and says which case it is: loading, could not load (with the real error), no signed documents on this account, or the download button.
