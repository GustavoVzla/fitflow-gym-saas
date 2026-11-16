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
      admin_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          gym_id: string | null
          id: string
          metadata: Json
          resource_id: string | null
          resource_type: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          gym_id?: string | null
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          gym_id?: string | null
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      agendas: {
        Row: {
          active: boolean
          capacity: number
          color: string
          created_at: string
          default_instructor_id: string | null
          description: string | null
          duration_minutes: number
          gym_id: string
          id: string
          name: string
          requires_payment_upfront: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          capacity?: number
          color?: string
          created_at?: string
          default_instructor_id?: string | null
          description?: string | null
          duration_minutes?: number
          gym_id: string
          id?: string
          name: string
          requires_payment_upfront?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          capacity?: number
          color?: string
          created_at?: string
          default_instructor_id?: string | null
          description?: string | null
          duration_minutes?: number
          gym_id?: string
          id?: string
          name?: string
          requires_payment_upfront?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendas_default_instructor_id_fkey"
            columns: ["default_instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendas_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      app_admins: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          agenda_id: string | null
          appointment_type: Database["public"]["Enums"]["appointment_type"]
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          consumed_session: boolean
          created_at: string
          created_by: string | null
          duration_minutes: number | null
          ends_at: string
          gym_id: string
          id: string
          instructor_id: string
          member_id: string
          notes: string | null
          payment_id: string | null
          price_cents: number | null
          room_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          title: string | null
          updated_at: string
        }
        Insert: {
          agenda_id?: string | null
          appointment_type?: Database["public"]["Enums"]["appointment_type"]
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          consumed_session?: boolean
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          ends_at: string
          gym_id: string
          id?: string
          instructor_id: string
          member_id: string
          notes?: string | null
          payment_id?: string | null
          price_cents?: number | null
          room_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          agenda_id?: string | null
          appointment_type?: Database["public"]["Enums"]["appointment_type"]
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          consumed_session?: boolean
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          ends_at?: string
          gym_id?: string
          id?: string
          instructor_id?: string
          member_id?: string
          notes?: string | null
          payment_id?: string | null
          price_cents?: number | null
          room_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_agenda_id_fkey"
            columns: ["agenda_id"]
            isOneToOne: false
            referencedRelation: "agendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "gym_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          gym_id: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          gym_id?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          gym_id?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      avisos_dispatch_queue: {
        Row: {
          attempts: number
          created_at: string
          error_message: string | null
          event_context: Json
          gym_id: string
          history_id: string | null
          id: string
          member_id: string
          scheduled_for: string
          sent_at: string | null
          status: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          event_context?: Json
          gym_id: string
          history_id?: string | null
          id?: string
          member_id: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          event_context?: Json
          gym_id?: string
          history_id?: string | null
          id?: string
          member_id?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avisos_dispatch_queue_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avisos_dispatch_queue_history_id_fkey"
            columns: ["history_id"]
            isOneToOne: false
            referencedRelation: "engagement_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avisos_dispatch_queue_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avisos_dispatch_queue_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "engagement_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          attended_at: string | null
          booked_at: string
          cancelled_at: string | null
          class_instance_id: string
          consumed_session: boolean
          created_at: string
          gym_id: string
          id: string
          member_id: string
          position_in_waitlist: number | null
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
        }
        Insert: {
          attended_at?: string | null
          booked_at?: string
          cancelled_at?: string | null
          class_instance_id: string
          consumed_session?: boolean
          created_at?: string
          gym_id: string
          id?: string
          member_id: string
          position_in_waitlist?: number | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Update: {
          attended_at?: string | null
          booked_at?: string
          cancelled_at?: string | null
          class_instance_id?: string
          consumed_session?: boolean
          created_at?: string
          gym_id?: string
          id?: string
          member_id?: string
          position_in_waitlist?: number | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_class_instance_id_fkey"
            columns: ["class_instance_id"]
            isOneToOne: false
            referencedRelation: "class_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_sessions: {
        Row: {
          amount_cents: number
          canceled_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          expires_at: string
          gym_id: string
          id: string
          member_id: string | null
          payment_id: string | null
          status: string
          stripe_session_id: string
          stripe_url: string
        }
        Insert: {
          amount_cents: number
          canceled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          expires_at: string
          gym_id: string
          id?: string
          member_id?: string | null
          payment_id?: string | null
          status?: string
          stripe_session_id: string
          stripe_url: string
        }
        Update: {
          amount_cents?: number
          canceled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          expires_at?: string
          gym_id?: string
          id?: string
          member_id?: string | null
          payment_id?: string | null
          status?: string
          stripe_session_id?: string
          stripe_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_sessions_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      class_instances: {
        Row: {
          booked_count: number
          cancellation_reason: string | null
          class_id: string
          created_at: string
          end_at: string
          gym_id: string
          id: string
          instructor_id: string | null
          max_spots: number | null
          room: string | null
          scheduled_date: string
          start_at: string
          status: Database["public"]["Enums"]["class_instance_status"]
          updated_at: string
          waitlist_count: number
        }
        Insert: {
          booked_count?: number
          cancellation_reason?: string | null
          class_id: string
          created_at?: string
          end_at: string
          gym_id: string
          id?: string
          instructor_id?: string | null
          max_spots?: number | null
          room?: string | null
          scheduled_date: string
          start_at: string
          status?: Database["public"]["Enums"]["class_instance_status"]
          updated_at?: string
          waitlist_count?: number
        }
        Update: {
          booked_count?: number
          cancellation_reason?: string | null
          class_id?: string
          created_at?: string
          end_at?: string
          gym_id?: string
          id?: string
          instructor_id?: string | null
          max_spots?: number | null
          room?: string | null
          scheduled_date?: string
          start_at?: string
          status?: Database["public"]["Enums"]["class_instance_status"]
          updated_at?: string
          waitlist_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_instances_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_instances_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_instances_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          color: string | null
          created_at: string
          day_of_week: number
          description: string | null
          duration_minutes: number | null
          end_time: string
          gym_id: string
          id: string
          instructor_id: string | null
          is_active: boolean
          max_spots: number
          min_spots: number | null
          name: string
          room: string | null
          start_time: string
          type: Database["public"]["Enums"]["class_type"]
          updated_at: string
          valid_from: string
          valid_until: string | null
          waitlist_size: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          day_of_week: number
          description?: string | null
          duration_minutes?: number | null
          end_time: string
          gym_id: string
          id?: string
          instructor_id?: string | null
          is_active?: boolean
          max_spots: number
          min_spots?: number | null
          name: string
          room?: string | null
          start_time: string
          type?: Database["public"]["Enums"]["class_type"]
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          waitlist_size?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          day_of_week?: number
          description?: string | null
          duration_minutes?: number | null
          end_time?: string
          gym_id?: string
          id?: string
          instructor_id?: string | null
          is_active?: boolean
          max_spots?: number
          min_spots?: number | null
          name?: string
          room?: string | null
          start_time?: string
          type?: Database["public"]["Enums"]["class_type"]
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          waitlist_size?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_registrations: {
        Row: {
          amount_cents: number | null
          cancellation_reason: string | null
          cancelled_at: string | null
          category: string | null
          competition_id: string
          created_at: string
          external_email: string | null
          external_first_name: string | null
          external_last_name: string | null
          external_phone: string | null
          gym_id: string
          id: string
          member_id: string | null
          metadata: Json
          notes: string | null
          paid: boolean
          payment_id: string | null
          registered_at: string
          updated_at: string
          waitlisted: boolean
        }
        Insert: {
          amount_cents?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          category?: string | null
          competition_id: string
          created_at?: string
          external_email?: string | null
          external_first_name?: string | null
          external_last_name?: string | null
          external_phone?: string | null
          gym_id: string
          id?: string
          member_id?: string | null
          metadata?: Json
          notes?: string | null
          paid?: boolean
          payment_id?: string | null
          registered_at?: string
          updated_at?: string
          waitlisted?: boolean
        }
        Update: {
          amount_cents?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          category?: string | null
          competition_id?: string
          created_at?: string
          external_email?: string | null
          external_first_name?: string | null
          external_last_name?: string | null
          external_phone?: string | null
          gym_id?: string
          id?: string
          member_id?: string | null
          metadata?: Json
          notes?: string | null
          paid?: boolean
          payment_id?: string | null
          registered_at?: string
          updated_at?: string
          waitlisted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "competition_registrations_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_registrations_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_registrations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_registrations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          categories: string[]
          conditions: string | null
          contact_email: string | null
          contact_phone: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          end_date: string
          gym_id: string
          id: string
          is_active: boolean
          latitude: number | null
          location_address: string | null
          longitude: number | null
          max_registrations: number | null
          name: string
          online_registration_enabled: boolean
          participants: Json | null
          price_cents: number | null
          results: Json | null
          rules: Json | null
          slug: string | null
          start_date: string
          tax_percent: number | null
          type: string | null
          updated_at: string
          waitlist_enabled: boolean
        }
        Insert: {
          categories?: string[]
          conditions?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          end_date: string
          gym_id: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          location_address?: string | null
          longitude?: number | null
          max_registrations?: number | null
          name: string
          online_registration_enabled?: boolean
          participants?: Json | null
          price_cents?: number | null
          results?: Json | null
          rules?: Json | null
          slug?: string | null
          start_date: string
          tax_percent?: number | null
          type?: string | null
          updated_at?: string
          waitlist_enabled?: boolean
        }
        Update: {
          categories?: string[]
          conditions?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          end_date?: string
          gym_id?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          location_address?: string | null
          longitude?: number | null
          max_registrations?: number | null
          name?: string
          online_registration_enabled?: boolean
          participants?: Json | null
          price_cents?: number | null
          results?: Json | null
          rules?: Json | null
          slug?: string | null
          start_date?: string
          tax_percent?: number | null
          type?: string | null
          updated_at?: string
          waitlist_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "competitions_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          gym_id: string
          id: string
          is_archived: boolean
          last_message_at: string | null
          last_message_preview: string | null
          member_id: string | null
          subject: string | null
          unread_count_gym: number
          unread_count_member: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          gym_id: string
          id?: string
          is_archived?: boolean
          last_message_at?: string | null
          last_message_preview?: string | null
          member_id?: string | null
          subject?: string | null
          unread_count_gym?: number
          unread_count_member?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          gym_id?: string
          id?: string
          is_archived?: boolean
          last_message_at?: string | null
          last_message_preview?: string | null
          member_id?: string | null
          subject?: string | null
          unread_count_gym?: number
          unread_count_member?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_alerts: {
        Row: {
          channel: string
          created_at: string
          created_by: string | null
          gym_id: string
          id: string
          is_active: boolean
          message_template: string
          name: string
          send_offset_minutes: number
          subject: string | null
          trigger_type: string
          trigger_value: number | null
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          created_by?: string | null
          gym_id: string
          id?: string
          is_active?: boolean
          message_template: string
          name: string
          send_offset_minutes?: number
          subject?: string | null
          trigger_type: string
          trigger_value?: number | null
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string | null
          gym_id?: string
          id?: string
          is_active?: boolean
          message_template?: string
          name?: string
          send_offset_minutes?: number
          subject?: string | null
          trigger_type?: string
          trigger_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_alerts_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_history: {
        Row: {
          alert_id: string | null
          channel: string
          error_message: string | null
          gym_id: string
          id: string
          member_id: string
          sent_at: string
          status: string
        }
        Insert: {
          alert_id?: string | null
          channel: string
          error_message?: string | null
          gym_id: string
          id?: string
          member_id: string
          sent_at?: string
          status: string
        }
        Update: {
          alert_id?: string | null
          channel?: string
          error_message?: string | null
          gym_id?: string
          id?: string
          member_id?: string
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_history_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "engagement_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_history_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_history_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          billing_address: string | null
          billing_city: string | null
          billing_email: string | null
          billing_phone: string | null
          billing_postal_code: string | null
          billing_tax_id: string | null
          created_at: string
          gym_id: string
          id: string
          name: string
          notes: string | null
          primary_payer_member_id: string | null
          updated_at: string
        }
        Insert: {
          billing_address?: string | null
          billing_city?: string | null
          billing_email?: string | null
          billing_phone?: string | null
          billing_postal_code?: string | null
          billing_tax_id?: string | null
          created_at?: string
          gym_id: string
          id?: string
          name: string
          notes?: string | null
          primary_payer_member_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_address?: string | null
          billing_city?: string | null
          billing_email?: string | null
          billing_phone?: string | null
          billing_postal_code?: string | null
          billing_tax_id?: string | null
          created_at?: string
          gym_id?: string
          id?: string
          name?: string
          notes?: string | null
          primary_payer_member_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "families_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "families_primary_payer_member_id_fkey"
            columns: ["primary_payer_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          added_at: string
          family_id: string
          gym_id: string
          member_id: string
        }
        Insert: {
          added_at?: string
          family_id: string
          gym_id: string
          member_id: string
        }
        Update: {
          added_at?: string
          family_id?: string
          gym_id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_members_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_clause_templates: {
        Row: {
          body: string
          code: string
          created_at: string
          created_by: string | null
          gym_id: string
          id: string
          is_active: boolean
          is_required: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          code: string
          created_at?: string
          created_by?: string | null
          gym_id: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          code?: string
          created_at?: string
          created_by?: string | null
          gym_id?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_clause_templates_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          deleted_by: string | null
          description: string
          expense_date: string
          gym_id: string
          id: string
          invoice_number: string | null
          invoice_url: string | null
          notes: string | null
          stripe_payment_intent_id: string | null
          supplier: string | null
          tax_amount: number | null
          updated_at: string
        }
        Insert: {
          amount: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description: string
          expense_date?: string
          gym_id: string
          id?: string
          invoice_number?: string | null
          invoice_url?: string | null
          notes?: string | null
          stripe_payment_intent_id?: string | null
          supplier?: string | null
          tax_amount?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          expense_date?: string
          gym_id?: string
          id?: string
          invoice_number?: string | null
          invoice_url?: string | null
          notes?: string | null
          stripe_payment_intent_id?: string | null
          supplier?: string | null
          tax_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_expenses_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_form_fields: {
        Row: {
          created_at: string
          field_label: string
          field_name: string
          field_type: Database["public"]["Enums"]["form_field_type"]
          form_scope: Database["public"]["Enums"]["form_scope"]
          gym_id: string
          help_text: string | null
          id: string
          is_active: boolean
          is_required: boolean
          options: Json | null
          placeholder: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_label: string
          field_name: string
          field_type: Database["public"]["Enums"]["form_field_type"]
          form_scope: Database["public"]["Enums"]["form_scope"]
          gym_id: string
          help_text?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          options?: Json | null
          placeholder?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_label?: string
          field_name?: string
          field_type?: Database["public"]["Enums"]["form_field_type"]
          form_scope?: Database["public"]["Enums"]["form_scope"]
          gym_id?: string
          help_text?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          options?: Json | null
          placeholder?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_form_fields_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_onboarding_progress: {
        Row: {
          created_at: string
          dismissed_at: string | null
          gym_id: string
          step_overrides: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          dismissed_at?: string | null
          gym_id: string
          step_overrides?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          dismissed_at?: string | null
          gym_id?: string
          step_overrides?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_onboarding_progress_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: true
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_rooms: {
        Row: {
          capacity: number | null
          color: string | null
          created_at: string
          gym_id: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          color?: string | null
          created_at?: string
          gym_id: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          color?: string | null
          created_at?: string
          gym_id?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_rooms_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_settings: {
        Row: {
          appointment_cancel_hours: number
          booking_advance_days: number
          booking_cancel_hours: number
          brand_color: string | null
          brand_logo_url: string | null
          created_at: string
          gym_id: string
          integrations: Json
          notifications_config: Json
          opening_hours: Json
          updated_at: string
          waitlist_enabled: boolean
        }
        Insert: {
          appointment_cancel_hours?: number
          booking_advance_days?: number
          booking_cancel_hours?: number
          brand_color?: string | null
          brand_logo_url?: string | null
          created_at?: string
          gym_id: string
          integrations?: Json
          notifications_config?: Json
          opening_hours?: Json
          updated_at?: string
          waitlist_enabled?: boolean
        }
        Update: {
          appointment_cancel_hours?: number
          booking_advance_days?: number
          booking_cancel_hours?: number
          brand_color?: string | null
          brand_logo_url?: string | null
          created_at?: string
          gym_id?: string
          integrations?: Json
          notifications_config?: Json
          opening_hours?: Json
          updated_at?: string
          waitlist_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "gym_settings_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: true
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_tours_seen: {
        Row: {
          id: string
          seen_at: string
          tour_key: string
          user_id: string
        }
        Insert: {
          id?: string
          seen_at?: string
          tour_key: string
          user_id: string
        }
        Update: {
          id?: string
          seen_at?: string
          tour_key?: string
          user_id?: string
        }
        Relationships: []
      }
      gym_users: {
        Row: {
          accepted_at: string | null
          created_at: string
          gym_id: string
          id: string
          invited_at: string | null
          invited_by: string | null
          is_active: boolean
          role: Database["public"]["Enums"]["gym_user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          gym_id: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean
          role?: Database["public"]["Enums"]["gym_user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          gym_id?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean
          role?: Database["public"]["Enums"]["gym_user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_users_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gyms: {
        Row: {
          address: string | null
          block_morosos_after_days: number | null
          brand_color: string
          city: string | null
          country: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          email: string | null
          fee_percent_card: number
          fee_percent_sepa: number
          fiscal_address_city: string | null
          fiscal_address_line1: string | null
          fiscal_address_postal_code: string | null
          fiscal_country_code: string
          id: string
          legal_name: string | null
          logo_url: string | null
          name: string
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          phone: string | null
          plan: Database["public"]["Enums"]["gym_plan"]
          postal_code: string | null
          settings_general: Json
          slug: string
          status: Database["public"]["Enums"]["gym_status"]
          stripe_account_id: string | null
          stripe_customer_id: string | null
          stripe_key_vault_id: string | null
          stripe_onboarded_at: string | null
          stripe_publishable_key: string | null
          stripe_webhook_vault_id: string | null
          suspended_at: string | null
          suspended_reason: string | null
          tax_id: string | null
          timezone: string
          trial_ends_at: string | null
          updated_at: string
          web_gallery_urls: Json | null
          web_hero_url: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          block_morosos_after_days?: number | null
          brand_color?: string
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          email?: string | null
          fee_percent_card?: number
          fee_percent_sepa?: number
          fiscal_address_city?: string | null
          fiscal_address_line1?: string | null
          fiscal_address_postal_code?: string | null
          fiscal_country_code?: string
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name: string
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          phone?: string | null
          plan?: Database["public"]["Enums"]["gym_plan"]
          postal_code?: string | null
          settings_general?: Json
          slug: string
          status?: Database["public"]["Enums"]["gym_status"]
          stripe_account_id?: string | null
          stripe_customer_id?: string | null
          stripe_key_vault_id?: string | null
          stripe_onboarded_at?: string | null
          stripe_publishable_key?: string | null
          stripe_webhook_vault_id?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          tax_id?: string | null
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
          web_gallery_urls?: Json | null
          web_hero_url?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          block_morosos_after_days?: number | null
          brand_color?: string
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          email?: string | null
          fee_percent_card?: number
          fee_percent_sepa?: number
          fiscal_address_city?: string | null
          fiscal_address_line1?: string | null
          fiscal_address_postal_code?: string | null
          fiscal_country_code?: string
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          phone?: string | null
          plan?: Database["public"]["Enums"]["gym_plan"]
          postal_code?: string | null
          settings_general?: Json
          slug?: string
          status?: Database["public"]["Enums"]["gym_status"]
          stripe_account_id?: string | null
          stripe_customer_id?: string | null
          stripe_key_vault_id?: string | null
          stripe_onboarded_at?: string | null
          stripe_publishable_key?: string | null
          stripe_webhook_vault_id?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          tax_id?: string | null
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
          web_gallery_urls?: Json | null
          web_hero_url?: string | null
          website?: string | null
        }
        Relationships: []
      }
      import_jobs: {
        Row: {
          column_mapping: Json
          created_at: string
          created_by: string | null
          errors_json: Json
          filename: string | null
          gym_id: string
          id: string
          job_type: Database["public"]["Enums"]["import_job_type"]
          rows_err: number
          rows_ok: number
          rows_total: number
          status: Database["public"]["Enums"]["import_job_status"]
          updated_at: string
        }
        Insert: {
          column_mapping?: Json
          created_at?: string
          created_by?: string | null
          errors_json?: Json
          filename?: string | null
          gym_id: string
          id?: string
          job_type?: Database["public"]["Enums"]["import_job_type"]
          rows_err?: number
          rows_ok?: number
          rows_total?: number
          status?: Database["public"]["Enums"]["import_job_status"]
          updated_at?: string
        }
        Update: {
          column_mapping?: Json
          created_at?: string
          created_by?: string | null
          errors_json?: Json
          filename?: string | null
          gym_id?: string
          id?: string
          job_type?: Database["public"]["Enums"]["import_job_type"]
          rows_err?: number
          rows_ok?: number
          rows_total?: number
          status?: Database["public"]["Enums"]["import_job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_blocks: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string
          gym_id: string
          id: string
          instructor_id: string
          reason: Database["public"]["Enums"]["instructor_block_reason"]
          recurrence_rule: string | null
          starts_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at: string
          gym_id: string
          id?: string
          instructor_id: string
          reason?: Database["public"]["Enums"]["instructor_block_reason"]
          recurrence_rule?: string | null
          starts_at: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string
          gym_id?: string
          id?: string
          instructor_id?: string
          reason?: Database["public"]["Enums"]["instructor_block_reason"]
          recurrence_rule?: string | null
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_blocks_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_blocks_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_check_ins: {
        Row: {
          cancelled: boolean
          checked_in_at: string
          checked_out_at: string | null
          created_at: string
          created_by: string | null
          duration_minutes: number | null
          gym_id: string
          id: string
          instructor_id: string
          location_lat: number | null
          location_lng: number | null
          notes: string | null
          source: Database["public"]["Enums"]["check_in_source"]
          updated_at: string
        }
        Insert: {
          cancelled?: boolean
          checked_in_at?: string
          checked_out_at?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          gym_id: string
          id?: string
          instructor_id: string
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          source?: Database["public"]["Enums"]["check_in_source"]
          updated_at?: string
        }
        Update: {
          cancelled?: boolean
          checked_in_at?: string
          checked_out_at?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          gym_id?: string
          id?: string
          instructor_id?: string
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          source?: Database["public"]["Enums"]["check_in_source"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_check_ins_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_check_ins_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_notification_prefs: {
        Row: {
          category: string
          created_at: string
          delivery: Database["public"]["Enums"]["notification_delivery"]
          gym_id: string
          instructor_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          created_at?: string
          delivery?: Database["public"]["Enums"]["notification_delivery"]
          gym_id: string
          instructor_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          delivery?: Database["public"]["Enums"]["notification_delivery"]
          gym_id?: string
          instructor_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instructor_notification_prefs_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_notification_prefs_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_permissions: {
        Row: {
          created_at: string
          gym_id: string
          instructor_id: string
          level: number
          permission_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          gym_id: string
          instructor_id: string
          level: number
          permission_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          gym_id?: string
          instructor_id?: string
          level?: number
          permission_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instructor_permissions_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_permissions_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      instructors: {
        Row: {
          avatar_url: string | null
          bio: string | null
          color: string | null
          created_at: string
          email: string | null
          gym_id: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          specialties: string[] | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          color?: string | null
          created_at?: string
          email?: string | null
          gym_id: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          specialties?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          color?: string | null
          created_at?: string
          email?: string | null
          gym_id?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          specialties?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instructors_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_sequences: {
        Row: {
          gym_id: string
          last_number: number
          prefix: string
          updated_at: string
          year: number
        }
        Insert: {
          gym_id: string
          last_number?: number
          prefix: string
          updated_at?: string
          year: number
        }
        Update: {
          gym_id?: string
          last_number?: number
          prefix?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_sequences_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string
          due_date: string | null
          emitter_city: string
          emitter_country_code: string
          emitter_fiscal_address: string
          emitter_legal_name: string
          emitter_postal_code: string
          emitter_tax_id: string
          gym_id: string
          id: string
          invoice_number: string
          issue_date: string
          issued_at: string | null
          linked_payment_id: string | null
          member_id: string | null
          notes: string | null
          operation_date: string | null
          pdf_generated_at: string | null
          pdf_url: string | null
          receiver_address: string | null
          receiver_email: string | null
          receiver_name: string
          receiver_tax_id: string | null
          sequence_number: number
          sequence_year: number
          series: string
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal_cents: number
          tax_cents: number
          tax_rate_pct: number
          total_cents: number
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description: string
          due_date?: string | null
          emitter_city: string
          emitter_country_code: string
          emitter_fiscal_address: string
          emitter_legal_name: string
          emitter_postal_code: string
          emitter_tax_id: string
          gym_id: string
          id?: string
          invoice_number: string
          issue_date?: string
          issued_at?: string | null
          linked_payment_id?: string | null
          member_id?: string | null
          notes?: string | null
          operation_date?: string | null
          pdf_generated_at?: string | null
          pdf_url?: string | null
          receiver_address?: string | null
          receiver_email?: string | null
          receiver_name: string
          receiver_tax_id?: string | null
          sequence_number: number
          sequence_year: number
          series?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_cents: number
          tax_cents: number
          tax_rate_pct?: number
          total_cents: number
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          due_date?: string | null
          emitter_city?: string
          emitter_country_code?: string
          emitter_fiscal_address?: string
          emitter_legal_name?: string
          emitter_postal_code?: string
          emitter_tax_id?: string
          gym_id?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          issued_at?: string | null
          linked_payment_id?: string | null
          member_id?: string | null
          notes?: string | null
          operation_date?: string | null
          pdf_generated_at?: string | null
          pdf_url?: string | null
          receiver_address?: string | null
          receiver_email?: string | null
          receiver_name?: string
          receiver_tax_id?: string | null
          sequence_number?: number
          sequence_year?: number
          series?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_cents?: number
          tax_cents?: number
          tax_rate_pct?: number
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_linked_payment_id_fkey"
            columns: ["linked_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_assigned_instructors: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          gym_id: string
          instructor_id: string
          member_id: string
          notes: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          gym_id: string
          instructor_id: string
          member_id: string
          notes?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          gym_id?: string
          instructor_id?: string
          member_id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_assigned_instructors_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_assigned_instructors_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_assigned_instructors_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_clauses: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          body_snapshot: string
          created_at: string
          expires_at: string | null
          gym_id: string
          id: string
          member_id: string
          notes: string | null
          signed_at: string | null
          signed_by_ip: string | null
          signed_by_name: string | null
          status: string
          template_id: string | null
          title_snapshot: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          body_snapshot: string
          created_at?: string
          expires_at?: string | null
          gym_id: string
          id?: string
          member_id: string
          notes?: string | null
          signed_at?: string | null
          signed_by_ip?: string | null
          signed_by_name?: string | null
          status?: string
          template_id?: string | null
          title_snapshot: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          body_snapshot?: string
          created_at?: string
          expires_at?: string | null
          gym_id?: string
          id?: string
          member_id?: string
          notes?: string | null
          signed_at?: string | null
          signed_by_ip?: string | null
          signed_by_name?: string | null
          status?: string
          template_id?: string | null
          title_snapshot?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_clauses_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_clauses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_clauses_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "gym_clause_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      member_health_data: {
        Row: {
          gym_id: string
          image_consent: boolean
          marketing_consent: boolean
          medical_info: Json | null
          medical_notes: string | null
          member_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          gym_id: string
          image_consent?: boolean
          marketing_consent?: boolean
          medical_info?: Json | null
          medical_notes?: string | null
          member_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          gym_id?: string
          image_consent?: boolean
          marketing_consent?: boolean
          medical_info?: Json | null
          medical_notes?: string | null
          member_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_health_data_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_health_data_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_tariffs: {
        Row: {
          created_at: string
          end_date: string | null
          gym_id: string
          id: string
          is_active: boolean
          member_id: string
          sessions_remaining: number | null
          sessions_used: number
          start_date: string
          tariff_id: string
          tariff_snapshot: Json
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          gym_id: string
          id?: string
          is_active?: boolean
          member_id: string
          sessions_remaining?: number | null
          sessions_used?: number
          start_date?: string
          tariff_id: string
          tariff_snapshot: Json
        }
        Update: {
          created_at?: string
          end_date?: string | null
          gym_id?: string
          id?: string
          is_active?: boolean
          member_id?: string
          sessions_remaining?: number | null
          sessions_used?: number
          start_date?: string
          tariff_id?: string
          tariff_snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "member_tariffs_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_tariffs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_tariffs_tariff_id_fkey"
            columns: ["tariff_id"]
            isOneToOne: false
            referencedRelation: "tariffs"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          address: string | null
          auth_user_id: string | null
          avatar_url: string | null
          birth_date: string | null
          blocked_for_morosos_at: string | null
          city: string | null
          created_at: string
          current_tariff_id: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          first_name: string
          gender: string | null
          gym_id: string
          id: string
          image_consent: boolean
          internal_notes: string | null
          invite_count: number
          invite_sent_at: string | null
          join_date: string
          last_name: string
          leave_date: string | null
          marketing_consent: boolean
          medical_info: Json | null
          medical_notes: string | null
          member_number: string | null
          notes: string | null
          phone: string | null
          postal_code: string | null
          rgpd_consent: boolean
          rgpd_consent_at: string | null
          rgpd_consent_operator_user_id: string | null
          rgpd_consent_source: string | null
          second_last_name: string | null
          sepa_mandate_id: string | null
          status: Database["public"]["Enums"]["member_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_current_period_end: string | null
          subscription_status: string | null
          tags: string[] | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          auth_user_id?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          blocked_for_morosos_at?: string | null
          city?: string | null
          created_at?: string
          current_tariff_id?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          first_name: string
          gender?: string | null
          gym_id: string
          id?: string
          image_consent?: boolean
          internal_notes?: string | null
          invite_count?: number
          invite_sent_at?: string | null
          join_date?: string
          last_name: string
          leave_date?: string | null
          marketing_consent?: boolean
          medical_info?: Json | null
          medical_notes?: string | null
          member_number?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          rgpd_consent?: boolean
          rgpd_consent_at?: string | null
          rgpd_consent_operator_user_id?: string | null
          rgpd_consent_source?: string | null
          second_last_name?: string | null
          sepa_mandate_id?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_current_period_end?: string | null
          subscription_status?: string | null
          tags?: string[] | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          auth_user_id?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          blocked_for_morosos_at?: string | null
          city?: string | null
          created_at?: string
          current_tariff_id?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          first_name?: string
          gender?: string | null
          gym_id?: string
          id?: string
          image_consent?: boolean
          internal_notes?: string | null
          invite_count?: number
          invite_sent_at?: string | null
          join_date?: string
          last_name?: string
          leave_date?: string | null
          marketing_consent?: boolean
          medical_info?: Json | null
          medical_notes?: string | null
          member_number?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          rgpd_consent?: boolean
          rgpd_consent_at?: string | null
          rgpd_consent_operator_user_id?: string | null
          rgpd_consent_source?: string | null
          second_last_name?: string | null
          sepa_mandate_id?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_current_period_end?: string | null
          subscription_status?: string | null
          tags?: string[] | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_current_tariff_id_fkey"
            columns: ["current_tariff_id"]
            isOneToOne: false
            referencedRelation: "tariffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json | null
          content: string
          conversation_id: string
          created_at: string
          gym_id: string
          id: string
          is_read: boolean
          sender_member_id: string | null
          sender_type: string
          sender_user_id: string | null
        }
        Insert: {
          attachments?: Json | null
          content: string
          conversation_id: string
          created_at?: string
          gym_id: string
          id?: string
          is_read?: boolean
          sender_member_id?: string | null
          sender_type: string
          sender_user_id?: string | null
        }
        Update: {
          attachments?: Json | null
          content?: string
          conversation_id?: string
          created_at?: string
          gym_id?: string
          id?: string
          is_read?: boolean
          sender_member_id?: string | null
          sender_type?: string
          sender_user_id?: string | null
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
            foreignKeyName: "messages_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_member_id_fkey"
            columns: ["sender_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          gym_id: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          gym_id: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          read_at?: string | null
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          gym_id?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          applicable_tariff_ids: string[] | null
          code: string | null
          created_at: string
          current_redemptions: number
          description: string | null
          discount_type: string | null
          discount_value: number | null
          gym_id: string
          id: string
          is_active: boolean
          max_redemptions: number | null
          title: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applicable_tariff_ids?: string[] | null
          code?: string | null
          created_at?: string
          current_redemptions?: number
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          gym_id: string
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          title: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applicable_tariff_ids?: string[] | null
          code?: string | null
          created_at?: string
          current_redemptions?: number
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          gym_id?: string
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          title?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          concept: string | null
          created_at: string
          currency: string
          description: string
          due_date: string | null
          external_reference: string | null
          failed_at: string | null
          failure_reason: string | null
          gym_id: string
          id: string
          invoice_number: string | null
          invoice_url: string | null
          member_id: string
          member_snapshot: Json
          member_tariff_id: string | null
          method: Database["public"]["Enums"]["payment_method"]
          paid_at: string | null
          payment_source: string
          period_end: string | null
          period_start: string | null
          refunded_at: string | null
          sepa_mandate_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id: string | null
          stripe_checkout_session_id: string | null
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          tariff_snapshot: Json | null
          tax_amount: number | null
          updated_at: string
        }
        Insert: {
          amount: number
          concept?: string | null
          created_at?: string
          currency?: string
          description: string
          due_date?: string | null
          external_reference?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          gym_id: string
          id?: string
          invoice_number?: string | null
          invoice_url?: string | null
          member_id: string
          member_snapshot: Json
          member_tariff_id?: string | null
          method: Database["public"]["Enums"]["payment_method"]
          paid_at?: string | null
          payment_source?: string
          period_end?: string | null
          period_start?: string | null
          refunded_at?: string | null
          sepa_mandate_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          tariff_snapshot?: Json | null
          tax_amount?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
          concept?: string | null
          created_at?: string
          currency?: string
          description?: string
          due_date?: string | null
          external_reference?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          gym_id?: string
          id?: string
          invoice_number?: string | null
          invoice_url?: string | null
          member_id?: string
          member_snapshot?: Json
          member_tariff_id?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string | null
          payment_source?: string
          period_end?: string | null
          period_start?: string | null
          refunded_at?: string | null
          sepa_mandate_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          tariff_snapshot?: Json | null
          tax_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_member_tariff_id_fkey"
            columns: ["member_tariff_id"]
            isOneToOne: false
            referencedRelation: "member_tariffs"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_user_id: string | null
          comments_count: number
          content: string
          created_at: string
          gym_id: string
          id: string
          is_published: boolean
          likes_count: number
          media_urls: string[] | null
          published_at: string | null
          tags: string[] | null
          title: string | null
          updated_at: string
        }
        Insert: {
          author_user_id?: string | null
          comments_count?: number
          content: string
          created_at?: string
          gym_id: string
          id?: string
          is_published?: boolean
          likes_count?: number
          media_urls?: string[] | null
          published_at?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          author_user_id?: string | null
          comments_count?: number
          content?: string
          created_at?: string
          gym_id?: string
          id?: string
          is_published?: boolean
          likes_count?: number
          media_urls?: string[] | null
          published_at?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          assigned_to_user_id: string | null
          conversion_member_id: string | null
          created_at: string
          email: string | null
          gym_id: string
          id: string
          interest: string | null
          last_contact_at: string | null
          lost_reason: string | null
          name: string
          notes: string | null
          phone: string | null
          source: string | null
          status: Database["public"]["Enums"]["prospect_status"]
          updated_at: string
        }
        Insert: {
          assigned_to_user_id?: string | null
          conversion_member_id?: string | null
          created_at?: string
          email?: string | null
          gym_id: string
          id?: string
          interest?: string | null
          last_contact_at?: string | null
          lost_reason?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["prospect_status"]
          updated_at?: string
        }
        Update: {
          assigned_to_user_id?: string | null
          conversion_member_id?: string | null
          created_at?: string
          email?: string | null
          gym_id?: string
          id?: string
          interest?: string | null
          last_contact_at?: string | null
          lost_reason?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["prospect_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospects_conversion_member_id_fkey"
            columns: ["conversion_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_secret: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_secret: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_secret?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      recurring_bookings: {
        Row: {
          active: boolean
          class_id: string | null
          created_at: string
          created_by: string | null
          day_of_week: number
          duration_minutes: number | null
          ends_on: string | null
          gym_id: string
          id: string
          instructor_id: string | null
          member_id: string
          notes: string | null
          room: string | null
          start_time: string
          starts_on: string
          type: Database["public"]["Enums"]["recurring_booking_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          day_of_week: number
          duration_minutes?: number | null
          ends_on?: string | null
          gym_id: string
          id?: string
          instructor_id?: string | null
          member_id: string
          notes?: string | null
          room?: string | null
          start_time: string
          starts_on?: string
          type: Database["public"]["Enums"]["recurring_booking_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          day_of_week?: number
          duration_minutes?: number | null
          ends_on?: string | null
          gym_id?: string
          id?: string
          instructor_id?: string | null
          member_id?: string
          notes?: string | null
          room?: string | null
          start_time?: string
          starts_on?: string
          type?: Database["public"]["Enums"]["recurring_booking_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_bookings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_bookings_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_bookings_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      reports_snapshots: {
        Row: {
          computed_at: string
          data: Json
          gym_id: string
          id: string
          period_end: string
          period_start: string
          report_key: string
        }
        Insert: {
          computed_at?: string
          data: Json
          gym_id: string
          id?: string
          period_end: string
          period_start: string
          report_key: string
        }
        Update: {
          computed_at?: string
          data?: Json
          gym_id?: string
          id?: string
          period_end?: string
          period_start?: string
          report_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_snapshots_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string | null
          product_name_snapshot: string
          quantity: number
          unit_price: number
        }
        Insert: {
          id?: string
          order_id: string
          product_id?: string | null
          product_name_snapshot: string
          quantity: number
          unit_price: number
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string | null
          product_name_snapshot?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "shop_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "shop_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shop_products"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_orders: {
        Row: {
          created_at: string
          gym_id: string
          id: string
          items: Json
          member_id: string | null
          order_number: string
          payment_id: string | null
          status: Database["public"]["Enums"]["shop_order_status"]
          subtotal: number
          tax_amount: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          gym_id: string
          id?: string
          items: Json
          member_id?: string | null
          order_number: string
          payment_id?: string | null
          status?: Database["public"]["Enums"]["shop_order_status"]
          subtotal: number
          tax_amount?: number
          total: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          gym_id?: string
          id?: string
          items?: Json
          member_id?: string | null
          order_number?: string
          payment_id?: string | null
          status?: Database["public"]["Enums"]["shop_order_status"]
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_orders_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_orders_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_orders_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_products: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          gym_id: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          price: number
          sku: string | null
          stock: number | null
          tax_rate: number | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          gym_id: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          price: number
          sku?: string | null
          stock?: number | null
          tax_rate?: number | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          gym_id?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          price?: number
          sku?: string | null
          stock?: number | null
          tax_rate?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_products_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          api_version: string | null
          event_type: string
          gym_id: string | null
          id: string
          payload: Json
          processed_at: string
          processing_error: string | null
        }
        Insert: {
          api_version?: string | null
          event_type: string
          gym_id?: string | null
          id: string
          payload: Json
          processed_at?: string
          processing_error?: string | null
        }
        Update: {
          api_version?: string | null
          event_type?: string
          gym_id?: string | null
          id?: string
          payload?: Json
          processed_at?: string
          processing_error?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stripe_webhook_events_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      tariffs: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          duration_months: number | null
          group: string | null
          gym_id: string
          id: string
          is_active: boolean
          name: string
          price: number
          sessions_per_week: number | null
          sort_order: number
          stripe_last_synced_at: string | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          stripe_sync_error: string | null
          stripe_sync_status: string
          total_sessions: number | null
          type: Database["public"]["Enums"]["tariff_type"]
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          duration_months?: number | null
          group?: string | null
          gym_id: string
          id?: string
          is_active?: boolean
          name: string
          price: number
          sessions_per_week?: number | null
          sort_order?: number
          stripe_last_synced_at?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          stripe_sync_error?: string | null
          stripe_sync_status?: string
          total_sessions?: number | null
          type?: Database["public"]["Enums"]["tariff_type"]
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          duration_months?: number | null
          group?: string | null
          gym_id?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sessions_per_week?: number | null
          sort_order?: number
          stripe_last_synced_at?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          stripe_sync_error?: string | null
          stripe_sync_status?: string
          total_sessions?: number | null
          type?: Database["public"]["Enums"]["tariff_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tariffs_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          gym_id: string
          id: string
          instructor_id: string | null
          member_id: string | null
          phone: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          recurrence_end_date: string | null
          recurrence_interval: number | null
          recurrence_parent_id: string | null
          recurrence_type: Database["public"]["Enums"]["task_recurrence_type"]
          related_payment_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          gym_id: string
          id?: string
          instructor_id?: string | null
          member_id?: string | null
          phone?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          recurrence_end_date?: string | null
          recurrence_interval?: number | null
          recurrence_parent_id?: string | null
          recurrence_type?: Database["public"]["Enums"]["task_recurrence_type"]
          related_payment_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          gym_id?: string
          id?: string
          instructor_id?: string | null
          member_id?: string | null
          phone?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          recurrence_end_date?: string | null
          recurrence_interval?: number | null
          recurrence_parent_id?: string | null
          recurrence_type?: Database["public"]["Enums"]["task_recurrence_type"]
          related_payment_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_recurrence_parent_id_fkey"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_related_payment_id_fkey"
            columns: ["related_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      training_group_members: {
        Row: {
          added_at: string
          group_id: string
          gym_id: string
          member_id: string
        }
        Insert: {
          added_at?: string
          group_id: string
          gym_id: string
          member_id: string
        }
        Update: {
          added_at?: string
          group_id?: string
          gym_id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "training_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_group_members_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_group_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      training_groups: {
        Row: {
          color: string | null
          created_at: string
          default_class_id: string | null
          description: string | null
          gym_id: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          default_class_id?: string | null
          description?: string | null
          gym_id: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          default_class_id?: string | null
          description?: string | null
          gym_id?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_groups_default_class_id_fkey"
            columns: ["default_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_groups_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          created_at: string
          description: string | null
          difficulty: string | null
          duration_minutes: number | null
          exercises: Json
          gym_id: string
          id: string
          is_published: boolean
          name: string
          published_by: string | null
          published_date: string | null
          tags: string[] | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          difficulty?: string | null
          duration_minutes?: number | null
          exercises?: Json
          gym_id: string
          id?: string
          is_published?: boolean
          name: string
          published_by?: string | null
          published_date?: string | null
          tags?: string[] | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          difficulty?: string | null
          duration_minutes?: number | null
          exercises?: Json
          gym_id?: string
          id?: string
          is_published?: boolean
          name?: string
          published_by?: string | null
          published_date?: string | null
          tags?: string[] | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workouts_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_change_gym_payment_mode: {
        Args: {
          p_gym_id: string
          p_new_mode: Database["public"]["Enums"]["payment_mode"]
        }
        Returns: undefined
      }
      admin_change_gym_plan: {
        Args: {
          p_gym_id: string
          p_new_plan: Database["public"]["Enums"]["gym_plan"]
        }
        Returns: undefined
      }
      admin_create_gym_with_owner: {
        Args: {
          p_client_email: string
          p_gym_email?: string
          p_gym_name: string
          p_gym_phone?: string
          p_gym_slug: string
          p_payment_mode?: Database["public"]["Enums"]["payment_mode"]
          p_plan?: Database["public"]["Enums"]["gym_plan"]
          p_temp_password: string
        }
        Returns: {
          out_gym_id: string
          out_user_id: string
        }[]
      }
      admin_get_gym_detail: {
        Args: { p_gym_id: string }
        Returns: {
          address: string
          city: string
          country: string
          created_at: string
          currency: string
          deleted_at: string
          email: string
          fee_percent_card: number
          fee_percent_sepa: number
          id: string
          name: string
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          phone: string
          plan: Database["public"]["Enums"]["gym_plan"]
          postal_code: string
          slug: string
          status: string
          stripe_key_vault_id: string
          stripe_onboarded_at: string
          stripe_publishable_key: string
          suspended_at: string
          suspended_reason: string
          tax_id: string
          timezone: string
          website: string
        }[]
      }
      admin_global_stats: {
        Args: never
        Returns: {
          active_gyms: number
          new_gyms_this_month: number
          revenue_this_month_cents: number
          total_active_members: number
          total_gyms: number
          total_members: number
        }[]
      }
      admin_import_members_from_csv: {
        Args: {
          p_column_mapping: Json
          p_filename: string
          p_gym_id: string
          p_rows: Json
        }
        Returns: {
          column_mapping: Json
          created_at: string
          created_by: string | null
          errors_json: Json
          filename: string | null
          gym_id: string
          id: string
          job_type: Database["public"]["Enums"]["import_job_type"]
          rows_err: number
          rows_ok: number
          rows_total: number
          status: Database["public"]["Enums"]["import_job_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "import_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_list_audit_log: {
        Args: { p_gym_id?: string; p_limit?: number; p_offset?: number }
        Returns: {
          action: string
          actor_email: string
          actor_user_id: string
          created_at: string
          gym_id: string
          id: string
          metadata: Json
          resource_id: string
          resource_type: string
        }[]
      }
      admin_list_gym_users: {
        Args: { p_gym_id: string }
        Returns: {
          accepted_at: string
          created_at: string
          email: string
          full_name: string
          gym_user_id: string
          invited_at: string
          is_active: boolean
          last_sign_in_at: string
          must_change_password: boolean
          role: Database["public"]["Enums"]["gym_user_role"]
          user_id: string
        }[]
      }
      admin_list_gyms: {
        Args: { p_include_deleted?: boolean }
        Returns: {
          active_members_count: number
          created_at: string
          deleted_at: string
          id: string
          members_count: number
          name: string
          owner_email: string
          owner_name: string
          plan: Database["public"]["Enums"]["gym_plan"]
          slug: string
          status: string
          suspended_at: string
        }[]
      }
      admin_list_import_jobs: {
        Args: { p_gym_id: string }
        Returns: {
          column_mapping: Json
          created_at: string
          created_by: string | null
          errors_json: Json
          filename: string | null
          gym_id: string
          id: string
          job_type: Database["public"]["Enums"]["import_job_type"]
          rows_err: number
          rows_ok: number
          rows_total: number
          status: Database["public"]["Enums"]["import_job_status"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "import_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_log_magic_link_sent: {
        Args: { p_gym_id?: string; p_user_id: string }
        Returns: undefined
      }
      admin_reactivate_gym: { Args: { p_gym_id: string }; Returns: undefined }
      admin_remove_gym_user: {
        Args: { p_gym_user_id: string }
        Returns: undefined
      }
      admin_reset_user_password_temporary: {
        Args: { p_new_password: string; p_user_id: string }
        Returns: undefined
      }
      admin_restore_gym: { Args: { p_gym_id: string }; Returns: undefined }
      admin_soft_delete_gym: {
        Args: { p_gym_id: string; p_reason?: string }
        Returns: undefined
      }
      admin_suspend_gym: {
        Args: { p_gym_id: string; p_reason: string }
        Returns: undefined
      }
      admin_transfer_gym_ownership: {
        Args: { p_gym_id: string; p_new_owner_user_id: string }
        Returns: undefined
      }
      admin_update_gym: {
        Args: {
          p_address?: string
          p_city?: string
          p_country?: string
          p_currency?: string
          p_email?: string
          p_gym_id: string
          p_name?: string
          p_phone?: string
          p_postal_code?: string
          p_tax_id?: string
          p_timezone?: string
          p_website?: string
        }
        Returns: undefined
      }
      assign_clause_to_member: {
        Args: {
          p_expires_at?: string
          p_member_id: string
          p_template_id: string
        }
        Returns: {
          assigned_at: string
          assigned_by: string | null
          body_snapshot: string
          created_at: string
          expires_at: string | null
          gym_id: string
          id: string
          member_id: string
          notes: string | null
          signed_at: string | null
          signed_by_ip: string | null
          signed_by_name: string | null
          status: string
          template_id: string | null
          title_snapshot: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "member_clauses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      book_class: {
        Args: { p_class_instance_id: string; p_member_id: string }
        Returns: string
      }
      bulk_assign_instructor: {
        Args: {
          p_instructor_id: string
          p_member_ids: string[]
          p_notes?: string
        }
        Returns: number
      }
      bulk_set_instructor_notif_prefs: {
        Args: { p_instructor_id: string; p_prefs: Json }
        Returns: number
      }
      bulk_set_instructor_permissions: {
        Args: { p_instructor_id: string; p_perms: Json }
        Returns: number
      }
      cancel_appointment: {
        Args: { p_id: string; p_reason?: string }
        Returns: {
          agenda_id: string | null
          appointment_type: Database["public"]["Enums"]["appointment_type"]
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          consumed_session: boolean
          created_at: string
          created_by: string | null
          duration_minutes: number | null
          ends_at: string
          gym_id: string
          id: string
          instructor_id: string
          member_id: string
          notes: string | null
          payment_id: string | null
          price_cents: number | null
          room_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_appointment_by_member: {
        Args: { p_id: string; p_reason?: string }
        Returns: {
          agenda_id: string | null
          appointment_type: Database["public"]["Enums"]["appointment_type"]
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          consumed_session: boolean
          created_at: string
          created_by: string | null
          duration_minutes: number | null
          ends_at: string
          gym_id: string
          id: string
          instructor_id: string
          member_id: string
          notes: string | null
          payment_id: string | null
          price_cents: number | null
          room_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_booking: { Args: { p_booking_id: string }; Returns: undefined }
      clear_gym_stripe_keys: { Args: { p_gym_id: string }; Returns: undefined }
      clear_must_change_password: { Args: never; Returns: undefined }
      clear_step_override: {
        Args: { p_gym_id: string; p_step_key: string }
        Returns: undefined
      }
      complete_appointment: {
        Args: { p_consume_session?: boolean; p_id: string }
        Returns: {
          agenda_id: string | null
          appointment_type: Database["public"]["Enums"]["appointment_type"]
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          consumed_session: boolean
          created_at: string
          created_by: string | null
          duration_minutes: number | null
          ends_at: string
          gym_id: string
          id: string
          instructor_id: string
          member_id: string
          notes: string | null
          payment_id: string | null
          price_cents: number | null
          room_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      convert_prospect_to_member: {
        Args: {
          p_prospect_id: string
          p_rgpd_consent_granted?: boolean
          p_rgpd_consent_source?: string
          p_tariff_id?: string
        }
        Returns: string
      }
      create_appointment: {
        Args: {
          p_appointment_type?: Database["public"]["Enums"]["appointment_type"]
          p_ends_at: string
          p_instructor_id: string
          p_member_id: string
          p_notes?: string
          p_price_cents?: number
          p_room_id: string
          p_starts_at: string
          p_title?: string
        }
        Returns: {
          agenda_id: string | null
          appointment_type: Database["public"]["Enums"]["appointment_type"]
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          consumed_session: boolean
          created_at: string
          created_by: string | null
          duration_minutes: number | null
          ends_at: string
          gym_id: string
          id: string
          instructor_id: string
          member_id: string
          notes: string | null
          payment_id: string | null
          price_cents: number | null
          room_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_expense: {
        Args: {
          p_amount: number
          p_category: Database["public"]["Enums"]["expense_category"]
          p_description: string
          p_expense_date?: string
          p_gym_id: string
          p_invoice_number?: string
          p_invoice_url?: string
          p_notes?: string
          p_supplier?: string
          p_tax_amount?: number
        }
        Returns: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          deleted_by: string | null
          description: string
          expense_date: string
          gym_id: string
          id: string
          invoice_number: string | null
          invoice_url: string | null
          notes: string | null
          stripe_payment_intent_id: string | null
          supplier: string | null
          tax_amount: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "gym_expenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_gym_with_owner: {
        Args: {
          p_email?: string
          p_name: string
          p_phone?: string
          p_slug: string
          p_timezone?: string
        }
        Returns: string
      }
      create_instructor_block: {
        Args: {
          p_description?: string
          p_ends_at: string
          p_instructor_id: string
          p_reason?: Database["public"]["Enums"]["instructor_block_reason"]
          p_recurrence_rule?: string
          p_starts_at: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string
          gym_id: string
          id: string
          instructor_id: string
          reason: Database["public"]["Enums"]["instructor_block_reason"]
          recurrence_rule: string | null
          starts_at: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "instructor_blocks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_user_gyms: {
        Args: never
        Returns: {
          gym_brand_color: string
          gym_id: string
          gym_logo_url: string
          gym_name: string
          gym_plan: Database["public"]["Enums"]["gym_plan"]
          gym_slug: string
          gym_status: Database["public"]["Enums"]["gym_status"]
          role: Database["public"]["Enums"]["gym_user_role"]
        }[]
      }
      delete_agenda: { Args: { p_id: string }; Returns: boolean }
      delete_expense: {
        Args: { p_id: string }
        Returns: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          deleted_by: string | null
          description: string
          expense_date: string
          gym_id: string
          id: string
          invoice_number: string | null
          invoice_url: string | null
          notes: string | null
          stripe_payment_intent_id: string | null
          supplier: string | null
          tax_amount: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "gym_expenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_instructor_block: { Args: { p_id: string }; Returns: boolean }
      dismiss_onboarding: { Args: { p_gym_id: string }; Returns: undefined }
      dispatch_pending_avisos: {
        Args: { p_batch_size?: number }
        Returns: number
      }
      enqueue_aviso: {
        Args: {
          p_event_context?: Json
          p_gym_id: string
          p_member_id: string
          p_trigger_type: string
        }
        Returns: number
      }
      generate_class_instances: {
        Args: { p_from_date?: string; p_gym_id: string; p_to_date?: string }
        Returns: number
      }
      generate_invoice_from_payment: {
        Args: {
          p_notes?: string
          p_payment_id: string
          p_receiver_tax_id?: string
          p_tax_rate_pct?: number
        }
        Returns: string
      }
      get_gym_stripe_secret: { Args: { p_gym_id: string }; Returns: string }
      get_gym_stripe_webhook_secret: {
        Args: { p_gym_id: string }
        Returns: string
      }
      get_instructor_availability: {
        Args: {
          p_from: string
          p_gym_id: string
          p_instructor_id: string
          p_to: string
        }
        Returns: {
          ends_at: string
          label: string
          ref_id: string
          source: string
          starts_at: string
        }[]
      }
      get_onboarding_state: { Args: { p_gym_id: string }; Returns: Json }
      get_tours_seen: { Args: never; Returns: string[] }
      gym_expenses_kpis: {
        Args: { p_gym_id: string; p_month?: string }
        Returns: {
          gross_margin: number
          gross_margin_pct: number
          gym_id: string
          month_start: string
          total_expenses: number
          total_expenses_by_category: Json
          total_income: number
        }[]
      }
      instructor_check_in: {
        Args: {
          p_location_lat?: number
          p_location_lng?: number
          p_source?: Database["public"]["Enums"]["check_in_source"]
        }
        Returns: {
          cancelled: boolean
          checked_in_at: string
          checked_out_at: string | null
          created_at: string
          created_by: string | null
          duration_minutes: number | null
          gym_id: string
          id: string
          instructor_id: string
          location_lat: number | null
          location_lng: number | null
          notes: string | null
          source: Database["public"]["Enums"]["check_in_source"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "instructor_check_ins"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      instructor_check_ins_month_total: {
        Args: { p_instructor_id: string; p_month?: string }
        Returns: {
          total_minutes: number
          total_sessions: number
        }[]
      }
      instructor_check_out: {
        Args: never
        Returns: {
          cancelled: boolean
          checked_in_at: string
          checked_out_at: string | null
          created_at: string
          created_by: string | null
          duration_minutes: number | null
          gym_id: string
          id: string
          instructor_id: string
          location_lat: number | null
          location_lng: number | null
          notes: string | null
          source: Database["public"]["Enums"]["check_in_source"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "instructor_check_ins"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_app_admin: { Args: never; Returns: boolean }
      is_member_blocked_for_morosos: {
        Args: { p_member_id: string }
        Returns: boolean
      }
      link_member_auth_user: {
        Args: { p_member_id: string }
        Returns: undefined
      }
      list_agendas: {
        Args: { p_gym_id: string; p_only_active?: boolean }
        Returns: {
          active: boolean
          capacity: number
          color: string
          created_at: string
          default_instructor_id: string | null
          description: string | null
          duration_minutes: number
          gym_id: string
          id: string
          name: string
          requires_payment_upfront: boolean
          sort_order: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "agendas"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_appointments_in_range: {
        Args: {
          p_from: string
          p_gym_id: string
          p_instructor_id?: string
          p_to: string
        }
        Returns: {
          agenda_id: string | null
          appointment_type: Database["public"]["Enums"]["appointment_type"]
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          consumed_session: boolean
          created_at: string
          created_by: string | null
          duration_minutes: number | null
          ends_at: string
          gym_id: string
          id: string
          instructor_id: string
          member_id: string
          notes: string | null
          payment_id: string | null
          price_cents: number | null
          room_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          title: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_competition_registrations: {
        Args: { p_competition_id: string }
        Returns: {
          amount_cents: number | null
          cancellation_reason: string | null
          cancelled_at: string | null
          category: string | null
          competition_id: string
          created_at: string
          external_email: string | null
          external_first_name: string | null
          external_last_name: string | null
          external_phone: string | null
          gym_id: string
          id: string
          member_id: string | null
          metadata: Json
          notes: string | null
          paid: boolean
          payment_id: string | null
          registered_at: string
          updated_at: string
          waitlisted: boolean
        }[]
        SetofOptions: {
          from: "*"
          to: "competition_registrations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_expenses_range: {
        Args: {
          p_category?: Database["public"]["Enums"]["expense_category"]
          p_from?: string
          p_gym_id: string
          p_supplier?: string
          p_to?: string
        }
        Returns: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          deleted_by: string | null
          description: string
          expense_date: string
          gym_id: string
          id: string
          invoice_number: string | null
          invoice_url: string | null
          notes: string | null
          stripe_payment_intent_id: string | null
          supplier: string | null
          tax_amount: number | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "gym_expenses"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_instructor_blocks_in_range: {
        Args: {
          p_from: string
          p_gym_id: string
          p_instructor_id?: string
          p_to: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string
          gym_id: string
          id: string
          instructor_id: string
          reason: Database["public"]["Enums"]["instructor_block_reason"]
          recurrence_rule: string | null
          starts_at: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "instructor_blocks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      mark_member_invited: {
        Args: { p_member_id: string }
        Returns: {
          address: string | null
          auth_user_id: string | null
          avatar_url: string | null
          birth_date: string | null
          blocked_for_morosos_at: string | null
          city: string | null
          created_at: string
          current_tariff_id: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          first_name: string
          gender: string | null
          gym_id: string
          id: string
          image_consent: boolean
          internal_notes: string | null
          invite_count: number
          invite_sent_at: string | null
          join_date: string
          last_name: string
          leave_date: string | null
          marketing_consent: boolean
          medical_info: Json | null
          medical_notes: string | null
          member_number: string | null
          notes: string | null
          phone: string | null
          postal_code: string | null
          rgpd_consent: boolean
          rgpd_consent_at: string | null
          rgpd_consent_operator_user_id: string | null
          rgpd_consent_source: string | null
          second_last_name: string | null
          sepa_mandate_id: string | null
          status: Database["public"]["Enums"]["member_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_current_period_end: string | null
          subscription_status: string | null
          tags: string[] | null
          tax_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_no_show_appointment: {
        Args: { p_id: string }
        Returns: {
          agenda_id: string | null
          appointment_type: Database["public"]["Enums"]["appointment_type"]
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          consumed_session: boolean
          created_at: string
          created_by: string | null
          duration_minutes: number | null
          ends_at: string
          gym_id: string
          id: string
          instructor_id: string
          member_id: string
          notes: string | null
          payment_id: string | null
          price_cents: number | null
          room_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_step_completed_manually: {
        Args: { p_gym_id: string; p_step_key: string }
        Returns: undefined
      }
      mark_step_skipped: {
        Args: { p_gym_id: string; p_step_key: string }
        Returns: undefined
      }
      mark_tariff_stripe_synced: {
        Args: {
          p_error?: string
          p_price_id: string
          p_product_id: string
          p_sync_status?: string
          p_tariff_id: string
        }
        Returns: undefined
      }
      mark_tour_seen: { Args: { p_tour_key: string }; Returns: undefined }
      register_for_competition_public: {
        Args: {
          p_category?: string
          p_competition_slug: string
          p_email: string
          p_first_name: string
          p_gym_id: string
          p_last_name: string
          p_notes?: string
          p_phone?: string
        }
        Returns: {
          amount_cents: number | null
          cancellation_reason: string | null
          cancelled_at: string | null
          category: string | null
          competition_id: string
          created_at: string
          external_email: string | null
          external_first_name: string | null
          external_last_name: string | null
          external_phone: string | null
          gym_id: string
          id: string
          member_id: string | null
          metadata: Json
          notes: string | null
          paid: boolean
          payment_id: string | null
          registered_at: string
          updated_at: string
          waitlisted: boolean
        }
        SetofOptions: {
          from: "*"
          to: "competition_registrations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      render_aviso_body: {
        Args: { p_body: string; p_event_context?: Json; p_member_id: string }
        Returns: string
      }
      reschedule_appointment: {
        Args: { p_id: string; p_new_ends_at: string; p_new_starts_at: string }
        Returns: {
          agenda_id: string | null
          appointment_type: Database["public"]["Enums"]["appointment_type"]
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          consumed_session: boolean
          created_at: string
          created_by: string | null
          duration_minutes: number | null
          ends_at: string
          gym_id: string
          id: string
          instructor_id: string
          member_id: string
          notes: string | null
          payment_id: string | null
          price_cents: number | null
          room_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reset_onboarding_dismissed: {
        Args: { p_gym_id: string }
        Returns: undefined
      }
      set_gym_stripe_keys: {
        Args: {
          p_gym_id: string
          p_publishable_key: string
          p_secret_key: string
          p_webhook_secret?: string
        }
        Returns: undefined
      }
      set_gym_stripe_webhook_secret: {
        Args: { p_gym_id: string; p_webhook_secret: string }
        Returns: undefined
      }
      sign_member_clause: {
        Args: {
          p_clause_id: string
          p_signed_by_ip?: string
          p_signed_by_name: string
        }
        Returns: {
          assigned_at: string
          assigned_by: string | null
          body_snapshot: string
          created_at: string
          expires_at: string | null
          gym_id: string
          id: string
          member_id: string
          notes: string | null
          signed_at: string | null
          signed_by_ip: string | null
          signed_by_name: string | null
          status: string
          template_id: string | null
          title_snapshot: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "member_clauses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      unblock_member_morosos: { Args: { p_member_id: string }; Returns: string }
      update_expense: {
        Args: {
          p_amount?: number
          p_category?: Database["public"]["Enums"]["expense_category"]
          p_description?: string
          p_expense_date?: string
          p_id: string
          p_invoice_number?: string
          p_invoice_url?: string
          p_notes?: string
          p_supplier?: string
          p_tax_amount?: number
        }
        Returns: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          deleted_by: string | null
          description: string
          expense_date: string
          gym_id: string
          id: string
          invoice_number: string | null
          invoice_url: string | null
          notes: string | null
          stripe_payment_intent_id: string | null
          supplier: string | null
          tax_amount: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "gym_expenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_agenda: {
        Args: {
          p_active?: boolean
          p_capacity?: number
          p_color?: string
          p_default_instructor_id?: string
          p_description?: string
          p_duration_minutes: number
          p_gym_id: string
          p_id: string
          p_name: string
          p_requires_payment_upfront?: boolean
          p_sort_order?: number
        }
        Returns: {
          active: boolean
          capacity: number
          color: string
          created_at: string
          default_instructor_id: string | null
          description: string | null
          duration_minutes: number
          gym_id: string
          id: string
          name: string
          requires_payment_upfront: boolean
          sort_order: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "agendas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      appointment_status: "scheduled" | "completed" | "cancelled" | "no_show"
      appointment_type:
        | "personal_training"
        | "consultation"
        | "assessment"
        | "nutrition"
        | "other"
      booking_status:
        | "confirmed"
        | "waitlist"
        | "cancelled"
        | "attended"
        | "no_show"
      check_in_source: "webapp" | "pwa" | "manual"
      class_instance_status: "scheduled" | "cancelled" | "completed"
      class_type:
        | "dinamico"
        | "premium"
        | "salud"
        | "personal_1h"
        | "personal_30min"
        | "grupal"
      expense_category:
        | "material"
        | "utilities"
        | "rent"
        | "staff"
        | "cleaning"
        | "marketing"
        | "software"
        | "maintenance"
        | "other"
      form_field_type:
        | "text"
        | "number"
        | "select"
        | "checkbox"
        | "textarea"
        | "date"
      form_scope: "member_signup" | "prospect_signup"
      gym_plan: "base" | "smart" | "pro" | "premium" | "app_pro" | "enterprise"
      gym_status: "active" | "trial" | "suspended" | "cancelled"
      gym_user_role:
        | "super_admin"
        | "owner"
        | "admin"
        | "staff"
        | "trainer"
        | "viewer"
      import_job_status: "pending" | "dry_run_ok" | "completed" | "failed"
      import_job_type: "members" | "tariffs" | "payments"
      instructor_block_reason: "vacation" | "sick" | "personal" | "other"
      invoice_status: "draft" | "issued" | "cancelled" | "voided"
      member_status: "active" | "pending" | "inactive" | "blocked"
      notification_delivery: "none" | "email" | "push" | "both"
      notification_type: "info" | "warning" | "success" | "error"
      payment_method:
        | "manual"
        | "sepa"
        | "card"
        | "stripe"
        | "cash"
        | "bank_transfer"
      payment_mode:
        | "manual"
        | "direct_keys"
        | "connect_express"
        | "connect_standard"
        | "managed"
      payment_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "refunded"
        | "cancelled"
      prospect_status:
        | "new"
        | "contacted"
        | "scheduled_visit"
        | "converted"
        | "lost"
      recurring_booking_type: "class" | "appointment"
      shop_order_status:
        | "pending"
        | "paid"
        | "fulfilled"
        | "cancelled"
        | "refunded"
      tariff_type: "monthly" | "bonus" | "one_time"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_recurrence_type: "none" | "daily" | "weekly" | "monthly"
      task_status: "todo" | "in_progress" | "done" | "archived"
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
  public: {
    Enums: {
      appointment_status: ["scheduled", "completed", "cancelled", "no_show"],
      appointment_type: [
        "personal_training",
        "consultation",
        "assessment",
        "nutrition",
        "other",
      ],
      booking_status: [
        "confirmed",
        "waitlist",
        "cancelled",
        "attended",
        "no_show",
      ],
      check_in_source: ["webapp", "pwa", "manual"],
      class_instance_status: ["scheduled", "cancelled", "completed"],
      class_type: [
        "dinamico",
        "premium",
        "salud",
        "personal_1h",
        "personal_30min",
        "grupal",
      ],
      expense_category: [
        "material",
        "utilities",
        "rent",
        "staff",
        "cleaning",
        "marketing",
        "software",
        "maintenance",
        "other",
      ],
      form_field_type: [
        "text",
        "number",
        "select",
        "checkbox",
        "textarea",
        "date",
      ],
      form_scope: ["member_signup", "prospect_signup"],
      gym_plan: ["base", "smart", "pro", "premium", "app_pro", "enterprise"],
      gym_status: ["active", "trial", "suspended", "cancelled"],
      gym_user_role: [
        "super_admin",
        "owner",
        "admin",
        "staff",
        "trainer",
        "viewer",
      ],
      import_job_status: ["pending", "dry_run_ok", "completed", "failed"],
      import_job_type: ["members", "tariffs", "payments"],
      instructor_block_reason: ["vacation", "sick", "personal", "other"],
      invoice_status: ["draft", "issued", "cancelled", "voided"],
      member_status: ["active", "pending", "inactive", "blocked"],
      notification_delivery: ["none", "email", "push", "both"],
      notification_type: ["info", "warning", "success", "error"],
      payment_method: [
        "manual",
        "sepa",
        "card",
        "stripe",
        "cash",
        "bank_transfer",
      ],
      payment_mode: [
        "manual",
        "direct_keys",
        "connect_express",
        "connect_standard",
        "managed",
      ],
      payment_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "refunded",
        "cancelled",
      ],
      prospect_status: [
        "new",
        "contacted",
        "scheduled_visit",
        "converted",
        "lost",
      ],
      recurring_booking_type: ["class", "appointment"],
      shop_order_status: [
        "pending",
        "paid",
        "fulfilled",
        "cancelled",
        "refunded",
      ],
      tariff_type: ["monthly", "bonus", "one_time"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_recurrence_type: ["none", "daily", "weekly", "monthly"],
      task_status: ["todo", "in_progress", "done", "archived"],
    },
  },
} as const
