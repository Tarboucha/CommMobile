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
    PostgrestVersion: "14.1"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          address_type: Database["public"]["Enums"]["address_type"] | null
          apartment_unit: string | null
          city: string
          country: string | null
          created_at: string | null
          deleted_at: string | null
          delivery_instructions: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          label: string | null
          latitude: number
          location: unknown
          longitude: number
          postal_code: string
          profile_id: string
          state: string
          street_name: string
          street_number: string | null
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          address_type?: Database["public"]["Enums"]["address_type"] | null
          apartment_unit?: string | null
          city: string
          country?: string | null
          created_at?: string | null
          deleted_at?: string | null
          delivery_instructions?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          label?: string | null
          latitude: number
          location?: unknown
          longitude: number
          postal_code: string
          profile_id: string
          state: string
          street_name: string
          street_number?: string | null
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          address_type?: Database["public"]["Enums"]["address_type"] | null
          apartment_unit?: string | null
          city?: string
          country?: string | null
          created_at?: string | null
          deleted_at?: string | null
          delivery_instructions?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          label?: string | null
          latitude?: number
          location?: unknown
          longitude?: number
          postal_code?: string
          profile_id?: string
          state?: string
          street_name?: string
          street_number?: string | null
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addresses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_schedules: {
        Row: {
          created_at: string | null
          dtend: string | null
          dtstart: string
          end_time: string
          id: string
          is_active: boolean | null
          offering_id: string
          rrule: string
          slot_label: string | null
          slot_unit: string | null
          slots_available: number
          start_time: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dtend?: string | null
          dtstart: string
          end_time: string
          id?: string
          is_active?: boolean | null
          offering_id: string
          rrule: string
          slot_label?: string | null
          slot_unit?: string | null
          slots_available?: number
          start_time: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dtend?: string | null
          dtstart?: string
          end_time?: string
          id?: string
          is_active?: boolean | null
          offering_id?: string
          rrule?: string
          slot_label?: string | null
          slot_unit?: string | null
          slots_available?: number
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "availability_schedules_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_community_snapshots: {
        Row: {
          booking_id: string
          created_at: string | null
          id: string
          original_community_id: string | null
          snapshot_community_description: string | null
          snapshot_community_image_url: string | null
          snapshot_community_name: string
        }
        Insert: {
          booking_id: string
          created_at?: string | null
          id?: string
          original_community_id?: string | null
          snapshot_community_description?: string | null
          snapshot_community_image_url?: string | null
          snapshot_community_name: string
        }
        Update: {
          booking_id?: string
          created_at?: string | null
          id?: string
          original_community_id?: string | null
          snapshot_community_description?: string | null
          snapshot_community_image_url?: string | null
          snapshot_community_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_community_snapshots_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_community_snapshots_original_community_id_fkey"
            columns: ["original_community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_customer_snapshots: {
        Row: {
          booking_id: string
          created_at: string | null
          id: string
          original_customer_id: string
          snapshot_avatar_url: string | null
          snapshot_display_name: string | null
          snapshot_email: string | null
          snapshot_first_name: string | null
          snapshot_last_name: string | null
          snapshot_phone: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string | null
          id?: string
          original_customer_id: string
          snapshot_avatar_url?: string | null
          snapshot_display_name?: string | null
          snapshot_email?: string | null
          snapshot_first_name?: string | null
          snapshot_last_name?: string | null
          snapshot_phone?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string | null
          id?: string
          original_customer_id?: string
          snapshot_avatar_url?: string | null
          snapshot_display_name?: string | null
          snapshot_email?: string | null
          snapshot_first_name?: string | null
          snapshot_last_name?: string | null
          snapshot_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_customer_snapshots_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_customer_snapshots_original_customer_id_fkey"
            columns: ["original_customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_delivery_snapshots: {
        Row: {
          booking_id: string
          created_at: string | null
          id: string
          snapshot_address_id: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string | null
          id?: string
          snapshot_address_id?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string | null
          id?: string
          snapshot_address_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_delivery_snapshots_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_delivery_snapshots_snapshot_address_id_fkey"
            columns: ["snapshot_address_id"]
            isOneToOne: false
            referencedRelation: "snapshot_addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_items: {
        Row: {
          booking_id: string
          created_at: string | null
          currency_code: string | null
          delivery_fee_amount: number | null
          fulfillment_method: Database["public"]["Enums"]["fulfillment_method"]
          id: string
          instance_date: string | null
          offering_id: string
          offering_version: number
          quantity: number
          schedule_id: string | null
          snapshot_category: Database["public"]["Enums"]["offering_category"]
          snapshot_description: string | null
          snapshot_image_url: string | null
          snapshot_title: string
          special_instructions: string | null
          total_amount: number
          unit_price_amount: number
        }
        Insert: {
          booking_id: string
          created_at?: string | null
          currency_code?: string | null
          delivery_fee_amount?: number | null
          fulfillment_method: Database["public"]["Enums"]["fulfillment_method"]
          id?: string
          instance_date?: string | null
          offering_id: string
          offering_version: number
          quantity?: number
          schedule_id?: string | null
          snapshot_category: Database["public"]["Enums"]["offering_category"]
          snapshot_description?: string | null
          snapshot_image_url?: string | null
          snapshot_title: string
          special_instructions?: string | null
          total_amount: number
          unit_price_amount: number
        }
        Update: {
          booking_id?: string
          created_at?: string | null
          currency_code?: string | null
          delivery_fee_amount?: number | null
          fulfillment_method?: Database["public"]["Enums"]["fulfillment_method"]
          id?: string
          instance_date?: string | null
          offering_id?: string
          offering_version?: number
          quantity?: number
          schedule_id?: string | null
          snapshot_category?: Database["public"]["Enums"]["offering_category"]
          snapshot_description?: string | null
          snapshot_image_url?: string | null
          snapshot_title?: string
          special_instructions?: string | null
          total_amount?: number
          unit_price_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_items_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_items_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_items_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "availability_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_provider_snapshots: {
        Row: {
          booking_item_id: string
          created_at: string | null
          id: string
          original_provider_id: string
          snapshot_address_id: string | null
          snapshot_avatar_url: string | null
          snapshot_display_name: string
          snapshot_email: string | null
          snapshot_phone: string | null
        }
        Insert: {
          booking_item_id: string
          created_at?: string | null
          id?: string
          original_provider_id: string
          snapshot_address_id?: string | null
          snapshot_avatar_url?: string | null
          snapshot_display_name: string
          snapshot_email?: string | null
          snapshot_phone?: string | null
        }
        Update: {
          booking_item_id?: string
          created_at?: string | null
          id?: string
          original_provider_id?: string
          snapshot_address_id?: string | null
          snapshot_avatar_url?: string | null
          snapshot_display_name?: string
          snapshot_email?: string | null
          snapshot_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_provider_snapshots_booking_item_id_fkey"
            columns: ["booking_item_id"]
            isOneToOne: true
            referencedRelation: "booking_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_provider_snapshots_original_provider_id_fkey"
            columns: ["original_provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_provider_snapshots_snapshot_address_id_fkey"
            columns: ["snapshot_address_id"]
            isOneToOne: false
            referencedRelation: "snapshot_addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_schedule_snapshots: {
        Row: {
          booking_item_id: string
          created_at: string | null
          exception_id: string | null
          exception_override_end_time: string | null
          exception_override_slots: number | null
          exception_override_start_time: string | null
          exception_reason: string | null
          had_exception: boolean | null
          id: string
          original_schedule_id: string | null
          slots_booked_at_booking: number | null
          snapshot_dtend: string | null
          snapshot_dtstart: string
          snapshot_end_time: string
          snapshot_rrule: string
          snapshot_slot_label: string | null
          snapshot_slot_unit: string | null
          snapshot_slots_available: number
          snapshot_start_time: string
        }
        Insert: {
          booking_item_id: string
          created_at?: string | null
          exception_id?: string | null
          exception_override_end_time?: string | null
          exception_override_slots?: number | null
          exception_override_start_time?: string | null
          exception_reason?: string | null
          had_exception?: boolean | null
          id?: string
          original_schedule_id?: string | null
          slots_booked_at_booking?: number | null
          snapshot_dtend?: string | null
          snapshot_dtstart: string
          snapshot_end_time: string
          snapshot_rrule: string
          snapshot_slot_label?: string | null
          snapshot_slot_unit?: string | null
          snapshot_slots_available: number
          snapshot_start_time: string
        }
        Update: {
          booking_item_id?: string
          created_at?: string | null
          exception_id?: string | null
          exception_override_end_time?: string | null
          exception_override_slots?: number | null
          exception_override_start_time?: string | null
          exception_reason?: string | null
          had_exception?: boolean | null
          id?: string
          original_schedule_id?: string | null
          slots_booked_at_booking?: number | null
          snapshot_dtend?: string | null
          snapshot_dtstart?: string
          snapshot_end_time?: string
          snapshot_rrule?: string
          snapshot_slot_label?: string | null
          snapshot_slot_unit?: string | null
          snapshot_slots_available?: number
          snapshot_start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_schedule_snapshots_booking_item_id_fkey"
            columns: ["booking_item_id"]
            isOneToOne: true
            referencedRelation: "booking_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_schedule_snapshots_exception_id_fkey"
            columns: ["exception_id"]
            isOneToOne: false
            referencedRelation: "schedule_exceptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_schedule_snapshots_original_schedule_id_fkey"
            columns: ["original_schedule_id"]
            isOneToOne: false
            referencedRelation: "availability_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_status_history: {
        Row: {
          booking_id: string
          changed_by_id: string | null
          created_at: string | null
          from_status: Database["public"]["Enums"]["booking_status"] | null
          id: string
          notes: string | null
          to_status: Database["public"]["Enums"]["booking_status"]
        }
        Insert: {
          booking_id: string
          changed_by_id?: string | null
          created_at?: string | null
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: string
          notes?: string | null
          to_status: Database["public"]["Enums"]["booking_status"]
        }
        Update: {
          booking_id?: string
          changed_by_id?: string | null
          created_at?: string | null
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: string
          notes?: string | null
          to_status?: Database["public"]["Enums"]["booking_status"]
        }
        Relationships: [
          {
            foreignKeyName: "booking_status_history_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_status_history_changed_by_id_fkey"
            columns: ["changed_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          booking_number: string
          booking_status: Database["public"]["Enums"]["booking_status"] | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by_id: string | null
          community_id: string
          completed_at: string | null
          confirmed_at: string | null
          created_at: string | null
          currency_code: string | null
          customer_id: string
          delivery_address_id: string | null
          discount_amount: number | null
          id: string
          idempotency_key: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          platform_fee_amount: number | null
          ready_at: string | null
          service_fee_amount: number | null
          special_instructions: string | null
          subtotal_amount: number
          tip_amount: number | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          booking_number: string
          booking_status?: Database["public"]["Enums"]["booking_status"] | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by_id?: string | null
          community_id: string
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          currency_code?: string | null
          customer_id: string
          delivery_address_id?: string | null
          discount_amount?: number | null
          id?: string
          idempotency_key?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          platform_fee_amount?: number | null
          ready_at?: string | null
          service_fee_amount?: number | null
          special_instructions?: string | null
          subtotal_amount: number
          tip_amount?: number | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          booking_number?: string
          booking_status?: Database["public"]["Enums"]["booking_status"] | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by_id?: string | null
          community_id?: string
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          currency_code?: string | null
          customer_id?: string
          delivery_address_id?: string | null
          discount_amount?: number | null
          id?: string
          idempotency_key?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          platform_fee_amount?: number | null
          ready_at?: string | null
          service_fee_amount?: number | null
          special_instructions?: string | null
          subtotal_amount?: number
          tip_amount?: number | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_cancelled_by_id_fkey"
            columns: ["cancelled_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      communities: {
        Row: {
          access_type:
            | Database["public"]["Enums"]["community_access_type"]
            | null
          address_id: string | null
          allow_member_invites: boolean | null
          auto_approve_join_requests: boolean | null
          community_description: string | null
          community_image_url: string | null
          community_name: string
          created_at: string | null
          created_by_profile_id: string
          current_members_count: number | null
          deleted_at: string | null
          id: string
          invite_link_expires_at: string | null
          invite_link_token: string | null
          is_active: boolean | null
          max_members: number | null
          plan: string | null
          updated_at: string | null
        }
        Insert: {
          access_type?:
            | Database["public"]["Enums"]["community_access_type"]
            | null
          address_id?: string | null
          allow_member_invites?: boolean | null
          auto_approve_join_requests?: boolean | null
          community_description?: string | null
          community_image_url?: string | null
          community_name: string
          created_at?: string | null
          created_by_profile_id: string
          current_members_count?: number | null
          deleted_at?: string | null
          id?: string
          invite_link_expires_at?: string | null
          invite_link_token?: string | null
          is_active?: boolean | null
          max_members?: number | null
          plan?: string | null
          updated_at?: string | null
        }
        Update: {
          access_type?:
            | Database["public"]["Enums"]["community_access_type"]
            | null
          address_id?: string | null
          allow_member_invites?: boolean | null
          auto_approve_join_requests?: boolean | null
          community_description?: string | null
          community_image_url?: string | null
          community_name?: string
          created_at?: string | null
          created_by_profile_id?: string
          current_members_count?: number | null
          deleted_at?: string | null
          id?: string
          invite_link_expires_at?: string | null
          invite_link_token?: string | null
          is_active?: boolean | null
          max_members?: number | null
          plan?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communities_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communities_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_invitations: {
        Row: {
          accepted_at: string | null
          community_id: string
          created_at: string | null
          current_uses: number | null
          declined_at: string | null
          expires_at: string
          id: string
          invitation_message: string | null
          invitation_status:
            | Database["public"]["Enums"]["invitation_status"]
            | null
          invitation_token: string
          invited_by_profile_id: string
          invited_email: string | null
          invited_profile_id: string | null
          max_uses: number | null
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          community_id: string
          created_at?: string | null
          current_uses?: number | null
          declined_at?: string | null
          expires_at: string
          id?: string
          invitation_message?: string | null
          invitation_status?:
            | Database["public"]["Enums"]["invitation_status"]
            | null
          invitation_token: string
          invited_by_profile_id: string
          invited_email?: string | null
          invited_profile_id?: string | null
          max_uses?: number | null
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          community_id?: string
          created_at?: string | null
          current_uses?: number | null
          declined_at?: string | null
          expires_at?: string
          id?: string
          invitation_message?: string | null
          invitation_status?:
            | Database["public"]["Enums"]["invitation_status"]
            | null
          invitation_token?: string
          invited_by_profile_id?: string
          invited_email?: string | null
          invited_profile_id?: string | null
          max_uses?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_invitations_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_invitations_invited_by_profile_id_fkey"
            columns: ["invited_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_invitations_invited_profile_id_fkey"
            columns: ["invited_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_members: {
        Row: {
          admin_notes: string | null
          approved_by_profile_id: string | null
          can_invite_members: boolean | null
          can_post_offerings: boolean | null
          community_id: string
          created_at: string | null
          id: string
          invited_by_profile_id: string | null
          join_method: Database["public"]["Enums"]["join_method"]
          join_requested_at: string | null
          last_activity_at: string | null
          member_role: Database["public"]["Enums"]["member_role"] | null
          membership_approved_at: string | null
          membership_removed_at: string | null
          membership_status:
            | Database["public"]["Enums"]["membership_status"]
            | null
          profile_id: string
          removal_reason: string | null
          removed_by_profile_id: string | null
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          approved_by_profile_id?: string | null
          can_invite_members?: boolean | null
          can_post_offerings?: boolean | null
          community_id: string
          created_at?: string | null
          id?: string
          invited_by_profile_id?: string | null
          join_method: Database["public"]["Enums"]["join_method"]
          join_requested_at?: string | null
          last_activity_at?: string | null
          member_role?: Database["public"]["Enums"]["member_role"] | null
          membership_approved_at?: string | null
          membership_removed_at?: string | null
          membership_status?:
            | Database["public"]["Enums"]["membership_status"]
            | null
          profile_id: string
          removal_reason?: string | null
          removed_by_profile_id?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          approved_by_profile_id?: string | null
          can_invite_members?: boolean | null
          can_post_offerings?: boolean | null
          community_id?: string
          created_at?: string | null
          id?: string
          invited_by_profile_id?: string | null
          join_method?: Database["public"]["Enums"]["join_method"]
          join_requested_at?: string | null
          last_activity_at?: string | null
          member_role?: Database["public"]["Enums"]["member_role"] | null
          membership_approved_at?: string | null
          membership_removed_at?: string | null
          membership_status?:
            | Database["public"]["Enums"]["membership_status"]
            | null
          profile_id?: string
          removal_reason?: string | null
          removed_by_profile_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_members_approved_by_profile_id_fkey"
            columns: ["approved_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_invited_by_profile_id_fkey"
            columns: ["invited_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_removed_by_profile_id_fkey"
            columns: ["removed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          is_muted: boolean | null
          joined_at: string | null
          last_read_at: string | null
          left_at: string | null
          muted_until: string | null
          profile_id: string
          removed_at: string | null
          removed_by_id: string | null
        }
        Insert: {
          conversation_id: string
          is_muted?: boolean | null
          joined_at?: string | null
          last_read_at?: string | null
          left_at?: string | null
          muted_until?: string | null
          profile_id: string
          removed_at?: string | null
          removed_by_id?: string | null
        }
        Update: {
          conversation_id?: string
          is_muted?: boolean | null
          joined_at?: string | null
          last_read_at?: string | null
          left_at?: string | null
          muted_until?: string | null
          profile_id?: string
          removed_at?: string | null
          removed_by_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_removed_by_id_fkey"
            columns: ["removed_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          booking_id: string | null
          community_id: string | null
          conversation_type: Database["public"]["Enums"]["conversation_type"]
          created_at: string | null
          created_by_profile_id: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          booking_id?: string | null
          community_id?: string | null
          conversation_type: Database["public"]["Enums"]["conversation_type"]
          created_at?: string | null
          created_by_profile_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          booking_id?: string | null
          community_id?: string | null
          conversation_type?: Database["public"]["Enums"]["conversation_type"]
          created_at?: string | null
          created_by_profile_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          created_at: string | null
          file_name: string | null
          file_size_bytes: number | null
          file_type: string | null
          file_url: string
          height: number | null
          id: string
          message_id: string
          mime_type: string | null
          width: number | null
        }
        Insert: {
          created_at?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          file_url: string
          height?: number | null
          id?: string
          message_id: string
          mime_type?: string | null
          width?: number | null
        }
        Update: {
          created_at?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          file_url?: string
          height?: number | null
          id?: string
          message_id?: string
          mime_type?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string | null
          deleted_at: string | null
          edited_at: string | null
          expires_at: string | null
          has_attachments: boolean | null
          id: string
          is_deleted: boolean | null
          is_edited: boolean | null
          reply_to_message_id: string | null
          sender_id: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          expires_at?: string | null
          has_attachments?: boolean | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          reply_to_message_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          expires_at?: string | null
          has_attachments?: boolean | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          reply_to_message_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          data_json: Json | null
          id: string
          is_read: boolean | null
          notification_type: string
          profile_id: string
          read_at: string | null
          related_booking_id: string | null
          related_community_id: string | null
          related_offering_id: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          data_json?: Json | null
          id?: string
          is_read?: boolean | null
          notification_type: string
          profile_id: string
          read_at?: string | null
          related_booking_id?: string | null
          related_community_id?: string | null
          related_offering_id?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          data_json?: Json | null
          id?: string
          is_read?: boolean | null
          notification_type?: string
          profile_id?: string
          read_at?: string | null
          related_booking_id?: string | null
          related_community_id?: string | null
          related_offering_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_booking_id_fkey"
            columns: ["related_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_community_id_fkey"
            columns: ["related_community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_offering_id_fkey"
            columns: ["related_offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      offering_images: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          image_url: string
          is_primary: boolean | null
          offering_id: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url: string
          is_primary?: boolean | null
          offering_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url?: string
          is_primary?: boolean | null
          offering_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offering_images_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      offerings: {
        Row: {
          category: Database["public"]["Enums"]["offering_category"]
          community_id: string
          created_at: string | null
          currency_code: string | null
          deleted_at: string | null
          delivery_fee_amount: number | null
          delivery_radius_km: number | null
          description: string | null
          fulfillment_method:
            | Database["public"]["Enums"]["fulfillment_method"]
            | null
          id: string
          is_delivery_available: boolean | null
          is_featured: boolean | null
          pickup_address_id: string | null
          price_amount: number | null
          price_type: Database["public"]["Enums"]["price_type"] | null
          provider_id: string
          status: string | null
          title: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          category: Database["public"]["Enums"]["offering_category"]
          community_id: string
          created_at?: string | null
          currency_code?: string | null
          deleted_at?: string | null
          delivery_fee_amount?: number | null
          delivery_radius_km?: number | null
          description?: string | null
          fulfillment_method?:
            | Database["public"]["Enums"]["fulfillment_method"]
            | null
          id?: string
          is_delivery_available?: boolean | null
          is_featured?: boolean | null
          pickup_address_id?: string | null
          price_amount?: number | null
          price_type?: Database["public"]["Enums"]["price_type"] | null
          provider_id: string
          status?: string | null
          title: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          category?: Database["public"]["Enums"]["offering_category"]
          community_id?: string
          created_at?: string | null
          currency_code?: string | null
          deleted_at?: string | null
          delivery_fee_amount?: number | null
          delivery_radius_km?: number | null
          description?: string | null
          fulfillment_method?:
            | Database["public"]["Enums"]["fulfillment_method"]
            | null
          id?: string
          is_delivery_available?: boolean | null
          is_featured?: boolean | null
          pickup_address_id?: string | null
          price_amount?: number | null
          price_type?: Database["public"]["Enums"]["price_type"] | null
          provider_id?: string
          status?: string | null
          title?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "offerings_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offerings_pickup_address_id_fkey"
            columns: ["pickup_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offerings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_user_id: string
          avatar_url: string | null
          bio: string | null
          business_type: string | null
          created_at: string | null
          deleted_at: string | null
          display_name: string | null
          email: string | null
          first_name: string | null
          id: string
          is_email_verified: boolean | null
          is_verified: boolean | null
          last_login_at: string | null
          last_name: string | null
          phone: string | null
          preferred_language: string | null
          subscription_expires_at: string | null
          subscription_type: string | null
          updated_at: string | null
          verification_documents_json: Json | null
        }
        Insert: {
          auth_user_id: string
          avatar_url?: string | null
          bio?: string | null
          business_type?: string | null
          created_at?: string | null
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_email_verified?: boolean | null
          is_verified?: boolean | null
          last_login_at?: string | null
          last_name?: string | null
          phone?: string | null
          preferred_language?: string | null
          subscription_expires_at?: string | null
          subscription_type?: string | null
          updated_at?: string | null
          verification_documents_json?: Json | null
        }
        Update: {
          auth_user_id?: string
          avatar_url?: string | null
          bio?: string | null
          business_type?: string | null
          created_at?: string | null
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_email_verified?: boolean | null
          is_verified?: boolean | null
          last_login_at?: string | null
          last_name?: string | null
          phone?: string | null
          preferred_language?: string | null
          subscription_expires_at?: string | null
          subscription_type?: string | null
          updated_at?: string | null
          verification_documents_json?: Json | null
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string | null
          device_name: string | null
          device_type: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          profile_id: string
          token: string
        }
        Insert: {
          created_at?: string | null
          device_name?: string | null
          device_type?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          profile_id: string
          token: string
        }
        Update: {
          created_at?: string | null
          device_name?: string | null
          device_type?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          profile_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          booking_id: string
          community_id: string | null
          created_at: string | null
          id: string
          is_visible: boolean | null
          rating: number
          review_text: string | null
          reviewer_id: string
          updated_at: string | null
        }
        Insert: {
          booking_id: string
          community_id?: string | null
          created_at?: string | null
          id?: string
          is_visible?: boolean | null
          rating: number
          review_text?: string | null
          reviewer_id: string
          updated_at?: string | null
        }
        Update: {
          booking_id?: string
          community_id?: string | null
          created_at?: string | null
          id?: string
          is_visible?: boolean | null
          rating?: number
          review_text?: string | null
          reviewer_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_exceptions: {
        Row: {
          cancellation_reason: string | null
          created_at: string | null
          exception_date: string
          id: string
          is_cancelled: boolean | null
          override_end_time: string | null
          override_slots: number | null
          override_start_time: string | null
          schedule_id: string
          updated_at: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          created_at?: string | null
          exception_date: string
          id?: string
          is_cancelled?: boolean | null
          override_end_time?: string | null
          override_slots?: number | null
          override_start_time?: string | null
          schedule_id: string
          updated_at?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          created_at?: string | null
          exception_date?: string
          id?: string
          is_cancelled?: boolean | null
          override_end_time?: string | null
          override_slots?: number | null
          override_start_time?: string | null
          schedule_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_exceptions_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "availability_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_instances: {
        Row: {
          created_at: string | null
          instance_date: string
          schedule_id: string
          slots_booked: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          instance_date: string
          schedule_id: string
          slots_booked?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          instance_date?: string
          schedule_id?: string
          slots_booked?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_instances_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "availability_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      snapshot_addresses: {
        Row: {
          apartment_unit: string | null
          city: string | null
          country: string | null
          created_at: string | null
          id: string
          instructions: string | null
          latitude: number | null
          longitude: number | null
          original_address_id: string | null
          postal_code: string | null
          street_name: string | null
          street_number: string | null
        }
        Insert: {
          apartment_unit?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          instructions?: string | null
          latitude?: number | null
          longitude?: number | null
          original_address_id?: string | null
          postal_code?: string | null
          street_name?: string | null
          street_number?: string | null
        }
        Update: {
          apartment_unit?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          instructions?: string | null
          latitude?: number | null
          longitude?: number | null
          original_address_id?: string | null
          postal_code?: string | null
          street_name?: string | null
          street_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snapshot_addresses_original_address_id_fkey"
            columns: ["original_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      generate_booking_number: { Args: never; Returns: string }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_current_profile_id: { Args: never; Returns: string }
      get_offering_approximate_location: {
        Args: { p_offering_id: string }
        Returns: Database["public"]["CompositeTypes"]["approximate_location"]
        SetofOptions: {
          from: "*"
          to: "approximate_location"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_offerings_approximate_locations: {
        Args: { p_offering_ids: string[] }
        Returns: {
          approximate_latitude: number
          approximate_longitude: number
          city: string
          country: string
          offering_id: string
          state: string
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      is_community_admin: { Args: { p_community_id: string }; Returns: boolean }
      is_community_member: {
        Args: { p_community_id: string }
        Returns: boolean
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      address_type: "home" | "work" | "other"
      booking_status:
        | "pending"
        | "confirmed"
        | "in_progress"
        | "ready"
        | "completed"
        | "cancelled"
        | "refunded"
      community_access_type: "open" | "request_to_join" | "invite_only"
      conversation_type: "direct" | "community" | "booking"
      fulfillment_method: "pickup" | "delivery" | "online" | "at_location"
      invitation_status: "pending" | "accepted" | "declined" | "expired"
      join_method: "invite_link" | "direct_invite" | "request"
      member_role: "owner" | "admin" | "moderator" | "member"
      membership_status: "pending" | "active" | "removed" | "left"
      offering_category: "food" | "product" | "service" | "share" | "event"
      payment_method: "in_app" | "cash" | "external"
      payment_status: "pending" | "paid" | "refunded" | "cancelled"
      price_type: "fixed" | "negotiable" | "free" | "donation"
    }
    CompositeTypes: {
      approximate_location: {
        city: string | null
        state: string | null
        country: string | null
        approximate_latitude: number | null
        approximate_longitude: number | null
      }
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      address_type: ["home", "work", "other"],
      booking_status: [
        "pending",
        "confirmed",
        "in_progress",
        "ready",
        "completed",
        "cancelled",
        "refunded",
      ],
      community_access_type: ["open", "request_to_join", "invite_only"],
      conversation_type: ["direct", "community", "booking"],
      fulfillment_method: ["pickup", "delivery", "online", "at_location"],
      invitation_status: ["pending", "accepted", "declined", "expired"],
      join_method: ["invite_link", "direct_invite", "request"],
      member_role: ["owner", "admin", "moderator", "member"],
      membership_status: ["pending", "active", "removed", "left"],
      offering_category: ["food", "product", "service", "share", "event"],
      payment_method: ["in_app", "cash", "external"],
      payment_status: ["pending", "paid", "refunded", "cancelled"],
      price_type: ["fixed", "negotiable", "free", "donation"],
    },
  },
} as const
