# Plan: membership numbers for everyone, built to scale (2026-10-11)

Status: PLAN ONLY. Nothing is built. Every database change below needs owner approval before it runs, with a rollback file and a check.

## Why
- Display names are not unique ("John Smith"), change, and for people who joined through the sign-up link are currently their email address (bug; fixed first, see order below).
- A stable number lets staff find one person, ties a signed waiver, a payment and an erasure record to one person, and survives name changes.

## Design
1. One number per person per gym, for everyone who belongs to the gym: members, owners, admins, staff, coaches, PTs. It sits on the person's place in the gym (`gym_members`), not on the person, so gyms never see across each other.
2. The number never encodes the role. Roles change (a member becomes a coach; a PT also trains). The role is shown as a tag beside the number and used as a filter.
3. Never changes, never reused, even after the person leaves or is erased. Gaps are fine.
4. Stored as a plain integer (`member_no`). The display form is built when shown: the gym's short prefix plus the number padded to at least six digits (PP-000123). A seventh digit simply widens it, so there is no ceiling to hit. Prefix and padding can change later without touching any stored number.
5. Each gym has a short prefix (2 to 4 letters, from its name, owner can see it). Fixed once members exist; changing it later is a deliberate, recorded action, because printed cards and emails carry the old one.
6. Unique per gym (`unique (gym_id, member_no)`), enforced by the database, not the app.

## Built to scale
- Assignment is done by the database, atomically, by a trigger when someone is added to a gym, so every way in (sign-up link, invite, staff adding someone, claiming an invite) gets a number and the app cannot forget. A per-gym counter row is incremented under a row lock, so two people joining at the same moment get different numbers (a test fires many joins at once and checks no duplicates).
- Existing people are numbered once, oldest first, in batches.
- Search by number or name is done by the database with indexes (gym and number; name search with a trigram index) and paged, not by loading everyone into the browser. Today the Members page and Signed documents page load the whole list (signatures up to 1,000). Moving both to database search with paging is part of this work, so a gym with thousands of people stays quick.
- Only the person themself and that gym's owners, admins and staff can read a number. No other member can.

## Where it shows
Members list and search, member record, Signed documents (and stamped on every signed PDF), reports and exports, the Legal records archive, the erasure log (an erased member remains as "Erased member PP-000123", no personal details), and the door or check-in screen.

## Not doing
- No check digit and no role letters in the number.
- No number shared across gyms.
- The door QR code, when built, carries a signed token, not the bare number.

## Order (each its own PR, owner approves each database change)
1. Display-name fix (small): new joiners stop showing as their email; repair of people already showing an email.
2. Membership numbers: counter and prefix, trigger, numbering of existing people, a function to look someone up by number, tests including the simultaneous-join test, rollback and check.
3. Show the number: members list, record, signed documents, signed PDF stamp, reports.
4. Database search and paging for Members and Signed documents.
5. Later, using the number: erasure log, Legal records archive, door.

## Decisions for the owner
- Prefix style (letters from the gym name) and minimum width (six digits).
- Prefix fixed once members exist (recommended).
