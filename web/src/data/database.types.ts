export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      calendar_feed_tokens: {
        Row: {
          created_at: string
          gym_id: string
          id: string
          is_active: boolean
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          gym_id: string
          id?: string
          is_active?: boolean
          token?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          gym_id?: string
          id?: string
          is_active?: boolean
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_feed_tokens_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      capabilities: {
        Row: {
          created_at: string
          description: string | null
          gym_id: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          gym_id: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          gym_id?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capabilities_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_members: {
        Row: {
          channel_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          gym_id: string
          id: string
          is_private: boolean
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          gym_id: string
          id?: string
          is_private?: boolean
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          gym_id?: string
          id?: string
          is_private?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      class_booking_purchases: {
        Row: {
          amount_pence: number
          created_at: string
          currency: string
          gym_id: string
          id: string
          provider_payment_id: string | null
          session_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_pence: number
          created_at?: string
          currency?: string
          gym_id: string
          id?: string
          provider_payment_id?: string | null
          session_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_pence?: number
          created_at?: string
          currency?: string
          gym_id?: string
          id?: string
          provider_payment_id?: string | null
          session_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_booking_purchases_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_booking_purchases_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      class_bookings: {
        Row: {
          booked_at: string
          cancelled_at: string | null
          created_at: string
          gym_id: string
          id: string
          session_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          booked_at?: string
          cancelled_at?: string | null
          created_at?: string
          gym_id: string
          id?: string
          session_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          booked_at?: string
          cancelled_at?: string | null
          created_at?: string
          gym_id?: string
          id?: string
          session_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_bookings_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_bookings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      class_session_reserved_plans: {
        Row: {
          plan_id: string
          session_id: string
        }
        Insert: {
          plan_id: string
          session_id: string
        }
        Update: {
          plan_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_session_reserved_plans_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_session_reserved_plans_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      class_session_resources: {
        Row: {
          created_at: string
          gym_id: string
          id: string
          quantity: number
          resource_id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          gym_id: string
          id?: string
          quantity?: number
          resource_id: string
          session_id: string
        }
        Update: {
          created_at?: string
          gym_id?: string
          id?: string
          quantity?: number
          resource_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_session_resources_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_session_resources_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_session_resources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      class_session_staff: {
        Row: {
          assignment_role: string
          created_at: string
          gym_id: string
          id: string
          is_lead: boolean
          session_id: string
          user_id: string
        }
        Insert: {
          assignment_role?: string
          created_at?: string
          gym_id: string
          id?: string
          is_lead?: boolean
          session_id: string
          user_id: string
        }
        Update: {
          assignment_role?: string
          created_at?: string
          gym_id?: string
          id?: string
          is_lead?: boolean
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_session_staff_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_session_staff_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      class_sessions: {
        Row: {
          capacity: number
          class_type_id: string | null
          coach_user_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          drop_in_price_pence: number | null
          ends_at: string
          gym_id: string
          id: string
          is_cancelled: boolean
          name: string
          reserved_capacity: number
          reserved_release_minutes_before: number | null
          starts_at: string
          updated_at: string
        }
        Insert: {
          capacity: number
          class_type_id?: string | null
          coach_user_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          drop_in_price_pence?: number | null
          ends_at: string
          gym_id: string
          id?: string
          is_cancelled?: boolean
          name: string
          reserved_capacity?: number
          reserved_release_minutes_before?: number | null
          starts_at: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          class_type_id?: string | null
          coach_user_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          drop_in_price_pence?: number | null
          ends_at?: string
          gym_id?: string
          id?: string
          is_cancelled?: boolean
          name?: string
          reserved_capacity?: number
          reserved_release_minutes_before?: number | null
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_class_type_id_fkey"
            columns: ["class_type_id"]
            isOneToOne: false
            referencedRelation: "class_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      class_types: {
        Row: {
          created_at: string
          default_capacity: number
          description: string | null
          difficulty_level: string
          drop_in_price_pence: number | null
          duration_minutes: number
          gym_id: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_capacity?: number
          description?: string | null
          difficulty_level?: string
          drop_in_price_pence?: number | null
          duration_minutes?: number
          gym_id: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_capacity?: number
          description?: string | null
          difficulty_level?: string
          drop_in_price_pence?: number | null
          duration_minutes?: number
          gym_id?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_types_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_access_invite_approvals: {
        Row: {
          approved_at: string
          invite_id: string
          owner_user_id: string
        }
        Insert: {
          approved_at?: string
          invite_id: string
          owner_user_id: string
        }
        Update: {
          approved_at?: string
          invite_id?: string
          owner_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_access_invite_approvals_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "gym_admin_invites"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_access_settings: {
        Row: {
          access_code: string | null
          access_enabled: boolean
          gym_id: string
          member_label: string
          member_note: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          access_code?: string | null
          access_enabled?: boolean
          gym_id: string
          member_label?: string
          member_note?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          access_code?: string | null
          access_enabled?: boolean
          gym_id?: string
          member_label?: string
          member_note?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gym_access_settings_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: true
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_admin_invites: {
        Row: {
          approved_at: string | null
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          created_by: string
          delivery_method: string | null
          email: string
          email_sent_at: string | null
          expires_at: string
          gym_id: string
          id: string
          invite_role: string
          invitee_name: string | null
          revoked_at: string | null
          status: string
          token_hash: string
        }
        Insert: {
          approved_at?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          created_by: string
          delivery_method?: string | null
          email: string
          email_sent_at?: string | null
          expires_at: string
          gym_id: string
          id?: string
          invite_role?: string
          invitee_name?: string | null
          revoked_at?: string | null
          status?: string
          token_hash: string
        }
        Update: {
          approved_at?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          created_by?: string
          delivery_method?: string | null
          email?: string
          email_sent_at?: string | null
          expires_at?: string
          gym_id?: string
          id?: string
          invite_role?: string
          invitee_name?: string | null
          revoked_at?: string | null
          status?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_admin_invites_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_communication_settings: {
        Row: {
          accent_color: string
          created_at: string
          footer_text: string | null
          gym_id: string
          logo_url: string | null
          reply_to_email: string | null
          sender_domain_status: string
          sender_email: string | null
          sender_name: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string
          created_at?: string
          footer_text?: string | null
          gym_id: string
          logo_url?: string | null
          reply_to_email?: string | null
          sender_domain_status?: string
          sender_email?: string | null
          sender_name?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string
          created_at?: string
          footer_text?: string | null
          gym_id?: string
          logo_url?: string | null
          reply_to_email?: string | null
          sender_domain_status?: string
          sender_email?: string | null
          sender_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_communication_settings_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: true
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_email_templates: {
        Row: {
          body_text: string
          button_label: string | null
          category: string
          created_at: string
          enabled: boolean
          gym_id: string
          heading: string
          id: string
          preheader: string | null
          subject: string
          template_key: string
          template_name: string
          updated_at: string
        }
        Insert: {
          body_text: string
          button_label?: string | null
          category?: string
          created_at?: string
          enabled?: boolean
          gym_id: string
          heading: string
          id?: string
          preheader?: string | null
          subject: string
          template_key: string
          template_name: string
          updated_at?: string
        }
        Update: {
          body_text?: string
          button_label?: string | null
          category?: string
          created_at?: string
          enabled?: boolean
          gym_id?: string
          heading?: string
          id?: string
          preheader?: string | null
          subject?: string
          template_key?: string
          template_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_email_templates_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_member_view_settings: {
        Row: {
          cta_config: Json
          gym_id: string
          home_layout: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cta_config?: Json
          gym_id: string
          home_layout?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cta_config?: Json
          gym_id?: string
          home_layout?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gym_member_view_settings_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: true
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_members: {
        Row: {
          access_revoked_at: string | null
          access_status: string
          approved_at: string | null
          approved_by: string | null
          attrition_on: string | null
          created_at: string
          gym_id: string
          id: string
          is_active: boolean
          joined_at: string
          role: Database["public"]["Enums"]["gym_member_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          access_revoked_at?: string | null
          access_status?: string
          approved_at?: string | null
          approved_by?: string | null
          attrition_on?: string | null
          created_at?: string
          gym_id: string
          id?: string
          is_active?: boolean
          joined_at?: string
          role?: Database["public"]["Enums"]["gym_member_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          access_revoked_at?: string | null
          access_status?: string
          approved_at?: string | null
          approved_by?: string | null
          attrition_on?: string | null
          created_at?: string
          gym_id?: string
          id?: string
          is_active?: boolean
          joined_at?: string
          role?: Database["public"]["Enums"]["gym_member_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_members_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_ownership_action_approvals: {
        Row: {
          action_id: string
          approved_at: string
          owner_user_id: string
        }
        Insert: {
          action_id: string
          approved_at?: string
          owner_user_id: string
        }
        Update: {
          action_id?: string
          approved_at?: string
          owner_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_ownership_action_approvals_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "gym_ownership_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_ownership_actions: {
        Row: {
          action_type: string
          created_at: string
          created_by: string
          executed_at: string | null
          expires_at: string
          gym_id: string
          id: string
          status: string
          target_user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          created_by: string
          executed_at?: string | null
          expires_at?: string
          gym_id: string
          id?: string
          status?: string
          target_user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          created_by?: string
          executed_at?: string | null
          expires_at?: string
          gym_id?: string
          id?: string
          status?: string
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gym_ownership_actions_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gyms: {
        Row: {
          country_code: string
          created_at: string
          created_by: string | null
          currency: string
          id: string
          logo_url: string | null
          name: string
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          country_code?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      member_notifications: {
        Row: {
          body: string | null
          created_at: string
          delivered_at: string | null
          gym_id: string
          id: string
          notification_type: string
          read_at: string | null
          related_comment_id: string | null
          related_post_id: string | null
          related_session_id: string | null
          scheduled_for: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          delivered_at?: string | null
          gym_id: string
          id?: string
          notification_type: string
          read_at?: string | null
          related_comment_id?: string | null
          related_post_id?: string | null
          related_session_id?: string | null
          scheduled_for?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          delivered_at?: string | null
          gym_id?: string
          id?: string
          notification_type?: string
          read_at?: string | null
          related_comment_id?: string | null
          related_post_id?: string | null
          related_session_id?: string | null
          scheduled_for?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_notifications_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_notifications_related_comment_id_fkey"
            columns: ["related_comment_id"]
            isOneToOne: false
            referencedRelation: "social_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_notifications_related_post_id_fkey"
            columns: ["related_post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_notifications_related_session_id_fkey"
            columns: ["related_session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      member_training_preferences: {
        Row: {
          gym_id: string
          updated_at: string
          user_id: string
          weekly_goal: number
        }
        Insert: {
          gym_id: string
          updated_at?: string
          user_id: string
          weekly_goal?: number
        }
        Update: {
          gym_id?: string
          updated_at?: string
          user_id?: string
          weekly_goal?: number
        }
        Relationships: []
      }
      members: {
        Row: {
          created_at: string
          display_name: string
          email: string | null
          first_name: string | null
          gym_id: string
          id: string
          joined_at: string
          last_name: string | null
          phone: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          email?: string | null
          first_name?: string | null
          gym_id: string
          id?: string
          joined_at?: string
          last_name?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string | null
          first_name?: string | null
          gym_id?: string
          id?: string
          joined_at?: string
          last_name?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_plans: {
        Row: {
          access_type: string
          billing_interval: string
          classes_per_week: number | null
          created_at: string
          description: string | null
          gym_id: string
          id: string
          includes_classes: boolean
          includes_open_gym: boolean
          includes_pt: boolean
          is_active: boolean
          is_public: boolean
          joining_fee_pence: number
          name: string
          price_pence: number
          trial_days: number
          updated_at: string
        }
        Insert: {
          access_type?: string
          billing_interval?: string
          classes_per_week?: number | null
          created_at?: string
          description?: string | null
          gym_id: string
          id?: string
          includes_classes?: boolean
          includes_open_gym?: boolean
          includes_pt?: boolean
          is_active?: boolean
          is_public?: boolean
          joining_fee_pence?: number
          name: string
          price_pence: number
          trial_days?: number
          updated_at?: string
        }
        Update: {
          access_type?: string
          billing_interval?: string
          classes_per_week?: number | null
          created_at?: string
          description?: string | null
          gym_id?: string
          id?: string
          includes_classes?: boolean
          includes_open_gym?: boolean
          includes_pt?: boolean
          is_active?: boolean
          is_public?: boolean
          joining_fee_pence?: number
          name?: string
          price_pence?: number
          trial_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_plans_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          ends_on: string | null
          gym_id: string
          id: string
          member_id: string | null
          payment_provider:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          payment_status: Database["public"]["Enums"]["payment_state"]
          plan_id: string | null
          provider_customer_id: string | null
          provider_last_synced_at: string | null
          provider_mandate_id: string | null
          provider_status: string | null
          provider_subscription_id: string | null
          starts_on: string | null
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          ends_on?: string | null
          gym_id: string
          id?: string
          member_id?: string | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          payment_status?: Database["public"]["Enums"]["payment_state"]
          plan_id?: string | null
          provider_customer_id?: string | null
          provider_last_synced_at?: string | null
          provider_mandate_id?: string | null
          provider_status?: string | null
          provider_subscription_id?: string | null
          starts_on?: string | null
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          ends_on?: string | null
          gym_id?: string
          id?: string
          member_id?: string | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          payment_status?: Database["public"]["Enums"]["payment_state"]
          plan_id?: string | null
          provider_customer_id?: string | null
          provider_last_synced_at?: string | null
          provider_mandate_id?: string | null
          provider_status?: string | null
          provider_subscription_id?: string | null
          starts_on?: string | null
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          channel_id: string
          created_at: string
          edited_at: string | null
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          channel_id: string
          created_at?: string
          edited_at?: string | null
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          channel_id?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          booking_confirmation: boolean
          calendar_sync_enabled: boolean
          class_reminders: boolean
          created_at: string
          gym_id: string
          push_enabled: boolean
          reminder_minutes: number
          social_notifications: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_confirmation?: boolean
          calendar_sync_enabled?: boolean
          class_reminders?: boolean
          created_at?: string
          gym_id: string
          push_enabled?: boolean
          reminder_minutes?: number
          social_notifications?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_confirmation?: boolean
          calendar_sync_enabled?: boolean
          class_reminders?: boolean
          created_at?: string
          gym_id?: string
          push_enabled?: boolean
          reminder_minutes?: number
          social_notifications?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_provider_connections: {
        Row: {
          connected_at: string | null
          created_at: string
          environment: string
          external_account_id: string | null
          external_creditor_id: string | null
          gym_id: string
          id: string
          last_error: string | null
          last_synced_at: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          status: Database["public"]["Enums"]["provider_connection_status"]
          updated_at: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          environment?: string
          external_account_id?: string | null
          external_creditor_id?: string | null
          gym_id: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          status?: Database["public"]["Enums"]["provider_connection_status"]
          updated_at?: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          environment?: string
          external_account_id?: string | null
          external_creditor_id?: string | null
          gym_id?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          status?: Database["public"]["Enums"]["provider_connection_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_provider_connections_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_records: {
        Row: {
          amount_pence: number
          charge_date: string | null
          created_at: string
          currency: string
          failure_code: string | null
          failure_message: string | null
          gym_id: string
          id: string
          membership_id: string | null
          paid_out_at: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_created_at: string | null
          provider_customer_id: string | null
          provider_mandate_id: string | null
          provider_payment_id: string | null
          provider_subscription_id: string | null
          state: Database["public"]["Enums"]["payment_state"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_pence: number
          charge_date?: string | null
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          gym_id: string
          id?: string
          membership_id?: string | null
          paid_out_at?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_created_at?: string | null
          provider_customer_id?: string | null
          provider_mandate_id?: string | null
          provider_payment_id?: string | null
          provider_subscription_id?: string | null
          state?: Database["public"]["Enums"]["payment_state"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_pence?: number
          charge_date?: string | null
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          gym_id?: string
          id?: string
          membership_id?: string | null
          paid_out_at?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_created_at?: string | null
          provider_customer_id?: string | null
          provider_mandate_id?: string | null
          provider_payment_id?: string | null
          provider_subscription_id?: string | null
          state?: Database["public"]["Enums"]["payment_state"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_records_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_bests: {
        Row: {
          achieved_at: string
          comparison_direction: string
          created_at: string
          exercise_key: string | null
          exercise_name: string
          gym_id: string
          id: string
          metric_type: string
          notes: string | null
          unit: string | null
          updated_at: string
          user_id: string
          value_numeric: number
          workout_set_id: string | null
        }
        Insert: {
          achieved_at?: string
          comparison_direction?: string
          created_at?: string
          exercise_key?: string | null
          exercise_name: string
          gym_id: string
          id?: string
          metric_type: string
          notes?: string | null
          unit?: string | null
          updated_at?: string
          user_id: string
          value_numeric: number
          workout_set_id?: string | null
        }
        Update: {
          achieved_at?: string
          comparison_direction?: string
          created_at?: string
          exercise_key?: string | null
          exercise_name?: string
          gym_id?: string
          id?: string
          metric_type?: string
          notes?: string | null
          unit?: string | null
          updated_at?: string
          user_id?: string
          value_numeric?: number
          workout_set_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personal_bests_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_bests_workout_set_id_fkey"
            columns: ["workout_set_id"]
            isOneToOne: false
            referencedRelation: "workout_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          first_name: string | null
          gender: string | null
          id: string
          last_name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          first_name?: string | null
          gender?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pt_appointments: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string
          gym_id: string
          id: string
          member_user_id: string | null
          notes: string | null
          staff_user_id: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at: string
          gym_id: string
          id?: string
          member_user_id?: string | null
          notes?: string | null
          staff_user_id: string
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          gym_id?: string
          id?: string
          member_user_id?: string | null
          notes?: string | null
          staff_user_id?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pt_appointments_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_availability: {
        Row: {
          created_at: string
          end_time: string
          gym_id: string
          id: string
          is_available: boolean
          resource_id: string
          start_time: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          gym_id: string
          id?: string
          is_available?: boolean
          resource_id: string
          start_time: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          gym_id?: string
          id?: string
          is_available?: boolean
          resource_id?: string
          start_time?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "resource_availability_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_availability_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          allow_overlap: boolean
          capacity: number | null
          created_at: string
          gym_id: string
          id: string
          is_active: boolean
          is_bookable: boolean
          name: string
          notes: string | null
          resource_type: string
          updated_at: string
        }
        Insert: {
          allow_overlap?: boolean
          capacity?: number | null
          created_at?: string
          gym_id: string
          id?: string
          is_active?: boolean
          is_bookable?: boolean
          name: string
          notes?: string | null
          resource_type?: string
          updated_at?: string
        }
        Update: {
          allow_overlap?: boolean
          capacity?: number | null
          created_at?: string
          gym_id?: string
          id?: string
          is_active?: boolean
          is_bookable?: boolean
          name?: string
          notes?: string | null
          resource_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requirements: {
        Row: {
          capability_id: string | null
          class_type_id: string
          created_at: string
          gym_id: string
          id: string
          quantity: number
          resource_id: string | null
        }
        Insert: {
          capability_id?: string | null
          class_type_id: string
          created_at?: string
          gym_id: string
          id?: string
          quantity?: number
          resource_id?: string | null
        }
        Update: {
          capability_id?: string | null
          class_type_id?: string
          created_at?: string
          gym_id?: string
          id?: string
          quantity?: number
          resource_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_requirements_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "capabilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requirements_class_type_id_fkey"
            columns: ["class_type_id"]
            isOneToOne: false
            referencedRelation: "class_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requirements_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requirements_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      social_comments: {
        Row: {
          body: string
          created_at: string
          gym_id: string
          id: string
          parent_comment_id: string | null
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          gym_id: string
          id?: string
          parent_comment_id?: string | null
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          gym_id?: string
          id?: string
          parent_comment_id?: string | null
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_comments_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "social_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          body: string
          created_at: string
          gym_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          gym_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          gym_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      social_reactions: {
        Row: {
          comment_id: string | null
          created_at: string
          gym_id: string
          id: string
          post_id: string | null
          reaction: string
          user_id: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          gym_id: string
          id?: string
          post_id?: string | null
          reaction?: string
          user_id: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          gym_id?: string
          id?: string
          post_id?: string | null
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "social_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_reactions_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_access: {
        Row: {
          access_level_id: string
          gym_id: string
          permissions: Json
          preset: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          access_level_id: string
          gym_id: string
          permissions?: Json
          preset?: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          access_level_id?: string
          gym_id?: string
          permissions?: Json
          preset?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_access_access_level_id_fkey"
            columns: ["access_level_id"]
            isOneToOne: false
            referencedRelation: "staff_access_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_access_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_access_levels: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          gym_id: string
          id: string
          is_active: boolean
          name: string
          permissions: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          gym_id: string
          id?: string
          is_active?: boolean
          name: string
          permissions?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          gym_id?: string
          id?: string
          is_active?: boolean
          name?: string
          permissions?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_access_levels_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_capabilities: {
        Row: {
          capability_id: string
          created_at: string
          expires_on: string | null
          gym_id: string
          notes: string | null
          qualified: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          capability_id: string
          created_at?: string
          expires_on?: string | null
          gym_id: string
          notes?: string | null
          qualified?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          capability_id?: string
          created_at?: string
          expires_on?: string | null
          gym_id?: string
          notes?: string | null
          qualified?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_capabilities_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "capabilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_capabilities_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_profiles: {
        Row: {
          created_at: string
          employment_type: string
          gross_hourly_rate_pence: number | null
          gym_id: string
          id: string
          is_active: boolean
          job_title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          employment_type?: string
          gross_hourly_rate_pence?: number | null
          gym_id: string
          id?: string
          is_active?: boolean
          job_title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          employment_type?: string
          gross_hourly_rate_pence?: number | null
          gym_id?: string
          id?: string
          is_active?: boolean
          job_title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_profiles_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_working_hours: {
        Row: {
          created_at: string
          end_time: string | null
          gym_id: string
          id: string
          is_working: boolean
          start_time: string | null
          updated_at: string
          user_id: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          gym_id: string
          id?: string
          is_working?: boolean
          start_time?: string | null
          updated_at?: string
          user_id: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string | null
          gym_id?: string
          id?: string
          is_working?: boolean
          start_time?: string | null
          updated_at?: string
          user_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "staff_working_hours_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      strava_activities: {
        Row: {
          activity_type: string | null
          athlete_id: number
          average_heartrate: number | null
          average_speed_mps: number | null
          calories: number | null
          distance_m: number | null
          elapsed_seconds: number | null
          elevation_gain_m: number | null
          gym_id: string
          id: string
          imported_at: string
          max_heartrate: number | null
          max_speed_mps: number | null
          moving_seconds: number | null
          name: string
          raw_summary: Json | null
          source_visibility: string | null
          sport_type: string | null
          started_at: string
          strava_activity_id: number
          updated_at: string
          user_id: string
          workout_session_id: string | null
        }
        Insert: {
          activity_type?: string | null
          athlete_id: number
          average_heartrate?: number | null
          average_speed_mps?: number | null
          calories?: number | null
          distance_m?: number | null
          elapsed_seconds?: number | null
          elevation_gain_m?: number | null
          gym_id: string
          id?: string
          imported_at?: string
          max_heartrate?: number | null
          max_speed_mps?: number | null
          moving_seconds?: number | null
          name: string
          raw_summary?: Json | null
          source_visibility?: string | null
          sport_type?: string | null
          started_at: string
          strava_activity_id: number
          updated_at?: string
          user_id: string
          workout_session_id?: string | null
        }
        Update: {
          activity_type?: string | null
          athlete_id?: number
          average_heartrate?: number | null
          average_speed_mps?: number | null
          calories?: number | null
          distance_m?: number | null
          elapsed_seconds?: number | null
          elevation_gain_m?: number | null
          gym_id?: string
          id?: string
          imported_at?: string
          max_heartrate?: number | null
          max_speed_mps?: number | null
          moving_seconds?: number | null
          name?: string
          raw_summary?: Json | null
          source_visibility?: string | null
          sport_type?: string | null
          started_at?: string
          strava_activity_id?: number
          updated_at?: string
          user_id?: string
          workout_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "strava_activities_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strava_activities_workout_session_id_fkey"
            columns: ["workout_session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      strava_connections: {
        Row: {
          athlete_first_name: string | null
          athlete_id: number
          athlete_last_name: string | null
          athlete_username: string | null
          connected_at: string
          created_at: string
          gym_id: string
          id: string
          last_error: string | null
          last_synced_at: string | null
          profile_url: string | null
          scopes: string[]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          athlete_first_name?: string | null
          athlete_id: number
          athlete_last_name?: string | null
          athlete_username?: string | null
          connected_at?: string
          created_at?: string
          gym_id: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          profile_url?: string | null
          scopes?: string[]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          athlete_first_name?: string | null
          athlete_id?: number
          athlete_last_name?: string | null
          athlete_username?: string | null
          connected_at?: string
          created_at?: string
          gym_id?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          profile_url?: string | null
          scopes?: string[]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strava_connections_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      training_group_challenge_entries: {
        Row: {
          challenge_id: string
          note: string | null
          submitted_at: string
          user_id: string
          value_numeric: number
        }
        Insert: {
          challenge_id: string
          note?: string | null
          submitted_at?: string
          user_id: string
          value_numeric: number
        }
        Update: {
          challenge_id?: string
          note?: string | null
          submitted_at?: string
          user_id?: string
          value_numeric?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_group_challenge_entries_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "training_group_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      training_group_challenges: {
        Row: {
          activity_name: string
          comparison_direction: string
          created_at: string
          created_by: string
          ends_at: string | null
          group_id: string
          id: string
          metric_type: string
          name: string
          starts_at: string
          unit: string | null
        }
        Insert: {
          activity_name: string
          comparison_direction?: string
          created_at?: string
          created_by: string
          ends_at?: string | null
          group_id: string
          id?: string
          metric_type: string
          name: string
          starts_at?: string
          unit?: string | null
        }
        Update: {
          activity_name?: string
          comparison_direction?: string
          created_at?: string
          created_by?: string
          ends_at?: string | null
          group_id?: string
          id?: string
          metric_type?: string
          name?: string
          starts_at?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_group_challenges_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "training_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      training_group_members: {
        Row: {
          group_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "training_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      training_groups: {
        Row: {
          created_at: string
          description: string | null
          gym_id: string
          id: string
          invite_code: string
          name: string
          owner_user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          gym_id: string
          id?: string
          invite_code: string
          name: string
          owner_user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          gym_id?: string
          id?: string
          invite_code?: string
          name?: string
          owner_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_groups_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_assignments: {
        Row: {
          assigned_by: string | null
          completed_at: string | null
          created_at: string
          due_at: string | null
          focus_tags: string[]
          gym_id: string
          id: string
          member_notes: string | null
          member_rpe: number | null
          member_user_id: string
          scheduled_for: string | null
          source: string
          started_at: string | null
          status: string
          template_id: string | null
          title: string
          updated_at: string
          workout_snapshot: Json
          workout_type: string
        }
        Insert: {
          assigned_by?: string | null
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          focus_tags?: string[]
          gym_id: string
          id?: string
          member_notes?: string | null
          member_rpe?: number | null
          member_user_id: string
          scheduled_for?: string | null
          source: string
          started_at?: string | null
          status?: string
          template_id?: string | null
          title: string
          updated_at?: string
          workout_snapshot?: Json
          workout_type?: string
        }
        Update: {
          assigned_by?: string | null
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          focus_tags?: string[]
          gym_id?: string
          id?: string
          member_notes?: string | null
          member_rpe?: number | null
          member_user_id?: string
          scheduled_for?: string | null
          source?: string
          started_at?: string | null
          status?: string
          template_id?: string | null
          title?: string
          updated_at?: string
          workout_snapshot?: Json
          workout_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_assignments_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_assignments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_entries: {
        Row: {
          created_at: string
          exercise_name: string
          gym_id: string
          id: string
          notes: string | null
          position: number
          session_id: string
          tracking_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exercise_name: string
          gym_id: string
          id?: string
          notes?: string | null
          position?: number
          session_id: string
          tracking_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          exercise_name?: string
          gym_id?: string
          id?: string
          notes?: string | null
          position?: number
          session_id?: string
          tracking_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_entries_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          created_at: string
          gym_id: string
          id: string
          notes: string | null
          performed_at: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          gym_id: string
          id?: string
          notes?: string | null
          performed_at?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          gym_id?: string
          id?: string
          notes?: string | null
          performed_at?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sets: {
        Row: {
          calories: number | null
          created_at: string
          custom_unit: string | null
          custom_value: number | null
          distance_m: number | null
          duration_seconds: number | null
          entry_id: string
          id: string
          notes: string | null
          reps: number | null
          set_number: number
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          calories?: number | null
          created_at?: string
          custom_unit?: string | null
          custom_value?: number | null
          distance_m?: number | null
          duration_seconds?: number | null
          entry_id: string
          id?: string
          notes?: string | null
          reps?: number | null
          set_number: number
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          calories?: number | null
          created_at?: string
          custom_unit?: string | null
          custom_value?: number | null
          distance_m?: number | null
          duration_seconds?: number | null
          entry_id?: string
          id?: string
          notes?: string | null
          reps?: number | null
          set_number?: number
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_sets_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "workout_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_template_activities: {
        Row: {
          activity_name: string
          activity_type: string
          block_id: string
          created_at: string
          gym_id: string
          id: string
          notes: string | null
          position: number
          prescription: Json
          template_id: string
          tracking_type: string
        }
        Insert: {
          activity_name: string
          activity_type?: string
          block_id: string
          created_at?: string
          gym_id: string
          id?: string
          notes?: string | null
          position?: number
          prescription?: Json
          template_id: string
          tracking_type?: string
        }
        Update: {
          activity_name?: string
          activity_type?: string
          block_id?: string
          created_at?: string
          gym_id?: string
          id?: string
          notes?: string | null
          position?: number
          prescription?: Json
          template_id?: string
          tracking_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_template_activities_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "workout_template_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_template_activities_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_template_activities_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_template_blocks: {
        Row: {
          block_type: string
          created_at: string
          gym_id: string
          id: string
          instructions: string | null
          position: number
          rounds: number | null
          template_id: string
          title: string
        }
        Insert: {
          block_type?: string
          created_at?: string
          gym_id: string
          id?: string
          instructions?: string | null
          position?: number
          rounds?: number | null
          template_id: string
          title: string
        }
        Update: {
          block_type?: string
          created_at?: string
          gym_id?: string
          id?: string
          instructions?: string | null
          position?: number
          rounds?: number | null
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_template_blocks_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_template_blocks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_templates: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          estimated_minutes: number | null
          focus_tags: string[]
          gym_id: string
          id: string
          is_active: boolean
          title: string
          updated_at: string
          visibility: string
          workout_type: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          estimated_minutes?: number | null
          focus_tags?: string[]
          gym_id: string
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
          visibility?: string
          workout_type?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          estimated_minutes?: number | null
          focus_tags?: string[]
          gym_id?: string
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
          visibility?: string
          workout_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_templates_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_wods: {
        Row: {
          created_at: string
          gym_id: string
          id: string
          is_active: boolean
          message: string | null
          published_by: string
          template_id: string
          wod_date: string
        }
        Insert: {
          created_at?: string
          gym_id: string
          id?: string
          is_active?: boolean
          message?: string | null
          published_by: string
          template_id: string
          wod_date: string
        }
        Update: {
          created_at?: string
          gym_id?: string
          id?: string
          is_active?: boolean
          message?: string | null
          published_by?: string
          template_id?: string
          wod_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_wods_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_wods_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_admin_access: {
        Args: { target_gym_id: string; target_user_id: string }
        Returns: boolean
      }
      approve_email_owner_invite: {
        Args: { target_invite_id: string }
        Returns: {
          owner_approvals: number
          owner_approvals_required: number
          ready_to_send: boolean
          status: string
        }[]
      }
      approve_ownership_action: {
        Args: { target_action_id: string }
        Returns: Json
      }
      approve_pending_access: {
        Args: { target_gym_id: string; target_user_id: string }
        Returns: Json
      }
      approve_shareable_owner_invite: {
        Args: { target_invite_id: string }
        Returns: {
          owner_approvals: number
          owner_approvals_required: number
          ready_to_share: boolean
          status: string
          token: string
        }[]
      }
      assign_staff_access_level: {
        Args: {
          target_gym_id: string
          target_level_id: string
          target_user_id: string
        }
        Returns: undefined
      }
      book_class_session: {
        Args: { p_session_id: string }
        Returns: {
          booked_at: string
          cancelled_at: string | null
          created_at: string
          gym_id: string
          id: string
          session_id: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "class_bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_class_booking: {
        Args: { p_session_id: string }
        Returns: {
          booked_at: string
          cancelled_at: string | null
          created_at: string
          gym_id: string
          id: string
          session_id: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "class_bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_access_invite: {
        Args: { invite_token: string }
        Returns: {
          access_status: string
          gym_id: string
          gym_name: string
          role: string
        }[]
      }
      claim_admin_invite: {
        Args: { invite_token: string }
        Returns: {
          access_status: string
          gym_id: string
          gym_name: string
        }[]
      }
      create_access_invite: {
        Args: {
          expires_in_days?: number
          invite_email: string
          requested_role?: string
          target_gym_id: string
        }
        Returns: {
          expires_at: string
          gym_name: string
          invite_id: string
          invite_role: string
          token: string
        }[]
      }
      create_admin_invite: {
        Args: {
          expires_in_days?: number
          invite_email: string
          target_gym_id: string
        }
        Returns: {
          expires_at: string
          gym_name: string
          invite_id: string
          token: string
        }[]
      }
      create_email_access_invite: {
        Args: {
          expires_in_days?: number
          invite_email: string
          invitee_name?: string
          requested_role?: string
          target_gym_id: string
        }
        Returns: {
          invite_id: string
          owner_approvals: number
          owner_approvals_required: number
          status: string
        }[]
      }
      create_gym_for_current_user: {
        Args: { gym_name: string; gym_slug: string }
        Returns: string
      }
      create_shareable_access_invite: {
        Args: {
          expires_in_days?: number
          invite_email: string
          invitee_name?: string
          requested_role?: string
          target_gym_id: string
        }
        Returns: {
          invite_id: string
          owner_approvals: number
          owner_approvals_required: number
          status: string
          token: string
        }[]
      }
      create_training_group: {
        Args: { p_description?: string; p_gym_id: string; p_name: string }
        Returns: Json
      }
      create_training_group_challenge: {
        Args: {
          p_activity_name: string
          p_comparison_direction?: string
          p_ends_at?: string
          p_group_id: string
          p_metric_type: string
          p_name: string
          p_unit: string
        }
        Returns: string
      }
      create_validated_class_session: {
        Args: {
          p_capacity: number
          p_class_type_id: string
          p_description: string
          p_ends_at: string
          p_gym_id: string
          p_name: string
          p_plan_ids?: string[]
          p_reserved_capacity?: number
          p_reserved_release_minutes_before?: number
          p_staff_ids?: string[]
          p_starts_at: string
        }
        Returns: Json
      }
      delete_admin_invite: {
        Args: { target_invite_id: string }
        Returns: boolean
      }
      get_access_invite: {
        Args: { invite_token: string }
        Returns: {
          email: string
          expires_at: string
          gym_name: string
          invite_id: string
          invite_role: string
          status: string
        }[]
      }
      get_admin_invite: {
        Args: { invite_token: string }
        Returns: {
          email: string
          expires_at: string
          gym_name: string
          invite_id: string
          status: string
        }[]
      }
      get_auth_email_context: {
        Args: {
          p_access_invite?: string
          p_email: string
          p_gym_id?: string
          p_signup_slug?: string
          p_user_id: string
        }
        Returns: {
          accent_color: string
          access_invite: boolean
          footer_text: string
          gym_id: string
          gym_name: string
          gym_slug: string
          invite_role: string
          invited_by: string
          logo_url: string
          reply_to_email: string
          sender_domain_status: string
          sender_email: string
          sender_name: string
        }[]
      }
      get_auth_email_template: {
        Args: { p_gym_id: string; p_template_key: string }
        Returns: {
          body_text: string
          button_label: string
          enabled: boolean
          heading: string
          preheader: string
          subject: string
        }[]
      }
      get_class_booking_options: {
        Args: { p_session_id: string }
        Returns: Json
      }
      get_class_calendar: {
        Args: { p_from: string; p_gym_id: string; p_to: string }
        Returns: {
          availability_note: string
          bookable_for_me: boolean
          booked_count: number
          capacity: number
          description: string
          ends_at: string
          is_cancelled: boolean
          my_booking_status: string
          name: string
          reserved_capacity: number
          reserved_eligible: boolean
          reserved_plan_names: string[]
          reserved_release_minutes_before: number
          session_id: string
          spaces_left: number
          starts_at: string
        }[]
      }
      get_email_invite_send_context: {
        Args: { requesting_user_id: string; target_invite_id: string }
        Returns: {
          email: string
          expires_at: string
          gym_id: string
          invite_id: string
          invite_role: string
          status: string
        }[]
      }
      get_gym_team_accounts: {
        Args: { target_gym_id: string }
        Returns: {
          access_status: string
          display_name: string
          email: string
          is_active: boolean
          joined_at: string
          role: Database["public"]["Enums"]["gym_member_role"]
          user_id: string
        }[]
      }
      get_member_home_settings: { Args: { p_gym_id: string }; Returns: Json }
      get_my_training_groups: { Args: { p_gym_id: string }; Returns: Json }
      get_public_gym_brand: { Args: { p_gym_id: string }; Returns: Json }
      get_public_gym_join_options: {
        Args: { p_gym_slug: string }
        Returns: Json
      }
      get_training_group_dashboard: {
        Args: { p_group_id: string }
        Returns: Json
      }
      hybridone_auth_journey_test_membership: {
        Args: {
          target_action: string
          target_gym_id?: string
          target_user_id: string
        }
        Returns: undefined
      }
      hybridone_auth_journey_test_membership_role: {
        Args: {
          target_action: string
          target_gym_id?: string
          target_role?: string
          target_user_id: string
        }
        Returns: undefined
      }
      hybridone_invite_edge_test_admin: {
        Args: {
          p_action: string
          p_gym_id?: string
          p_invite_id?: string
          p_run_id: string
          p_user_id?: string
        }
        Returns: Json
      }
      hybridone_membership_persona_cleanup: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      hybridone_membership_persona_setup: {
        Args: { persona: string; target_user_id: string }
        Returns: string
      }
      join_public_gym_with_membership: {
        Args: { p_gym_slug: string; p_plan_id: string }
        Returns: Json
      }
      join_training_group_by_code: { Args: { p_code: string }; Returns: Json }
      mark_email_invite_sent: {
        Args: { target_invite_id: string }
        Returns: undefined
      }
      member_book_class: { Args: { p_session_id: string }; Returns: Json }
      member_cancel_class: { Args: { p_session_id: string }; Returns: Json }
      member_class_schedule: {
        Args: { p_from?: string; p_gym_id: string; p_to?: string }
        Returns: {
          available_spaces: number
          booked_count: number
          capacity: number
          description: string
          ends_at: string
          is_booked: boolean
          name: string
          session_id: string
          starts_at: string
        }[]
      }
      prepare_class_drop_in_purchase: {
        Args: { p_session_id: string }
        Returns: Json
      }
      prepare_email_invite_token: {
        Args: { new_token: string; target_invite_id: string }
        Returns: {
          email: string
          expires_at: string
          gym_name: string
          invite_role: string
        }[]
      }
      preview_training_group_invite: { Args: { p_code: string }; Returns: Json }
      propose_gym_deletion: { Args: { target_gym_id: string }; Returns: Json }
      propose_owner_promotion: {
        Args: { target_gym_id: string; target_user_id: string }
        Returns: Json
      }
      propose_owner_removal: {
        Args: { target_gym_id: string; target_user_id: string }
        Returns: Json
      }
      provision_staff_membership_with_level: {
        Args: {
          target_display_name: string
          target_gym_id: string
          target_level_id: string
          target_role: string
          target_user_id: string
        }
        Returns: undefined
      }
      remove_admin_access: {
        Args: { target_gym_id: string; target_user_id: string }
        Returns: boolean
      }
      remove_gym_staff_access: {
        Args: { target_gym_id: string; target_user_id: string }
        Returns: boolean
      }
      revoke_admin_invite: {
        Args: { target_invite_id: string }
        Returns: boolean
      }
      submit_training_group_challenge_result: {
        Args: { p_challenge_id: string; p_note?: string; p_value: number }
        Returns: undefined
      }
      validate_class_schedule: {
        Args: {
          p_capacity: number
          p_class_type_id: string
          p_ends_at: string
          p_exclude_session_id?: string
          p_gym_id: string
          p_staff_ids?: string[]
          p_starts_at: string
        }
        Returns: Json
      }
    }
    Enums: {
      gym_member_role: "owner" | "admin" | "staff" | "coach" | "member"
      membership_status:
        | "pending"
        | "active"
        | "paused"
        | "cancelled"
        | "expired"
      payment_provider: "gocardless" | "manual" | "other"
      payment_state:
        | "pending"
        | "submitted"
        | "confirmed"
        | "paid_out"
        | "failed"
        | "cancelled"
        | "charged_back"
        | "refunded"
      provider_connection_status:
        | "not_connected"
        | "pending"
        | "connected"
        | "error"
        | "revoked"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      gym_member_role: ["owner", "admin", "staff", "coach", "member"],
      membership_status: [
        "pending",
        "active",
        "paused",
        "cancelled",
        "expired",
      ],
      payment_provider: ["gocardless", "manual", "other"],
      payment_state: [
        "pending",
        "submitted",
        "confirmed",
        "paid_out",
        "failed",
        "cancelled",
        "charged_back",
        "refunded",
      ],
      provider_connection_status: [
        "not_connected",
        "pending",
        "connected",
        "error",
        "revoked",
      ],
    },
  },
} as const
