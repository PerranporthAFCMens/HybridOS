# Restore the production hold after the 18 October release

Gym touched: none.

- Release c85b018f1c29c8f35330a813107c7a5e887cc683 was promoted to main on 18 October 2026 (previous production tagged `prod-2026-10-18-203200` for rollback).
- This puts `release_gate` back to `production_hold: true` and `production_promotion_allowed: false`, as after the 11 October release.
- The "Manual production release" workflow has been disabled again by the owner.
