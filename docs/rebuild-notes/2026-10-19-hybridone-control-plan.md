# HybridOne Control: the business panel (plan and step 1 SQL, 19 October 2026)

Owner request (19 October): a HybridOne **business panel** that controls the add-on switches and manages HybridOne's own customers: **billing and CRM**. Built **before** create-a-gym and the Enterprise manager.

## Who and where
- Platform administrators only (a short list, separate from any gym role). Gyms and head office never see it.
- Suggested home: its own address (for example `control.hybridone.co.uk`) with its own sign-in. **Decision needed from the owner**; step 1 does not depend on it.

## Steps (each is its own PR, each SQL step approved by the owner first)
1. **Platform foundation (this PR, SQL drafted, nothing applied):** platform admin list, add-on catalogue, per-gym add-on switches, audit log, and the functions to list gyms and switch an add-on. `supabase/migrations/20261019100000_platform_foundation.sql` (rollback `supabase/rollback/20261019_drop_platform_foundation.sql`).
2. **Control screens (no SQL):** sign-in for platform admins, "All gyms" list, one gym's add-on switches, audit log.
3. **Gating:** the gym app reads `my_gym_addons` to hide menus; each important module gets its own database rule calling `gym_addon_enabled`, module by module.
4. **Billing (new SQL, needs decisions below):** plan and price per gym, billing status, invoices/payments record, linked to HybridOne's own Stripe account (separate from the gyms' Stripe Connect accounts).
5. **CRM (new SQL):** contacts per gym (owner, billing contact), notes, stage (lead, trial, customer, churned), follow-up dates.
6. **Create-a-gym**, then the **Enterprise manager** (organisations and head-office roles).

## Step 1 in plain English
- Anyone signed in can read the **names** of the add-ons. Only platform admins can switch them or see the gym list and the audit log.
- Optional add-ons default to **on** for every existing gym, so nothing disappears when this is applied. Always-on modules (Classes, Payments, Staff and access, Member app) cannot be switched off.
- A switch is not security by itself; step 3 adds database rules module by module.
- After applying, the owner adds themselves once as a platform admin (statement at the bottom of the migration; it uses your sign-in email, which is why it is not in the public file's data).
- Gym: touches no gym's data. Use Puffin Performance to try switching on the test gym first.

## Questions for the owner
1. Home address and sign-in for the panel (own address with its own login is the suggestion).
2. Does HybridOne bill gyms monthly per plan, per add-on, or per member? Which Stripe account, and invoices by Stripe or by HybridOne?
3. CRM: which fields matter (contact, stage, notes, next follow-up, plan, renewal date)? Email/ticket history later?
4. Who besides the owner gets platform access, and view-only or change?
5. Add-on list: is the draft list in the migration right, and which are always on?
