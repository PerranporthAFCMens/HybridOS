# Plan terms and cancelling, part 3: the screens (2026-10-15)

- **Plan editor** (Plans): "Minimum term (months)" and "Notice to leave (days)". Blank = use the gym-wide setting, 0 = none. Any whole numbers are saved. Terms over 12 months, or notice over 30 days, show a warning (UK guidance can treat these as unfair) and never block saving. Each plan card shows its terms, or "Uses your gym-wide terms".
- **Pass terms on** (inside an existing plan with terms): "Pass these terms to current members", reason required. Existing members only receive terms that are the same or better for them; the result is said in words ("2 members now have these terms").
- **Sign-up page**: each plan shows its terms before it is chosen, the payment step repeats them, and the payment agreement (written on the server, saved word for word) now states the minimum term and the notice.
- **Member file** (Members): the old one-click Cancel is replaced by **End membership...** (today or on a last day, reason required) and, for a member with a minimum term, **Release from minimum term...** (reason required). Each member's own terms are shown. These are the staff overrides from part 1 and are kept on the record.
- **Stripe stays in step**: after a member asks to leave, staff approve or decline, a member takes a request back, or staff end a membership, the app asks `stripe-membership-sync` (part 2) to make Stripe match, so a member who has left is not billed. Where Stripe could not be told, staff see a warning saying so (the member never does).
- The member app already explained notice and term from the database's own numbers, so it now reads each member's own terms with no screen change.

Needs part 1 (database) and part 2 (`stripe-membership-sync`) live. Until the function is deployed, ending a card-paying member in HybridOne does not stop Stripe billing them (the screen warns). The edited `stripe-join` (wording) must be pasted into Supabase again to put the terms in the agreement.

Not here: staff permissions per access level (owner and admin only for now), pausing in Stripe, a scheduled safety net that re-checks Stripe overnight.
