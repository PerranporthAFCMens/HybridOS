-- HybridOne current-state schema baseline
-- Generated 2026-09-30 from read-only PostgreSQL catalog metadata.
-- Schema and permissions only. No live table rows, user data, tokens or secrets.
-- This migration is for fresh/local databases only. NEVER apply it to the live HybridOne project.

create schema if not exists private;

create extension if not exists "pg_stat_statements" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "supabase_vault" with schema "vault";
create extension if not exists "uuid-ossp" with schema "extensions";

create type public.gym_member_role as enum ('owner', 'admin', 'staff', 'coach', 'member');
create type public.membership_status as enum ('pending', 'active', 'paused', 'cancelled', 'expired');
create type public.payment_provider as enum ('gocardless', 'manual', 'other');
create type public.payment_state as enum ('pending', 'submitted', 'confirmed', 'paid_out', 'failed', 'cancelled', 'charged_back', 'refunded');
create type public.provider_connection_status as enum ('not_connected', 'pending', 'connected', 'error', 'revoked');

create sequence private.strava_webhook_events_id_seq increment by 1 minvalue 1 no maxvalue start with 1 cache 1 no cycle;

create table private.gocardless_webhook_events (
  id uuid default gen_random_uuid() not null,
  event_key text,
  resource_type text,
  action text,
  resource_id text,
  gym_id uuid,
  payload jsonb not null,
  processed_at timestamp with time zone,
  processing_error text,
  created_at timestamp with time zone default now() not null,
  constraint gocardless_webhook_events_event_key_key UNIQUE (event_key),
  constraint gocardless_webhook_events_pkey PRIMARY KEY (id)
);

create table private.strava_oauth_states (
  state text not null,
  gym_id uuid not null,
  user_id uuid not null,
  redirect_to text,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default now() not null,
  constraint strava_oauth_states_pkey PRIMARY KEY (state)
);

create table private.strava_tokens (
  connection_id uuid not null,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamp with time zone not null,
  updated_at timestamp with time zone default now() not null,
  constraint strava_tokens_pkey PRIMARY KEY (connection_id)
);

create table private.strava_webhook_events (
  id bigint default nextval('private.strava_webhook_events_id_seq'::regclass) not null,
  subscription_id bigint,
  owner_id bigint,
  object_id bigint,
  object_type text,
  aspect_type text,
  event_time bigint,
  updates jsonb,
  payload jsonb not null,
  received_at timestamp with time zone default now() not null,
  processed_at timestamp with time zone,
  processing_error text,
  constraint strava_webhook_events_pkey PRIMARY KEY (id)
);

create table public.calendar_feed_tokens (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  user_id uuid not null,
  token uuid default gen_random_uuid() not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint calendar_feed_tokens_gym_id_user_id_key UNIQUE (gym_id, user_id),
  constraint calendar_feed_tokens_pkey PRIMARY KEY (id),
  constraint calendar_feed_tokens_token_key UNIQUE (token)
);

create table public.capabilities (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  name text not null,
  description text,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint capabilities_gym_id_name_key UNIQUE (gym_id, name),
  constraint capabilities_pkey PRIMARY KEY (id)
);

create table public.channel_members (
  channel_id uuid not null,
  user_id uuid not null,
  joined_at timestamp with time zone default now() not null,
  constraint channel_members_pkey PRIMARY KEY (channel_id, user_id)
);

create table public.channels (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  name text not null,
  description text,
  is_private boolean default false not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  constraint channels_gym_id_name_key UNIQUE (gym_id, name),
  constraint channels_pkey PRIMARY KEY (id)
);

create table public.class_booking_purchases (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  session_id uuid not null,
  user_id uuid not null,
  amount_pence integer not null,
  currency text default 'GBP'::text not null,
  status text default 'pending'::text not null,
  provider_payment_id text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint class_booking_purchases_amount_pence_check CHECK (amount_pence >= 0),
  constraint class_booking_purchases_pkey PRIMARY KEY (id),
  constraint class_booking_purchases_status_check CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'cancelled'::text, 'refunded'::text]))
);

create table public.class_bookings (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  session_id uuid not null,
  user_id uuid not null,
  status text default 'booked'::text not null,
  booked_at timestamp with time zone default now() not null,
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint class_bookings_pkey PRIMARY KEY (id),
  constraint class_bookings_session_id_user_id_key UNIQUE (session_id, user_id),
  constraint class_bookings_status_check CHECK (status = ANY (ARRAY['booked'::text, 'cancelled'::text, 'attended'::text, 'no_show'::text]))
);

create table public.class_session_reserved_plans (
  session_id uuid not null,
  plan_id uuid not null,
  constraint class_session_reserved_plans_pkey PRIMARY KEY (session_id, plan_id)
);

create table public.class_session_resources (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  session_id uuid not null,
  resource_id uuid not null,
  quantity integer default 1 not null,
  created_at timestamp with time zone default now() not null,
  constraint class_session_resources_pkey PRIMARY KEY (id),
  constraint class_session_resources_quantity_check CHECK (quantity > 0),
  constraint class_session_resources_session_id_resource_id_key UNIQUE (session_id, resource_id)
);

create table public.class_session_staff (
  id uuid default gen_random_uuid() not null,
  session_id uuid not null,
  gym_id uuid not null,
  user_id uuid not null,
  assignment_role text default 'coach'::text not null,
  is_lead boolean default false not null,
  created_at timestamp with time zone default now() not null,
  constraint class_session_staff_assignment_role_check CHECK (assignment_role = ANY (ARRAY['coach'::text, 'assistant'::text, 'staff'::text])),
  constraint class_session_staff_pkey PRIMARY KEY (id),
  constraint class_session_staff_session_id_user_id_key UNIQUE (session_id, user_id)
);

create table public.class_sessions (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  class_type_id uuid,
  name text not null,
  description text,
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  capacity integer not null,
  reserved_capacity integer default 0 not null,
  reserved_release_minutes_before integer,
  coach_user_id uuid,
  is_cancelled boolean default false not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  drop_in_price_pence integer,
  constraint class_sessions_capacity_check CHECK (capacity > 0),
  constraint class_sessions_check CHECK (reserved_capacity >= 0 AND reserved_capacity <= capacity),
  constraint class_sessions_check1 CHECK (ends_at > starts_at),
  constraint class_sessions_drop_in_price_pence_check CHECK (drop_in_price_pence IS NULL OR drop_in_price_pence >= 0),
  constraint class_sessions_pkey PRIMARY KEY (id),
  constraint class_sessions_reserved_release_minutes_before_check CHECK (reserved_release_minutes_before IS NULL OR reserved_release_minutes_before >= 0)
);

create table public.class_types (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  name text not null,
  description text,
  duration_minutes integer default 60 not null,
  default_capacity integer default 20 not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  difficulty_level text default 'all_levels'::text not null,
  drop_in_price_pence integer,
  constraint class_types_default_capacity_check CHECK (default_capacity > 0),
  constraint class_types_difficulty_level_check CHECK (difficulty_level = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text, 'all_levels'::text])),
  constraint class_types_drop_in_price_pence_check CHECK (drop_in_price_pence IS NULL OR drop_in_price_pence >= 0),
  constraint class_types_duration_minutes_check CHECK (duration_minutes >= 5 AND duration_minutes <= 480),
  constraint class_types_pkey PRIMARY KEY (id)
);

create table public.gym_access_invite_approvals (
  invite_id uuid not null,
  owner_user_id uuid not null,
  approved_at timestamp with time zone default now() not null,
  constraint gym_access_invite_approvals_pkey PRIMARY KEY (invite_id, owner_user_id)
);

create table public.gym_access_settings (
  gym_id uuid not null,
  access_enabled boolean default false not null,
  access_code text,
  member_label text default 'Door access'::text not null,
  member_note text,
  updated_at timestamp with time zone default now() not null,
  updated_by uuid,
  constraint gym_access_settings_pkey PRIMARY KEY (gym_id)
);

create table public.gym_admin_invites (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  email text not null,
  token_hash text not null,
  status text default 'open'::text not null,
  created_by uuid not null,
  claimed_by uuid,
  created_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone not null,
  claimed_at timestamp with time zone,
  approved_at timestamp with time zone,
  revoked_at timestamp with time zone,
  invite_role text default 'admin'::text not null,
  email_sent_at timestamp with time zone,
  delivery_method text,
  constraint gym_admin_invites_delivery_method_check CHECK (delivery_method IS NULL OR (delivery_method = ANY (ARRAY['email'::text, 'link'::text]))),
  constraint gym_admin_invites_pkey PRIMARY KEY (id),
  constraint gym_admin_invites_role_check CHECK (invite_role = ANY (ARRAY['admin'::text, 'owner'::text])),
  constraint gym_admin_invites_status_check CHECK (status = ANY (ARRAY['awaiting_approval'::text, 'open'::text, 'claimed'::text, 'approved'::text, 'revoked'::text, 'expired'::text])),
  constraint gym_admin_invites_token_hash_key UNIQUE (token_hash)
);

create table public.gym_communication_settings (
  gym_id uuid not null,
  sender_name text,
  reply_to_email text,
  accent_color text default '#0b1020'::text not null,
  logo_url text,
  footer_text text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  sender_email text,
  sender_domain_status text default 'unverified'::text not null,
  constraint gym_communication_settings_pkey PRIMARY KEY (gym_id),
  constraint gym_communication_settings_sender_domain_status_check CHECK (sender_domain_status = ANY (ARRAY['unverified'::text, 'pending'::text, 'verified'::text, 'failed'::text]))
);

create table public.gym_email_templates (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  template_key text not null,
  category text default 'transactional'::text not null,
  template_name text not null,
  subject text not null,
  preheader text,
  heading text not null,
  body_text text not null,
  button_label text,
  enabled boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint gym_email_templates_category_check CHECK (category = ANY (ARRAY['transactional'::text, 'marketing'::text])),
  constraint gym_email_templates_gym_id_template_key_key UNIQUE (gym_id, template_key),
  constraint gym_email_templates_pkey PRIMARY KEY (id)
);

create table public.gym_member_view_settings (
  gym_id uuid not null,
  home_layout jsonb default '[{"key": "goal", "visible": true}, {"key": "progress", "visible": true}, {"key": "activity", "visible": true}, {"key": "hero", "visible": true}, {"key": "upcoming_count", "visible": true}, {"key": "next_classes", "visible": true}, {"key": "membership", "visible": true}, {"key": "booked_classes", "visible": true}, {"key": "pt", "visible": true}]'::jsonb not null,
  updated_at timestamp with time zone default now() not null,
  updated_by uuid,
  cta_config jsonb default jsonb_build_object('enabled', true, 'eyebrow', 'YOUR TRAINING HUB', 'title', 'Keep your training moving', 'body', 'Track your week, log workouts and keep your progress in one place.', 'primary_label', 'Log workout', 'primary_target', 'workouts', 'secondary_label', 'View classes', 'secondary_target', 'classes') not null,
  constraint gym_member_view_settings_pkey PRIMARY KEY (gym_id)
);

create table public.gym_members (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  user_id uuid not null,
  role gym_member_role default 'member'::gym_member_role not null,
  is_active boolean default true not null,
  joined_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  attrition_on date,
  access_status text default 'active'::text not null,
  approved_by uuid,
  approved_at timestamp with time zone,
  access_revoked_at timestamp with time zone,
  constraint gym_members_access_status_check CHECK (access_status = ANY (ARRAY['pending'::text, 'active'::text, 'revoked'::text])),
  constraint gym_members_attrition_after_joined CHECK (attrition_on IS NULL OR attrition_on >= joined_at::date),
  constraint gym_members_gym_id_user_id_key UNIQUE (gym_id, user_id),
  constraint gym_members_pkey PRIMARY KEY (id)
);

create table public.gym_ownership_action_approvals (
  action_id uuid not null,
  owner_user_id uuid not null,
  approved_at timestamp with time zone default now() not null,
  constraint gym_ownership_action_approvals_pkey PRIMARY KEY (action_id, owner_user_id)
);

create table public.gym_ownership_actions (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  action_type text not null,
  target_user_id uuid,
  created_by uuid not null,
  status text default 'pending'::text not null,
  created_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone default (now() + '14 days'::interval) not null,
  executed_at timestamp with time zone,
  constraint gym_ownership_actions_action_type_check CHECK (action_type = ANY (ARRAY['activate_owner'::text, 'promote_owner'::text, 'remove_owner'::text, 'delete_gym'::text])),
  constraint gym_ownership_actions_pkey PRIMARY KEY (id),
  constraint gym_ownership_actions_status_check CHECK (status = ANY (ARRAY['pending'::text, 'executed'::text, 'cancelled'::text, 'expired'::text]))
);

create table public.gyms (
  id uuid default gen_random_uuid() not null,
  name text not null,
  slug text not null,
  timezone text default 'Europe/London'::text not null,
  country_code text default 'GB'::text not null,
  currency text default 'GBP'::text not null,
  logo_url text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  created_by uuid,
  constraint gyms_pkey PRIMARY KEY (id),
  constraint gyms_slug_key UNIQUE (slug)
);

create table public.member_notifications (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  user_id uuid not null,
  notification_type text not null,
  title text not null,
  body text,
  related_session_id uuid,
  scheduled_for timestamp with time zone default now() not null,
  delivered_at timestamp with time zone,
  read_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  related_post_id uuid,
  related_comment_id uuid,
  constraint member_notifications_pkey PRIMARY KEY (id)
);

create table public.member_training_preferences (
  gym_id uuid not null,
  user_id uuid not null,
  weekly_goal smallint default 3 not null,
  updated_at timestamp with time zone default now() not null,
  constraint member_training_preferences_pkey PRIMARY KEY (gym_id, user_id),
  constraint member_training_preferences_weekly_goal_check CHECK (weekly_goal >= 1 AND weekly_goal <= 14)
);

create table public.members (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  user_id uuid,
  first_name text,
  last_name text,
  display_name text not null,
  email text,
  phone text,
  status text default 'active'::text not null,
  joined_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint members_gym_id_user_id_key UNIQUE (gym_id, user_id),
  constraint members_phone_e164_check CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{6,14}$'::text),
  constraint members_pkey PRIMARY KEY (id),
  constraint members_status_check CHECK (status = ANY (ARRAY['active'::text, 'paused'::text, 'cancelled'::text, 'prospect'::text]))
);

create table public.membership_plans (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  name text not null,
  description text,
  price_pence integer not null,
  billing_interval text default 'monthly'::text not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  joining_fee_pence integer default 0 not null,
  access_type text default 'hybrid'::text not null,
  includes_open_gym boolean default true not null,
  includes_classes boolean default true not null,
  includes_pt boolean default false not null,
  classes_per_week integer,
  trial_days integer default 0 not null,
  is_public boolean default true not null,
  constraint membership_plans_access_type_check CHECK (access_type = ANY (ARRAY['gym'::text, 'classes'::text, 'hybrid'::text, 'pt'::text, 'custom'::text])),
  constraint membership_plans_billing_interval_check CHECK (billing_interval = ANY (ARRAY['weekly'::text, 'monthly'::text, 'quarterly'::text, 'annual'::text, 'one_off'::text])),
  constraint membership_plans_classes_per_week_check CHECK (classes_per_week IS NULL OR classes_per_week >= 0),
  constraint membership_plans_joining_fee_pence_check CHECK (joining_fee_pence >= 0),
  constraint membership_plans_pkey PRIMARY KEY (id),
  constraint membership_plans_price_pence_check CHECK (price_pence >= 0),
  constraint membership_plans_trial_days_check CHECK (trial_days >= 0)
);

create table public.memberships (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  user_id uuid,
  plan_id uuid,
  status membership_status default 'pending'::membership_status not null,
  starts_on date,
  ends_on date,
  payment_provider payment_provider,
  provider_customer_id text,
  provider_mandate_id text,
  provider_subscription_id text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  provider_status text,
  provider_last_synced_at timestamp with time zone,
  payment_status payment_state default 'pending'::payment_state not null,
  member_id uuid,
  constraint memberships_pkey PRIMARY KEY (id)
);

create table public.messages (
  id uuid default gen_random_uuid() not null,
  channel_id uuid not null,
  sender_id uuid not null,
  body text not null,
  created_at timestamp with time zone default now() not null,
  edited_at timestamp with time zone,
  constraint messages_body_check CHECK (char_length(body) >= 1 AND char_length(body) <= 5000),
  constraint messages_pkey PRIMARY KEY (id)
);

create table public.notification_preferences (
  gym_id uuid not null,
  user_id uuid not null,
  booking_confirmation boolean default true not null,
  class_reminders boolean default true not null,
  reminder_minutes integer default 60 not null,
  push_enabled boolean default false not null,
  calendar_sync_enabled boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  social_notifications boolean default true not null,
  constraint notification_preferences_pkey PRIMARY KEY (gym_id, user_id),
  constraint notification_preferences_reminder_minutes_check CHECK (reminder_minutes >= 5 AND reminder_minutes <= 10080)
);

create table public.payment_provider_connections (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  provider payment_provider not null,
  status provider_connection_status default 'not_connected'::provider_connection_status not null,
  environment text default 'sandbox'::text not null,
  external_account_id text,
  external_creditor_id text,
  connected_at timestamp with time zone,
  last_synced_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint payment_provider_connections_environment_check CHECK (environment = ANY (ARRAY['sandbox'::text, 'live'::text])),
  constraint payment_provider_connections_gym_id_provider_key UNIQUE (gym_id, provider),
  constraint payment_provider_connections_pkey PRIMARY KEY (id)
);

create table public.payment_records (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  membership_id uuid,
  user_id uuid,
  provider payment_provider default 'gocardless'::payment_provider not null,
  provider_payment_id text,
  provider_customer_id text,
  provider_mandate_id text,
  provider_subscription_id text,
  amount_pence integer not null,
  currency text default 'GBP'::text not null,
  state payment_state default 'pending'::payment_state not null,
  charge_date date,
  paid_out_at timestamp with time zone,
  failure_code text,
  failure_message text,
  provider_created_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint payment_records_amount_pence_check CHECK (amount_pence >= 0),
  constraint payment_records_pkey PRIMARY KEY (id)
);

create table public.personal_bests (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  user_id uuid not null,
  exercise_name text not null,
  exercise_key text generated always as (lower(TRIM(BOTH FROM exercise_name))) stored,
  metric_type text not null,
  comparison_direction text default 'higher'::text not null,
  value_numeric numeric not null,
  unit text,
  achieved_at timestamp with time zone default now() not null,
  workout_set_id uuid,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint personal_bests_comparison_direction_check CHECK (comparison_direction = ANY (ARRAY['higher'::text, 'lower'::text])),
  constraint personal_bests_gym_id_user_id_exercise_key_metric_type_key UNIQUE (gym_id, user_id, exercise_key, metric_type),
  constraint personal_bests_metric_type_check CHECK (metric_type = ANY (ARRAY['weight'::text, 'reps'::text, 'time'::text, 'distance'::text, 'calories'::text, 'custom'::text])),
  constraint personal_bests_pkey PRIMARY KEY (id)
);

create table public.profiles (
  id uuid not null,
  first_name text,
  last_name text,
  display_name text,
  avatar_url text,
  bio text,
  phone text,
  date_of_birth date,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  gender text,
  constraint profiles_gender_allowed CHECK (gender IS NULL OR (gender = ANY (ARRAY['female'::text, 'male'::text, 'non_binary'::text, 'other'::text, 'prefer_not_to_say'::text]))),
  constraint profiles_phone_e164_check CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{6,14}$'::text),
  constraint profiles_pkey PRIMARY KEY (id)
);

create table public.pt_appointments (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  staff_user_id uuid not null,
  member_user_id uuid,
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  status text default 'booked'::text not null,
  notes text,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint pt_appointments_check CHECK (ends_at > starts_at),
  constraint pt_appointments_pkey PRIMARY KEY (id),
  constraint pt_appointments_status_check CHECK (status = ANY (ARRAY['booked'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text]))
);

create table public.resource_availability (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  resource_id uuid not null,
  weekday smallint not null,
  start_time time without time zone not null,
  end_time time without time zone not null,
  is_available boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint resource_availability_check CHECK (end_time > start_time),
  constraint resource_availability_pkey PRIMARY KEY (id),
  constraint resource_availability_resource_id_weekday_key UNIQUE (resource_id, weekday),
  constraint resource_availability_weekday_check CHECK (weekday >= 0 AND weekday <= 6)
);

create table public.resources (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  name text not null,
  resource_type text default 'room'::text not null,
  capacity integer,
  is_bookable boolean default true not null,
  allow_overlap boolean default false not null,
  notes text,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint resources_capacity_check CHECK (capacity IS NULL OR capacity > 0),
  constraint resources_gym_id_name_key UNIQUE (gym_id, name),
  constraint resources_pkey PRIMARY KEY (id),
  constraint resources_resource_type_check CHECK (resource_type = ANY (ARRAY['room'::text, 'area'::text, 'equipment'::text, 'other'::text]))
);

create table public.service_requirements (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  class_type_id uuid not null,
  capability_id uuid,
  resource_id uuid,
  quantity integer default 1 not null,
  created_at timestamp with time zone default now() not null,
  constraint service_requirements_check CHECK ((capability_id IS NOT NULL) <> (resource_id IS NOT NULL)),
  constraint service_requirements_pkey PRIMARY KEY (id),
  constraint service_requirements_quantity_check CHECK (quantity > 0)
);

create table public.social_comments (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  post_id uuid not null,
  user_id uuid not null,
  parent_comment_id uuid,
  body text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint social_comments_body_check CHECK (char_length(TRIM(BOTH FROM body)) >= 1 AND char_length(TRIM(BOTH FROM body)) <= 2000),
  constraint social_comments_pkey PRIMARY KEY (id)
);

create table public.social_posts (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  user_id uuid not null,
  body text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint social_posts_body_check CHECK (char_length(TRIM(BOTH FROM body)) >= 1 AND char_length(TRIM(BOTH FROM body)) <= 5000),
  constraint social_posts_pkey PRIMARY KEY (id)
);

create table public.social_reactions (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  user_id uuid not null,
  post_id uuid,
  comment_id uuid,
  reaction text default 'like'::text not null,
  created_at timestamp with time zone default now() not null,
  constraint social_reaction_one_target CHECK ((post_id IS NOT NULL) <> (comment_id IS NOT NULL)),
  constraint social_reactions_pkey PRIMARY KEY (id),
  constraint social_reactions_reaction_check CHECK (reaction = ANY (ARRAY['like'::text, 'heart'::text, 'laugh'::text]))
);

create table public.staff_access (
  gym_id uuid not null,
  user_id uuid not null,
  preset text default 'coach'::text not null,
  permissions jsonb default '{}'::jsonb not null,
  updated_at timestamp with time zone default now() not null,
  updated_by uuid,
  access_level_id uuid not null,
  constraint staff_access_pkey PRIMARY KEY (gym_id, user_id)
);

create table public.staff_access_levels (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  name text not null,
  description text,
  permissions jsonb default '{}'::jsonb not null,
  is_active boolean default true not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint staff_access_levels_pkey PRIMARY KEY (id)
);

create table public.staff_capabilities (
  gym_id uuid not null,
  user_id uuid not null,
  capability_id uuid not null,
  qualified boolean default true not null,
  expires_on date,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint staff_capabilities_pkey PRIMARY KEY (gym_id, user_id, capability_id)
);

create table public.staff_profiles (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  user_id uuid not null,
  job_title text,
  gross_hourly_rate_pence integer,
  employment_type text default 'hourly'::text not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint staff_profiles_employment_type_check CHECK (employment_type = ANY (ARRAY['hourly'::text, 'salary'::text, 'contractor'::text, 'volunteer'::text])),
  constraint staff_profiles_gross_hourly_rate_pence_check CHECK (gross_hourly_rate_pence IS NULL OR gross_hourly_rate_pence >= 0),
  constraint staff_profiles_gym_id_user_id_key UNIQUE (gym_id, user_id),
  constraint staff_profiles_pkey PRIMARY KEY (id)
);

create table public.staff_working_hours (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  user_id uuid not null,
  weekday smallint not null,
  start_time time without time zone,
  end_time time without time zone,
  is_working boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint staff_working_hours_check CHECK (is_working = false OR start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time),
  constraint staff_working_hours_gym_id_user_id_weekday_key UNIQUE (gym_id, user_id, weekday),
  constraint staff_working_hours_pkey PRIMARY KEY (id),
  constraint staff_working_hours_weekday_check CHECK (weekday >= 0 AND weekday <= 6)
);

create table public.strava_activities (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  user_id uuid not null,
  athlete_id bigint not null,
  strava_activity_id bigint not null,
  name text not null,
  sport_type text,
  activity_type text,
  started_at timestamp with time zone not null,
  elapsed_seconds integer,
  moving_seconds integer,
  distance_m numeric,
  elevation_gain_m numeric,
  calories numeric,
  average_speed_mps numeric,
  max_speed_mps numeric,
  average_heartrate numeric,
  max_heartrate numeric,
  source_visibility text,
  workout_session_id uuid,
  raw_summary jsonb,
  imported_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint strava_activities_pkey PRIMARY KEY (id),
  constraint strava_activities_user_id_strava_activity_id_key UNIQUE (user_id, strava_activity_id)
);

create table public.strava_connections (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  user_id uuid not null,
  athlete_id bigint not null,
  athlete_username text,
  athlete_first_name text,
  athlete_last_name text,
  profile_url text,
  scopes text[] default '{}'::text[] not null,
  status text default 'connected'::text not null,
  connected_at timestamp with time zone default now() not null,
  last_synced_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint strava_connections_athlete_id_key UNIQUE (athlete_id),
  constraint strava_connections_gym_id_user_id_key UNIQUE (gym_id, user_id),
  constraint strava_connections_pkey PRIMARY KEY (id),
  constraint strava_connections_status_check CHECK (status = ANY (ARRAY['connected'::text, 'disconnected'::text, 'revoked'::text, 'error'::text]))
);

create table public.training_group_challenge_entries (
  challenge_id uuid not null,
  user_id uuid not null,
  value_numeric numeric not null,
  note text,
  submitted_at timestamp with time zone default now() not null,
  constraint training_group_challenge_entries_pkey PRIMARY KEY (challenge_id, user_id)
);

create table public.training_group_challenges (
  id uuid default gen_random_uuid() not null,
  group_id uuid not null,
  created_by uuid not null,
  name text not null,
  activity_name text not null,
  metric_type text not null,
  unit text,
  comparison_direction text default 'higher'::text not null,
  starts_at timestamp with time zone default now() not null,
  ends_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  constraint training_group_challenges_comparison_direction_check CHECK (comparison_direction = ANY (ARRAY['higher'::text, 'lower'::text])),
  constraint training_group_challenges_metric_type_check CHECK (metric_type = ANY (ARRAY['weight'::text, 'reps'::text, 'time'::text, 'distance'::text, 'calories'::text, 'custom'::text])),
  constraint training_group_challenges_name_check CHECK (char_length(TRIM(BOTH FROM name)) >= 2 AND char_length(TRIM(BOTH FROM name)) <= 100),
  constraint training_group_challenges_pkey PRIMARY KEY (id)
);

create table public.training_group_members (
  group_id uuid not null,
  user_id uuid not null,
  joined_at timestamp with time zone default now() not null,
  constraint training_group_members_pkey PRIMARY KEY (group_id, user_id)
);

create table public.training_groups (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  owner_user_id uuid not null,
  name text not null,
  description text,
  invite_code text not null,
  created_at timestamp with time zone default now() not null,
  constraint training_groups_invite_code_key UNIQUE (invite_code),
  constraint training_groups_name_check CHECK (char_length(TRIM(BOTH FROM name)) >= 2 AND char_length(TRIM(BOTH FROM name)) <= 80),
  constraint training_groups_pkey PRIMARY KEY (id)
);

create table public.workout_assignments (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  template_id uuid,
  member_user_id uuid not null,
  assigned_by uuid,
  source text not null,
  title text not null,
  workout_type text default 'strength'::text not null,
  focus_tags text[] default '{}'::text[] not null,
  workout_snapshot jsonb default '{}'::jsonb not null,
  scheduled_for date,
  due_at timestamp with time zone,
  status text default 'todo'::text not null,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  member_rpe numeric,
  member_notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint workout_assignments_member_rpe_check CHECK (member_rpe IS NULL OR member_rpe >= 1::numeric AND member_rpe <= 10::numeric),
  constraint workout_assignments_pkey PRIMARY KEY (id),
  constraint workout_assignments_source_check CHECK (source = ANY (ARRAY['self'::text, 'pt'::text, 'wod'::text])),
  constraint workout_assignments_status_check CHECK (status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'completed'::text, 'skipped'::text]))
);

create table public.workout_entries (
  id uuid default gen_random_uuid() not null,
  session_id uuid not null,
  gym_id uuid not null,
  user_id uuid not null,
  exercise_name text not null,
  tracking_type text default 'strength'::text not null,
  "position" integer default 0 not null,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint workout_entries_pkey PRIMARY KEY (id),
  constraint workout_entries_tracking_type_check CHECK (tracking_type = ANY (ARRAY['strength'::text, 'time'::text, 'distance'::text, 'calories'::text, 'custom'::text]))
);

create table public.workout_sessions (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  user_id uuid not null,
  title text,
  performed_at timestamp with time zone default now() not null,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint workout_sessions_pkey PRIMARY KEY (id)
);

create table public.workout_sets (
  id uuid default gen_random_uuid() not null,
  entry_id uuid not null,
  set_number integer not null,
  reps integer,
  weight_kg numeric(8,2),
  duration_seconds integer,
  distance_m numeric(10,2),
  calories numeric(10,2),
  custom_value numeric(12,3),
  custom_unit text,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint workout_sets_calories_check CHECK (calories IS NULL OR calories >= 0::numeric),
  constraint workout_sets_distance_m_check CHECK (distance_m IS NULL OR distance_m >= 0::numeric),
  constraint workout_sets_duration_seconds_check CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  constraint workout_sets_entry_id_set_number_key UNIQUE (entry_id, set_number),
  constraint workout_sets_pkey PRIMARY KEY (id),
  constraint workout_sets_reps_check CHECK (reps IS NULL OR reps >= 0),
  constraint workout_sets_set_number_check CHECK (set_number > 0),
  constraint workout_sets_weight_kg_check CHECK (weight_kg IS NULL OR weight_kg >= 0::numeric)
);

create table public.workout_template_activities (
  id uuid default gen_random_uuid() not null,
  block_id uuid not null,
  template_id uuid not null,
  gym_id uuid not null,
  activity_name text not null,
  activity_type text default 'exercise'::text not null,
  tracking_type text default 'strength'::text not null,
  "position" integer default 0 not null,
  prescription jsonb default '{}'::jsonb not null,
  notes text,
  created_at timestamp with time zone default now() not null,
  constraint workout_template_activities_pkey PRIMARY KEY (id)
);

create table public.workout_template_blocks (
  id uuid default gen_random_uuid() not null,
  template_id uuid not null,
  gym_id uuid not null,
  title text not null,
  block_type text default 'standard'::text not null,
  "position" integer default 0 not null,
  rounds integer,
  instructions text,
  created_at timestamp with time zone default now() not null,
  constraint workout_template_blocks_block_type_check CHECK (block_type = ANY (ARRAY['warmup'::text, 'standard'::text, 'strength'::text, 'circuit'::text, 'amrap'::text, 'emom'::text, 'for_time'::text, 'intervals'::text, 'finisher'::text, 'cooldown'::text, 'custom'::text])),
  constraint workout_template_blocks_pkey PRIMARY KEY (id),
  constraint workout_template_blocks_rounds_check CHECK (rounds IS NULL OR rounds > 0)
);

create table public.workout_templates (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  created_by uuid not null,
  title text not null,
  description text,
  workout_type text default 'strength'::text not null,
  focus_tags text[] default '{}'::text[] not null,
  estimated_minutes integer,
  visibility text default 'private'::text not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint workout_templates_estimated_minutes_check CHECK (estimated_minutes IS NULL OR estimated_minutes >= 1 AND estimated_minutes <= 600),
  constraint workout_templates_pkey PRIMARY KEY (id),
  constraint workout_templates_title_check CHECK (length(TRIM(BOTH FROM title)) >= 1 AND length(TRIM(BOTH FROM title)) <= 120),
  constraint workout_templates_visibility_check CHECK (visibility = ANY (ARRAY['private'::text, 'gym'::text])),
  constraint workout_templates_workout_type_check CHECK (workout_type = ANY (ARRAY['strength'::text, 'cardio'::text, 'conditioning'::text, 'hybrid'::text, 'mobility'::text, 'recovery'::text, 'custom'::text]))
);

create table public.workout_wods (
  id uuid default gen_random_uuid() not null,
  gym_id uuid not null,
  template_id uuid not null,
  published_by uuid not null,
  wod_date date not null,
  message text,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  constraint workout_wods_gym_id_wod_date_key UNIQUE (gym_id, wod_date),
  constraint workout_wods_pkey PRIMARY KEY (id)
);

alter sequence private.strava_webhook_events_id_seq owned by private.strava_webhook_events.id;

alter table private.gocardless_webhook_events add constraint gocardless_webhook_events_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE SET NULL;
alter table private.strava_oauth_states add constraint strava_oauth_states_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table private.strava_oauth_states add constraint strava_oauth_states_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table private.strava_tokens add constraint strava_tokens_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES strava_connections(id) ON DELETE CASCADE;
alter table public.calendar_feed_tokens add constraint calendar_feed_tokens_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.calendar_feed_tokens add constraint calendar_feed_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.capabilities add constraint capabilities_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.channel_members add constraint channel_members_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE;
alter table public.channel_members add constraint channel_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.channels add constraint channels_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.channels add constraint channels_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.class_booking_purchases add constraint class_booking_purchases_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.class_booking_purchases add constraint class_booking_purchases_session_id_fkey FOREIGN KEY (session_id) REFERENCES class_sessions(id) ON DELETE CASCADE;
alter table public.class_booking_purchases add constraint class_booking_purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.class_bookings add constraint class_bookings_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.class_bookings add constraint class_bookings_session_id_fkey FOREIGN KEY (session_id) REFERENCES class_sessions(id) ON DELETE CASCADE;
alter table public.class_bookings add constraint class_bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.class_session_reserved_plans add constraint class_session_reserved_plans_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES membership_plans(id) ON DELETE CASCADE;
alter table public.class_session_reserved_plans add constraint class_session_reserved_plans_session_id_fkey FOREIGN KEY (session_id) REFERENCES class_sessions(id) ON DELETE CASCADE;
alter table public.class_session_resources add constraint class_session_resources_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.class_session_resources add constraint class_session_resources_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE;
alter table public.class_session_resources add constraint class_session_resources_session_id_fkey FOREIGN KEY (session_id) REFERENCES class_sessions(id) ON DELETE CASCADE;
alter table public.class_session_staff add constraint class_session_staff_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.class_session_staff add constraint class_session_staff_session_id_fkey FOREIGN KEY (session_id) REFERENCES class_sessions(id) ON DELETE CASCADE;
alter table public.class_session_staff add constraint class_session_staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.class_sessions add constraint class_sessions_class_type_id_fkey FOREIGN KEY (class_type_id) REFERENCES class_types(id) ON DELETE SET NULL;
alter table public.class_sessions add constraint class_sessions_coach_user_id_fkey FOREIGN KEY (coach_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.class_sessions add constraint class_sessions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.class_sessions add constraint class_sessions_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.class_types add constraint class_types_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.gym_access_invite_approvals add constraint gym_access_invite_approvals_invite_id_fkey FOREIGN KEY (invite_id) REFERENCES gym_admin_invites(id) ON DELETE CASCADE;
alter table public.gym_access_invite_approvals add constraint gym_access_invite_approvals_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.gym_access_settings add constraint gym_access_settings_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.gym_access_settings add constraint gym_access_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);
alter table public.gym_admin_invites add constraint gym_admin_invites_claimed_by_fkey FOREIGN KEY (claimed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.gym_admin_invites add constraint gym_admin_invites_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.gym_admin_invites add constraint gym_admin_invites_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.gym_communication_settings add constraint gym_communication_settings_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.gym_email_templates add constraint gym_email_templates_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.gym_member_view_settings add constraint gym_member_view_settings_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.gym_member_view_settings add constraint gym_member_view_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);
alter table public.gym_members add constraint gym_members_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.gym_members add constraint gym_members_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.gym_members add constraint gym_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.gym_ownership_action_approvals add constraint gym_ownership_action_approvals_action_id_fkey FOREIGN KEY (action_id) REFERENCES gym_ownership_actions(id) ON DELETE CASCADE;
alter table public.gym_ownership_action_approvals add constraint gym_ownership_action_approvals_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.gym_ownership_actions add constraint gym_ownership_actions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.gym_ownership_actions add constraint gym_ownership_actions_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.gym_ownership_actions add constraint gym_ownership_actions_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.gyms add constraint gyms_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.member_notifications add constraint member_notifications_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.member_notifications add constraint member_notifications_related_comment_id_fkey FOREIGN KEY (related_comment_id) REFERENCES social_comments(id) ON DELETE CASCADE;
alter table public.member_notifications add constraint member_notifications_related_post_id_fkey FOREIGN KEY (related_post_id) REFERENCES social_posts(id) ON DELETE CASCADE;
alter table public.member_notifications add constraint member_notifications_related_session_id_fkey FOREIGN KEY (related_session_id) REFERENCES class_sessions(id) ON DELETE CASCADE;
alter table public.member_notifications add constraint member_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.members add constraint members_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.members add constraint members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.membership_plans add constraint membership_plans_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.memberships add constraint memberships_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.memberships add constraint memberships_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;
alter table public.memberships add constraint memberships_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES membership_plans(id) ON DELETE SET NULL;
alter table public.memberships add constraint memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.messages add constraint messages_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE;
alter table public.messages add constraint messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.notification_preferences add constraint notification_preferences_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.notification_preferences add constraint notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.payment_provider_connections add constraint payment_provider_connections_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.payment_records add constraint payment_records_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.payment_records add constraint payment_records_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES memberships(id) ON DELETE SET NULL;
alter table public.payment_records add constraint payment_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.personal_bests add constraint personal_bests_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.personal_bests add constraint personal_bests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.personal_bests add constraint personal_bests_workout_set_id_fkey FOREIGN KEY (workout_set_id) REFERENCES workout_sets(id) ON DELETE SET NULL;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.pt_appointments add constraint pt_appointments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.pt_appointments add constraint pt_appointments_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.pt_appointments add constraint pt_appointments_member_user_id_fkey FOREIGN KEY (member_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.pt_appointments add constraint pt_appointments_staff_user_id_fkey FOREIGN KEY (staff_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.resource_availability add constraint resource_availability_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.resource_availability add constraint resource_availability_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE;
alter table public.resources add constraint resources_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.service_requirements add constraint service_requirements_capability_id_fkey FOREIGN KEY (capability_id) REFERENCES capabilities(id) ON DELETE CASCADE;
alter table public.service_requirements add constraint service_requirements_class_type_id_fkey FOREIGN KEY (class_type_id) REFERENCES class_types(id) ON DELETE CASCADE;
alter table public.service_requirements add constraint service_requirements_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.service_requirements add constraint service_requirements_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE;
alter table public.social_comments add constraint social_comments_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.social_comments add constraint social_comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES social_comments(id) ON DELETE CASCADE;
alter table public.social_comments add constraint social_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES social_posts(id) ON DELETE CASCADE;
alter table public.social_comments add constraint social_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.social_posts add constraint social_posts_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.social_posts add constraint social_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.social_reactions add constraint social_reactions_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES social_comments(id) ON DELETE CASCADE;
alter table public.social_reactions add constraint social_reactions_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.social_reactions add constraint social_reactions_post_id_fkey FOREIGN KEY (post_id) REFERENCES social_posts(id) ON DELETE CASCADE;
alter table public.social_reactions add constraint social_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.staff_access add constraint staff_access_access_level_id_fkey FOREIGN KEY (access_level_id) REFERENCES staff_access_levels(id) ON DELETE RESTRICT;
alter table public.staff_access add constraint staff_access_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.staff_access add constraint staff_access_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);
alter table public.staff_access add constraint staff_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.staff_access_levels add constraint staff_access_levels_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.staff_access_levels add constraint staff_access_levels_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.staff_capabilities add constraint staff_capabilities_capability_id_fkey FOREIGN KEY (capability_id) REFERENCES capabilities(id) ON DELETE CASCADE;
alter table public.staff_capabilities add constraint staff_capabilities_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.staff_capabilities add constraint staff_capabilities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.staff_profiles add constraint staff_profiles_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.staff_profiles add constraint staff_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.staff_working_hours add constraint staff_working_hours_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.staff_working_hours add constraint staff_working_hours_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.strava_activities add constraint strava_activities_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.strava_activities add constraint strava_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.strava_activities add constraint strava_activities_workout_session_id_fkey FOREIGN KEY (workout_session_id) REFERENCES workout_sessions(id) ON DELETE SET NULL;
alter table public.strava_connections add constraint strava_connections_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.strava_connections add constraint strava_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.training_group_challenge_entries add constraint training_group_challenge_entries_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES training_group_challenges(id) ON DELETE CASCADE;
alter table public.training_group_challenge_entries add constraint training_group_challenge_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.training_group_challenges add constraint training_group_challenges_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.training_group_challenges add constraint training_group_challenges_group_id_fkey FOREIGN KEY (group_id) REFERENCES training_groups(id) ON DELETE CASCADE;
alter table public.training_group_members add constraint training_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES training_groups(id) ON DELETE CASCADE;
alter table public.training_group_members add constraint training_group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.training_groups add constraint training_groups_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.training_groups add constraint training_groups_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.workout_assignments add constraint workout_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.workout_assignments add constraint workout_assignments_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.workout_assignments add constraint workout_assignments_member_user_id_fkey FOREIGN KEY (member_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.workout_assignments add constraint workout_assignments_template_id_fkey FOREIGN KEY (template_id) REFERENCES workout_templates(id) ON DELETE SET NULL;
alter table public.workout_entries add constraint workout_entries_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.workout_entries add constraint workout_entries_session_id_fkey FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE;
alter table public.workout_entries add constraint workout_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.workout_sessions add constraint workout_sessions_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.workout_sessions add constraint workout_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.workout_sets add constraint workout_sets_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES workout_entries(id) ON DELETE CASCADE;
alter table public.workout_template_activities add constraint workout_template_activities_block_id_fkey FOREIGN KEY (block_id) REFERENCES workout_template_blocks(id) ON DELETE CASCADE;
alter table public.workout_template_activities add constraint workout_template_activities_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.workout_template_activities add constraint workout_template_activities_template_id_fkey FOREIGN KEY (template_id) REFERENCES workout_templates(id) ON DELETE CASCADE;
alter table public.workout_template_blocks add constraint workout_template_blocks_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.workout_template_blocks add constraint workout_template_blocks_template_id_fkey FOREIGN KEY (template_id) REFERENCES workout_templates(id) ON DELETE CASCADE;
alter table public.workout_templates add constraint workout_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
alter table public.workout_templates add constraint workout_templates_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.workout_wods add constraint workout_wods_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE;
alter table public.workout_wods add constraint workout_wods_published_by_fkey FOREIGN KEY (published_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
alter table public.workout_wods add constraint workout_wods_template_id_fkey FOREIGN KEY (template_id) REFERENCES workout_templates(id) ON DELETE CASCADE;

CREATE INDEX gocardless_webhook_gym_idx ON private.gocardless_webhook_events USING btree (gym_id);
CREATE INDEX gocardless_webhook_unprocessed_idx ON private.gocardless_webhook_events USING btree (created_at) WHERE (processed_at IS NULL);
CREATE INDEX strava_webhook_events_owner_idx ON private.strava_webhook_events USING btree (owner_id, received_at DESC);
CREATE INDEX channel_members_user_id_idx ON public.channel_members USING btree (user_id);
CREATE INDEX channels_created_by_idx ON public.channels USING btree (created_by);
CREATE UNIQUE INDEX class_booking_purchases_one_live ON public.class_booking_purchases USING btree (session_id, user_id) WHERE (status = ANY (ARRAY['pending'::text, 'paid'::text]));
CREATE INDEX class_bookings_gym_idx ON public.class_bookings USING btree (gym_id);
CREATE INDEX class_bookings_session_status_idx ON public.class_bookings USING btree (session_id, status);
CREATE INDEX class_bookings_user_idx ON public.class_bookings USING btree (user_id);
CREATE INDEX class_reserved_plans_plan_idx ON public.class_session_reserved_plans USING btree (plan_id);
CREATE INDEX class_session_staff_gym_idx ON public.class_session_staff USING btree (gym_id);
CREATE INDEX class_session_staff_session_idx ON public.class_session_staff USING btree (session_id);
CREATE INDEX class_session_staff_user_idx ON public.class_session_staff USING btree (user_id);
CREATE INDEX class_sessions_class_type_idx ON public.class_sessions USING btree (class_type_id);
CREATE INDEX class_sessions_coach_idx ON public.class_sessions USING btree (coach_user_id);
CREATE INDEX class_sessions_gym_starts_idx ON public.class_sessions USING btree (gym_id, starts_at);
CREATE INDEX class_types_gym_id_idx ON public.class_types USING btree (gym_id);
CREATE INDEX gym_admin_invites_claimed_idx ON public.gym_admin_invites USING btree (gym_id, claimed_by) WHERE (claimed_by IS NOT NULL);
CREATE INDEX gym_admin_invites_gym_idx ON public.gym_admin_invites USING btree (gym_id, created_at DESC);
CREATE INDEX gym_members_user_id_idx ON public.gym_members USING btree (user_id);
CREATE UNIQUE INDEX gym_ownership_actions_one_pending ON public.gym_ownership_actions USING btree (gym_id, action_type, COALESCE(target_user_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE (status = 'pending'::text);
CREATE INDEX gyms_created_by_idx ON public.gyms USING btree (created_by);
CREATE UNIQUE INDEX member_notifications_dedupe ON public.member_notifications USING btree (user_id, related_session_id, notification_type) WHERE (related_session_id IS NOT NULL);
CREATE INDEX member_notifications_due ON public.member_notifications USING btree (scheduled_for) WHERE (delivered_at IS NULL);
CREATE INDEX members_gym_id_idx ON public.members USING btree (gym_id);
CREATE INDEX members_gym_status_idx ON public.members USING btree (gym_id, status);
CREATE INDEX members_user_id_idx ON public.members USING btree (user_id) WHERE (user_id IS NOT NULL);
CREATE INDEX membership_plans_gym_id_idx ON public.membership_plans USING btree (gym_id);
CREATE INDEX memberships_gym_user_idx ON public.memberships USING btree (gym_id, user_id);
CREATE INDEX memberships_member_id_idx ON public.memberships USING btree (member_id);
CREATE INDEX memberships_plan_id_idx ON public.memberships USING btree (plan_id);
CREATE INDEX memberships_user_id_idx ON public.memberships USING btree (user_id);
CREATE INDEX messages_channel_created_at_idx ON public.messages USING btree (channel_id, created_at DESC);
CREATE INDEX messages_sender_id_idx ON public.messages USING btree (sender_id);
CREATE INDEX payment_records_gym_created_idx ON public.payment_records USING btree (gym_id, created_at DESC);
CREATE INDEX payment_records_membership_idx ON public.payment_records USING btree (membership_id);
CREATE UNIQUE INDEX payment_records_provider_payment_uidx ON public.payment_records USING btree (provider, provider_payment_id) WHERE (provider_payment_id IS NOT NULL);
CREATE INDEX payment_records_user_idx ON public.payment_records USING btree (user_id);
CREATE INDEX personal_bests_user_idx ON public.personal_bests USING btree (user_id, gym_id, achieved_at DESC);
CREATE INDEX pt_appointments_gym_start_idx ON public.pt_appointments USING btree (gym_id, starts_at);
CREATE INDEX pt_appointments_member_start_idx ON public.pt_appointments USING btree (member_user_id, starts_at);
CREATE INDEX pt_appointments_staff_start_idx ON public.pt_appointments USING btree (staff_user_id, starts_at);
CREATE INDEX resources_gym_idx ON public.resources USING btree (gym_id);
CREATE INDEX service_requirements_class_type_idx ON public.service_requirements USING btree (class_type_id);
CREATE INDEX social_comments_post_created_idx ON public.social_comments USING btree (post_id, created_at);
CREATE INDEX social_posts_gym_created_idx ON public.social_posts USING btree (gym_id, created_at DESC);
CREATE UNIQUE INDEX social_reactions_comment_unique ON public.social_reactions USING btree (user_id, comment_id) WHERE (comment_id IS NOT NULL);
CREATE UNIQUE INDEX social_reactions_post_unique ON public.social_reactions USING btree (user_id, post_id) WHERE (post_id IS NOT NULL);
CREATE INDEX staff_access_access_level_idx ON public.staff_access USING btree (access_level_id) WHERE (access_level_id IS NOT NULL);
CREATE UNIQUE INDEX staff_access_levels_gym_name_unique ON public.staff_access_levels USING btree (gym_id, lower(name));
CREATE INDEX staff_capabilities_gym_user_idx ON public.staff_capabilities USING btree (gym_id, user_id);
CREATE INDEX staff_profiles_gym_idx ON public.staff_profiles USING btree (gym_id);
CREATE INDEX staff_hours_gym_user_idx ON public.staff_working_hours USING btree (gym_id, user_id);
CREATE INDEX strava_activities_athlete_idx ON public.strava_activities USING btree (athlete_id);
CREATE INDEX strava_activities_user_started_idx ON public.strava_activities USING btree (user_id, started_at DESC);
CREATE INDEX workout_assignments_member_idx ON public.workout_assignments USING btree (member_user_id, status, scheduled_for);
CREATE UNIQUE INDEX workout_assignments_unique_wod_pickup_idx ON public.workout_assignments USING btree (gym_id, member_user_id, template_id, scheduled_for) WHERE ((source = 'wod'::text) AND (template_id IS NOT NULL) AND (scheduled_for IS NOT NULL));
CREATE INDEX idx_workout_entries_session ON public.workout_entries USING btree (session_id, "position");
CREATE INDEX idx_workout_sessions_gym ON public.workout_sessions USING btree (gym_id);
CREATE INDEX idx_workout_sessions_user_performed ON public.workout_sessions USING btree (user_id, performed_at DESC);
CREATE INDEX idx_workout_sets_entry ON public.workout_sets USING btree (entry_id, set_number);
CREATE INDEX workout_activities_block_idx ON public.workout_template_activities USING btree (block_id, "position");
CREATE INDEX workout_blocks_template_idx ON public.workout_template_blocks USING btree (template_id, "position");
CREATE INDEX workout_templates_gym_idx ON public.workout_templates USING btree (gym_id, is_active);
CREATE INDEX workout_wods_gym_date_idx ON public.workout_wods USING btree (gym_id, wod_date);

set check_function_bodies = off;;

CREATE OR REPLACE FUNCTION private.active_owner_count(target_gym_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
  select count(*)::integer
  from public.gym_members gm
  where gm.gym_id=target_gym_id
    and gm.role='owner'::public.gym_member_role
    and gm.is_active=true
    and gm.access_status='active';
$$;

CREATE OR REPLACE FUNCTION private.can_manage_gym_member(target_gym_id uuid, target_user_id uuid, target_role gym_member_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
  select exists (
    select 1
    from public.gym_members actor
    where actor.gym_id = target_gym_id
      and actor.user_id = (select auth.uid())
      and actor.is_active = true
      and actor.access_status = 'active'
      and (
        (
          actor.role = 'owner'::public.gym_member_role
          and target_user_id <> actor.user_id
          and target_role <> 'owner'::public.gym_member_role
        )
        or
        (
          actor.role = 'admin'::public.gym_member_role
          and target_user_id <> actor.user_id
          and target_role = any(array['member'::public.gym_member_role,'staff'::public.gym_member_role,'coach'::public.gym_member_role])
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.can_view_profile(target_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
  select exists (
    select 1
    from public.gym_members mine
    join public.gym_members theirs on theirs.gym_id = mine.gym_id
    where mine.user_id = (select auth.uid())
      and mine.is_active = true
      and theirs.user_id = target_user_id
      and theirs.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION private.can_write_gym(target_gym_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
  select exists (
    select 1
    from public.gym_members gm
    where gm.gym_id = target_gym_id
      and gm.user_id = (select auth.uid())
      and gm.is_active = true
      and gm.access_status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION private.enforce_workout_assignment_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
declare
  actor uuid := auth.uid();
  actor_is_staff boolean := false;
begin
  if actor is not null then
    actor_is_staff := private.has_gym_role(new.gym_id, array['owner','admin','staff','coach']::public.gym_member_role[]);
  end if;

  if not exists (
    select 1 from public.gym_members gm
    where gm.gym_id = new.gym_id
      and gm.user_id = new.member_user_id
      and gm.is_active
  ) then
    raise exception 'Workout assignment member must be active in this gym';
  end if;

  if new.template_id is not null and not exists (
    select 1 from public.workout_templates wt
    where wt.id = new.template_id and wt.gym_id = new.gym_id
  ) then
    raise exception 'Workout template must belong to the assignment gym';
  end if;

  if new.source = 'wod' then
    if new.template_id is null or new.scheduled_for is null or not exists (
      select 1 from public.workout_wods w
      where w.gym_id = new.gym_id
        and w.template_id = new.template_id
        and w.wod_date = new.scheduled_for
        and w.is_active
    ) then
      raise exception 'WOD assignment must match an active published gym WOD';
    end if;
  end if;

  if tg_op = 'UPDATE' and actor = old.member_user_id and not actor_is_staff then
    if new.gym_id is distinct from old.gym_id
      or new.member_user_id is distinct from old.member_user_id
      or new.template_id is distinct from old.template_id
      or new.assigned_by is distinct from old.assigned_by
      or new.source is distinct from old.source
      or new.title is distinct from old.title
      or new.workout_type is distinct from old.workout_type
      or new.focus_tags is distinct from old.focus_tags
      or new.workout_snapshot is distinct from old.workout_snapshot
      or new.scheduled_for is distinct from old.scheduled_for
      or new.due_at is distinct from old.due_at
      or new.created_at is distinct from old.created_at then
      raise exception 'Members may only update workout progress and completion fields';
    end if;
  end if;

  if new.status = 'in_progress' and new.started_at is null then
    new.started_at := now();
  end if;
  if new.status = 'completed' and new.completed_at is null then
    new.completed_at := now();
  end if;
  if new.status <> 'completed' then
    new.completed_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION private.execute_ownership_action(target_action_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  a public.gym_ownership_actions%rowtype;
  required_count integer;
  approval_count integer;
begin
  select * into a from public.gym_ownership_actions where id=target_action_id for update;
  if a.id is null then raise exception 'Ownership action not found'; end if;
  if a.status<>'pending' then
    return jsonb_build_object('executed',a.status='executed','status',a.status);
  end if;
  if a.expires_at<=now() then
    update public.gym_ownership_actions set status='expired' where id=a.id;
    return jsonb_build_object('executed',false,'status','expired');
  end if;

  select count(*) into required_count
  from public.gym_members gm
  where gm.gym_id=a.gym_id
    and gm.role='owner'::public.gym_member_role
    and gm.is_active=true
    and gm.access_status='active';

  select count(*) into approval_count
  from public.gym_ownership_action_approvals ap
  join public.gym_members gm
    on gm.gym_id=a.gym_id
   and gm.user_id=ap.owner_user_id
   and gm.role='owner'::public.gym_member_role
   and gm.is_active=true
   and gm.access_status='active'
  where ap.action_id=a.id;

  if required_count<1 or approval_count<required_count then
    return jsonb_build_object(
      'executed',false,
      'status','pending',
      'approvals',approval_count,
      'required',required_count,
      'action_id',a.id
    );
  end if;

  if a.action_type='activate_owner' then
    update public.gym_members
    set role='owner'::public.gym_member_role,
        access_status='active',
        is_active=true,
        approved_by=a.created_by,
        approved_at=now(),
        access_revoked_at=null,
        updated_at=now()
    where gym_id=a.gym_id
      and user_id=a.target_user_id
      and role='owner'::public.gym_member_role
      and access_status='pending';

    if not found then raise exception 'Pending Owner not found'; end if;

    update public.gym_admin_invites
    set status='approved',approved_at=now()
    where gym_id=a.gym_id
      and claimed_by=a.target_user_id
      and invite_role='owner'
      and status='claimed';

  elsif a.action_type='promote_owner' then
    update public.gym_members
    set role='owner'::public.gym_member_role,
        access_status='active',
        is_active=true,
        approved_by=a.created_by,
        approved_at=now(),
        access_revoked_at=null,
        updated_at=now()
    where gym_id=a.gym_id
      and user_id=a.target_user_id
      and role='admin'::public.gym_member_role
      and access_status='active';

    if not found then raise exception 'Active Admin not found'; end if;

  elsif a.action_type='remove_owner' then
    update public.gym_members
    set is_active=false,
        access_status='revoked',
        access_revoked_at=now(),
        updated_at=now()
    where gym_id=a.gym_id
      and user_id=a.target_user_id
      and role='owner'::public.gym_member_role
      and access_status='active';

    if not found then raise exception 'Active Owner not found'; end if;

  elsif a.action_type='delete_gym' then
    delete from public.gyms where id=a.gym_id;
    return jsonb_build_object('executed',true,'status','executed','action_id',a.id);
  end if;

  update public.gym_ownership_actions
  set status='executed',executed_at=now()
  where id=a.id;

  return jsonb_build_object(
    'executed',true,
    'status','executed',
    'approvals',approval_count,
    'required',required_count,
    'action_id',a.id
  );
end;
$$;

CREATE OR REPLACE FUNCTION private.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
begin
  insert into public.profiles (id, first_name, last_name, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data ->> 'given_name'),
    coalesce(new.raw_user_meta_data ->> 'last_name', new.raw_user_meta_data ->> 'family_name'),
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', new.email),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION private.has_active_owner(target_gym_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
  select exists(
    select 1 from public.gym_members gm
    where gm.gym_id=target_gym_id
      and gm.role='owner'::public.gym_member_role
      and gm.is_active=true
      and gm.access_status='active'
  );
$$;

CREATE OR REPLACE FUNCTION private.has_gym_role(target_gym_id uuid, allowed_roles gym_member_role[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
  select exists (
    select 1
    from public.gym_members gm
    where gm.gym_id = target_gym_id
      and gm.user_id = (select auth.uid())
      and gm.is_active = true
      and gm.access_status = 'active'
      and (
        gm.role = any(allowed_roles)
        or (
          gm.role = any(array['staff'::public.gym_member_role,'coach'::public.gym_member_role])
          and (
            'owner'::public.gym_member_role = any(allowed_roles)
            or 'admin'::public.gym_member_role = any(allowed_roles)
          )
          and exists (
            select 1
            from public.staff_access sa
            where sa.gym_id = target_gym_id
              and sa.user_id = gm.user_id
              and coalesce((sa.permissions ->> 'full_access')::boolean,false) = true
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.has_gym_staff_permission(target_gym_id uuid, permission_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
  select exists (
    select 1
    from public.gym_members gm
    join public.staff_access sa
      on sa.gym_id=gm.gym_id
     and sa.user_id=gm.user_id
    where gm.gym_id=target_gym_id
      and gm.user_id=auth.uid()
      and gm.is_active=true
      and gm.access_status='active'
      and gm.role in ('staff'::public.gym_member_role,'coach'::public.gym_member_role)
      and coalesce((sa.permissions->>permission_key)::boolean,false)=true
  );
$$;

CREATE OR REPLACE FUNCTION private.is_gym_member(target_gym_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
  select exists (
    select 1
    from public.gym_members gm
    where gm.gym_id = target_gym_id
      and gm.user_id = (select auth.uid())
      and gm.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION private.is_pending_admin(target_gym_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
  select exists (
    select 1
    from public.gym_members gm
    where gm.gym_id = target_gym_id
      and gm.user_id = (select auth.uid())
      and gm.is_active = true
      and gm.role = 'admin'::public.gym_member_role
      and gm.access_status = 'pending'
  );
$$;

CREATE OR REPLACE FUNCTION private.member_has_class_access(p_gym_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
  select coalesce((
    select mp.includes_classes
    from public.memberships m
    join public.membership_plans mp on mp.id=m.plan_id
    where m.gym_id=p_gym_id and m.user_id=p_user_id and m.status='active'
      and (m.starts_on is null or m.starts_on<=current_date)
      and (m.ends_on is null or m.ends_on>=current_date)
    order by m.created_at desc
    limit 1
  ),false)
$$;

CREATE OR REPLACE FUNCTION private.member_has_paid_class(p_session_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
  select exists(
    select 1 from public.class_booking_purchases p
    where p.session_id=p_session_id and p.user_id=p_user_id and p.status='paid'
  )
$$;

CREATE OR REPLACE FUNCTION private.notify_social_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  recipient uuid;
  kind text;
begin
  if new.parent_comment_id is not null then
    select c.user_id into recipient
    from public.social_comments c
    where c.id = new.parent_comment_id and c.gym_id = new.gym_id;
    kind := 'social_reply';
  else
    select p.user_id into recipient
    from public.social_posts p
    where p.id = new.post_id and p.gym_id = new.gym_id;
    kind := 'social_comment';
  end if;

  if recipient is not null and recipient <> new.user_id
     and private.social_notifications_enabled(new.gym_id, recipient) then
    insert into public.member_notifications
      (gym_id,user_id,notification_type,title,body,related_post_id,related_comment_id,scheduled_for)
    values
      (new.gym_id,recipient,kind,
       case when kind='social_reply' then 'New reply' else 'New comment' end,
       case when kind='social_reply' then 'Someone replied to your comment.' else 'Someone commented on your post.' end,
       new.post_id,new.id,now());
  end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION private.notify_social_reaction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  recipient uuid;
  target_post uuid;
  target_comment uuid;
begin
  if new.post_id is not null then
    select p.user_id, p.id into recipient, target_post
    from public.social_posts p
    where p.id = new.post_id and p.gym_id = new.gym_id;
  elsif new.comment_id is not null then
    select c.user_id, c.post_id, c.id into recipient, target_post, target_comment
    from public.social_comments c
    where c.id = new.comment_id and c.gym_id = new.gym_id;
  end if;

  if recipient is not null and recipient <> new.user_id
     and private.social_notifications_enabled(new.gym_id, recipient) then
    insert into public.member_notifications
      (gym_id,user_id,notification_type,title,body,related_post_id,related_comment_id,scheduled_for)
    values
      (new.gym_id,recipient,'social_reaction','New reaction','Someone reacted to your post or comment.',target_post,target_comment,now());
  end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION private.propagate_staff_access_level_permissions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
begin
  if new.permissions is distinct from old.permissions then
    update public.staff_access
       set permissions=new.permissions,
           preset='level',
           updated_at=now()
     where access_level_id=new.id;
  end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION private.protect_gym_creator()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'Gym owner identity cannot be changed';
  end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION private.social_notifications_enabled(p_gym_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
  select exists (
    select 1 from public.gym_members gm
    where gm.gym_id = p_gym_id and gm.user_id = p_user_id and gm.is_active
  ) and coalesce((
    select np.social_notifications
    from public.notification_preferences np
    where np.gym_id = p_gym_id and np.user_id = p_user_id
  ), true);
$$;

CREATE OR REPLACE FUNCTION private.staff_has_permission(p_gym_id uuid, p_user_id uuid, p_permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
  select case
    when private.has_gym_role(p_gym_id,array['owner'::gym_member_role,'admin'::gym_member_role]) then true
    else coalesce((select (permissions ->> p_permission)::boolean from public.staff_access where gym_id=p_gym_id and user_id=p_user_id),false)
  end;
$$;

CREATE OR REPLACE FUNCTION public.approve_admin_access(target_gym_id uuid, target_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
begin
  if not private.has_gym_role(target_gym_id,array['owner'::public.gym_member_role]) then
    raise exception 'Owner access required';
  end if;

  update public.gym_members
  set access_status='active',
      is_active=true,
      approved_by=auth.uid(),
      approved_at=now(),
      access_revoked_at=null,
      updated_at=now()
  where gym_id=target_gym_id
    and user_id=target_user_id
    and role='admin'::public.gym_member_role
    and access_status='pending';

  if not found then raise exception 'Pending admin access not found'; end if;

  update public.gym_admin_invites
  set status='approved',approved_at=now()
  where gym_id=target_gym_id
    and claimed_by=target_user_id
    and status='claimed';

  return true;
end;
$$;

CREATE OR REPLACE FUNCTION public.approve_email_owner_invite(target_invite_id uuid)
 RETURNS TABLE(status text, owner_approvals integer, owner_approvals_required integer, ready_to_send boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  inv public.gym_admin_invites%rowtype;
  approvals integer;
  required_count integer;
begin
  select i.* into inv from public.gym_admin_invites i where i.id=target_invite_id for update;
  if inv.id is null then raise exception 'Invite not found'; end if;
  if inv.invite_role<>'owner' then raise exception 'Only Owner invites require Owner approval'; end if;
  if inv.status not in ('awaiting_approval','open') then raise exception 'Invite is no longer awaiting approval'; end if;
  if not private.has_gym_role(inv.gym_id,array['owner'::public.gym_member_role]) then
    raise exception 'Owner access required';
  end if;

  insert into public.gym_access_invite_approvals(invite_id,owner_user_id)
  values(inv.id,auth.uid())
  on conflict do nothing;

  required_count:=private.active_owner_count(inv.gym_id);
  select count(*)::integer into approvals
  from public.gym_access_invite_approvals a
  join public.gym_members gm
    on gm.gym_id=inv.gym_id
   and gm.user_id=a.owner_user_id
   and gm.role='owner'::public.gym_member_role
   and gm.is_active=true
   and gm.access_status='active'
  where a.invite_id=inv.id;

  if approvals>=required_count then
    update public.gym_admin_invites i set status='open' where i.id=inv.id;
    inv.status:='open';
  end if;

  return query select inv.status,approvals,required_count,(approvals>=required_count);
end;
$$;

CREATE OR REPLACE FUNCTION public.approve_ownership_action(target_action_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  a public.gym_ownership_actions%rowtype;
  result jsonb;
begin
  select * into a from public.gym_ownership_actions where id=target_action_id;
  if a.id is null then raise exception 'Ownership action not found'; end if;
  if not private.has_gym_role(a.gym_id,array['owner'::public.gym_member_role]) then
    raise exception 'Owner access required';
  end if;
  if a.status<>'pending' then raise exception 'Ownership action is no longer pending'; end if;

  insert into public.gym_ownership_action_approvals(action_id,owner_user_id)
  values(a.id,auth.uid())
  on conflict do nothing;

  select private.execute_ownership_action(a.id) into result;
  return result;
end;
$$;

CREATE OR REPLACE FUNCTION public.approve_pending_access(target_gym_id uuid, target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  member public.gym_members%rowtype;
  result jsonb;
begin
  if not private.has_gym_role(target_gym_id,array['owner'::public.gym_member_role]) then
    raise exception 'Owner access required';
  end if;

  select * into member
  from public.gym_members
  where gym_id=target_gym_id and user_id=target_user_id and is_active=true;

  if member.id is null or member.access_status<>'pending' then
    raise exception 'Pending access not found';
  end if;

  if member.role='admin'::public.gym_member_role then
    update public.gym_members
    set access_status='active',
        approved_by=auth.uid(),
        approved_at=now(),
        access_revoked_at=null,
        updated_at=now()
    where id=member.id;

    update public.gym_admin_invites
    set status='approved',approved_at=now()
    where gym_id=target_gym_id
      and claimed_by=target_user_id
      and invite_role='admin'
      and status='claimed';

    return jsonb_build_object('executed',true,'status','executed','role','admin');
  end if;

  if member.role='owner'::public.gym_member_role then
    select public.propose_owner_promotion(target_gym_id,target_user_id) into result;
    return result||jsonb_build_object('role','owner');
  end if;

  raise exception 'Unsupported pending role';
end;
$$;

CREATE OR REPLACE FUNCTION public.approve_shareable_owner_invite(target_invite_id uuid)
 RETURNS TABLE(status text, token text, owner_approvals integer, owner_approvals_required integer, ready_to_share boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  inv public.gym_admin_invites%rowtype;
  approvals integer;
  required_count integer;
  raw_token text:=encode(extensions.gen_random_bytes(32),'hex');
begin
  select i.* into inv from public.gym_admin_invites i where i.id=target_invite_id for update;
  if inv.id is null then raise exception 'Invite not found'; end if;
  if inv.invite_role<>'owner' then raise exception 'Only Owner invites require Owner approval'; end if;
  if inv.delivery_method<>'link' then raise exception 'This is not a shareable link invite'; end if;
  if inv.status not in ('awaiting_approval','open') then raise exception 'Invite is no longer awaiting approval'; end if;
  if not private.has_gym_role(inv.gym_id,array['owner'::public.gym_member_role]) then
    raise exception 'Owner access required';
  end if;

  insert into public.gym_access_invite_approvals(invite_id,owner_user_id)
  values(inv.id,auth.uid())
  on conflict do nothing;

  required_count:=private.active_owner_count(inv.gym_id);
  select count(*)::integer into approvals
  from public.gym_access_invite_approvals a
  join public.gym_members gm
    on gm.gym_id=inv.gym_id
   and gm.user_id=a.owner_user_id
   and gm.role='owner'::public.gym_member_role
   and gm.is_active=true
   and gm.access_status='active'
  where a.invite_id=inv.id;

  if approvals>=required_count then
    update public.gym_admin_invites i
    set status='open',
        token_hash=encode(extensions.digest(raw_token,'sha256'),'hex'),
        email_sent_at=now()
    where i.id=inv.id;
    inv.status:='open';
  end if;

  return query
  select inv.status,
         case when approvals>=required_count then raw_token else null end,
         approvals,required_count,(approvals>=required_count);
end;
$$;

CREATE OR REPLACE FUNCTION public.assign_staff_access_level(target_gym_id uuid, target_user_id uuid, target_level_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
AS $$
declare
  v_permissions jsonb;
  v_target_role public.gym_member_role;
begin
  if not (
    private.has_gym_role(
      target_gym_id,
      array['owner'::public.gym_member_role,'admin'::public.gym_member_role]
    )
    or private.has_gym_staff_permission(target_gym_id,'manage_staff')
  ) then
    raise exception 'Staff management permission required';
  end if;

  select gm.role
    into v_target_role
  from public.gym_members gm
  where gm.gym_id=target_gym_id
    and gm.user_id=target_user_id
    and gm.is_active=true
    and gm.role in ('staff'::public.gym_member_role,'coach'::public.gym_member_role);

  if v_target_role is null then
    raise exception 'The selected user is not active Staff or Coach for this gym';
  end if;

  select l.permissions
    into v_permissions
  from public.staff_access_levels l
  where l.id=target_level_id
    and l.gym_id=target_gym_id
    and l.is_active=true;

  if v_permissions is null then
    raise exception 'Access level not found or inactive';
  end if;

  insert into public.staff_access(
    gym_id,user_id,preset,permissions,access_level_id,updated_at,updated_by
  )
  values(
    target_gym_id,target_user_id,'level',v_permissions,target_level_id,now(),auth.uid()
  )
  on conflict (gym_id,user_id) do update
    set preset='level',
        permissions=excluded.permissions,
        access_level_id=excluded.access_level_id,
        updated_at=now(),
        updated_by=auth.uid();
end;
$$;

CREATE OR REPLACE FUNCTION public.book_class_session(p_session_id uuid)
 RETURNS class_bookings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
declare
  v_session public.class_sessions%rowtype;
  v_existing public.class_bookings%rowtype;
  v_plan_id uuid;
  v_is_reserved_eligible boolean := false;
  v_total_booked integer := 0;
  v_general_booked integer := 0;
  v_reserved_released boolean := false;
  v_booking public.class_bookings%rowtype;
  v_included boolean;
  v_paid boolean;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into v_session from public.class_sessions where id = p_session_id for update;
  if not found then raise exception 'Class session not found'; end if;
  if not private.can_write_gym(v_session.gym_id) then raise exception 'Not a member of this gym'; end if;
  if v_session.is_cancelled then raise exception 'This class has been cancelled'; end if;
  if v_session.starts_at <= now() then raise exception 'This class has already started'; end if;

  select * into v_existing from public.class_bookings
  where session_id = p_session_id and user_id = auth.uid();
  if found and v_existing.status = 'booked' then raise exception 'You are already booked into this class'; end if;

  v_included:=private.member_has_class_access(v_session.gym_id,auth.uid());
  v_paid:=private.member_has_paid_class(v_session.id,auth.uid());
  if not v_included and not v_paid then
    if v_session.drop_in_price_pence is null then
      raise exception 'Your membership does not include classes. Upgrade to a class-inclusive membership to book this class.';
    else
      raise exception 'Your membership does not include classes. This class costs £% as a drop-in, or you can upgrade your membership.',to_char(v_session.drop_in_price_pence/100.0,'FM999999990.00');
    end if;
  end if;

  select m.plan_id into v_plan_id
  from public.memberships m
  where m.gym_id = v_session.gym_id and m.user_id = auth.uid() and m.status = 'active'
    and (m.starts_on is null or m.starts_on <= current_date)
    and (m.ends_on is null or m.ends_on >= current_date)
  order by m.created_at desc limit 1;

  if v_plan_id is not null then
    select exists(select 1 from public.class_session_reserved_plans rp where rp.session_id = p_session_id and rp.plan_id = v_plan_id)
    into v_is_reserved_eligible;
  end if;

  if v_session.reserved_capacity > 0 and v_session.reserved_release_minutes_before is not null then
    v_reserved_released := now() >= (v_session.starts_at - make_interval(mins => v_session.reserved_release_minutes_before));
  end if;

  select count(*) into v_total_booked from public.class_bookings b
  where b.session_id = p_session_id and b.status = 'booked';
  if v_total_booked >= v_session.capacity then raise exception 'This class is full'; end if;

  if v_session.reserved_capacity > 0 and not v_reserved_released and not v_is_reserved_eligible then
    select count(*) into v_general_booked
    from public.class_bookings b
    where b.session_id = p_session_id and b.status = 'booked'
      and not exists (
        select 1 from public.memberships m
        join public.class_session_reserved_plans rp on rp.plan_id = m.plan_id and rp.session_id = p_session_id
        where m.gym_id = v_session.gym_id and m.user_id = b.user_id and m.status = 'active'
          and (m.starts_on is null or m.starts_on <= current_date)
          and (m.ends_on is null or m.ends_on >= current_date)
      );
    if v_general_booked >= (v_session.capacity - v_session.reserved_capacity) then
      raise exception 'General spaces are full. Remaining spaces are reserved for eligible memberships';
    end if;
  end if;

  if v_existing.id is not null then
    update public.class_bookings set status='booked', booked_at=now(), cancelled_at=null, updated_at=now()
    where id=v_existing.id returning * into v_booking;
  else
    insert into public.class_bookings(gym_id,session_id,user_id,status)
    values(v_session.gym_id,p_session_id,auth.uid(),'booked') returning * into v_booking;
  end if;
  return v_booking;
end$$;

CREATE OR REPLACE FUNCTION public.cancel_class_booking(p_session_id uuid)
 RETURNS class_bookings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
declare
  v_booking public.class_bookings%rowtype;
  v_gym_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select gym_id into v_gym_id from public.class_sessions where id=p_session_id;
  if v_gym_id is null then raise exception 'Class session not found'; end if;
  if not private.can_write_gym(v_gym_id) then raise exception 'Read-only access'; end if;

  update public.class_bookings
  set status='cancelled',cancelled_at=now(),updated_at=now()
  where session_id=p_session_id and user_id=auth.uid() and status='booked'
  returning * into v_booking;

  if not found then raise exception 'Active booking not found'; end if;
  return v_booking;
end;
$$;

CREATE OR REPLACE FUNCTION public.claim_access_invite(invite_token text)
 RETURNS TABLE(gym_id uuid, gym_name text, access_status text, role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  inv public.gym_admin_invites%rowtype;
  user_email text;
  gname text;
  existing public.gym_members%rowtype;
  role_value public.gym_member_role;
  activate_now boolean:=false;
begin
  if auth.uid() is null then raise exception 'Sign in or create an account first'; end if;

  select i.* into inv
  from public.gym_admin_invites i
  where i.token_hash=encode(extensions.digest(invite_token,'sha256'),'hex')
  for update;

  if inv.id is null then raise exception 'Invite not found'; end if;
  if inv.expires_at<=now() and inv.status='open' then
    update public.gym_admin_invites i set status='expired' where i.id=inv.id;
    raise exception 'Invite has expired';
  end if;
  if inv.status in ('revoked','expired','awaiting_approval') then
    raise exception 'Invite is not ready to accept';
  end if;
  if inv.status in ('claimed','approved') and inv.claimed_by<>auth.uid() then
    raise exception 'Invite has already been used';
  end if;

  select lower(u.email) into user_email
  from auth.users u
  where u.id=auth.uid();

  if user_email is distinct from lower(inv.email) then
    raise exception 'This invite was issued to a different email address';
  end if;

  select gm.* into existing
  from public.gym_members gm
  where gm.gym_id=inv.gym_id and gm.user_id=auth.uid();

  if inv.status='approved'
     and inv.claimed_by=auth.uid()
     and existing.id is not null
     and existing.is_active=true
     and existing.access_status='active' then
    select g.name into gname from public.gyms g where g.id=inv.gym_id;
    return query select inv.gym_id,gname,'active'::text,existing.role::text;
    return;
  end if;

  if existing.id is not null
     and existing.is_active=true
     and existing.access_status='active' then
    raise exception 'This account already has active access to the gym';
  end if;

  role_value:=inv.invite_role::public.gym_member_role;
  activate_now:=(inv.status='open' and inv.email_sent_at is not null);

  insert into public.gym_members(
    gym_id,user_id,role,is_active,access_status,approved_by,approved_at,access_revoked_at
  )
  values(
    inv.gym_id,
    auth.uid(),
    role_value,
    true,
    case when activate_now then 'active' else 'pending' end,
    case when activate_now then inv.created_by else null end,
    case when activate_now then now() else null end,
    null
  )
  on conflict on constraint gym_members_gym_id_user_id_key do update
    set role=excluded.role,
        is_active=true,
        access_status=excluded.access_status,
        approved_by=excluded.approved_by,
        approved_at=excluded.approved_at,
        access_revoked_at=null,
        updated_at=now();

  update public.gym_admin_invites i
  set status=case when activate_now then 'approved' else 'claimed' end,
      claimed_by=auth.uid(),
      claimed_at=coalesce(i.claimed_at,now()),
      approved_at=case when activate_now then now() else i.approved_at end
  where i.id=inv.id;

  select g.name into gname from public.gyms g where g.id=inv.gym_id;

  return query
  select inv.gym_id,gname,
         case when activate_now then 'active' else 'pending' end::text,
         inv.invite_role;
end;
$$;

CREATE OR REPLACE FUNCTION public.claim_admin_invite(invite_token text)
 RETURNS TABLE(gym_id uuid, gym_name text, access_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  inv public.gym_admin_invites%rowtype;
  user_email text;
  gname text;
  existing_role public.gym_member_role;
begin
  if auth.uid() is null then
    raise exception 'Sign in or create an account first';
  end if;

  select * into inv
  from public.gym_admin_invites
  where token_hash=encode(extensions.digest(invite_token,'sha256'),'hex')
  for update;

  if inv.id is null then raise exception 'Invite not found'; end if;
  if inv.expires_at <= now() and inv.status='open' then
    update public.gym_admin_invites set status='expired' where id=inv.id;
    raise exception 'Invite has expired';
  end if;
  if inv.status in ('revoked','expired') then raise exception 'Invite is no longer valid'; end if;
  if inv.status='approved' and inv.claimed_by=auth.uid() then
    select name into gname from public.gyms where id=inv.gym_id;
    return query select inv.gym_id,gname,'active'::text;
    return;
  end if;
  if inv.status='claimed' and inv.claimed_by<>auth.uid() then
    raise exception 'Invite has already been used';
  end if;

  select lower(email) into user_email from auth.users where id=auth.uid();
  if user_email is distinct from lower(inv.email) then
    raise exception 'This invite was issued to a different email address';
  end if;

  select role into existing_role
  from public.gym_members
  where gym_id=inv.gym_id and user_id=auth.uid();

  if existing_role='owner'::public.gym_member_role then
    raise exception 'Owner account cannot claim an admin invite';
  end if;

  insert into public.gym_members(
    gym_id,user_id,role,is_active,access_status,approved_by,approved_at,access_revoked_at
  )
  values(inv.gym_id,auth.uid(),'admin',true,'pending',null,null,null)
  on conflict(gym_id,user_id) do update
    set role='admin'::public.gym_member_role,
        is_active=true,
        access_status='pending',
        approved_by=null,
        approved_at=null,
        access_revoked_at=null,
        updated_at=now();

  update public.gym_admin_invites
  set status='claimed',
      claimed_by=auth.uid(),
      claimed_at=coalesce(claimed_at,now())
  where id=inv.id;

  select name into gname from public.gyms where id=inv.gym_id;
  return query select inv.gym_id,gname,'pending'::text;
end;
$$;

CREATE OR REPLACE FUNCTION public.create_access_invite(target_gym_id uuid, invite_email text, requested_role text DEFAULT 'admin'::text, expires_in_days integer DEFAULT 7)
 RETURNS TABLE(invite_id uuid, token text, expires_at timestamp with time zone, gym_name text, invite_role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  raw_token text;
  expiry timestamptz;
  new_id uuid;
  gname text;
  normal_role text:=lower(trim(coalesce(requested_role,'admin')));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not private.has_gym_role(target_gym_id,array['owner'::public.gym_member_role]) then
    raise exception 'Owner access required';
  end if;
  if normal_role not in ('admin','owner') then raise exception 'Invite role must be Admin or Owner'; end if;
  if invite_email is null or position('@' in invite_email)<2 then raise exception 'A valid email address is required'; end if;

  if exists(
    select 1
    from public.gym_members gm
    join auth.users u on u.id=gm.user_id
    where gm.gym_id=target_gym_id
      and gm.is_active=true
      and lower(u.email)=lower(trim(invite_email))
  ) then
    raise exception 'That account already has access to this gym';
  end if;

  expiry:=now()+make_interval(days=>greatest(1,least(coalesce(expires_in_days,7),30)));
  raw_token:=encode(extensions.gen_random_bytes(32),'hex');

  insert into public.gym_admin_invites(gym_id,email,token_hash,status,created_by,expires_at,invite_role)
  values(
    target_gym_id,
    lower(trim(invite_email)),
    encode(extensions.digest(raw_token,'sha256'),'hex'),
    'open',
    auth.uid(),
    expiry,
    normal_role
  )
  returning id into new_id;

  select name into gname from public.gyms where id=target_gym_id;
  return query select new_id,raw_token,expiry,gname,normal_role;
end;
$$;

CREATE OR REPLACE FUNCTION public.create_admin_invite(target_gym_id uuid, invite_email text, expires_in_days integer DEFAULT 7)
 RETURNS TABLE(invite_id uuid, token text, expires_at timestamp with time zone, gym_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  raw_token text;
  expiry timestamptz;
  new_id uuid;
  gname text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not private.has_gym_role(target_gym_id,array['owner'::public.gym_member_role]) then
    raise exception 'Owner access required';
  end if;
  if invite_email is null or position('@' in invite_email) < 2 then
    raise exception 'A valid email address is required';
  end if;
  expiry := now() + make_interval(days => greatest(1,least(coalesce(expires_in_days,7),30)));
  raw_token := encode(extensions.gen_random_bytes(32),'hex');

  insert into public.gym_admin_invites(gym_id,email,token_hash,status,created_by,expires_at)
  values(
    target_gym_id,
    lower(trim(invite_email)),
    encode(extensions.digest(raw_token,'sha256'),'hex'),
    'open',
    auth.uid(),
    expiry
  )
  returning id into new_id;

  select name into gname from public.gyms where id=target_gym_id;

  return query select new_id,raw_token,expiry,gname;
end;
$$;

CREATE OR REPLACE FUNCTION public.create_email_access_invite(target_gym_id uuid, invite_email text, requested_role text DEFAULT 'admin'::text, expires_in_days integer DEFAULT 7)
 RETURNS TABLE(invite_id uuid, status text, owner_approvals integer, owner_approvals_required integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  normal_email text:=lower(trim(invite_email));
  normal_role text:=lower(trim(coalesce(requested_role,'admin')));
  required_count integer;
  new_status text;
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not private.has_gym_role(target_gym_id,array['owner'::public.gym_member_role]) then
    raise exception 'Owner access required';
  end if;
  if normal_role not in ('admin','owner') then raise exception 'Invite role must be Admin or Owner'; end if;
  if normal_email is null or position('@' in normal_email)<2 then raise exception 'A valid email address is required'; end if;

  if exists(
    select 1
    from public.gym_members gm
    join auth.users u on u.id=gm.user_id
    where gm.gym_id=target_gym_id
      and gm.is_active=true
      and gm.access_status='active'
      and lower(u.email)=normal_email
  ) then
    raise exception 'That account already has active access to this gym';
  end if;

  update public.gym_admin_invites i
  set status='revoked',revoked_at=now()
  where i.gym_id=target_gym_id
    and lower(i.email)=normal_email
    and i.status in ('awaiting_approval','open');

  required_count:=case when normal_role='owner' then private.active_owner_count(target_gym_id) else 1 end;
  if required_count<1 then raise exception 'Gym has no active Owner'; end if;
  new_status:=case when normal_role='owner' and required_count>1 then 'awaiting_approval' else 'open' end;

  insert into public.gym_admin_invites(
    gym_id,email,token_hash,status,created_by,expires_at,invite_role
  )
  values(
    target_gym_id,
    normal_email,
    'pending-email-token-'||gen_random_uuid()::text,
    new_status,
    auth.uid(),
    now()+make_interval(days=>greatest(1,least(coalesce(expires_in_days,7),30))),
    normal_role
  )
  returning id into new_id;

  insert into public.gym_access_invite_approvals(invite_id,owner_user_id)
  values(new_id,auth.uid())
  on conflict do nothing;

  return query
  select new_id,new_status,1,required_count;
end;
$$;

CREATE OR REPLACE FUNCTION public.create_gym_for_current_user(gym_name text, gym_slug text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $$
declare
  new_gym_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(gym_name), '') is null then
    raise exception 'Gym name is required';
  end if;

  if gym_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Invalid gym slug';
  end if;

  insert into public.gyms (name, slug, created_by)
  values (trim(gym_name), gym_slug, (select auth.uid()))
  returning id into new_gym_id;

  insert into public.gym_members (gym_id, user_id, role)
  values (new_gym_id, (select auth.uid()), 'owner');

  return new_gym_id;
end;
$$;

CREATE OR REPLACE FUNCTION public.create_shareable_access_invite(target_gym_id uuid, invite_email text, requested_role text DEFAULT 'admin'::text, expires_in_days integer DEFAULT 7)
 RETURNS TABLE(invite_id uuid, token text, status text, owner_approvals integer, owner_approvals_required integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  normal_email text:=lower(trim(invite_email));
  normal_role text:=lower(trim(coalesce(requested_role,'admin')));
  required_count integer;
  new_status text;
  new_id uuid;
  raw_token text:=encode(extensions.gen_random_bytes(32),'hex');
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not private.has_gym_role(target_gym_id,array['owner'::public.gym_member_role]) then
    raise exception 'Owner access required';
  end if;
  if normal_role not in ('admin','owner') then raise exception 'Invite role must be Admin or Owner'; end if;
  if normal_email is null or position('@' in normal_email)<2 then raise exception 'A valid email address is required'; end if;

  if exists(
    select 1
    from public.gym_members gm
    join auth.users u on u.id=gm.user_id
    where gm.gym_id=target_gym_id
      and gm.is_active=true
      and gm.access_status='active'
      and lower(u.email)=normal_email
  ) then
    raise exception 'That account already has active access to this gym';
  end if;

  update public.gym_admin_invites i
  set status='revoked',revoked_at=now()
  where i.gym_id=target_gym_id
    and lower(i.email)=normal_email
    and i.status in ('awaiting_approval','open');

  required_count:=case when normal_role='owner' then private.active_owner_count(target_gym_id) else 1 end;
  if required_count<1 then raise exception 'Gym has no active Owner'; end if;
  new_status:=case when normal_role='owner' and required_count>1 then 'awaiting_approval' else 'open' end;

  insert into public.gym_admin_invites(
    gym_id,email,token_hash,status,created_by,expires_at,invite_role,delivery_method,
    email_sent_at
  )
  values(
    target_gym_id,
    normal_email,
    encode(extensions.digest(raw_token,'sha256'),'hex'),
    new_status,
    auth.uid(),
    now()+make_interval(days=>greatest(1,least(coalesce(expires_in_days,7),30))),
    normal_role,
    'link',
    case when new_status='open' then now() else null end
  )
  returning id into new_id;

  insert into public.gym_access_invite_approvals(invite_id,owner_user_id)
  values(new_id,auth.uid())
  on conflict do nothing;

  return query
  select new_id,
         case when new_status='open' then raw_token else null end,
         new_status,1,required_count;
end;
$$;

CREATE OR REPLACE FUNCTION public.create_training_group(p_gym_id uuid, p_name text, p_description text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $$
declare
  v_user uuid:=auth.uid();
  v_group public.training_groups%rowtype;
  v_code text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not private.can_write_gym(p_gym_id) then
    raise exception 'Active gym membership required';
  end if;
  if char_length(trim(coalesce(p_name,'')))<2 then raise exception 'Group name is required'; end if;
  loop
    v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    exit when not exists(select 1 from public.training_groups g where g.invite_code=v_code);
  end loop;
  insert into public.training_groups(gym_id,owner_user_id,name,description,invite_code)
  values(p_gym_id,v_user,trim(p_name),nullif(trim(coalesce(p_description,'')),''),v_code)
  returning * into v_group;
  insert into public.training_group_members(group_id,user_id) values(v_group.id,v_user);
  return jsonb_build_object('id',v_group.id,'name',v_group.name,'description',v_group.description,'invite_code',v_group.invite_code);
end$$;

CREATE OR REPLACE FUNCTION public.create_training_group_challenge(p_group_id uuid, p_name text, p_activity_name text, p_metric_type text, p_unit text, p_comparison_direction text DEFAULT 'higher'::text, p_ends_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth'
AS $$
declare
  v_user uuid:=auth.uid();
  v_id uuid;
  v_gym_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select gym_id into v_gym_id from public.training_groups where id=p_group_id;
  if v_gym_id is null then raise exception 'Group not found'; end if;
  if not private.can_write_gym(v_gym_id) then raise exception 'Read-only access'; end if;
  if not exists(select 1 from public.training_group_members gm where gm.group_id=p_group_id and gm.user_id=v_user) then
    raise exception 'You are not a member of this group';
  end if;
  if p_metric_type not in ('weight','reps','time','distance','calories','custom') then raise exception 'Invalid metric'; end if;
  if p_comparison_direction not in ('higher','lower') then raise exception 'Invalid direction'; end if;

  insert into public.training_group_challenges(group_id,created_by,name,activity_name,metric_type,unit,comparison_direction,ends_at)
  values(p_group_id,v_user,trim(p_name),trim(p_activity_name),p_metric_type,nullif(trim(coalesce(p_unit,'')),''),p_comparison_direction,p_ends_at)
  returning id into v_id;
  return v_id;
end;
$$;

CREATE OR REPLACE FUNCTION public.create_validated_class_session(p_gym_id uuid, p_class_type_id uuid, p_name text, p_description text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_capacity integer, p_reserved_capacity integer DEFAULT 0, p_reserved_release_minutes_before integer DEFAULT NULL::integer, p_staff_ids uuid[] DEFAULT '{}'::uuid[], p_plan_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
declare
  v_check jsonb;
  v_session_id uuid;
  v_uid uuid;
  v_i integer := 0;
  v_role text;
  v_drop_in integer;
begin
  if not private.has_gym_role(p_gym_id, array['owner'::gym_member_role,'admin'::gym_member_role]) then
    raise exception 'Not authorised';
  end if;
  if coalesce(trim(p_name),'')='' or p_starts_at is null or p_ends_at is null or p_ends_at<=p_starts_at then
    return jsonb_build_object('ok',false,'errors',jsonb_build_array('Check the class name, date, start time and duration.'));
  end if;
  if p_capacity is null or p_capacity<1 or coalesce(p_reserved_capacity,0)<0 or coalesce(p_reserved_capacity,0)>p_capacity then
    return jsonb_build_object('ok',false,'errors',jsonb_build_array('Check the class capacity and reserved spaces.'));
  end if;

  if p_class_type_id is not null then
    v_check:=public.validate_class_schedule(p_gym_id,p_class_type_id,p_starts_at,p_ends_at,p_capacity,coalesce(p_staff_ids,'{}'::uuid[]),null);
    if coalesce((v_check->>'ok')::boolean,false)=false then return v_check; end if;
    select drop_in_price_pence into v_drop_in from public.class_types where id=p_class_type_id and gym_id=p_gym_id;
  end if;

  insert into public.class_sessions(
    gym_id,class_type_id,name,description,starts_at,ends_at,capacity,reserved_capacity,reserved_release_minutes_before,drop_in_price_pence,created_by
  ) values(
    p_gym_id,p_class_type_id,trim(p_name),nullif(trim(coalesce(p_description,'')),''),p_starts_at,p_ends_at,p_capacity,
    coalesce(p_reserved_capacity,0),p_reserved_release_minutes_before,v_drop_in,auth.uid()
  ) returning id into v_session_id;

  if coalesce(array_length(p_plan_ids,1),0)>0 and coalesce(p_reserved_capacity,0)>0 then
    insert into public.class_session_reserved_plans(session_id,plan_id)
    select v_session_id,x from unnest(p_plan_ids)x
    where exists(select 1 from public.membership_plans mp where mp.id=x and mp.gym_id=p_gym_id and mp.is_active=true)
    on conflict do nothing;
  end if;

  if coalesce(array_length(p_staff_ids,1),0)>0 then
    foreach v_uid in array p_staff_ids loop
      v_i:=v_i+1;
      select case when gm.role='coach'::gym_member_role then 'coach' else 'staff' end into v_role
      from public.gym_members gm
      where gm.gym_id=p_gym_id and gm.user_id=v_uid and gm.is_active=true
        and gm.role in ('owner'::gym_member_role,'admin'::gym_member_role,'staff'::gym_member_role,'coach'::gym_member_role)
      limit 1;
      if v_role is not null then
        insert into public.class_session_staff(session_id,gym_id,user_id,assignment_role,is_lead)
        values(v_session_id,p_gym_id,v_uid,v_role,v_i=1) on conflict do nothing;
      end if;
    end loop;
  end if;

  if p_class_type_id is not null then
    insert into public.class_session_resources(gym_id,session_id,resource_id,quantity)
    select p_gym_id,v_session_id,sr.resource_id,greatest(coalesce(sr.quantity,1),1)
    from public.service_requirements sr join public.resources r on r.id=sr.resource_id
    where sr.gym_id=p_gym_id and sr.class_type_id=p_class_type_id and sr.resource_id is not null and r.is_active=true
    on conflict(session_id,resource_id) do update set quantity=excluded.quantity;
  end if;

  return jsonb_build_object('ok',true,'session_id',v_session_id);
end$$;

CREATE OR REPLACE FUNCTION public.delete_admin_invite(target_invite_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  inv public.gym_admin_invites%rowtype;
begin
  select * into inv from public.gym_admin_invites where id=target_invite_id for update;
  if inv.id is null then raise exception 'Invite not found'; end if;
  if not private.has_gym_role(inv.gym_id,array['owner'::public.gym_member_role]) then
    raise exception 'Owner access required';
  end if;
  if inv.status='approved' then raise exception 'Remove the approved access instead'; end if;

  if inv.claimed_by is not null then
    update public.gym_members
    set is_active=false,
        access_status='revoked',
        access_revoked_at=now(),
        updated_at=now()
    where gym_id=inv.gym_id
      and user_id=inv.claimed_by
      and role::text=inv.invite_role
      and access_status='pending';
  end if;

  delete from public.gym_admin_invites where id=target_invite_id;
  return true;
end;
$$;

CREATE OR REPLACE FUNCTION public.get_access_invite(invite_token text)
 RETURNS TABLE(invite_id uuid, gym_name text, email text, status text, expires_at timestamp with time zone, invite_role text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
  select i.id,g.name,i.email,
         case when i.status='open' and i.expires_at<=now() then 'expired' else i.status end,
         i.expires_at,
         i.invite_role
  from public.gym_admin_invites i
  join public.gyms g on g.id=i.gym_id
  where i.token_hash=encode(extensions.digest(invite_token,'sha256'),'hex')
  limit 1;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_invite(invite_token text)
 RETURNS TABLE(invite_id uuid, gym_name text, email text, status text, expires_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
  select i.id,g.name,i.email,
         case when i.status='open' and i.expires_at <= now() then 'expired' else i.status end,
         i.expires_at
  from public.gym_admin_invites i
  join public.gyms g on g.id=i.gym_id
  where i.token_hash=encode(extensions.digest(invite_token,'sha256'),'hex')
  limit 1;
$$;

CREATE OR REPLACE FUNCTION public.get_auth_email_context(p_user_id uuid, p_email text, p_gym_id uuid DEFAULT NULL::uuid, p_access_invite text DEFAULT NULL::text, p_signup_slug text DEFAULT NULL::text)
 RETURNS TABLE(gym_id uuid, gym_name text, gym_slug text, sender_name text, sender_email text, reply_to_email text, sender_domain_status text, accent_color text, logo_url text, footer_text text, invited_by text, invite_role text, access_invite boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  v_gym_id uuid;
  v_inviter uuid;
  v_invite_role text;
  v_is_invite boolean := false;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  if nullif(trim(coalesce(p_access_invite,'')),'') is not null then
    select i.gym_id, i.created_by, i.invite_role
      into v_gym_id, v_inviter, v_invite_role
    from public.gym_admin_invites i
    where i.token_hash = encode(extensions.digest(p_access_invite,'sha256'),'hex')
      and lower(i.email) = lower(trim(coalesce(p_email,'')))
      and i.status = 'open'
      and i.expires_at > now()
    limit 1;

    if v_gym_id is null then
      return;
    end if;
    v_is_invite := true;

  elsif nullif(trim(coalesce(p_signup_slug,'')),'') is not null then
    select g.id
      into v_gym_id
    from public.gyms g
    where g.id = p_gym_id
      and g.slug = p_signup_slug
      and exists (
        select 1
        from public.membership_plans mp
        where mp.gym_id = g.id
          and mp.is_active = true
          and mp.is_public = true
      )
    limit 1;

    if v_gym_id is null then
      return;
    end if;

  elsif p_gym_id is not null and p_user_id is not null then
    if exists (
      select 1
      from public.gym_members gm
      where gm.gym_id = p_gym_id
        and gm.user_id = p_user_id
        and gm.is_active = true
    ) then
      v_gym_id := p_gym_id;
    else
      return;
    end if;

  else
    return;
  end if;

  return query
  select
    g.id,
    g.name,
    g.slug,
    coalesce(nullif(trim(s.sender_name),''), g.name),
    s.sender_email,
    s.reply_to_email,
    coalesce(nullif(trim(s.sender_domain_status),''), 'unverified'),
    coalesce(nullif(trim(s.accent_color),''), '#0b1020'),
    s.logo_url,
    coalesce(nullif(trim(s.footer_text),''), 'Sent by ' || g.name || ' via HybridOne'),
    case
      when v_inviter is null then null
      else coalesce(
        nullif(trim(p.display_name),''),
        nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),
        'A gym Owner'
      )
    end,
    v_invite_role,
    v_is_invite
  from public.gyms g
  left join public.gym_communication_settings s on s.gym_id = g.id
  left join public.profiles p on p.id = v_inviter
  where g.id = v_gym_id
  limit 1;
end;
$$;

CREATE OR REPLACE FUNCTION public.get_auth_email_template(p_gym_id uuid, p_template_key text)
 RETURNS TABLE(subject text, preheader text, heading text, body_text text, button_label text, enabled boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  return query
  select
    t.subject,
    t.preheader,
    t.heading,
    t.body_text,
    t.button_label,
    t.enabled
  from public.gym_email_templates t
  where t.gym_id = p_gym_id
    and t.template_key = p_template_key
  limit 1;
end;
$$;

CREATE OR REPLACE FUNCTION public.get_class_booking_options(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
declare
  s public.class_sessions%rowtype;
  v_included boolean;
  v_paid boolean;
  v_plans jsonb;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into s from public.class_sessions where id=p_session_id;
  if not found then raise exception 'Class session not found'; end if;
  if not private.is_gym_member(s.gym_id) then raise exception 'Not a member of this gym'; end if;

  v_included:=private.member_has_class_access(s.gym_id,auth.uid());
  v_paid:=private.member_has_paid_class(s.id,auth.uid());

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',mp.id,'name',mp.name,'price_pence',mp.price_pence,'billing_interval',mp.billing_interval
  ) order by mp.price_pence,mp.name),'[]'::jsonb)
  into v_plans
  from public.membership_plans mp
  where mp.gym_id=s.gym_id and mp.is_active=true and mp.is_public=true and mp.includes_classes=true;

  return jsonb_build_object(
    'session_id',s.id,
    'included_with_membership',v_included,
    'already_paid',v_paid,
    'drop_in_price_pence',s.drop_in_price_pence,
    'can_pay_drop_in',s.drop_in_price_pence is not null,
    'upgrade_plans',v_plans
  );
end$$;

CREATE OR REPLACE FUNCTION public.get_class_calendar(p_gym_id uuid, p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS TABLE(session_id uuid, name text, description text, starts_at timestamp with time zone, ends_at timestamp with time zone, capacity integer, reserved_capacity integer, reserved_release_minutes_before integer, is_cancelled boolean, booked_count bigint, spaces_left bigint, my_booking_status text, reserved_eligible boolean, reserved_plan_names text[], bookable_for_me boolean, availability_note text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
  with my_plan as (
    select m.plan_id
    from public.memberships m
    where m.gym_id = p_gym_id and m.user_id = auth.uid() and m.status='active'
      and (m.starts_on is null or m.starts_on <= current_date)
      and (m.ends_on is null or m.ends_on >= current_date)
    order by m.created_at desc limit 1
  ), base as (
    select s.*,
      count(b.id) filter (where b.status='booked') as booked_count,
      max(case when b.user_id=auth.uid() then b.status end) as my_booking_status,
      exists(select 1 from public.class_session_reserved_plans rp where rp.session_id=s.id and rp.plan_id=(select plan_id from my_plan)) as reserved_eligible,
      coalesce((select array_agg(mp.name order by mp.price_pence,mp.name) from public.class_session_reserved_plans rp join public.membership_plans mp on mp.id=rp.plan_id where rp.session_id=s.id),array[]::text[]) as reserved_plan_names,
      count(b.id) filter (
        where b.status='booked' and not exists (
          select 1 from public.memberships m
          join public.class_session_reserved_plans rp on rp.plan_id=m.plan_id and rp.session_id=s.id
          where m.gym_id=s.gym_id and m.user_id=b.user_id and m.status='active'
            and (m.starts_on is null or m.starts_on<=current_date)
            and (m.ends_on is null or m.ends_on>=current_date)
        )
      ) as general_booked
    from public.class_sessions s
    left join public.class_bookings b on b.session_id=s.id
    where s.gym_id=p_gym_id and s.starts_at>=p_from and s.starts_at<p_to and private.is_gym_member(p_gym_id)
    group by s.id
  )
  select
    id,name,description,starts_at,ends_at,capacity,reserved_capacity,reserved_release_minutes_before,is_cancelled,
    booked_count,
    greatest(capacity-booked_count,0)::bigint,
    my_booking_status,
    reserved_eligible,
    reserved_plan_names,
    case
      when is_cancelled or starts_at<=now() or my_booking_status='booked' or booked_count>=capacity then false
      when reserved_capacity>0
        and not reserved_eligible
        and not (reserved_release_minutes_before is not null and now()>=(starts_at-make_interval(mins=>reserved_release_minutes_before)))
        and general_booked >= capacity-reserved_capacity then false
      else true
    end as bookable_for_me,
    case
      when is_cancelled then 'Cancelled'
      when starts_at<=now() then 'Started'
      when my_booking_status='booked' then 'Booked'
      when booked_count>=capacity then 'Full'
      when reserved_capacity>0 and not reserved_eligible
        and not (reserved_release_minutes_before is not null and now()>=(starts_at-make_interval(mins=>reserved_release_minutes_before)))
        and general_booked >= capacity-reserved_capacity then 'Remaining spaces are reserved for eligible memberships'
      when reserved_capacity>0 and array_length(reserved_plan_names,1)>0 then reserved_capacity||' spaces reserved for '||array_to_string(reserved_plan_names, ', ')
      else greatest(capacity-booked_count,0)||' spaces left'
    end as availability_note
  from base order by starts_at;
$$;

CREATE OR REPLACE FUNCTION public.get_email_invite_send_context(target_invite_id uuid, requesting_user_id uuid)
 RETURNS TABLE(invite_id uuid, gym_id uuid, email text, invite_role text, status text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  inv public.gym_admin_invites%rowtype;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  select i.* into inv
  from public.gym_admin_invites i
  where i.id = target_invite_id;

  if inv.id is null then
    raise exception 'Invite not found';
  end if;

  if not exists (
    select 1
    from public.gym_members gm
    where gm.gym_id = inv.gym_id
      and gm.user_id = requesting_user_id
      and gm.role = 'owner'::public.gym_member_role
      and gm.is_active = true
      and gm.access_status = 'active'
  ) then
    raise exception 'Owner access required';
  end if;

  return query
  select inv.id, inv.gym_id, inv.email, inv.invite_role, inv.status, inv.expires_at;
end;
$$;

CREATE OR REPLACE FUNCTION public.get_gym_team_accounts(target_gym_id uuid)
 RETURNS TABLE(user_id uuid, email text, display_name text, role gym_member_role, is_active boolean, access_status text, joined_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
begin
  if not exists (
    select 1
    from public.gym_members gm
    where gm.gym_id = target_gym_id
      and gm.user_id = auth.uid()
      and gm.is_active = true
      and gm.access_status = 'active'
      and gm.role in ('owner'::public.gym_member_role,'admin'::public.gym_member_role)
  ) then
    raise exception 'Owner/Admin access required';
  end if;

  return query
  select
    gm.user_id,
    u.email::text,
    coalesce(
      nullif(p.display_name,''),
      nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),
      split_part(u.email,'@',1)
    )::text as display_name,
    gm.role,
    gm.is_active,
    gm.access_status,
    gm.joined_at
  from public.gym_members gm
  join auth.users u on u.id = gm.user_id
  left join public.profiles p on p.id = gm.user_id
  where gm.gym_id = target_gym_id
    and gm.role <> 'member'::public.gym_member_role
  order by
    case gm.role
      when 'owner'::public.gym_member_role then 1
      when 'admin'::public.gym_member_role then 2
      when 'staff'::public.gym_member_role then 3
      when 'coach'::public.gym_member_role then 4
      else 5
    end,
    lower(coalesce(p.display_name, trim(concat_ws(' ',p.first_name,p.last_name)), u.email));
end;
$$;

CREATE OR REPLACE FUNCTION public.get_member_home_settings(p_gym_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_layout jsonb;
  v_cta jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.gym_members gm
    where gm.gym_id = p_gym_id
      and gm.user_id = auth.uid()
      and gm.is_active = true
  ) then
    raise exception 'Not authorised for this gym';
  end if;

  select home_layout, cta_config
    into v_layout, v_cta
  from public.gym_member_view_settings
  where gym_id = p_gym_id;

  return jsonb_build_object(
    'home_layout', coalesce(v_layout, '[]'::jsonb),
    'cta_config', coalesce(v_cta, '{}'::jsonb)
  );
end;
$$;

CREATE OR REPLACE FUNCTION public.get_my_training_groups(p_gym_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $$
select coalesce(jsonb_agg(jsonb_build_object(
  'id',g.id,
  'name',g.name,
  'description',g.description,
  'invite_code',g.invite_code,
  'owner_user_id',g.owner_user_id,
  'owner_name',coalesce(p.display_name,p.first_name,'Member'),
  'member_count',(select count(*) from public.training_group_members gm2 where gm2.group_id=g.id),
  'challenge_count',(select count(*) from public.training_group_challenges c where c.group_id=g.id and (c.ends_at is null or c.ends_at>=now())),
  'created_at',g.created_at
) order by g.created_at desc),'[]'::jsonb)
from public.training_groups g
join public.training_group_members gm on gm.group_id=g.id and gm.user_id=auth.uid()
left join public.profiles p on p.id=g.owner_user_id
where g.gym_id=p_gym_id
and exists(select 1 from public.gym_members m where m.gym_id=p_gym_id and m.user_id=auth.uid() and m.is_active=true)
$$;

CREATE OR REPLACE FUNCTION public.get_public_gym_join_options(p_gym_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
declare
  v_gym public.gyms%rowtype;
  v_plans jsonb;
begin
  select * into v_gym
  from public.gyms
  where slug = p_gym_slug
  limit 1;

  if not found then
    raise exception 'Gym not found';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', mp.id,
      'name', mp.name,
      'description', mp.description,
      'price_pence', mp.price_pence,
      'billing_interval', mp.billing_interval,
      'joining_fee_pence', mp.joining_fee_pence,
      'access_type', mp.access_type,
      'includes_open_gym', mp.includes_open_gym,
      'includes_classes', mp.includes_classes,
      'includes_pt', mp.includes_pt,
      'classes_per_week', mp.classes_per_week,
      'trial_days', mp.trial_days
    )
    order by mp.price_pence, mp.name
  ), '[]'::jsonb)
  into v_plans
  from public.membership_plans mp
  where mp.gym_id = v_gym.id
    and mp.is_active = true
    and mp.is_public = true;

  return jsonb_build_object(
    'gym_id', v_gym.id,
    'gym_name', v_gym.name,
    'gym_slug', v_gym.slug,
    'logo_url', v_gym.logo_url,
    'plans', v_plans
  );
end;
$$;

CREATE OR REPLACE FUNCTION public.get_training_group_dashboard(p_group_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $$
declare v_user uuid:=auth.uid(); v_group public.training_groups%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.training_group_members gm where gm.group_id=p_group_id and gm.user_id=v_user) then
    raise exception 'You are not a member of this group';
  end if;
  select * into v_group from public.training_groups where id=p_group_id;
  return jsonb_build_object(
    'group',jsonb_build_object(
      'id',v_group.id,'name',v_group.name,'description',v_group.description,'invite_code',v_group.invite_code,
      'owner_user_id',v_group.owner_user_id
    ),
    'members',coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id',gm.user_id,
        'name',coalesce(p.display_name,p.first_name,'Member'),
        'joined_at',gm.joined_at,
        'recent_workouts',coalesce((
          select jsonb_agg(wj order by (wj->>'performed_at')::timestamptz desc)
          from (
            select jsonb_build_object('title',coalesce(ws.title,'Workout'),'performed_at',ws.performed_at) wj
            from public.workout_sessions ws
            where ws.gym_id=v_group.gym_id and ws.user_id=gm.user_id
            order by ws.performed_at desc limit 3
          ) q
        ),'[]'::jsonb),
        'recent_pbs',coalesce((
          select jsonb_agg(pj order by (pj->>'achieved_at')::timestamptz desc)
          from (
            select jsonb_build_object('exercise_name',pb.exercise_name,'value',pb.value_numeric,'unit',pb.unit,'achieved_at',pb.achieved_at) pj
            from public.personal_bests pb
            where pb.gym_id=v_group.gym_id and pb.user_id=gm.user_id
            order by pb.achieved_at desc limit 3
          ) q2
        ),'[]'::jsonb)
      ) order by coalesce(p.display_name,p.first_name,'Member'))
      from public.training_group_members gm
      left join public.profiles p on p.id=gm.user_id
      where gm.group_id=p_group_id
    ),'[]'::jsonb),
    'challenges',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',c.id,'name',c.name,'activity_name',c.activity_name,'metric_type',c.metric_type,'unit',c.unit,
        'comparison_direction',c.comparison_direction,'starts_at',c.starts_at,'ends_at',c.ends_at,
        'entries',coalesce((
          select jsonb_agg(jsonb_build_object(
            'user_id',e.user_id,'name',coalesce(p2.display_name,p2.first_name,'Member'),
            'value',e.value_numeric,'note',e.note,'submitted_at',e.submitted_at
          ) order by
            case when c.comparison_direction='higher' then e.value_numeric end desc nulls last,
            case when c.comparison_direction='lower' then e.value_numeric end asc nulls last)
          from public.training_group_challenge_entries e
          left join public.profiles p2 on p2.id=e.user_id
          where e.challenge_id=c.id
        ),'[]'::jsonb)
      ) order by c.created_at desc)
      from public.training_group_challenges c
      where c.group_id=p_group_id
    ),'[]'::jsonb)
  );
end$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
begin
  insert into public.profiles (id, first_name, last_name, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', split_part(coalesce(new.raw_user_meta_data->>'full_name', ''), ' ', 1), ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.hybridone_invite_edge_test_admin(p_action text, p_run_id text, p_user_id uuid DEFAULT NULL::uuid, p_gym_id uuid DEFAULT NULL::uuid, p_invite_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  v_prefix text := 'hybridone-edge-'||p_run_id||'-';
  v_email text;
  v_gym uuid;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'Service role required'; end if;
  if p_run_id !~ '^[0-9]+$' then raise exception 'Invalid run id'; end if;

  if p_user_id is not null then
    select lower(email) into v_email from auth.users where id=p_user_id;
    if v_email is null or v_email not like v_prefix||'%@example.com' then
      raise exception 'User is not an approved edge-test account';
    end if;
  end if;

  if p_action='create_gym' then
    v_gym:=gen_random_uuid();
    insert into public.gyms(id,name,slug,timezone,country_code,currency,created_at,updated_at)
    values(v_gym,'HybridOne Edge Test','hybridone-edge-'||p_run_id,'Europe/London','GB','GBP',now(),now());
    insert into public.profiles(id,display_name,updated_at)
    values(p_user_id,'HybridOne Edge Owner',now())
    on conflict(id) do update set display_name=excluded.display_name,updated_at=now();
    insert into public.gym_members(gym_id,user_id,role,is_active,access_status,joined_at,updated_at)
    values(v_gym,p_user_id,'owner',true,'active',now(),now());
    return jsonb_build_object('ok',true,'gym_id',v_gym);
  end if;

  if p_action='add_owner' then
    if not exists(select 1 from public.gyms where id=p_gym_id and slug='hybridone-edge-'||p_run_id) then
      raise exception 'Scratch gym not found';
    end if;
    insert into public.profiles(id,display_name,updated_at)
    values(p_user_id,'HybridOne Edge Owner 2',now())
    on conflict(id) do update set display_name=excluded.display_name,updated_at=now();
    insert into public.gym_members(gym_id,user_id,role,is_active,access_status,joined_at,updated_at)
    values(p_gym_id,p_user_id,'owner',true,'active',now(),now())
    on conflict(gym_id,user_id) do update
      set role='owner',is_active=true,access_status='active',access_revoked_at=null,updated_at=now();
    return jsonb_build_object('ok',true);
  end if;

  if p_action='remove_membership' then
    delete from public.gym_members
    where gym_id=p_gym_id and user_id=p_user_id;
    return jsonb_build_object('ok',true);
  end if;

  if p_action='expire_invite' then
    update public.gym_admin_invites i
    set expires_at=now()-interval '1 minute'
    where i.id=p_invite_id
      and i.gym_id=p_gym_id
      and lower(i.email) like v_prefix||'%@example.com';
    if not found then raise exception 'Test invite not found'; end if;
    return jsonb_build_object('ok',true);
  end if;

  if p_action='cleanup' then
    delete from public.gym_access_invite_approvals a
    using public.gym_admin_invites i
    where a.invite_id=i.id and lower(i.email) like v_prefix||'%@example.com';
    delete from public.gym_admin_invites i
    where lower(i.email) like v_prefix||'%@example.com';
    delete from public.gym_members gm
    where gm.user_id in (select id from auth.users where lower(email) like v_prefix||'%@example.com')
       or gm.gym_id in (select id from public.gyms where slug='hybridone-edge-'||p_run_id);
    delete from public.profiles p
    where p.id in (select id from auth.users where lower(email) like v_prefix||'%@example.com');
    delete from public.gyms where slug='hybridone-edge-'||p_run_id;
    return jsonb_build_object('ok',true);
  end if;

  raise exception 'Unsupported action';
end;
$$;

CREATE OR REPLACE FUNCTION public.join_public_gym_with_membership(p_gym_slug text, p_plan_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
declare
  v_uid uuid := auth.uid();
  v_gym_id uuid;
  v_gym_name text;
  v_plan public.membership_plans%rowtype;
  v_membership_id uuid;
  v_existing_role public.gym_member_role;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select id, name into v_gym_id, v_gym_name
  from public.gyms
  where slug = p_gym_slug
  limit 1;

  if v_gym_id is null then
    raise exception 'Gym not found';
  end if;

  select * into v_plan
  from public.membership_plans
  where id = p_plan_id
    and gym_id = v_gym_id
    and is_active = true
    and is_public = true;

  if not found then
    raise exception 'Membership plan is not available';
  end if;

  select role into v_existing_role
  from public.gym_members
  where gym_id = v_gym_id
    and user_id = v_uid
  limit 1;

  if v_existing_role is null then
    insert into public.gym_members(gym_id,user_id,role,is_active)
    values(v_gym_id,v_uid,'member',true);
  else
    update public.gym_members
    set is_active = true, updated_at = now()
    where gym_id = v_gym_id and user_id = v_uid;
  end if;

  select id into v_membership_id
  from public.memberships
  where gym_id = v_gym_id
    and user_id = v_uid
    and status in ('active','pending','paused')
  order by created_at desc
  limit 1;

  if v_membership_id is null then
    insert into public.memberships(
      gym_id,user_id,plan_id,status,starts_on,payment_provider,payment_status
    )
    values(
      v_gym_id,v_uid,v_plan.id,'active',current_date,'manual','confirmed'
    )
    returning id into v_membership_id;
  else
    update public.memberships
    set plan_id = v_plan.id,
        status = 'active',
        starts_on = coalesce(starts_on,current_date),
        ends_on = null,
        payment_provider = 'manual',
        payment_status = 'confirmed',
        provider_customer_id = null,
        provider_mandate_id = null,
        provider_subscription_id = null,
        provider_status = 'test_manual_active',
        provider_last_synced_at = now(),
        updated_at = now()
    where id = v_membership_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'gym_id', v_gym_id,
    'gym_name', v_gym_name,
    'plan_id', v_plan.id,
    'plan_name', v_plan.name,
    'membership_id', v_membership_id,
    'status', 'active',
    'payment_mode', 'manual_test'
  );
end;
$$;

CREATE OR REPLACE FUNCTION public.join_training_group_by_code(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $$
declare v_user uuid:=auth.uid(); v_group public.training_groups%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_group from public.training_groups where upper(invite_code)=upper(trim(p_code));
  if v_group.id is null then raise exception 'Invite not found'; end if;
  if not private.can_write_gym(v_group.gym_id) then
    raise exception 'You need an active membership at this gym to join this group';
  end if;
  insert into public.training_group_members(group_id,user_id) values(v_group.id,v_user) on conflict do nothing;
  return jsonb_build_object('id',v_group.id,'name',v_group.name);
end$$;

CREATE OR REPLACE FUNCTION public.mark_email_invite_sent(target_invite_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
begin
  if auth.role()<>'service_role' then raise exception 'Service role required'; end if;
  update public.gym_admin_invites i
  set email_sent_at=now()
  where i.id=target_invite_id and i.status='open';
end;
$$;

CREATE OR REPLACE FUNCTION public.member_book_class(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
declare
  s public.class_sessions%rowtype;
  v_count integer;
  v_id uuid;
  v_included boolean;
  v_paid boolean;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into s from public.class_sessions where id=p_session_id for update;
  if not found then raise exception 'Class session not found'; end if;
  if not private.can_write_gym(s.gym_id) then
    raise exception 'Not an active gym member';
  end if;
  if coalesce(s.is_cancelled,false) then raise exception 'This class has been cancelled'; end if;
  if s.starts_at<=now() then raise exception 'This class has already started'; end if;

  if exists(select 1 from public.class_bookings b where b.session_id=p_session_id and b.user_id=auth.uid() and b.status='booked') then
    return jsonb_build_object('status','booked','already_booked',true);
  end if;

  v_included:=private.member_has_class_access(s.gym_id,auth.uid());
  v_paid:=private.member_has_paid_class(s.id,auth.uid());
  if not v_included and not v_paid then
    if s.drop_in_price_pence is null then
      raise exception 'Your membership does not include classes. Upgrade to a class-inclusive membership to book this class.';
    else
      raise exception 'Your membership does not include classes. This class costs £% as a drop-in, or you can upgrade your membership.',to_char(s.drop_in_price_pence/100.0,'FM999999990.00');
    end if;
  end if;

  select count(*) into v_count from public.class_bookings b where b.session_id=p_session_id and b.status='booked';
  if s.capacity is not null and v_count>=s.capacity then raise exception 'This class is full'; end if;

  insert into public.class_bookings(gym_id,session_id,user_id,status,booked_at,cancelled_at)
  values(s.gym_id,p_session_id,auth.uid(),'booked',now(),null)
  on conflict(session_id,user_id) do update set status='booked',booked_at=now(),cancelled_at=null,updated_at=now()
  returning id into v_id;

  return jsonb_build_object('status','booked','booking_id',v_id);
end$$;

CREATE OR REPLACE FUNCTION public.member_cancel_class(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
declare
  s public.class_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into s from public.class_sessions where id=p_session_id;
  if not found then raise exception 'Class session not found'; end if;
  if not private.can_write_gym(s.gym_id) then raise exception 'Read-only access'; end if;
  if s.starts_at<=now() then raise exception 'This class has already started'; end if;

  delete from public.class_bookings where session_id=p_session_id and user_id=auth.uid();
  return jsonb_build_object('status','cancelled');
end;
$$;

CREATE OR REPLACE FUNCTION public.member_class_schedule(p_gym_id uuid, p_from timestamp with time zone DEFAULT now(), p_to timestamp with time zone DEFAULT (now() + '30 days'::interval))
 RETURNS TABLE(session_id uuid, name text, description text, starts_at timestamp with time zone, ends_at timestamp with time zone, capacity integer, booked_count integer, available_spaces integer, is_booked boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.gym_members gm where gm.gym_id=p_gym_id and gm.user_id=auth.uid() and gm.is_active) then
    raise exception 'Not an active gym member';
  end if;

  return query
  select s.id,
         s.name,
         s.description,
         s.starts_at,
         s.ends_at,
         s.capacity,
         count(b.id) filter (where b.status='booked')::integer as booked_count,
         greatest(coalesce(s.capacity,0) - count(b.id) filter (where b.status='booked')::integer,0) as available_spaces,
         exists(select 1 from public.class_bookings mine where mine.session_id=s.id and mine.user_id=auth.uid() and mine.status='booked') as is_booked
  from public.class_sessions s
  left join public.class_bookings b on b.session_id=s.id
  where s.gym_id=p_gym_id
    and not coalesce(s.is_cancelled,false)
    and s.starts_at>=p_from and s.starts_at<p_to
  group by s.id,s.name,s.description,s.starts_at,s.ends_at,s.capacity
  order by s.starts_at;
end;
$$;

CREATE OR REPLACE FUNCTION public.normalise_member_phone()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $$
declare
  v text;
begin
  if new.phone is null or btrim(new.phone) = '' then
    new.phone := null;
    return new;
  end if;

  v := regexp_replace(btrim(new.phone), '[^0-9+]', '', 'g');
  if v like '00%' then v := '+' || substr(v, 3); end if;
  if v ~ '^0[0-9]+$' then
    v := '+44' || substr(v, 2);
  elsif v ~ '^44[0-9]+$' then
    v := '+' || v;
  end if;
  if v ~ '^\+440[0-9]+$' then v := '+44' || substr(v, 5); end if;

  if v !~ '^\+[1-9][0-9]{6,14}$' then
    raise exception 'Invalid mobile number. Use a valid number such as 07123 456789 or +44 7123 456789.'
      using errcode = '22023';
  end if;

  new.phone := v;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.normalise_profile_phone()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $$
declare
  v text;
begin
  if new.phone is null or btrim(new.phone) = '' then
    new.phone := null;
    return new;
  end if;

  v := regexp_replace(btrim(new.phone), '[^0-9+]', '', 'g');
  if v like '00%' then v := '+' || substr(v, 3); end if;
  if v ~ '^0[0-9]+$' then
    v := '+44' || substr(v, 2);
  elsif v ~ '^44[0-9]+$' then
    v := '+' || v;
  end if;
  if v ~ '^\+440[0-9]+$' then v := '+44' || substr(v, 5); end if;

  if v !~ '^\+[1-9][0-9]{6,14}$' then
    raise exception 'Invalid mobile number. Use a valid number such as 07123 456789 or +44 7123 456789.'
      using errcode = '22023';
  end if;

  new.phone := v;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.notify_social_comment_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $$
declare post_owner uuid; parent_owner uuid; pref boolean;
begin
 select p.user_id into post_owner from public.social_posts p where p.id=new.post_id and p.gym_id=new.gym_id;
 if new.parent_comment_id is not null then select c.user_id into parent_owner from public.social_comments c where c.id=new.parent_comment_id and c.gym_id=new.gym_id; end if;
 if parent_owner is not null and parent_owner<>new.user_id then
  select coalesce(np.social_notifications,true) into pref from public.notification_preferences np where np.gym_id=new.gym_id and np.user_id=parent_owner;
  if coalesce(pref,true) then insert into public.member_notifications(gym_id,user_id,notification_type,title,body,related_post_id,related_comment_id) values(new.gym_id,parent_owner,'social_reply','New reply in Social',left(new.body,180),new.post_id,new.id); end if;
 end if;
 if post_owner is not null and post_owner<>new.user_id and (parent_owner is null or parent_owner<>post_owner) then
  pref:=null; select coalesce(np.social_notifications,true) into pref from public.notification_preferences np where np.gym_id=new.gym_id and np.user_id=post_owner;
  if coalesce(pref,true) then insert into public.member_notifications(gym_id,user_id,notification_type,title,body,related_post_id,related_comment_id) values(new.gym_id,post_owner,'social_comment','New comment on your post',left(new.body,180),new.post_id,new.id); end if;
 end if;
 return new;
end; $$;

CREATE OR REPLACE FUNCTION public.notify_social_reaction_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $$
declare target_user uuid; target_post uuid; pref boolean;
begin
 if new.comment_id is not null then select c.user_id,c.post_id into target_user,target_post from public.social_comments c where c.id=new.comment_id and c.gym_id=new.gym_id;
 elsif new.post_id is not null then select p.user_id,p.id into target_user,target_post from public.social_posts p where p.id=new.post_id and p.gym_id=new.gym_id; end if;
 if target_user is null or target_user=new.user_id then return new; end if;
 select coalesce(np.social_notifications,true) into pref from public.notification_preferences np where np.gym_id=new.gym_id and np.user_id=target_user;
 if coalesce(pref,true) then insert into public.member_notifications(gym_id,user_id,notification_type,title,body,related_post_id,related_comment_id) values(new.gym_id,target_user,'social_reaction','New reaction in Social','Someone reacted to your ' || case when new.comment_id is null then 'post' else 'comment' end || '.',target_post,new.comment_id); end if;
 return new;
end; $$;

CREATE OR REPLACE FUNCTION public.prepare_class_drop_in_purchase(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
declare
  s public.class_sessions%rowtype;
  p public.class_booking_purchases%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into s from public.class_sessions where id=p_session_id;
  if not found then raise exception 'Class session not found'; end if;
  if not private.can_write_gym(s.gym_id) then raise exception 'Not a member of this gym'; end if;
  if private.member_has_class_access(s.gym_id,auth.uid()) then
    return jsonb_build_object('included_with_membership',true);
  end if;
  if s.drop_in_price_pence is null then
    raise exception 'This class is not available as a drop-in. Upgrade to a class-inclusive membership.';
  end if;

  select * into p from public.class_booking_purchases
  where session_id=s.id and user_id=auth.uid() and status in ('pending','paid')
  order by created_at desc limit 1;

  if p.id is null then
    insert into public.class_booking_purchases(gym_id,session_id,user_id,amount_pence,currency,status)
    values(s.gym_id,s.id,auth.uid(),s.drop_in_price_pence,'GBP','pending')
    returning * into p;
  elsif p.status='pending' and p.amount_pence<>s.drop_in_price_pence then
    update public.class_booking_purchases
    set amount_pence=s.drop_in_price_pence,updated_at=now()
    where id=p.id returning * into p;
  end if;

  return jsonb_build_object(
    'purchase_id',p.id,
    'amount_pence',p.amount_pence,
    'currency',p.currency,
    'status',p.status,
    'checkout_connected',false
  );
end$$;

CREATE OR REPLACE FUNCTION public.prepare_email_invite_token(target_invite_id uuid, new_token text)
 RETURNS TABLE(email text, invite_role text, gym_name text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  inv public.gym_admin_invites%rowtype;
  gname text;
begin
  if auth.role()<>'service_role' then raise exception 'Service role required'; end if;
  select i.* into inv from public.gym_admin_invites i where i.id=target_invite_id for update;
  if inv.id is null then raise exception 'Invite not found'; end if;
  if inv.status<>'open' then raise exception 'Invite is not ready to send'; end if;
  if inv.expires_at<=now() then
    update public.gym_admin_invites i set status='expired' where i.id=inv.id;
    raise exception 'Invite has expired';
  end if;

  update public.gym_admin_invites i
  set token_hash=encode(extensions.digest(new_token,'sha256'),'hex')
  where i.id=inv.id;

  select g.name into gname from public.gyms g where g.id=inv.gym_id;
  return query select inv.email,inv.invite_role,gname,inv.expires_at;
end;
$$;

CREATE OR REPLACE FUNCTION public.preview_training_group_invite(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $$
declare v jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select jsonb_build_object(
    'id',g.id,'gym_id',g.gym_id,'name',g.name,'description',g.description,
    'owner_name',coalesce(p.display_name,p.first_name,'Member'),
    'member_count',(select count(*) from public.training_group_members x where x.group_id=g.id),
    'already_member',exists(select 1 from public.training_group_members x where x.group_id=g.id and x.user_id=auth.uid())
  ) into v
  from public.training_groups g
  left join public.profiles p on p.id=g.owner_user_id
  where upper(g.invite_code)=upper(trim(p_code));
  if v is null then raise exception 'Invite not found'; end if;
  if not exists(select 1 from public.gym_members gm where gm.gym_id=(v->>'gym_id')::uuid and gm.user_id=auth.uid() and gm.is_active=true) then
    raise exception 'You need an active membership at this gym to join this group';
  end if;
  return v;
end$$;

CREATE OR REPLACE FUNCTION public.propose_gym_deletion(target_gym_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  action_id uuid;
  result jsonb;
begin
  if not private.has_gym_role(target_gym_id,array['owner'::public.gym_member_role]) then
    raise exception 'Owner access required';
  end if;

  select id into action_id
  from public.gym_ownership_actions
  where gym_id=target_gym_id
    and action_type='delete_gym'
    and status='pending'
  order by created_at desc limit 1;

  if action_id is null then
    insert into public.gym_ownership_actions(gym_id,action_type,created_by)
    values(target_gym_id,'delete_gym',auth.uid())
    returning id into action_id;
  end if;

  insert into public.gym_ownership_action_approvals(action_id,owner_user_id)
  values(action_id,auth.uid())
  on conflict do nothing;

  select private.execute_ownership_action(action_id) into result;
  return result;
end;
$$;

CREATE OR REPLACE FUNCTION public.propose_owner_promotion(target_gym_id uuid, target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  member public.gym_members%rowtype;
  action_id uuid;
  action_name text;
  result jsonb;
  v_target_user_id uuid := target_user_id;
begin
  if not private.has_gym_role(target_gym_id,array['owner'::public.gym_member_role]) then
    raise exception 'Owner access required';
  end if;

  select * into member
  from public.gym_members gm
  where gm.gym_id=target_gym_id
    and gm.user_id=v_target_user_id
    and gm.is_active=true;

  if member.id is null then raise exception 'Account is not active at this gym'; end if;

  if member.role='owner'::public.gym_member_role and member.access_status='pending' then
    action_name:='activate_owner';
  elsif member.role='admin'::public.gym_member_role and member.access_status='active' then
    action_name:='promote_owner';
  else
    raise exception 'Only a pending Owner or active Admin can be promoted';
  end if;

  select goa.id into action_id
  from public.gym_ownership_actions goa
  where goa.gym_id=target_gym_id
    and goa.action_type=action_name
    and goa.target_user_id=v_target_user_id
    and goa.status='pending'
  order by goa.created_at desc
  limit 1;

  if action_id is null then
    insert into public.gym_ownership_actions(gym_id,action_type,target_user_id,created_by)
    values(target_gym_id,action_name,v_target_user_id,auth.uid())
    returning id into action_id;
  end if;

  insert into public.gym_ownership_action_approvals(action_id,owner_user_id)
  values(action_id,auth.uid())
  on conflict do nothing;

  select private.execute_ownership_action(action_id) into result;
  return result;
end;
$$;

CREATE OR REPLACE FUNCTION public.propose_owner_removal(target_gym_id uuid, target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  owner_count integer;
  action_id uuid;
  result jsonb;
  v_target_user_id uuid := target_user_id;
begin
  if not private.has_gym_role(target_gym_id,array['owner'::public.gym_member_role]) then
    raise exception 'Owner access required';
  end if;

  select count(*) into owner_count
  from public.gym_members gm
  where gm.gym_id=target_gym_id
    and gm.role='owner'::public.gym_member_role
    and gm.is_active=true
    and gm.access_status='active';

  if owner_count<=1 then raise exception 'The gym must always retain at least one Owner'; end if;

  if not exists(
    select 1
    from public.gym_members gm
    where gm.gym_id=target_gym_id
      and gm.user_id=v_target_user_id
      and gm.role='owner'::public.gym_member_role
      and gm.is_active=true
      and gm.access_status='active'
  ) then raise exception 'Active Owner not found'; end if;

  select goa.id into action_id
  from public.gym_ownership_actions goa
  where goa.gym_id=target_gym_id
    and goa.action_type='remove_owner'
    and goa.target_user_id=v_target_user_id
    and goa.status='pending'
  order by goa.created_at desc
  limit 1;

  if action_id is null then
    insert into public.gym_ownership_actions(gym_id,action_type,target_user_id,created_by)
    values(target_gym_id,'remove_owner',v_target_user_id,auth.uid())
    returning id into action_id;
  end if;

  insert into public.gym_ownership_action_approvals(action_id,owner_user_id)
  values(action_id,auth.uid())
  on conflict do nothing;

  select private.execute_ownership_action(action_id) into result;
  return result;
end;
$$;

CREATE OR REPLACE FUNCTION public.provision_staff_membership_with_level(target_gym_id uuid, target_user_id uuid, target_display_name text, target_role text, target_level_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
AS $$
declare
  v_permissions jsonb;
  v_first text;
  v_last text;
  v_role public.gym_member_role;
begin
  if not (
    private.has_gym_role(
      target_gym_id,
      array['owner'::public.gym_member_role,'admin'::public.gym_member_role]
    )
    or private.has_gym_staff_permission(target_gym_id,'manage_staff')
  ) then
    raise exception 'Staff management permission required';
  end if;

  if target_role not in ('staff','coach') then
    raise exception 'Role must be Staff or Coach';
  end if;
  v_role := target_role::public.gym_member_role;

  select l.permissions
    into v_permissions
  from public.staff_access_levels l
  where l.id=target_level_id
    and l.gym_id=target_gym_id
    and l.is_active=true;

  if v_permissions is null then
    raise exception 'A valid active access level is required';
  end if;

  v_first := split_part(trim(coalesce(target_display_name,'')),' ',1);
  v_last := nullif(trim(substr(trim(coalesce(target_display_name,'')), length(v_first)+1)),'');

  insert into public.profiles(id,display_name,first_name,last_name,updated_at)
  values(target_user_id,nullif(trim(target_display_name),''),nullif(v_first,''),v_last,now())
  on conflict(id) do update
    set display_name=coalesce(nullif(excluded.display_name,''),public.profiles.display_name),
        first_name=coalesce(nullif(excluded.first_name,''),public.profiles.first_name),
        last_name=coalesce(excluded.last_name,public.profiles.last_name),
        updated_at=now();

  insert into public.staff_access(
    gym_id,user_id,preset,permissions,access_level_id,updated_at,updated_by
  )
  values(
    target_gym_id,target_user_id,'level',v_permissions,target_level_id,now(),auth.uid()
  )
  on conflict(gym_id,user_id) do update
    set preset='level',
        permissions=excluded.permissions,
        access_level_id=excluded.access_level_id,
        updated_at=now(),
        updated_by=auth.uid();

  insert into public.gym_members(
    gym_id,user_id,role,is_active,access_status,joined_at,updated_at,access_revoked_at
  )
  values(
    target_gym_id,target_user_id,v_role,true,'active',now(),now(),null
  )
  on conflict(gym_id,user_id) do update
    set role=excluded.role,
        is_active=true,
        access_status='active',
        access_revoked_at=null,
        updated_at=now();
end;
$$;

CREATE OR REPLACE FUNCTION public.queue_class_booking_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
declare
  s public.class_sessions%rowtype;
  p public.notification_preferences%rowtype;
  reminder_at timestamptz;
begin
  select * into s from public.class_sessions where id=new.session_id;
  select * into p from public.notification_preferences where gym_id=new.gym_id and user_id=new.user_id;

  if new.status='booked' and (tg_op='INSERT' or old.status is distinct from 'booked') then
    if coalesce(p.booking_confirmation,true) then
      insert into public.member_notifications(gym_id,user_id,notification_type,title,body,related_session_id,scheduled_for)
      values(new.gym_id,new.user_id,'booking_confirmation','Class booked',s.name||' is booked for '||to_char(s.starts_at at time zone 'Europe/London','Dy DD Mon HH24:MI')||'.',new.session_id,now())
      on conflict (user_id,related_session_id,notification_type) where related_session_id is not null do update set title=excluded.title,body=excluded.body,scheduled_for=now(),delivered_at=null,read_at=null;
    end if;
    if coalesce(p.class_reminders,true) then
      reminder_at:=s.starts_at-make_interval(mins=>coalesce(p.reminder_minutes,60));
      if reminder_at>now() then
        insert into public.member_notifications(gym_id,user_id,notification_type,title,body,related_session_id,scheduled_for)
        values(new.gym_id,new.user_id,'class_reminder','Class reminder',s.name||' starts at '||to_char(s.starts_at at time zone 'Europe/London','HH24:MI')||'.',new.session_id,reminder_at)
        on conflict (user_id,related_session_id,notification_type) where related_session_id is not null do update set title=excluded.title,body=excluded.body,scheduled_for=excluded.scheduled_for,delivered_at=null,read_at=null;
      end if;
    end if;
  elsif new.status='cancelled' and (tg_op='UPDATE' and old.status is distinct from 'cancelled') then
    delete from public.member_notifications where user_id=new.user_id and related_session_id=new.session_id and notification_type='class_reminder' and delivered_at is null;
    insert into public.member_notifications(gym_id,user_id,notification_type,title,body,related_session_id,scheduled_for)
    values(new.gym_id,new.user_id,'booking_cancelled','Booking cancelled',s.name||' booking has been cancelled.',new.session_id,now())
    on conflict (user_id,related_session_id,notification_type) where related_session_id is not null do update set body=excluded.body,scheduled_for=now(),delivered_at=null,read_at=null;
  end if;
  return new;
end $$;

CREATE OR REPLACE FUNCTION public.queue_social_comment_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
declare
  v_post_owner uuid;
  v_parent_owner uuid;
  v_actor_name text;
  v_post_body text;
begin
  select sp.user_id,sp.body into v_post_owner,v_post_body
  from public.social_posts sp
  where sp.id=new.post_id;

  select coalesce(p.display_name,nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),'A member')
  into v_actor_name
  from public.profiles p
  where p.id=new.user_id;

  if new.parent_comment_id is not null then
    select sc.user_id into v_parent_owner
    from public.social_comments sc
    where sc.id=new.parent_comment_id;
  end if;

  if v_post_owner is not null
     and v_post_owner<>new.user_id
     and coalesce((select np.social_notifications from public.notification_preferences np where np.gym_id=new.gym_id and np.user_id=v_post_owner),true)
  then
    insert into public.member_notifications(
      gym_id,user_id,notification_type,title,body,related_post_id,related_comment_id,scheduled_for
    ) values(
      new.gym_id,
      v_post_owner,
      case when new.parent_comment_id is null then 'social_comment' else 'social_reply' end,
      case when new.parent_comment_id is null then 'New comment on your post' else 'New reply in your post' end,
      v_actor_name||case when new.parent_comment_id is null then ' commented on your post.' else ' replied in your post.' end,
      new.post_id,
      new.id,
      now()
    );
  end if;

  if v_parent_owner is not null
     and v_parent_owner<>new.user_id
     and v_parent_owner is distinct from v_post_owner
     and coalesce((select np.social_notifications from public.notification_preferences np where np.gym_id=new.gym_id and np.user_id=v_parent_owner),true)
  then
    insert into public.member_notifications(
      gym_id,user_id,notification_type,title,body,related_post_id,related_comment_id,scheduled_for
    ) values(
      new.gym_id,
      v_parent_owner,
      'social_reply',
      'New reply to your comment',
      v_actor_name||' replied to your comment.',
      new.post_id,
      new.id,
      now()
    );
  end if;

  return new;
end$$;

CREATE OR REPLACE FUNCTION public.remove_admin_access(target_gym_id uuid, target_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
begin
  if not private.has_gym_role(target_gym_id,array['owner'::public.gym_member_role]) then
    raise exception 'Owner access required';
  end if;

  update public.gym_members
  set is_active=false,
      access_status='revoked',
      access_revoked_at=now(),
      updated_at=now()
  where gym_id=target_gym_id
    and user_id=target_user_id
    and role='admin'::public.gym_member_role;

  if not found then raise exception 'Admin access not found'; end if;

  update public.gym_admin_invites
  set status='revoked',revoked_at=now()
  where gym_id=target_gym_id
    and claimed_by=target_user_id
    and status in ('claimed','approved');

  return true;
end;
$$;

CREATE OR REPLACE FUNCTION public.remove_gym_staff_access(target_gym_id uuid, target_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  target_role public.gym_member_role;
begin
  if not exists (
    select 1
    from public.gym_members gm
    where gm.gym_id = target_gym_id
      and gm.user_id = auth.uid()
      and gm.is_active = true
      and gm.access_status = 'active'
      and gm.role in ('owner'::public.gym_member_role,'admin'::public.gym_member_role)
  ) then
    raise exception 'Owner/Admin access required';
  end if;

  select gm.role
    into target_role
  from public.gym_members gm
  where gm.gym_id = target_gym_id
    and gm.user_id = target_user_id
  limit 1;

  if target_role is null then
    raise exception 'Gym team account not found';
  end if;

  if target_role not in ('staff'::public.gym_member_role,'coach'::public.gym_member_role) then
    raise exception 'Use Admin Access to change Owner/Admin access';
  end if;

  update public.gym_members
  set is_active = false,
      access_status = 'revoked',
      access_revoked_at = now(),
      updated_at = now()
  where gym_id = target_gym_id
    and user_id = target_user_id
    and role in ('staff'::public.gym_member_role,'coach'::public.gym_member_role);

  update public.staff_profiles
  set is_active = false,
      updated_at = now()
  where gym_id = target_gym_id
    and user_id = target_user_id;

  delete from public.staff_access
  where gym_id = target_gym_id
    and user_id = target_user_id;

  return true;
end;
$$;

CREATE OR REPLACE FUNCTION public.revoke_admin_invite(target_invite_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  inv public.gym_admin_invites%rowtype;
begin
  select * into inv from public.gym_admin_invites where id=target_invite_id for update;
  if inv.id is null then raise exception 'Invite not found'; end if;
  if not private.has_gym_role(inv.gym_id,array['owner'::public.gym_member_role]) then
    raise exception 'Owner access required';
  end if;
  if inv.status='approved' then raise exception 'Remove the approved access instead'; end if;

  update public.gym_admin_invites
  set status='revoked',revoked_at=now()
  where id=inv.id;

  if inv.claimed_by is not null then
    update public.gym_members
    set is_active=false,
        access_status='revoked',
        access_revoked_at=now(),
        updated_at=now()
    where gym_id=inv.gym_id
      and user_id=inv.claimed_by
      and role::text=inv.invite_role
      and access_status='pending';
  end if;

  return true;
end;
$$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_staff_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $$ begin new.updated_at=now(); return new; end; $$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.submit_training_group_challenge_result(p_challenge_id uuid, p_value numeric, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth'
AS $$
declare
  v_user uuid:=auth.uid();
  v_group uuid;
  v_gym_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select c.group_id,g.gym_id into v_group,v_gym_id
  from public.training_group_challenges c
  join public.training_groups g on g.id=c.group_id
  where c.id=p_challenge_id and (c.ends_at is null or c.ends_at>=now());

  if v_group is null then raise exception 'Challenge is not active'; end if;
  if not private.can_write_gym(v_gym_id) then raise exception 'Read-only access'; end if;
  if not exists(select 1 from public.training_group_members gm where gm.group_id=v_group and gm.user_id=v_user) then
    raise exception 'You are not a member of this group';
  end if;

  insert into public.training_group_challenge_entries(challenge_id,user_id,value_numeric,note,submitted_at)
  values(p_challenge_id,v_user,p_value,nullif(trim(coalesce(p_note,'')),''),now())
  on conflict(challenge_id,user_id) do update
  set value_numeric=excluded.value_numeric,note=excluded.note,submitted_at=now();
end;
$$;

CREATE OR REPLACE FUNCTION public.sync_future_class_session_price()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
begin
  if new.drop_in_price_pence is distinct from old.drop_in_price_pence then
    update public.class_sessions
    set drop_in_price_pence=new.drop_in_price_pence, updated_at=now()
    where class_type_id=new.id
      and starts_at>now()
      and coalesce(is_cancelled,false)=false;
  end if;
  return new;
end$$;

CREATE OR REPLACE FUNCTION public.validate_class_schedule(p_gym_id uuid, p_class_type_id uuid, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_capacity integer, p_staff_ids uuid[] DEFAULT '{}'::uuid[], p_exclude_session_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
declare
  v_local_start timestamp;
  v_local_end timestamp;
  v_weekday int;
  v_start_time time;
  v_end_time time;
  v_errors jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  r record;
  v_qualified boolean;
  v_working boolean;
  v_conflict boolean;
  v_room_cap integer;
begin
  if not private.has_gym_role(p_gym_id, array['owner'::gym_member_role,'admin'::gym_member_role]) then
    raise exception 'Not authorised';
  end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    return jsonb_build_object('ok',false,'errors',jsonb_build_array('Choose a valid start time and duration.'),'warnings',v_warnings);
  end if;
  v_local_start := p_starts_at at time zone 'Europe/London';
  v_local_end := p_ends_at at time zone 'Europe/London';
  if v_local_start::date <> v_local_end::date then
    v_errors := v_errors || jsonb_build_array('Classes cannot currently run across midnight.');
  end if;
  v_weekday := extract(dow from v_local_start)::int;
  v_start_time := v_local_start::time;
  v_end_time := v_local_end::time;

  for r in
    select sr.capability_id, c.name
    from public.service_requirements sr
    join public.capabilities c on c.id=sr.capability_id
    where sr.gym_id=p_gym_id and sr.class_type_id=p_class_type_id and sr.capability_id is not null
  loop
    select exists(
      select 1 from public.staff_capabilities sc
      where sc.gym_id=p_gym_id and sc.user_id=any(coalesce(p_staff_ids,'{}'::uuid[]))
        and sc.capability_id=r.capability_id and sc.qualified=true
        and (sc.expires_on is null or sc.expires_on >= v_local_start::date)
    ) into v_qualified;
    if not v_qualified then
      v_errors := v_errors || jsonb_build_array('No selected staff member is currently qualified for '||r.name||'.');
    end if;
  end loop;

  for r in select unnest(coalesce(p_staff_ids,'{}'::uuid[])) as user_id loop
    select exists(
      select 1 from public.staff_working_hours wh
      where wh.gym_id=p_gym_id and wh.user_id=r.user_id and wh.weekday=v_weekday and wh.is_working=true
        and wh.start_time <= v_start_time and wh.end_time >= v_end_time
    ) into v_working;
    if not v_working then
      v_errors := v_errors || jsonb_build_array('A selected staff member is outside their configured working hours.');
    end if;
    select exists(
      select 1 from public.class_session_staff css
      join public.class_sessions cs on cs.id=css.session_id
      where css.gym_id=p_gym_id and css.user_id=r.user_id and cs.is_cancelled=false
        and (p_exclude_session_id is null or cs.id<>p_exclude_session_id)
        and tstzrange(cs.starts_at,cs.ends_at,'[)') && tstzrange(p_starts_at,p_ends_at,'[)')
    ) into v_conflict;
    if v_conflict then
      v_errors := v_errors || jsonb_build_array('A selected staff member is already assigned to another class at this time.');
    end if;
  end loop;

  for r in
    select sr.resource_id, sr.quantity, res.name, res.resource_type, res.capacity, res.allow_overlap, res.is_bookable
    from public.service_requirements sr
    join public.resources res on res.id=sr.resource_id
    where sr.gym_id=p_gym_id and sr.class_type_id=p_class_type_id and sr.resource_id is not null and res.is_active=true
  loop
    if not r.is_bookable then
      v_errors := v_errors || jsonb_build_array(r.name||' is not currently bookable.');
    end if;
    if r.capacity is not null and r.resource_type in ('room','area') and p_capacity > r.capacity then
      v_errors := v_errors || jsonb_build_array('Class capacity exceeds the maximum occupancy of '||r.name||' ('||r.capacity||').');
    end if;
    if exists(select 1 from public.resource_availability ra where ra.resource_id=r.resource_id and ra.weekday=v_weekday) then
      if not exists(select 1 from public.resource_availability ra where ra.resource_id=r.resource_id and ra.weekday=v_weekday and ra.is_available=true and ra.start_time<=v_start_time and ra.end_time>=v_end_time) then
        v_errors := v_errors || jsonb_build_array(r.name||' is outside its configured available hours.');
      end if;
    end if;
    if not r.allow_overlap then
      select exists(
        select 1 from public.class_session_resources csr
        join public.class_sessions cs on cs.id=csr.session_id
        where csr.gym_id=p_gym_id and csr.resource_id=r.resource_id and cs.is_cancelled=false
          and (p_exclude_session_id is null or cs.id<>p_exclude_session_id)
          and tstzrange(cs.starts_at,cs.ends_at,'[)') && tstzrange(p_starts_at,p_ends_at,'[)')
      ) into v_conflict;
      if v_conflict then
        v_errors := v_errors || jsonb_build_array(r.name||' is already booked at this time.');
      end if;
    end if;
  end loop;

  return jsonb_build_object('ok',jsonb_array_length(v_errors)=0,'errors',v_errors,'warnings',v_warnings);
end;
$$;
;
set check_function_bodies = on;

alter table public.calendar_feed_tokens enable row level security;
alter table public.capabilities enable row level security;
alter table public.channel_members enable row level security;
alter table public.channels enable row level security;
alter table public.class_booking_purchases enable row level security;
alter table public.class_bookings enable row level security;
alter table public.class_session_reserved_plans enable row level security;
alter table public.class_session_resources enable row level security;
alter table public.class_session_staff enable row level security;
alter table public.class_sessions enable row level security;
alter table public.class_types enable row level security;
alter table public.gym_access_invite_approvals enable row level security;
alter table public.gym_access_settings enable row level security;
alter table public.gym_admin_invites enable row level security;
alter table public.gym_communication_settings enable row level security;
alter table public.gym_email_templates enable row level security;
alter table public.gym_member_view_settings enable row level security;
alter table public.gym_members enable row level security;
alter table public.gym_ownership_action_approvals enable row level security;
alter table public.gym_ownership_actions enable row level security;
alter table public.gyms enable row level security;
alter table public.member_notifications enable row level security;
alter table public.member_training_preferences enable row level security;
alter table public.members enable row level security;
alter table public.membership_plans enable row level security;
alter table public.memberships enable row level security;
alter table public.messages enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.payment_provider_connections enable row level security;
alter table public.payment_records enable row level security;
alter table public.personal_bests enable row level security;
alter table public.profiles enable row level security;
alter table public.pt_appointments enable row level security;
alter table public.resource_availability enable row level security;
alter table public.resources enable row level security;
alter table public.service_requirements enable row level security;
alter table public.social_comments enable row level security;
alter table public.social_posts enable row level security;
alter table public.social_reactions enable row level security;
alter table public.staff_access enable row level security;
alter table public.staff_access_levels enable row level security;
alter table public.staff_capabilities enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.staff_working_hours enable row level security;
alter table public.strava_activities enable row level security;
alter table public.strava_connections enable row level security;
alter table public.training_group_challenge_entries enable row level security;
alter table public.training_group_challenges enable row level security;
alter table public.training_group_members enable row level security;
alter table public.training_groups enable row level security;
alter table public.workout_assignments enable row level security;
alter table public.workout_entries enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_sets enable row level security;
alter table public.workout_template_activities enable row level security;
alter table public.workout_template_blocks enable row level security;
alter table public.workout_templates enable row level security;
alter table public.workout_wods enable row level security;

create policy "members_manage_own_calendar_tokens" on public.calendar_feed_tokens for all to "authenticated" using (((user_id = auth.uid()) AND private.can_write_gym(gym_id))) with check (((user_id = auth.uid()) AND private.can_write_gym(gym_id)));
create policy "gym members view capabilities" on public.capabilities for select to public using (private.is_gym_member(gym_id));
create policy "owners admins manage capabilities" on public.capabilities for all to public using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])) with check (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]));
create policy "gym users can read channel membership" on public.channel_members for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM channels c
  WHERE ((c.id = channel_members.channel_id) AND private.is_gym_member(c.gym_id)))));
create policy "staff can delete channel membership" on public.channel_members for delete to "authenticated" using ((EXISTS ( SELECT 1
   FROM channels c
  WHERE ((c.id = channel_members.channel_id) AND private.has_gym_role(c.gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role])))));
create policy "staff can insert channel membership" on public.channel_members for insert to "authenticated" with check ((EXISTS ( SELECT 1
   FROM channels c
  WHERE ((c.id = channel_members.channel_id) AND private.has_gym_role(c.gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role])))));
create policy "gym members can read channels" on public.channels for select to "authenticated" using (private.is_gym_member(gym_id));
create policy "staff can delete channels" on public.channels for delete to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role]));
create policy "staff can insert channels" on public.channels for insert to "authenticated" with check (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role]));
create policy "staff can update channels" on public.channels for update to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role])) with check (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role]));
create policy "assigned class staff can view bookings" on public.class_bookings for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM class_session_staff css
  WHERE ((css.session_id = class_bookings.session_id) AND (css.user_id = auth.uid()) AND (css.gym_id = class_bookings.gym_id)))));
create policy "assigned staff can mark attendance" on public.class_bookings for update to "authenticated" using (((EXISTS ( SELECT 1
   FROM class_session_staff css
  WHERE ((css.session_id = class_bookings.session_id) AND (css.user_id = auth.uid()) AND (css.gym_id = class_bookings.gym_id)))) AND private.staff_has_permission(gym_id, auth.uid(), 'mark_attendance'::text))) with check (((EXISTS ( SELECT 1
   FROM class_session_staff css
  WHERE ((css.session_id = class_bookings.session_id) AND (css.user_id = auth.uid()) AND (css.gym_id = class_bookings.gym_id)))) AND private.staff_has_permission(gym_id, auth.uid(), 'mark_attendance'::text) AND (status = ANY (ARRAY['booked'::text, 'attended'::text, 'no_show'::text]))));
create policy "gym managers can view class bookings" on public.class_bookings for select to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role]));
create policy "pending admins can read class bookings" on public.class_bookings for select to "authenticated" using (private.is_pending_admin(gym_id));
create policy "users can view own class bookings" on public.class_bookings for select to "authenticated" using ((user_id = auth.uid()));
create policy "gym members can view reserved plan rules" on public.class_session_reserved_plans for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM class_sessions s
  WHERE ((s.id = class_session_reserved_plans.session_id) AND private.is_gym_member(s.gym_id)))));
create policy "owners admins manage reserved plan rules" on public.class_session_reserved_plans for all to "authenticated" using ((EXISTS ( SELECT 1
   FROM class_sessions s
  WHERE ((s.id = class_session_reserved_plans.session_id) AND private.has_gym_role(s.gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]))))) with check ((EXISTS ( SELECT 1
   FROM class_sessions s
  WHERE ((s.id = class_session_reserved_plans.session_id) AND private.has_gym_role(s.gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])))));
create policy "gym members view session resources" on public.class_session_resources for select to public using (private.is_gym_member(gym_id));
create policy "owners admins manage session resources" on public.class_session_resources for all to public using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])) with check (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]));
create policy "gym members can view class staff" on public.class_session_staff for select to "authenticated" using (private.is_gym_member(gym_id));
create policy "owners admins assign class staff" on public.class_session_staff for insert to "authenticated" with check ((private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]) AND (EXISTS ( SELECT 1
   FROM gym_members gm
  WHERE ((gm.gym_id = class_session_staff.gym_id) AND (gm.user_id = class_session_staff.user_id) AND (gm.is_active = true) AND (gm.role = ANY (ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role]))))) AND (EXISTS ( SELECT 1
   FROM class_sessions cs
  WHERE ((cs.id = class_session_staff.session_id) AND (cs.gym_id = class_session_staff.gym_id))))));
create policy "owners admins delete class staff" on public.class_session_staff for delete to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]));
create policy "owners admins update class staff" on public.class_session_staff for update to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])) with check (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]));
create policy "coaches can view assigned session details" on public.class_sessions for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM class_session_staff css
  WHERE ((css.session_id = class_sessions.id) AND (css.user_id = auth.uid()) AND (css.gym_id = class_sessions.gym_id)))));
create policy "gym members can view class sessions" on public.class_sessions for select to "authenticated" using (private.is_gym_member(gym_id));
create policy "owners admins manage class sessions" on public.class_sessions for all to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])) with check (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]));
create policy "gym members can view class types" on public.class_types for select to "authenticated" using (private.is_gym_member(gym_id));
create policy "gym owners and admins can manage class types" on public.class_types for all to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])) with check (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]));
create policy "owners read invite approvals" on public.gym_access_invite_approvals for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM gym_admin_invites i
  WHERE ((i.id = gym_access_invite_approvals.invite_id) AND private.has_gym_role(i.gym_id, ARRAY['owner'::gym_member_role])))));
create policy "gym admins can insert access settings" on public.gym_access_settings for insert to "authenticated" with check (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]));
create policy "gym admins can update access settings" on public.gym_access_settings for update to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])) with check (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]));
create policy "gym members can view access settings" on public.gym_access_settings for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM gym_members gm
  WHERE ((gm.gym_id = gym_access_settings.gym_id) AND (gm.user_id = auth.uid()) AND (gm.is_active = true)))));
create policy "owners can read admin invites" on public.gym_admin_invites for select to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role]));
create policy "Gym admins manage communication settings" on public.gym_communication_settings for all to "authenticated" using ((EXISTS ( SELECT 1
   FROM gym_members gm
  WHERE ((gm.gym_id = gym_communication_settings.gym_id) AND (gm.user_id = auth.uid()) AND (gm.is_active = true) AND (gm.access_status = 'active'::text) AND (gm.role = ANY (ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])))))) with check ((EXISTS ( SELECT 1
   FROM gym_members gm
  WHERE ((gm.gym_id = gym_communication_settings.gym_id) AND (gm.user_id = auth.uid()) AND (gm.is_active = true) AND (gm.access_status = 'active'::text) AND (gm.role = ANY (ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]))))));
create policy "Gym admins manage email templates" on public.gym_email_templates for all to "authenticated" using ((EXISTS ( SELECT 1
   FROM gym_members gm
  WHERE ((gm.gym_id = gym_email_templates.gym_id) AND (gm.user_id = auth.uid()) AND (gm.is_active = true) AND (gm.access_status = 'active'::text) AND (gm.role = ANY (ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])))))) with check ((EXISTS ( SELECT 1
   FROM gym_members gm
  WHERE ((gm.gym_id = gym_email_templates.gym_id) AND (gm.user_id = auth.uid()) AND (gm.is_active = true) AND (gm.access_status = 'active'::text) AND (gm.role = ANY (ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]))))));
create policy "owners admins delete member view settings" on public.gym_member_view_settings for delete to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]));
create policy "owners admins insert member view settings" on public.gym_member_view_settings for insert to "authenticated" with check (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]));
create policy "owners admins read member view settings" on public.gym_member_view_settings for select to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]));
create policy "owners admins update member view settings" on public.gym_member_view_settings for update to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])) with check (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]));
create policy "pending admins can read member view settings" on public.gym_member_view_settings for select to "authenticated" using (private.is_pending_admin(gym_id));
create policy "admins can delete gym members" on public.gym_members for delete to "authenticated" using (private.can_manage_gym_member(gym_id, user_id, role));
create policy "admins can update gym members" on public.gym_members for update to "authenticated" using (private.can_manage_gym_member(gym_id, user_id, role)) with check (private.can_manage_gym_member(gym_id, user_id, role));
create policy "authorized users can insert gym members" on public.gym_members for insert to "authenticated" with check (((private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role]) AND (role <> 'owner'::gym_member_role)) OR (private.has_gym_role(gym_id, ARRAY['admin'::gym_member_role]) AND (role = ANY (ARRAY['member'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role]))) OR ((user_id = ( SELECT auth.uid() AS uid)) AND (role = 'owner'::gym_member_role) AND (NOT private.has_active_owner(gym_id)) AND (EXISTS ( SELECT 1
   FROM gyms g
  WHERE ((g.id = gym_members.gym_id) AND (g.created_by = ( SELECT auth.uid() AS uid))))))));
create policy "gym users can read members" on public.gym_members for select to "authenticated" using (private.is_gym_member(gym_id));
create policy "owners read ownership approvals" on public.gym_ownership_action_approvals for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM gym_ownership_actions a
  WHERE ((a.id = gym_ownership_action_approvals.action_id) AND private.has_gym_role(a.gym_id, ARRAY['owner'::gym_member_role])))));
create policy "owners read ownership actions" on public.gym_ownership_actions for select to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role]));
create policy "admins can update their gym" on public.gyms for update to "authenticated" using (private.has_gym_role(id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])) with check (private.has_gym_role(id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]));
create policy "authenticated users can create gyms" on public.gyms for insert to "authenticated" with check ((created_by = ( SELECT auth.uid() AS uid)));
create policy "authorized users can read gyms" on public.gyms for select to "authenticated" using (((created_by = ( SELECT auth.uid() AS uid)) OR private.is_gym_member(id)));
create policy "members_update_own_notifications" on public.member_notifications for update to "authenticated" using (((user_id = auth.uid()) AND private.can_write_gym(gym_id))) with check (((user_id = auth.uid()) AND private.can_write_gym(gym_id)));
create policy "members_view_own_notifications" on public.member_notifications for select to "authenticated" using (((user_id = auth.uid()) AND private.is_gym_member(gym_id)));
create policy "members insert own training preferences" on public.member_training_preferences for insert to "authenticated" with check (((user_id = auth.uid()) AND private.can_write_gym(gym_id)));
create policy "members read own training preferences" on public.member_training_preferences for select to "authenticated" using (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM gym_members gm
  WHERE ((gm.gym_id = member_training_preferences.gym_id) AND (gm.user_id = auth.uid()) AND (gm.is_active = true))))));
create policy "members update own training preferences" on public.member_training_preferences for update to "authenticated" using (((user_id = auth.uid()) AND private.can_write_gym(gym_id))) with check (((user_id = auth.uid()) AND private.can_write_gym(gym_id)));
create policy "gym users can read members" on public.members for select to "authenticated" using (private.is_gym_member(gym_id));
create policy "staff can delete members" on public.members for delete to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]));
create policy "staff can insert members" on public.members for insert to "authenticated" with check (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role]));
create policy "staff can update members" on public.members for update to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role])) with check (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role]));
create policy "admins can delete plans" on public.membership_plans for delete to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]));
create policy "admins can insert plans" on public.membership_plans for insert to "authenticated" with check (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]));
create policy "admins can update plans" on public.membership_plans for update to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])) with check (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]));
create policy "gym members can read plans" on public.membership_plans for select to "authenticated" using (private.is_gym_member(gym_id));
create policy "members and staff can read memberships" on public.memberships for select to "authenticated" using (((user_id = ( SELECT auth.uid() AS uid)) OR private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role])));
create policy "pending admins can read memberships" on public.memberships for select to "authenticated" using (private.is_pending_admin(gym_id));
create policy "staff can delete memberships" on public.memberships for delete to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role]));
create policy "staff can insert memberships" on public.memberships for insert to "authenticated" with check (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role]));
create policy "staff can update memberships" on public.memberships for update to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role])) with check (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role]));
create policy "channel members can read messages" on public.messages for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM channels c
  WHERE ((c.id = messages.channel_id) AND private.is_gym_member(c.gym_id) AND ((c.is_private = false) OR (EXISTS ( SELECT 1
           FROM channel_members cm
          WHERE ((cm.channel_id = c.id) AND (cm.user_id = ( SELECT auth.uid() AS uid))))))))));
create policy "channel members can send messages" on public.messages for insert to "authenticated" with check (((sender_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM channels c
  WHERE ((c.id = messages.channel_id) AND private.can_write_gym(c.gym_id) AND ((c.is_private = false) OR (EXISTS ( SELECT 1
           FROM channel_members cm
          WHERE ((cm.channel_id = c.id) AND (cm.user_id = ( SELECT auth.uid() AS uid)))))))))));
create policy "users can edit own messages" on public.messages for update to "authenticated" using (((sender_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM channels c
  WHERE ((c.id = messages.channel_id) AND private.can_write_gym(c.gym_id)))))) with check (((sender_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM channels c
  WHERE ((c.id = messages.channel_id) AND private.can_write_gym(c.gym_id))))));
create policy "members_manage_own_notification_preferences" on public.notification_preferences for all to "authenticated" using (((user_id = auth.uid()) AND private.can_write_gym(gym_id))) with check (((user_id = auth.uid()) AND private.can_write_gym(gym_id)));
create policy "admins can delete provider connections" on public.payment_provider_connections for delete to "authenticated" using (( SELECT private.has_gym_role(payment_provider_connections.gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]) AS has_gym_role));
create policy "admins can insert provider connections" on public.payment_provider_connections for insert to "authenticated" with check (( SELECT private.has_gym_role(payment_provider_connections.gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]) AS has_gym_role));
create policy "admins can read provider connections" on public.payment_provider_connections for select to "authenticated" using (( SELECT private.has_gym_role(payment_provider_connections.gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]) AS has_gym_role));
create policy "admins can update provider connections" on public.payment_provider_connections for update to "authenticated" using (( SELECT private.has_gym_role(payment_provider_connections.gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]) AS has_gym_role)) with check (( SELECT private.has_gym_role(payment_provider_connections.gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]) AS has_gym_role));
create policy "pending admins can read payment provider connections" on public.payment_provider_connections for select to "authenticated" using (private.is_pending_admin(gym_id));
create policy "admins can insert payments" on public.payment_records for insert to "authenticated" with check (( SELECT private.has_gym_role(payment_records.gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]) AS has_gym_role));
create policy "admins can update payments" on public.payment_records for update to "authenticated" using (( SELECT private.has_gym_role(payment_records.gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]) AS has_gym_role)) with check (( SELECT private.has_gym_role(payment_records.gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]) AS has_gym_role));
create policy "gym users can read relevant payments" on public.payment_records for select to "authenticated" using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.has_gym_role(payment_records.gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]) AS has_gym_role)));
create policy "pending admins can read payments" on public.payment_records for select to "authenticated" using (private.is_pending_admin(gym_id));
create policy "members_manage_own_personal_bests" on public.personal_bests for all to public using (((user_id = auth.uid()) AND private.can_write_gym(gym_id))) with check (((user_id = auth.uid()) AND private.can_write_gym(gym_id)));
create policy "staff_view_gym_personal_bests" on public.personal_bests for select to public using ((EXISTS ( SELECT 1
   FROM gym_members gm
  WHERE ((gm.gym_id = personal_bests.gym_id) AND (gm.user_id = auth.uid()) AND (gm.is_active = true) AND (gm.role = ANY (ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role]))))));
create policy "authorized users can read profiles" on public.profiles for select to "authenticated" using (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.can_view_profile(profiles.id) AS can_view_profile)));
create policy "users can update own profile" on public.profiles for update to "authenticated" using ((id = ( SELECT auth.uid() AS uid))) with check ((id = ( SELECT auth.uid() AS uid)));
create policy "members can view own pt appointments" on public.pt_appointments for select to "authenticated" using ((member_user_id = auth.uid()));
create policy "pt appointments delete" on public.pt_appointments for delete to public using ((private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]) OR (EXISTS ( SELECT 1
   FROM gym_members gm
  WHERE ((gm.gym_id = pt_appointments.gym_id) AND (gm.user_id = auth.uid()) AND gm.is_active AND (gm.access_status = 'active'::text) AND (gm.role = ANY (ARRAY['staff'::gym_member_role, 'coach'::gym_member_role])) AND (pt_appointments.staff_user_id = auth.uid()))))));
create policy "pt appointments insert" on public.pt_appointments for insert to public with check ((private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]) OR (EXISTS ( SELECT 1
   FROM gym_members gm
  WHERE ((gm.gym_id = pt_appointments.gym_id) AND (gm.user_id = auth.uid()) AND gm.is_active AND (gm.access_status = 'active'::text) AND (gm.role = ANY (ARRAY['staff'::gym_member_role, 'coach'::gym_member_role])) AND (pt_appointments.staff_user_id = auth.uid()))))));
create policy "pt appointments select" on public.pt_appointments for select to public using ((EXISTS ( SELECT 1
   FROM gym_members gm
  WHERE ((gm.gym_id = pt_appointments.gym_id) AND (gm.user_id = auth.uid()) AND gm.is_active AND ((gm.role = ANY (ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])) OR (pt_appointments.staff_user_id = auth.uid()))))));
create policy "pt appointments update" on public.pt_appointments for update to public using ((private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]) OR (EXISTS ( SELECT 1
   FROM gym_members gm
  WHERE ((gm.gym_id = pt_appointments.gym_id) AND (gm.user_id = auth.uid()) AND gm.is_active AND (gm.access_status = 'active'::text) AND (gm.role = ANY (ARRAY['staff'::gym_member_role, 'coach'::gym_member_role])) AND (pt_appointments.staff_user_id = auth.uid())))))) with check ((private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]) OR (EXISTS ( SELECT 1
   FROM gym_members gm
  WHERE ((gm.gym_id = pt_appointments.gym_id) AND (gm.user_id = auth.uid()) AND gm.is_active AND (gm.access_status = 'active'::text) AND (gm.role = ANY (ARRAY['staff'::gym_member_role, 'coach'::gym_member_role])) AND (pt_appointments.staff_user_id = auth.uid()))))));
create policy "gym members view resource availability" on public.resource_availability for select to public using (private.is_gym_member(gym_id));
create policy "owners admins manage resource availability" on public.resource_availability for all to public using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])) with check (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]));
create policy "gym members view resources" on public.resources for select to public using (private.is_gym_member(gym_id));
create policy "owners admins manage resources" on public.resources for all to public using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])) with check (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]));
create policy "gym members view service requirements" on public.service_requirements for select to public using (private.is_gym_member(gym_id));
create policy "owners admins manage service requirements" on public.service_requirements for all to public using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])) with check (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]));
create policy "authors or admins delete social comments" on public.social_comments for delete to "authenticated" using ((((user_id = auth.uid()) AND private.can_write_gym(gym_id)) OR private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])));
create policy "authors or admins update social comments" on public.social_comments for update to "authenticated" using ((((user_id = auth.uid()) AND private.can_write_gym(gym_id)) OR private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]))) with check ((((user_id = auth.uid()) AND private.can_write_gym(gym_id)) OR private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])));
create policy "gym members create social comments" on public.social_comments for insert to public with check (((user_id = auth.uid()) AND private.can_write_gym(gym_id)));
create policy "gym members read social comments" on public.social_comments for select to public using ((EXISTS ( SELECT 1
   FROM gym_members gm
  WHERE ((gm.gym_id = social_comments.gym_id) AND (gm.user_id = auth.uid()) AND gm.is_active))));
create policy "authors or admins delete social posts" on public.social_posts for delete to "authenticated" using ((((user_id = auth.uid()) AND private.can_write_gym(gym_id)) OR private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])));
create policy "authors or admins update social posts" on public.social_posts for update to "authenticated" using ((((user_id = auth.uid()) AND private.can_write_gym(gym_id)) OR private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]))) with check ((((user_id = auth.uid()) AND private.can_write_gym(gym_id)) OR private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])));
create policy "gym members create social posts" on public.social_posts for insert to public with check (((user_id = auth.uid()) AND private.can_write_gym(gym_id)));
create policy "gym members read social posts" on public.social_posts for select to public using ((EXISTS ( SELECT 1
   FROM gym_members gm
  WHERE ((gm.gym_id = social_posts.gym_id) AND (gm.user_id = auth.uid()) AND gm.is_active))));
create policy "gym members create social reactions" on public.social_reactions for insert to public with check (((user_id = auth.uid()) AND private.can_write_gym(gym_id)));
create policy "gym members read social reactions" on public.social_reactions for select to public using ((EXISTS ( SELECT 1
   FROM gym_members gm
  WHERE ((gm.gym_id = social_reactions.gym_id) AND (gm.user_id = auth.uid()) AND gm.is_active))));
create policy "users delete own social reactions" on public.social_reactions for delete to public using (((user_id = auth.uid()) AND private.can_write_gym(gym_id)));
create policy "users update own social reactions" on public.social_reactions for update to public using (((user_id = auth.uid()) AND private.can_write_gym(gym_id))) with check (((user_id = auth.uid()) AND private.can_write_gym(gym_id)));
create policy "owners admins delete staff access" on public.staff_access for delete to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]));
create policy "owners admins insert staff access" on public.staff_access for insert to "authenticated" with check ((private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role]) OR (private.has_gym_role(gym_id, ARRAY['admin'::gym_member_role]) AND (COALESCE(((permissions ->> 'full_access'::text))::boolean, false) = false))));
create policy "owners admins read staff access" on public.staff_access for select to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]));
create policy "owners admins update staff access" on public.staff_access for update to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])) with check ((private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role]) OR (private.has_gym_role(gym_id, ARRAY['admin'::gym_member_role]) AND (COALESCE(((permissions ->> 'full_access'::text))::boolean, false) = false))));
create policy "pending admins can read staff access" on public.staff_access for select to "authenticated" using (private.is_pending_admin(gym_id));
create policy "staff can view own access" on public.staff_access for select to "authenticated" using (((user_id = auth.uid()) AND private.is_gym_member(gym_id)));
create policy "owners admins staff managers read access levels" on public.staff_access_levels for select to "authenticated" using ((private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]) OR private.has_gym_staff_permission(gym_id, 'manage_staff'::text)));
create policy "owners create access levels" on public.staff_access_levels for insert to "authenticated" with check (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role]));
create policy "owners delete access levels" on public.staff_access_levels for delete to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role]));
create policy "owners update access levels" on public.staff_access_levels for update to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role])) with check (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role]));
create policy "gym members view staff capabilities" on public.staff_capabilities for select to public using (private.is_gym_member(gym_id));
create policy "owners admins manage staff capabilities" on public.staff_capabilities for all to public using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])) with check (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]));
create policy "owners admins manage staff profiles" on public.staff_profiles for all to public using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])) with check (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]));
create policy "pending admins can read staff profiles" on public.staff_profiles for select to "authenticated" using (private.is_pending_admin(gym_id));
create policy "staff can view own profile" on public.staff_profiles for select to public using ((user_id = auth.uid()));
create policy "owners admins manage working hours" on public.staff_working_hours for all to public using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role])) with check (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role]));
create policy "staff view working hours" on public.staff_working_hours for select to public using (private.is_gym_member(gym_id));
create policy "users_view_own_strava_activities" on public.strava_activities for select to "authenticated" using ((user_id = auth.uid()));
create policy "users_disconnect_own_strava_connection" on public.strava_connections for delete to "authenticated" using ((user_id = auth.uid()));
create policy "users_view_own_strava_connection" on public.strava_connections for select to "authenticated" using ((user_id = auth.uid()));
create policy "members create own optional workouts" on public.workout_assignments for insert to "authenticated" with check (((member_user_id = ( SELECT auth.uid() AS uid)) AND (source = ANY (ARRAY['self'::text, 'wod'::text])) AND private.can_write_gym(gym_id)));
create policy "members read own workout assignments" on public.workout_assignments for select to "authenticated" using (((member_user_id = ( SELECT auth.uid() AS uid)) AND private.is_gym_member(gym_id)));
create policy "members update own workout assignments" on public.workout_assignments for update to "authenticated" using (((member_user_id = ( SELECT auth.uid() AS uid)) AND private.can_write_gym(gym_id))) with check (((member_user_id = ( SELECT auth.uid() AS uid)) AND private.can_write_gym(gym_id)));
create policy "pending admins can read workout assignments" on public.workout_assignments for select to "authenticated" using (private.is_pending_admin(gym_id));
create policy "staff manage member workout assignments" on public.workout_assignments for all to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role])) with check ((private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role]) AND (EXISTS ( SELECT 1
   FROM gym_members gm
  WHERE ((gm.gym_id = workout_assignments.gym_id) AND (gm.user_id = workout_assignments.member_user_id) AND gm.is_active)))));
create policy "members_manage_own_workout_entries" on public.workout_entries for all to "authenticated" using (((user_id = auth.uid()) AND private.can_write_gym(gym_id))) with check (((user_id = auth.uid()) AND private.can_write_gym(gym_id) AND (EXISTS ( SELECT 1
   FROM workout_sessions ws
  WHERE ((ws.id = workout_entries.session_id) AND (ws.user_id = auth.uid()) AND (ws.gym_id = workout_entries.gym_id))))));
create policy "staff_view_gym_workout_entries" on public.workout_entries for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM gym_members gm
  WHERE ((gm.gym_id = workout_entries.gym_id) AND (gm.user_id = auth.uid()) AND (gm.is_active = true) AND (gm.role = ANY (ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role]))))));
create policy "members_manage_own_workout_sessions" on public.workout_sessions for all to "authenticated" using (((user_id = auth.uid()) AND private.can_write_gym(gym_id))) with check (((user_id = auth.uid()) AND private.can_write_gym(gym_id)));
create policy "staff_view_gym_workout_sessions" on public.workout_sessions for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM gym_members gm
  WHERE ((gm.gym_id = workout_sessions.gym_id) AND (gm.user_id = auth.uid()) AND (gm.is_active = true) AND (gm.role = ANY (ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role]))))));
create policy "members_manage_sets_for_own_entries" on public.workout_sets for all to "authenticated" using ((EXISTS ( SELECT 1
   FROM workout_entries we
  WHERE ((we.id = workout_sets.entry_id) AND (we.user_id = auth.uid()) AND private.can_write_gym(we.gym_id))))) with check ((EXISTS ( SELECT 1
   FROM workout_entries we
  WHERE ((we.id = workout_sets.entry_id) AND (we.user_id = auth.uid()) AND private.can_write_gym(we.gym_id)))));
create policy "staff_view_sets_for_gym_entries" on public.workout_sets for select to "authenticated" using ((EXISTS ( SELECT 1
   FROM (workout_entries we
     JOIN gym_members gm ON ((gm.gym_id = we.gym_id)))
  WHERE ((we.id = workout_sets.entry_id) AND (gm.user_id = auth.uid()) AND (gm.is_active = true) AND (gm.role = ANY (ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role]))))));
create policy "members read published workout activities" on public.workout_template_activities for select to "authenticated" using ((private.is_gym_member(gym_id) AND (EXISTS ( SELECT 1
   FROM workout_templates t
  WHERE ((t.id = workout_template_activities.template_id) AND (t.gym_id = workout_template_activities.gym_id) AND (t.visibility = 'gym'::text) AND t.is_active)))));
create policy "pending admins can read workout activities" on public.workout_template_activities for select to "authenticated" using (private.is_pending_admin(gym_id));
create policy "staff manage workout activities" on public.workout_template_activities for all to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role])) with check ((private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role]) AND (EXISTS ( SELECT 1
   FROM workout_template_blocks b
  WHERE ((b.id = workout_template_activities.block_id) AND (b.template_id = workout_template_activities.template_id) AND (b.gym_id = workout_template_activities.gym_id))))));
create policy "members read published workout blocks" on public.workout_template_blocks for select to "authenticated" using ((private.is_gym_member(gym_id) AND (EXISTS ( SELECT 1
   FROM workout_templates t
  WHERE ((t.id = workout_template_blocks.template_id) AND (t.gym_id = workout_template_blocks.gym_id) AND (t.visibility = 'gym'::text) AND t.is_active)))));
create policy "pending admins can read workout blocks" on public.workout_template_blocks for select to "authenticated" using (private.is_pending_admin(gym_id));
create policy "staff manage workout blocks" on public.workout_template_blocks for all to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role])) with check ((private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role]) AND (EXISTS ( SELECT 1
   FROM workout_templates t
  WHERE ((t.id = workout_template_blocks.template_id) AND (t.gym_id = workout_template_blocks.gym_id))))));
create policy "members read gym workout templates" on public.workout_templates for select to "authenticated" using (((visibility = 'gym'::text) AND is_active AND private.is_gym_member(gym_id)));
create policy "pending admins can read workout templates" on public.workout_templates for select to "authenticated" using (private.is_pending_admin(gym_id));
create policy "staff manage workout templates" on public.workout_templates for all to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role])) with check (((created_by = ( SELECT auth.uid() AS uid)) AND private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role])));
create policy "gym members read active wods" on public.workout_wods for select to "authenticated" using ((is_active AND private.is_gym_member(gym_id)));
create policy "pending admins can read wods" on public.workout_wods for select to "authenticated" using (private.is_pending_admin(gym_id));
create policy "staff manage wods" on public.workout_wods for all to "authenticated" using (private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role])) with check (((published_by = ( SELECT auth.uid() AS uid)) AND private.has_gym_role(gym_id, ARRAY['owner'::gym_member_role, 'admin'::gym_member_role, 'staff'::gym_member_role, 'coach'::gym_member_role]) AND (EXISTS ( SELECT 1
   FROM workout_templates t
  WHERE ((t.id = workout_wods.template_id) AND (t.gym_id = workout_wods.gym_id))))));
create policy "users can delete own avatar objects" on storage.objects for delete to "authenticated" using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
create policy "users can read own avatar objects" on storage.objects for select to "authenticated" using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
create policy "users can update own avatar objects" on storage.objects for update to "authenticated" using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))) with check (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
create policy "users can upload own avatar objects" on storage.objects for insert to "authenticated" with check (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE TRIGGER capabilities_set_updated_at BEFORE UPDATE ON capabilities FOR EACH ROW EXECUTE FUNCTION set_staff_updated_at();
CREATE TRIGGER trg_queue_class_booking_notifications AFTER INSERT OR UPDATE OF status ON class_bookings FOR EACH ROW EXECUTE FUNCTION queue_class_booking_notifications();
CREATE TRIGGER trg_sync_future_class_session_price AFTER UPDATE OF drop_in_price_pence ON class_types FOR EACH ROW EXECUTE FUNCTION sync_future_class_session_price();
CREATE TRIGGER gym_members_set_updated_at BEFORE UPDATE ON gym_members FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER gyms_set_updated_at BEFORE UPDATE ON gyms FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER protect_gym_creator BEFORE UPDATE ON gyms FOR EACH ROW EXECUTE FUNCTION private.protect_gym_creator();
CREATE TRIGGER normalise_member_phone_before_write BEFORE INSERT OR UPDATE OF phone ON members FOR EACH ROW EXECUTE FUNCTION normalise_member_phone();
CREATE TRIGGER membership_plans_set_updated_at BEFORE UPDATE ON membership_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER memberships_set_updated_at BEFORE UPDATE ON memberships FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_payment_provider_connections_updated_at BEFORE UPDATE ON payment_provider_connections FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_payment_records_updated_at BEFORE UPDATE ON payment_records FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER normalise_profile_phone_before_write BEFORE INSERT OR UPDATE OF phone ON profiles FOR EACH ROW EXECUTE FUNCTION normalise_profile_phone();
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER resources_set_updated_at BEFORE UPDATE ON resources FOR EACH ROW EXECUTE FUNCTION set_staff_updated_at();
CREATE TRIGGER social_comment_activity_notification AFTER INSERT ON social_comments FOR EACH ROW EXECUTE FUNCTION notify_social_comment_activity();
CREATE TRIGGER social_comments_notify_member AFTER INSERT ON social_comments FOR EACH ROW EXECUTE FUNCTION private.notify_social_comment();
CREATE TRIGGER trg_queue_social_comment_notification AFTER INSERT ON social_comments FOR EACH ROW EXECUTE FUNCTION queue_social_comment_notification();
CREATE TRIGGER social_reaction_activity_notification AFTER INSERT ON social_reactions FOR EACH ROW EXECUTE FUNCTION notify_social_reaction_activity();
CREATE TRIGGER social_reactions_notify_member AFTER INSERT ON social_reactions FOR EACH ROW EXECUTE FUNCTION private.notify_social_reaction();
CREATE TRIGGER staff_access_level_permissions_sync AFTER UPDATE OF permissions ON staff_access_levels FOR EACH ROW EXECUTE FUNCTION private.propagate_staff_access_level_permissions();
CREATE TRIGGER staff_capabilities_set_updated_at BEFORE UPDATE ON staff_capabilities FOR EACH ROW EXECUTE FUNCTION set_staff_updated_at();
CREATE TRIGGER staff_profiles_set_updated_at BEFORE UPDATE ON staff_profiles FOR EACH ROW EXECUTE FUNCTION set_staff_updated_at();
CREATE TRIGGER staff_working_hours_set_updated_at BEFORE UPDATE ON staff_working_hours FOR EACH ROW EXECUTE FUNCTION set_staff_updated_at();
CREATE TRIGGER workout_assignment_integrity BEFORE INSERT OR UPDATE ON workout_assignments FOR EACH ROW EXECUTE FUNCTION private.enforce_workout_assignment_integrity();
create event trigger "ensure_rls" on ddl_command_end when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO') execute function public.rls_auto_enable();

revoke all on schema public from public, anon, authenticated, service_role;
revoke all on schema private from public, anon, authenticated, service_role;
grant usage on schema private to "authenticated";
grant usage on schema public to public;
grant usage on schema public to "anon";
grant usage on schema public to "authenticated";
grant usage on schema public to "service_role";

revoke all on table private.gocardless_webhook_events from public, anon, authenticated, service_role;
revoke all on table private.strava_oauth_states from public, anon, authenticated, service_role;
revoke all on table private.strava_tokens from public, anon, authenticated, service_role;
revoke all on table private.strava_webhook_events from public, anon, authenticated, service_role;
revoke all on table public.calendar_feed_tokens from public, anon, authenticated, service_role;
revoke all on table public.capabilities from public, anon, authenticated, service_role;
revoke all on table public.channel_members from public, anon, authenticated, service_role;
revoke all on table public.channels from public, anon, authenticated, service_role;
revoke all on table public.class_booking_purchases from public, anon, authenticated, service_role;
revoke all on table public.class_bookings from public, anon, authenticated, service_role;
revoke all on table public.class_session_reserved_plans from public, anon, authenticated, service_role;
revoke all on table public.class_session_resources from public, anon, authenticated, service_role;
revoke all on table public.class_session_staff from public, anon, authenticated, service_role;
revoke all on table public.class_sessions from public, anon, authenticated, service_role;
revoke all on table public.class_types from public, anon, authenticated, service_role;
revoke all on table public.gym_access_invite_approvals from public, anon, authenticated, service_role;
revoke all on table public.gym_access_settings from public, anon, authenticated, service_role;
revoke all on table public.gym_admin_invites from public, anon, authenticated, service_role;
revoke all on table public.gym_communication_settings from public, anon, authenticated, service_role;
revoke all on table public.gym_email_templates from public, anon, authenticated, service_role;
revoke all on table public.gym_member_view_settings from public, anon, authenticated, service_role;
revoke all on table public.gym_members from public, anon, authenticated, service_role;
revoke all on table public.gym_ownership_action_approvals from public, anon, authenticated, service_role;
revoke all on table public.gym_ownership_actions from public, anon, authenticated, service_role;
revoke all on table public.gyms from public, anon, authenticated, service_role;
revoke all on table public.member_notifications from public, anon, authenticated, service_role;
revoke all on table public.member_training_preferences from public, anon, authenticated, service_role;
revoke all on table public.members from public, anon, authenticated, service_role;
revoke all on table public.membership_plans from public, anon, authenticated, service_role;
revoke all on table public.memberships from public, anon, authenticated, service_role;
revoke all on table public.messages from public, anon, authenticated, service_role;
revoke all on table public.notification_preferences from public, anon, authenticated, service_role;
revoke all on table public.payment_provider_connections from public, anon, authenticated, service_role;
revoke all on table public.payment_records from public, anon, authenticated, service_role;
revoke all on table public.personal_bests from public, anon, authenticated, service_role;
revoke all on table public.profiles from public, anon, authenticated, service_role;
revoke all on table public.pt_appointments from public, anon, authenticated, service_role;
revoke all on table public.resource_availability from public, anon, authenticated, service_role;
revoke all on table public.resources from public, anon, authenticated, service_role;
revoke all on table public.service_requirements from public, anon, authenticated, service_role;
revoke all on table public.social_comments from public, anon, authenticated, service_role;
revoke all on table public.social_posts from public, anon, authenticated, service_role;
revoke all on table public.social_reactions from public, anon, authenticated, service_role;
revoke all on table public.staff_access from public, anon, authenticated, service_role;
revoke all on table public.staff_access_levels from public, anon, authenticated, service_role;
revoke all on table public.staff_capabilities from public, anon, authenticated, service_role;
revoke all on table public.staff_profiles from public, anon, authenticated, service_role;
revoke all on table public.staff_working_hours from public, anon, authenticated, service_role;
revoke all on table public.strava_activities from public, anon, authenticated, service_role;
revoke all on table public.strava_connections from public, anon, authenticated, service_role;
revoke all on table public.training_group_challenge_entries from public, anon, authenticated, service_role;
revoke all on table public.training_group_challenges from public, anon, authenticated, service_role;
revoke all on table public.training_group_members from public, anon, authenticated, service_role;
revoke all on table public.training_groups from public, anon, authenticated, service_role;
revoke all on table public.workout_assignments from public, anon, authenticated, service_role;
revoke all on table public.workout_entries from public, anon, authenticated, service_role;
revoke all on table public.workout_sessions from public, anon, authenticated, service_role;
revoke all on table public.workout_sets from public, anon, authenticated, service_role;
revoke all on table public.workout_template_activities from public, anon, authenticated, service_role;
revoke all on table public.workout_template_blocks from public, anon, authenticated, service_role;
revoke all on table public.workout_templates from public, anon, authenticated, service_role;
revoke all on table public.workout_wods from public, anon, authenticated, service_role;
grant references, trigger, truncate on table public.calendar_feed_tokens to "anon";
grant references, trigger, truncate on table public.calendar_feed_tokens to "authenticated";
grant references, trigger, truncate on table public.calendar_feed_tokens to "service_role";
grant references, trigger, truncate on table public.capabilities to "anon";
grant delete, insert, references, select, trigger, truncate, update on table public.capabilities to "authenticated";
grant references, trigger, truncate on table public.capabilities to "service_role";
grant delete, insert, references, select, trigger, truncate, update on table public.channel_members to "authenticated";
grant references, trigger, truncate on table public.channel_members to "service_role";
grant delete, insert, references, select, trigger, truncate, update on table public.channels to "authenticated";
grant references, trigger, truncate on table public.channels to "service_role";
grant references, select, trigger, truncate on table public.class_booking_purchases to "authenticated";
grant references, trigger, truncate on table public.class_booking_purchases to "service_role";
grant references, select, trigger, truncate on table public.class_bookings to "authenticated";
grant references, trigger, truncate on table public.class_bookings to "service_role";
grant delete, insert, references, select, trigger, truncate, update on table public.class_session_reserved_plans to "authenticated";
grant references, trigger, truncate on table public.class_session_reserved_plans to "service_role";
grant references, trigger, truncate on table public.class_session_resources to "anon";
grant delete, insert, references, select, trigger, truncate, update on table public.class_session_resources to "authenticated";
grant references, trigger, truncate on table public.class_session_resources to "service_role";
grant references, trigger, truncate on table public.class_session_staff to "anon";
grant delete, insert, references, select, trigger, truncate, update on table public.class_session_staff to "authenticated";
grant references, trigger, truncate on table public.class_session_staff to "service_role";
grant delete, insert, references, select, trigger, truncate, update on table public.class_sessions to "authenticated";
grant references, trigger, truncate on table public.class_sessions to "service_role";
grant delete, insert, references, select, trigger, truncate, update on table public.class_types to "authenticated";
grant references, trigger, truncate on table public.class_types to "service_role";
grant references, trigger, truncate on table public.gym_access_invite_approvals to "anon";
grant references, select, trigger, truncate on table public.gym_access_invite_approvals to "authenticated";
grant references, trigger, truncate on table public.gym_access_invite_approvals to "service_role";
grant references, trigger, truncate on table public.gym_access_settings to "anon";
grant insert, references, select, trigger, truncate, update on table public.gym_access_settings to "authenticated";
grant references, trigger, truncate on table public.gym_access_settings to "service_role";
grant references, trigger, truncate on table public.gym_admin_invites to "anon";
grant references, select, trigger, truncate on table public.gym_admin_invites to "authenticated";
grant references, select, trigger, truncate on table public.gym_admin_invites to "service_role";
grant references, trigger, truncate on table public.gym_communication_settings to "anon";
grant delete, insert, references, select, trigger, truncate, update on table public.gym_communication_settings to "authenticated";
grant references, select, trigger, truncate on table public.gym_communication_settings to "service_role";
grant references, trigger, truncate on table public.gym_email_templates to "anon";
grant delete, insert, references, select, trigger, truncate, update on table public.gym_email_templates to "authenticated";
grant references, select, trigger, truncate on table public.gym_email_templates to "service_role";
grant references, trigger, truncate on table public.gym_member_view_settings to "anon";
grant delete, insert, references, select, trigger, truncate, update on table public.gym_member_view_settings to "authenticated";
grant references, trigger, truncate on table public.gym_member_view_settings to "service_role";
grant delete, insert, references, select, trigger, truncate, update on table public.gym_members to "authenticated";
grant references, select, trigger, truncate on table public.gym_members to "service_role";
grant references, trigger, truncate on table public.gym_ownership_action_approvals to "anon";
grant references, select, trigger, truncate on table public.gym_ownership_action_approvals to "authenticated";
grant references, trigger, truncate on table public.gym_ownership_action_approvals to "service_role";
grant references, trigger, truncate on table public.gym_ownership_actions to "anon";
grant references, select, trigger, truncate on table public.gym_ownership_actions to "authenticated";
grant references, trigger, truncate on table public.gym_ownership_actions to "service_role";
grant delete, insert, references, select, trigger, truncate, update on table public.gyms to "authenticated";
grant references, trigger, truncate on table public.gyms to "service_role";
grant references, trigger, truncate on table public.member_notifications to "anon";
grant references, trigger, truncate on table public.member_notifications to "authenticated";
grant references, trigger, truncate on table public.member_notifications to "service_role";
grant references, trigger, truncate on table public.member_training_preferences to "anon";
grant insert, references, select, trigger, truncate, update on table public.member_training_preferences to "authenticated";
grant references, trigger, truncate on table public.member_training_preferences to "service_role";
grant references, trigger, truncate on table public.members to "anon";
grant delete, insert, references, select, trigger, truncate, update on table public.members to "authenticated";
grant references, trigger, truncate on table public.members to "service_role";
grant delete, insert, references, select, trigger, truncate, update on table public.membership_plans to "authenticated";
grant references, trigger, truncate on table public.membership_plans to "service_role";
grant delete, insert, references, select, trigger, truncate, update on table public.memberships to "authenticated";
grant references, trigger, truncate on table public.memberships to "service_role";
grant delete, insert, references, select, trigger, truncate, update on table public.messages to "authenticated";
grant references, trigger, truncate on table public.messages to "service_role";
grant references, trigger, truncate on table public.notification_preferences to "anon";
grant references, trigger, truncate on table public.notification_preferences to "authenticated";
grant references, trigger, truncate on table public.notification_preferences to "service_role";
grant references, trigger, truncate on table public.payment_provider_connections to "anon";
grant delete, insert, references, select, trigger, truncate, update on table public.payment_provider_connections to "authenticated";
grant references, trigger, truncate on table public.payment_provider_connections to "service_role";
grant references, trigger, truncate on table public.payment_records to "anon";
grant delete, insert, references, select, trigger, truncate, update on table public.payment_records to "authenticated";
grant references, trigger, truncate on table public.payment_records to "service_role";
grant references, trigger, truncate on table public.personal_bests to "anon";
grant delete, insert, references, select, trigger, truncate, update on table public.personal_bests to "authenticated";
grant references, trigger, truncate on table public.personal_bests to "service_role";
grant delete, insert, references, select, trigger, truncate, update on table public.profiles to "authenticated";
grant references, select, trigger, truncate on table public.profiles to "service_role";
grant references, trigger, truncate on table public.pt_appointments to "anon";
grant delete, insert, references, select, trigger, truncate, update on table public.pt_appointments to "authenticated";
grant references, trigger, truncate on table public.pt_appointments to "service_role";
grant references, trigger, truncate on table public.resource_availability to "anon";
grant delete, insert, references, select, trigger, truncate, update on table public.resource_availability to "authenticated";
grant references, trigger, truncate on table public.resource_availability to "service_role";
grant references, trigger, truncate on table public.resources to "anon";
grant delete, insert, references, select, trigger, truncate, update on table public.resources to "authenticated";
grant references, trigger, truncate on table public.resources to "service_role";
grant references, trigger, truncate on table public.service_requirements to "anon";
grant delete, insert, references, select, trigger, truncate, update on table public.service_requirements to "authenticated";
grant references, trigger, truncate on table public.service_requirements to "service_role";
grant references, trigger, truncate on table public.social_comments to "anon";
grant delete, insert, references, select, trigger, truncate, update on table public.social_comments to "authenticated";
grant references, trigger, truncate on table public.social_comments to "service_role";
grant references, trigger, truncate on table public.social_posts to "anon";
grant delete, insert, references, select, trigger, truncate, update on table public.social_posts to "authenticated";
grant references, trigger, truncate on table public.social_posts to "service_role";
grant references, trigger, truncate on table public.social_reactions to "anon";
grant delete, insert, references, select, trigger, truncate, update on table public.social_reactions to "authenticated";
grant references, trigger, truncate on table public.social_reactions to "service_role";
grant references, trigger, truncate on table public.staff_access to "anon";
grant delete, insert, references, select, trigger, truncate, update on table public.staff_access to "authenticated";
grant references, trigger, truncate on table public.staff_access to "service_role";
grant references, trigger, truncate on table public.staff_access_levels to "anon";
grant delete, insert, references, select, trigger, truncate, update on table public.staff_access_levels to "authenticated";
grant delete, insert, references, select, trigger, truncate, update on table public.staff_access_levels to "service_role";
grant references, trigger, truncate on table public.staff_capabilities to "anon";
grant delete, insert, references, select, trigger, truncate, update on table public.staff_capabilities to "authenticated";
grant references, trigger, truncate on table public.staff_capabilities to "service_role";
grant references, trigger, truncate on table public.staff_profiles to "anon";
grant references, trigger, truncate on table public.staff_profiles to "authenticated";
grant references, trigger, truncate on table public.staff_profiles to "service_role";
grant references, trigger, truncate on table public.staff_working_hours to "anon";
grant references, trigger, truncate on table public.staff_working_hours to "authenticated";
grant references, trigger, truncate on table public.staff_working_hours to "service_role";
grant references, select, trigger, truncate on table public.strava_activities to "authenticated";
grant references, trigger, truncate on table public.strava_activities to "service_role";
grant delete, references, select, trigger, truncate on table public.strava_connections to "authenticated";
grant references, trigger, truncate on table public.strava_connections to "service_role";
grant references, select, trigger, truncate on table public.training_group_challenge_entries to "authenticated";
grant references, trigger, truncate on table public.training_group_challenge_entries to "service_role";
grant references, select, trigger, truncate on table public.training_group_challenges to "authenticated";
grant references, trigger, truncate on table public.training_group_challenges to "service_role";
grant references, select, trigger, truncate on table public.training_group_members to "authenticated";
grant references, trigger, truncate on table public.training_group_members to "service_role";
grant references, select, trigger, truncate on table public.training_groups to "authenticated";
grant references, trigger, truncate on table public.training_groups to "service_role";
grant references, trigger, truncate on table public.workout_assignments to "anon";
grant delete, insert, references, select, trigger, truncate, update on table public.workout_assignments to "authenticated";
grant references, trigger, truncate on table public.workout_assignments to "service_role";
grant references, trigger, truncate on table public.workout_entries to "anon";
grant delete, insert, references, select, trigger, truncate, update on table public.workout_entries to "authenticated";
grant references, trigger, truncate on table public.workout_entries to "service_role";
grant references, trigger, truncate on table public.workout_sessions to "anon";
grant delete, insert, references, select, trigger, truncate, update on table public.workout_sessions to "authenticated";
grant references, trigger, truncate on table public.workout_sessions to "service_role";
grant references, trigger, truncate on table public.workout_sets to "anon";
grant delete, insert, references, select, trigger, truncate, update on table public.workout_sets to "authenticated";
grant references, trigger, truncate on table public.workout_sets to "service_role";
grant references, trigger, truncate on table public.workout_template_activities to "anon";
grant delete, insert, references, select, trigger, truncate, update on table public.workout_template_activities to "authenticated";
grant references, trigger, truncate on table public.workout_template_activities to "service_role";
grant references, trigger, truncate on table public.workout_template_blocks to "anon";
grant delete, insert, references, select, trigger, truncate, update on table public.workout_template_blocks to "authenticated";
grant references, trigger, truncate on table public.workout_template_blocks to "service_role";
grant references, trigger, truncate on table public.workout_templates to "anon";
grant delete, insert, references, select, trigger, truncate, update on table public.workout_templates to "authenticated";
grant references, trigger, truncate on table public.workout_templates to "service_role";
grant references, trigger, truncate on table public.workout_wods to "anon";
grant delete, insert, references, select, trigger, truncate, update on table public.workout_wods to "authenticated";
grant references, trigger, truncate on table public.workout_wods to "service_role";

revoke all on sequence private.strava_webhook_events_id_seq from public, anon, authenticated, service_role;

revoke all on function private.active_owner_count(target_gym_id uuid) from public, anon, authenticated, service_role;
revoke all on function private.can_manage_gym_member(target_gym_id uuid, target_user_id uuid, target_role gym_member_role) from public, anon, authenticated, service_role;
revoke all on function private.can_view_profile(target_user_id uuid) from public, anon, authenticated, service_role;
revoke all on function private.can_write_gym(target_gym_id uuid) from public, anon, authenticated, service_role;
revoke all on function private.enforce_workout_assignment_integrity() from public, anon, authenticated, service_role;
revoke all on function private.execute_ownership_action(target_action_id uuid) from public, anon, authenticated, service_role;
revoke all on function private.handle_new_user() from public, anon, authenticated, service_role;
revoke all on function private.has_active_owner(target_gym_id uuid) from public, anon, authenticated, service_role;
revoke all on function private.has_gym_role(target_gym_id uuid, allowed_roles gym_member_role[]) from public, anon, authenticated, service_role;
revoke all on function private.has_gym_staff_permission(target_gym_id uuid, permission_key text) from public, anon, authenticated, service_role;
revoke all on function private.is_gym_member(target_gym_id uuid) from public, anon, authenticated, service_role;
revoke all on function private.is_pending_admin(target_gym_id uuid) from public, anon, authenticated, service_role;
revoke all on function private.member_has_class_access(p_gym_id uuid, p_user_id uuid) from public, anon, authenticated, service_role;
revoke all on function private.member_has_paid_class(p_session_id uuid, p_user_id uuid) from public, anon, authenticated, service_role;
revoke all on function private.notify_social_comment() from public, anon, authenticated, service_role;
revoke all on function private.notify_social_reaction() from public, anon, authenticated, service_role;
revoke all on function private.propagate_staff_access_level_permissions() from public, anon, authenticated, service_role;
revoke all on function private.protect_gym_creator() from public, anon, authenticated, service_role;
revoke all on function private.social_notifications_enabled(p_gym_id uuid, p_user_id uuid) from public, anon, authenticated, service_role;
revoke all on function private.staff_has_permission(p_gym_id uuid, p_user_id uuid, p_permission text) from public, anon, authenticated, service_role;
revoke all on function public.approve_admin_access(target_gym_id uuid, target_user_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.approve_email_owner_invite(target_invite_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.approve_ownership_action(target_action_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.approve_pending_access(target_gym_id uuid, target_user_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.approve_shareable_owner_invite(target_invite_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.assign_staff_access_level(target_gym_id uuid, target_user_id uuid, target_level_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.book_class_session(p_session_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.cancel_class_booking(p_session_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.claim_access_invite(invite_token text) from public, anon, authenticated, service_role;
revoke all on function public.claim_admin_invite(invite_token text) from public, anon, authenticated, service_role;
revoke all on function public.create_access_invite(target_gym_id uuid, invite_email text, requested_role text, expires_in_days integer) from public, anon, authenticated, service_role;
revoke all on function public.create_admin_invite(target_gym_id uuid, invite_email text, expires_in_days integer) from public, anon, authenticated, service_role;
revoke all on function public.create_email_access_invite(target_gym_id uuid, invite_email text, requested_role text, expires_in_days integer) from public, anon, authenticated, service_role;
revoke all on function public.create_gym_for_current_user(gym_name text, gym_slug text) from public, anon, authenticated, service_role;
revoke all on function public.create_shareable_access_invite(target_gym_id uuid, invite_email text, requested_role text, expires_in_days integer) from public, anon, authenticated, service_role;
revoke all on function public.create_training_group(p_gym_id uuid, p_name text, p_description text) from public, anon, authenticated, service_role;
revoke all on function public.create_training_group_challenge(p_group_id uuid, p_name text, p_activity_name text, p_metric_type text, p_unit text, p_comparison_direction text, p_ends_at timestamp with time zone) from public, anon, authenticated, service_role;
revoke all on function public.create_validated_class_session(p_gym_id uuid, p_class_type_id uuid, p_name text, p_description text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_capacity integer, p_reserved_capacity integer, p_reserved_release_minutes_before integer, p_staff_ids uuid[], p_plan_ids uuid[]) from public, anon, authenticated, service_role;
revoke all on function public.delete_admin_invite(target_invite_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.get_access_invite(invite_token text) from public, anon, authenticated, service_role;
revoke all on function public.get_admin_invite(invite_token text) from public, anon, authenticated, service_role;
revoke all on function public.get_auth_email_context(p_user_id uuid, p_email text, p_gym_id uuid, p_access_invite text, p_signup_slug text) from public, anon, authenticated, service_role;
revoke all on function public.get_auth_email_template(p_gym_id uuid, p_template_key text) from public, anon, authenticated, service_role;
revoke all on function public.get_class_booking_options(p_session_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.get_class_calendar(p_gym_id uuid, p_from timestamp with time zone, p_to timestamp with time zone) from public, anon, authenticated, service_role;
revoke all on function public.get_email_invite_send_context(target_invite_id uuid, requesting_user_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.get_gym_team_accounts(target_gym_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.get_member_home_settings(p_gym_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.get_my_training_groups(p_gym_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.get_public_gym_join_options(p_gym_slug text) from public, anon, authenticated, service_role;
revoke all on function public.get_training_group_dashboard(p_group_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.handle_new_user() from public, anon, authenticated, service_role;
revoke all on function public.hybridone_invite_edge_test_admin(p_action text, p_run_id text, p_user_id uuid, p_gym_id uuid, p_invite_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.join_public_gym_with_membership(p_gym_slug text, p_plan_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.join_training_group_by_code(p_code text) from public, anon, authenticated, service_role;
revoke all on function public.mark_email_invite_sent(target_invite_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.member_book_class(p_session_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.member_cancel_class(p_session_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.member_class_schedule(p_gym_id uuid, p_from timestamp with time zone, p_to timestamp with time zone) from public, anon, authenticated, service_role;
revoke all on function public.normalise_member_phone() from public, anon, authenticated, service_role;
revoke all on function public.normalise_profile_phone() from public, anon, authenticated, service_role;
revoke all on function public.notify_social_comment_activity() from public, anon, authenticated, service_role;
revoke all on function public.notify_social_reaction_activity() from public, anon, authenticated, service_role;
revoke all on function public.prepare_class_drop_in_purchase(p_session_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.prepare_email_invite_token(target_invite_id uuid, new_token text) from public, anon, authenticated, service_role;
revoke all on function public.preview_training_group_invite(p_code text) from public, anon, authenticated, service_role;
revoke all on function public.propose_gym_deletion(target_gym_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.propose_owner_promotion(target_gym_id uuid, target_user_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.propose_owner_removal(target_gym_id uuid, target_user_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.provision_staff_membership_with_level(target_gym_id uuid, target_user_id uuid, target_display_name text, target_role text, target_level_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.queue_class_booking_notifications() from public, anon, authenticated, service_role;
revoke all on function public.queue_social_comment_notification() from public, anon, authenticated, service_role;
revoke all on function public.remove_admin_access(target_gym_id uuid, target_user_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.remove_gym_staff_access(target_gym_id uuid, target_user_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.revoke_admin_invite(target_invite_id uuid) from public, anon, authenticated, service_role;
revoke all on function public.rls_auto_enable() from public, anon, authenticated, service_role;
revoke all on function public.set_staff_updated_at() from public, anon, authenticated, service_role;
revoke all on function public.set_updated_at() from public, anon, authenticated, service_role;
revoke all on function public.submit_training_group_challenge_result(p_challenge_id uuid, p_value numeric, p_note text) from public, anon, authenticated, service_role;
revoke all on function public.sync_future_class_session_price() from public, anon, authenticated, service_role;
revoke all on function public.validate_class_schedule(p_gym_id uuid, p_class_type_id uuid, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_capacity integer, p_staff_ids uuid[], p_exclude_session_id uuid) from public, anon, authenticated, service_role;
grant execute on function private.active_owner_count(target_gym_id uuid) to public;
grant execute on function private.can_manage_gym_member(target_gym_id uuid, target_user_id uuid, target_role gym_member_role) to public;
grant execute on function private.can_view_profile(target_user_id uuid) to "authenticated";
grant execute on function private.can_write_gym(target_gym_id uuid) to public;
grant execute on function private.execute_ownership_action(target_action_id uuid) to public;
grant execute on function private.has_active_owner(target_gym_id uuid) to public;
grant execute on function private.has_gym_role(target_gym_id uuid, allowed_roles gym_member_role[]) to "authenticated";
grant execute on function private.has_gym_staff_permission(target_gym_id uuid, permission_key text) to "authenticated";
grant execute on function private.has_gym_staff_permission(target_gym_id uuid, permission_key text) to "service_role";
grant execute on function private.is_gym_member(target_gym_id uuid) to "authenticated";
grant execute on function private.is_pending_admin(target_gym_id uuid) to public;
grant execute on function private.member_has_class_access(p_gym_id uuid, p_user_id uuid) to public;
grant execute on function private.member_has_paid_class(p_session_id uuid, p_user_id uuid) to public;
grant execute on function private.propagate_staff_access_level_permissions() to public;
grant execute on function private.protect_gym_creator() to public;
grant execute on function private.staff_has_permission(p_gym_id uuid, p_user_id uuid, p_permission text) to "authenticated";
grant execute on function public.approve_admin_access(target_gym_id uuid, target_user_id uuid) to public;
grant execute on function public.approve_admin_access(target_gym_id uuid, target_user_id uuid) to "authenticated";
grant execute on function public.approve_email_owner_invite(target_invite_id uuid) to public;
grant execute on function public.approve_email_owner_invite(target_invite_id uuid) to "authenticated";
grant execute on function public.approve_ownership_action(target_action_id uuid) to public;
grant execute on function public.approve_ownership_action(target_action_id uuid) to "authenticated";
grant execute on function public.approve_pending_access(target_gym_id uuid, target_user_id uuid) to public;
grant execute on function public.approve_pending_access(target_gym_id uuid, target_user_id uuid) to "authenticated";
grant execute on function public.approve_shareable_owner_invite(target_invite_id uuid) to public;
grant execute on function public.approve_shareable_owner_invite(target_invite_id uuid) to "authenticated";
grant execute on function public.assign_staff_access_level(target_gym_id uuid, target_user_id uuid, target_level_id uuid) to "authenticated";
grant execute on function public.assign_staff_access_level(target_gym_id uuid, target_user_id uuid, target_level_id uuid) to "service_role";
grant execute on function public.book_class_session(p_session_id uuid) to "authenticated";
grant execute on function public.cancel_class_booking(p_session_id uuid) to "authenticated";
grant execute on function public.claim_access_invite(invite_token text) to public;
grant execute on function public.claim_access_invite(invite_token text) to "authenticated";
grant execute on function public.claim_admin_invite(invite_token text) to public;
grant execute on function public.claim_admin_invite(invite_token text) to "authenticated";
grant execute on function public.create_access_invite(target_gym_id uuid, invite_email text, requested_role text, expires_in_days integer) to public;
grant execute on function public.create_access_invite(target_gym_id uuid, invite_email text, requested_role text, expires_in_days integer) to "authenticated";
grant execute on function public.create_admin_invite(target_gym_id uuid, invite_email text, expires_in_days integer) to public;
grant execute on function public.create_admin_invite(target_gym_id uuid, invite_email text, expires_in_days integer) to "authenticated";
grant execute on function public.create_email_access_invite(target_gym_id uuid, invite_email text, requested_role text, expires_in_days integer) to public;
grant execute on function public.create_email_access_invite(target_gym_id uuid, invite_email text, requested_role text, expires_in_days integer) to "authenticated";
grant execute on function public.create_gym_for_current_user(gym_name text, gym_slug text) to "authenticated";
grant execute on function public.create_shareable_access_invite(target_gym_id uuid, invite_email text, requested_role text, expires_in_days integer) to public;
grant execute on function public.create_shareable_access_invite(target_gym_id uuid, invite_email text, requested_role text, expires_in_days integer) to "authenticated";
grant execute on function public.create_training_group(p_gym_id uuid, p_name text, p_description text) to "authenticated";
grant execute on function public.create_training_group_challenge(p_group_id uuid, p_name text, p_activity_name text, p_metric_type text, p_unit text, p_comparison_direction text, p_ends_at timestamp with time zone) to "authenticated";
grant execute on function public.create_validated_class_session(p_gym_id uuid, p_class_type_id uuid, p_name text, p_description text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_capacity integer, p_reserved_capacity integer, p_reserved_release_minutes_before integer, p_staff_ids uuid[], p_plan_ids uuid[]) to "authenticated";
grant execute on function public.delete_admin_invite(target_invite_id uuid) to public;
grant execute on function public.delete_admin_invite(target_invite_id uuid) to "authenticated";
grant execute on function public.get_access_invite(invite_token text) to public;
grant execute on function public.get_access_invite(invite_token text) to "anon";
grant execute on function public.get_access_invite(invite_token text) to "authenticated";
grant execute on function public.get_admin_invite(invite_token text) to public;
grant execute on function public.get_admin_invite(invite_token text) to "anon";
grant execute on function public.get_admin_invite(invite_token text) to "authenticated";
grant execute on function public.get_auth_email_context(p_user_id uuid, p_email text, p_gym_id uuid, p_access_invite text, p_signup_slug text) to "service_role";
grant execute on function public.get_auth_email_template(p_gym_id uuid, p_template_key text) to "service_role";
grant execute on function public.get_class_booking_options(p_session_id uuid) to "authenticated";
grant execute on function public.get_class_calendar(p_gym_id uuid, p_from timestamp with time zone, p_to timestamp with time zone) to "authenticated";
grant execute on function public.get_email_invite_send_context(target_invite_id uuid, requesting_user_id uuid) to "service_role";
grant execute on function public.get_gym_team_accounts(target_gym_id uuid) to "authenticated";
grant execute on function public.get_member_home_settings(p_gym_id uuid) to "authenticated";
grant execute on function public.get_my_training_groups(p_gym_id uuid) to "authenticated";
grant execute on function public.get_public_gym_join_options(p_gym_slug text) to "anon";
grant execute on function public.get_public_gym_join_options(p_gym_slug text) to "authenticated";
grant execute on function public.get_training_group_dashboard(p_group_id uuid) to "authenticated";
grant execute on function public.hybridone_invite_edge_test_admin(p_action text, p_run_id text, p_user_id uuid, p_gym_id uuid, p_invite_id uuid) to "service_role";
grant execute on function public.join_public_gym_with_membership(p_gym_slug text, p_plan_id uuid) to "authenticated";
grant execute on function public.join_training_group_by_code(p_code text) to "authenticated";
grant execute on function public.mark_email_invite_sent(target_invite_id uuid) to "service_role";
grant execute on function public.member_book_class(p_session_id uuid) to "authenticated";
grant execute on function public.member_cancel_class(p_session_id uuid) to "authenticated";
grant execute on function public.member_class_schedule(p_gym_id uuid, p_from timestamp with time zone, p_to timestamp with time zone) to "authenticated";
grant execute on function public.prepare_class_drop_in_purchase(p_session_id uuid) to "authenticated";
grant execute on function public.prepare_email_invite_token(target_invite_id uuid, new_token text) to "service_role";
grant execute on function public.preview_training_group_invite(p_code text) to "authenticated";
grant execute on function public.propose_gym_deletion(target_gym_id uuid) to public;
grant execute on function public.propose_gym_deletion(target_gym_id uuid) to "authenticated";
grant execute on function public.propose_owner_promotion(target_gym_id uuid, target_user_id uuid) to public;
grant execute on function public.propose_owner_promotion(target_gym_id uuid, target_user_id uuid) to "authenticated";
grant execute on function public.propose_owner_removal(target_gym_id uuid, target_user_id uuid) to public;
grant execute on function public.propose_owner_removal(target_gym_id uuid, target_user_id uuid) to "authenticated";
grant execute on function public.provision_staff_membership_with_level(target_gym_id uuid, target_user_id uuid, target_display_name text, target_role text, target_level_id uuid) to "authenticated";
grant execute on function public.remove_admin_access(target_gym_id uuid, target_user_id uuid) to public;
grant execute on function public.remove_admin_access(target_gym_id uuid, target_user_id uuid) to "authenticated";
grant execute on function public.remove_gym_staff_access(target_gym_id uuid, target_user_id uuid) to "authenticated";
grant execute on function public.revoke_admin_invite(target_invite_id uuid) to public;
grant execute on function public.revoke_admin_invite(target_invite_id uuid) to "authenticated";
grant execute on function public.set_staff_updated_at() to public;
grant execute on function public.set_updated_at() to public;
grant execute on function public.submit_training_group_challenge_result(p_challenge_id uuid, p_value numeric, p_note text) to "authenticated";
grant execute on function public.validate_class_schedule(p_gym_id uuid, p_class_type_id uuid, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_capacity integer, p_staff_ids uuid[], p_exclude_session_id uuid) to "authenticated";
