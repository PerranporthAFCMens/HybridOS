# Sign-in "Back to HybridOne" link on the dev preview (2026-10-29)

Found during the customer-journey check. On the dev preview (site root `/HybridOS/`) the "Back to HybridOne" button on the sign-in page pointed at `/HybridOS/HybridOS/`, which is a 404, because the in-app router added the site root a second time.

Fix: `LinkButton` treats an address that already starts with the site root as an ordinary link. Live (`/`) behaviour is unchanged. Touches no database, no gym data.

Rest of the journey (invite link, sign-up, membership, class booking, auth emails return links, privacy/data-deletion) checked: no other broken links. Browser checks run: invite, signin, join, join-pay, quick-join, membership, member, member-home, member-pack-buy, member-waitlist, classes, authreturn, all pass.
