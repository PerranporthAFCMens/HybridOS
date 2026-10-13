# Quick join, part 1: the database (no screens yet)

Version B of the sign-up review ("pay first, finish later"), built in four parts. This is part 1 and changes nothing a member
or a gym can see.

## What a gym will be able to choose (Settings, part 4)
- Join style: **Quick join** (name, date of birth and mobile, then pay) or **Full join** (everything first, exactly as today).
- Emergency contact, address: required, optional or off. Waiver: required or optional. These apply to Quick join only.
- Hold the door code until the required items are done (on by default).

## How it stays safe
- A gym with no settings row is a Full join gym, so nothing changes until a gym is switched.
- Only people who join **after** a gym switches to Quick join can be held. Existing members never lose the door code.
- Staff (owner, admin, staff, coach) always see the door code.
- Under 18 still needs a parent or guardian before paying.
- The address and emergency contact columns may now be empty; anything that is saved is checked exactly as before.

## What was added
`gym_join_settings`; `save_my_basics`, `save_my_emergency`, `save_my_address`, `get_my_ready_status`, `save_join_settings`,
`get_unfinished_members`, `get_public_gym_join_style`; `member_gaps` is style-aware; a restrictive door code policy asks
`member_may_see_door_code`.

## To switch Puffin Performance on (after the screens in part 2 are live)
Owner or admin calls `save_join_settings` (the settings screen in part 4 does this), or the SQL in the PR description.

Rollback: `supabase/rollback/20261016_drop_quick_join.sql` (refuses while anyone has paid but not given their address or emergency contact).
