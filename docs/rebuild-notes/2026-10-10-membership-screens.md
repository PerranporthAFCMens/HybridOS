# Membership screens (rules, requests, member pause / change / cancel)

Builds the screens on the membership rules database work (`20261010150000_membership_rules.sql`, already applied).

## Admin
- **Settings › Membership rules** (`#/membership-rules`): pausing, cancelling and changing plan. Everything starts off. Each rule says whether the gym approves each request or it happens automatically.
- **Settings › Membership requests** (`#/membership-requests`): waiting requests with Approve / Decline and an optional note; the last 60 days underneath.
- **Plans**: new tick "Members can switch to this plan themselves". Members can only move between plans with this ticked.

## Member (`#/m/membership`, from Me › Pause, change or cancel)
- Shows only what the gym has switched on; if nothing is, it says to ask at the gym.
- Pause: dates, reason chips, notice/length checked first (the database repeats every check).
- Change plan: the plans the gym allows, with price and start date.
- Cancel: offers a pause first (if the gym wants that), shows the last day and any early fee, asks why (optional).
- Pending or accepted requests can be withdrawn.

## Also in this change
- Workouts: a set can now be removed as well as added (the last one stays).

## Limits
- Billing (GoCardless) is not connected: someone at the gym stops/restarts the direct debit. Fees are recorded, not collected.
- No new SQL in this change.
