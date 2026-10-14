# New staff choose their own password (14 October 2026)

**Decision (owner):** a new staff login should not have a temporary password the owner reads out. The person clicks a link in the welcome email and chooses their own.

**How it works now**
1. "Add staff login" calls `admin-create-staff-with-level`. A new login is made with a long random password that nobody sees (not returned, not shown, not emailed). Someone who already had a HybridOne login keeps their password and is just given the role.
2. The screen then calls `notify-staff-welcome`. For a person who has never signed in it makes a one-time recovery link (the same kind as "Forgot password?") with the service role and puts it straight into the email as the "Choose your password" button. The link is never returned to the owner's browser. It lands on `auth-return.html?mode=recovery` ("Choose a new password", at least 8 characters), after which they continue to the staff app. Someone who has signed in before gets the ordinary welcome with the sign-in link.
3. If the link has run out, the person uses "Forgot password?" on the sign-in page, or the owner presses **Send welcome** on their row in Staff (a new link, one send per person per minute). If the link cannot be made, the ordinary welcome goes instead, which still gets them in.

**Deployed to the live project on 14 October 2026 (JWT required, both):** `notify-staff-welcome` v2 and `admin-create-staff-with-level` v7 (its first copy in the repository; it was live-only before).
**Undo:** `supabase/rollback/20261014_admin-create-staff-with-level_v6.ts` is the previous login-creation function exactly as it was; deploy it to go back to temporary passwords (the screen copes with both).
**Also fixed in passing:** the lookup of an existing login read only the first 1000 users, so it would have failed for a staff member's address once there were more people than that on HybridOne; it now reads every page.

**Settings only the owner can change in the Supabase dashboard (Authentication)**
- Email link lifetime: Supabase's default is 1 hour. For a welcome link 24 hours is kinder (Authentication, Providers, Email: "Email OTP expiration"; the maximum is 24 hours).
- **Leaked password protection is OFF** (the security advisor flags it). It stops anyone choosing a password found in known breaches (HaveIBeenPwned). Authentication, Attack Protection. It may need a paid Supabase plan.

**Roles:** staff and coaches use the staff app. Owners and admins land in the admin panel and run everything. Someone who should run the whole gym (a senior manager) is added as an **admin** under Owners and admins, not as staff. The Staff page now says so and links there.
