# Money owed: "not financial" flag and report (13 October 2026)

## What it does
- A member is **not financial** while they have a **missed payment**. A payment is missed when it has not been settled and either
  - its state is `failed` or `charged_back`, or
  - it is still `pending` / `submitted` and its charge date is more than the gym's grace period ago (Settings > Payments > Late payments, 7 days unless changed, 0 to 30 offered).
- It is worked out from the payment records every time (nothing stored to go out of date). A cancelled membership with a debt still counts.
- **Reports > Money owed** (owners and admins only): total owed, how many people, how many missed payments; everyone listed biggest debt first with plan, amount, number missed and oldest date; a search box; CSV / Excel / PDF download. **Click a name** to see each payment they missed (date due, amount, what happened, the reason from the bank, how many days ago).
- Each missed payment can be marked **paid another way** (cash, bank transfer), **waived** or **written off**, with a private note, and **undone**. Who did it and when is kept.
- A red **Not financial · owes £X** chip on the member's file (owners and admins only).

## Pieces
- `supabase/migrations/20261013120000_money_owed.sql` (+ rollback, verification, `supabase/tests/money_owed.sql`):
  - `payment_settlements` (how a payment was settled and the note; owners/admins read; only the functions write; a member can never read the note)
  - `gym_payment_settings.overdue_grace_days`
  - `private.missed_payments` (the one definition), `get_gym_arrears`, `get_member_missed_payments`, `settle_missed_payment`, `reopen_missed_payment` (all refuse anyone who is not an owner or admin of that gym, by raising an error)
  - CI counts: tables 82, functions 134, policies 202, triggers 36.
- `web/src/reports/Owed.tsx`, `owed.ts`, `web/src/data/arrears.ts`, `web/src/members/NotFinancial.tsx`; tests `web/tests/owed.test.ts`, `web/browser/owed.mjs`.

## Not in this change
- Members are not stopped from booking or entering because they are not financial. This is a flag and a report only.
- A member cannot yet see their own missed payment in the app.
- Emails or reminders to people who owe.
