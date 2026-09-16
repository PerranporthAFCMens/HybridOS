# Hybrid OS

Hybrid OS is a multi-gym membership and community platform.

## Product direction

The platform is being built so that multiple independent gyms can use the same software while keeping their data securely separated.

Initial product areas:

- Multi-gym tenancy
- Member accounts and social login
- Member profiles and avatars
- Membership plans and status
- GoCardless integration for recurring payments
- Staff/admin roles
- Gym community channels and messaging
- Future class booking, attendance and reporting

## Backend

Supabase project: `Hybrid OS`

Project ref: `mzgnhmeydhhpzgxlgudh`

Region: London (`eu-west-2`)

The initial database includes:

- `gyms`
- `profiles`
- `gym_members`
- `membership_plans`
- `memberships`
- `channels`
- `channel_members`
- `messages`

Row Level Security is enabled across all public application tables. Multi-tenant checks are handled through private helper functions so one gym cannot access another gym's data.

## Security principles

- Never commit Supabase secret/service-role keys.
- Frontend code may use only the Supabase publishable key.
- All public application tables must have RLS enabled.
- Authorization must be based on protected membership/role data, not user-editable profile metadata.
- Payment card/bank details will remain with the payment provider rather than being stored directly in Hybrid OS.

## Environments

For now this repository and Supabase project are the development environment. Before live customer data is introduced, production and development should be separated.
