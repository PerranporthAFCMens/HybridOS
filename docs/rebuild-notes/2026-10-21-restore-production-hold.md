# Restore the production hold after the 20 October release

Gym touched: none.

- Release 2b707e3f1a5ecd11495600abb99a3628a77eb7b9 was promoted to main on 21 October 2026 (Manual production release run 236).
- This puts `release_gate` back to `production_hold: true` and `production_promotion_allowed: false`, as after the 18 October release.
- The "Manual production release" workflow has been disabled again by the owner.
