# Quick join: sign the terms and waiver before paying

A gym on Quick join can now ask for the terms and waiver to be read and signed **before** paying, instead of after.

- New setting `gym_join_settings.sign_before_paying` (off by default; no gym changes unless it is switched on).
- When on, the sign-up journey is plan, email code, basics, **read and sign**, then agree and pay. A gym with no documents skips the step.
- The database enforces it: `private.member_gaps` reports "signature on the terms and waiver", so joining and `stripe_begin_membership` are refused until the signature is saved. The page cannot be talked around.
- Under 18, the parent or guardian reads and signs (as before).
- After paying, the checklist shows the waiver already done; the emergency contact and address stay after paying.
- The door-code hold is a separate setting (`hold_door_code`) and is off for Puffin: the code shows as soon as the member logs in.

The migration (`20261016090000_quick_join.sql`) was edited in place, as with plan terms. Puffin's database already has the change applied; the settings screen (part 4) will expose the switch.
