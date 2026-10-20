# HybridOne Control screens (2026-10-20)

- New screen at `/control` for the HybridOne team: every gym, per-gym add-on switches, and a log of recent changes.
- Uses only the platform functions already live (`platform_list_gyms`, `platform_set_gym_addon`, `platform_audit`) and the `platform_addons` list. No new SQL.
- Anyone who is not a platform admin gets "not allowed": the database refuses them, the screen only shows that.
- Always-on modules (Classes, Payments, Staff and access, Member app) show as locked.
- Not done yet: own address and authenticator step, billing, CRM, hiding switched-off modules inside the gym app. Gym touched: none (read/write of platform tables only).
