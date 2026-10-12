# Member export in the member app (2026-10-12)

The member can download their own signed copy from the app: **Me → Your signed documents → Download my signed copy**.

- It hands over the copy that was made and stored at signing (terms and waiver joined into one PDF). Nothing is regenerated.
- The card shows when they signed (full date and time). If no stored copy exists yet, it says "Your signed copy is not ready yet. Ask {gym} to send it to you."
- No database or function change. It relies on the member being able to read their own `member_signatures` row and their own folder in storage (existing policies). This has not been checked against the live project; if the download fails the page shows the "not ready" message and the real error would be needed.

Files: `web/src/data/signup.ts` (`getMySignedCopies`), `web/src/member/Me.tsx`, `web/browser/member.mjs` (download equals the stored PDF).

## The classic member app (where members are today)
Members and the owner's "Member view" still use the classic page (`member.html`), not the rebuilt one, so the export was invisible there. `member-signed-copy.js` adds the same "Your signed documents" card to the classic Me/Profile page: when they signed, a **Download my signed copy** button (the stored terms and waiver joined into one PDF, using pdf-lib from the same CDN the page already uses), or the reason if there is nothing to download. No database or function change. Check: `web/browser/classic-member.mjs` (set `CDN_DIR` to local copies of the libraries where the network blocks the CDN).
