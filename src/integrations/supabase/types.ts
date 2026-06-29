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
      attendance_absences: {
        Row: {
          created_at: string
          employee_id: string
          end_date: string
          id: string
          note: string | null
          requested_resolver: string | null
          resolved_at: string | null
          resolved_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["dochazka_absence_status"]
          type: Database["public"]["Enums"]["dochazka_absence_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          end_date: string
          id?: string
          note?: string | null
          requested_resolver?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["dochazka_absence_status"]
          type: Database["public"]["Enums"]["dochazka_absence_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          end_date?: string
          id?: string
          note?: string | null
          requested_resolver?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["dochazka_absence_status"]
          type?: Database["public"]["Enums"]["dochazka_absence_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_absences_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "attendance_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_absences_requested_resolver_fkey"
            columns: ["requested_resolver"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_absences_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "attendance_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_employee_pins: {
        Row: {
          employee_id: string
          failed_attempts: number
          lock_until: string | null
          pin: string
          pin_hash: string | null
          pin_lookup: string | null
          updated_at: string
        }
        Insert: {
          employee_id: string
          failed_attempts?: number
          lock_until?: string | null
          pin: string
          pin_hash?: string | null
          pin_lookup?: string | null
          updated_at?: string
        }
        Update: {
          employee_id?: string
          failed_attempts?: number
          lock_until?: string | null
          pin?: string
          pin_hash?: string | null
          pin_lookup?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_pins_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "attendance_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_employees: {
        Row: {
          active: boolean
          avatar_color: string
          can_approve_absences: boolean
          created_at: string
          employment_types: string[]
          id: string
          name: string
          role: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          avatar_color?: string
          can_approve_absences?: boolean
          created_at?: string
          employment_types?: string[]
          id?: string
          name: string
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          avatar_color?: string
          can_approve_absences?: boolean
          created_at?: string
          employment_types?: string[]
          id?: string
          name?: string
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      attendance_notifications: {
        Row: {
          created_at: string
          id: string
          is_for_manager: boolean
          message: string
          meta: Json
          read: boolean
          recipient_employee_id: string | null
          title: string
          type: Database["public"]["Enums"]["dochazka_notification_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          is_for_manager?: boolean
          message: string
          meta?: Json
          read?: boolean
          recipient_employee_id?: string | null
          title: string
          type: Database["public"]["Enums"]["dochazka_notification_type"]
        }
        Update: {
          created_at?: string
          id?: string
          is_for_manager?: boolean
          message?: string
          meta?: Json
          read?: boolean
          recipient_employee_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["dochazka_notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "attendance_notifications_recipient_employee_id_fkey"
            columns: ["recipient_employee_id"]
            isOneToOne: false
            referencedRelation: "attendance_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_pin_ip_allowlist: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          ip_cidr: unknown
          label: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          ip_cidr: unknown
          label?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          ip_cidr?: unknown
          label?: string | null
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          approval_note: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          break_duration: number
          check_in: string
          check_out: string | null
          created_at: string
          date: string
          employee_id: string
          geo_accuracy: number | null
          geo_lat: number | null
          geo_lng: number | null
          hours_worked: number
          id: string
          note: string | null
          shift_id: string | null
          updated_at: string
        }
        Insert: {
          approval_note?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          break_duration?: number
          check_in: string
          check_out?: string | null
          created_at?: string
          date: string
          employee_id: string
          geo_accuracy?: number | null
          geo_lat?: number | null
          geo_lng?: number | null
          hours_worked?: number
          id?: string
          note?: string | null
          shift_id?: string | null
          updated_at?: string
        }
        Update: {
          approval_note?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          break_duration?: number
          check_in?: string
          check_out?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          geo_accuracy?: number | null
          geo_lat?: number | null
          geo_lng?: number | null
          hours_worked?: number
          id?: string
          note?: string | null
          shift_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "attendance_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "attendance_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_settings: {
        Row: {
          custom_message_prefix: string
          daily_overtime_threshold_hours: number
          id: boolean
          late_arrival_buffer_minutes: number
          no_show_buffer_minutes: number
          notify_employee_absence_resolved: boolean
          notify_employee_late: boolean
          notify_employee_shift_ending: boolean
          notify_manager_absence_pending: boolean
          notify_manager_no_show: boolean
          require_record_approval: boolean
          rounding_minutes: number
          shift_ending_minutes_threshold: number
          updated_at: string
          weekly_overtime_threshold_hours: number
        }
        Insert: {
          custom_message_prefix?: string
          daily_overtime_threshold_hours?: number
          id?: boolean
          late_arrival_buffer_minutes?: number
          no_show_buffer_minutes?: number
          notify_employee_absence_resolved?: boolean
          notify_employee_late?: boolean
          notify_employee_shift_ending?: boolean
          notify_manager_absence_pending?: boolean
          notify_manager_no_show?: boolean
          require_record_approval?: boolean
          rounding_minutes?: number
          shift_ending_minutes_threshold?: number
          updated_at?: string
          weekly_overtime_threshold_hours?: number
        }
        Update: {
          custom_message_prefix?: string
          daily_overtime_threshold_hours?: number
          id?: boolean
          late_arrival_buffer_minutes?: number
          no_show_buffer_minutes?: number
          notify_employee_absence_resolved?: boolean
          notify_employee_late?: boolean
          notify_employee_shift_ending?: boolean
          notify_manager_absence_pending?: boolean
          notify_manager_no_show?: boolean
          require_record_approval?: boolean
          rounding_minutes?: number
          shift_ending_minutes_threshold?: number
          updated_at?: string
          weekly_overtime_threshold_hours?: number
        }
        Relationships: []
      }
      attendance_shifts: {
        Row: {
          color: string
          created_at: string
          end_time: string
          id: string
          name: string
          start_time: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          end_time: string
          id?: string
          name: string
          start_time: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          end_time?: string
          id?: string
          name?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_label: string | null
          id: string
          module: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_label?: string | null
          id?: string
          module: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_label?: string | null
          id?: string
          module?: string
        }
        Relationships: []
      }
      claim_attachments: {
        Row: {
          category: string
          claim_id: string
          created_at: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          size: number | null
        }
        Insert: {
          category: string
          claim_id: string
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          size?: number | null
        }
        Update: {
          category?: string
          claim_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          size?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_attachments_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_events: {
        Row: {
          claim_id: string
          created_at: string
          id: string
          message: string
          type: string
        }
        Insert: {
          claim_id: string
          created_at?: string
          id?: string
          message: string
          type: string
        }
        Update: {
          claim_id?: string
          created_at?: string
          id?: string
          message?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_events_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_tasks: {
        Row: {
          claim_id: string
          created_at: string
          done: boolean
          id: string
          title: string
        }
        Insert: {
          claim_id: string
          created_at?: string
          done?: boolean
          id?: string
          title: string
        }
        Update: {
          claim_id?: string
          created_at?: string
          done?: boolean
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_tasks_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          accident_record: string | null
          address: string | null
          assignee_id: string | null
          assignee_name: string | null
          claim_number: string | null
          company: string | null
          created_at: string
          created_by: string | null
          email: string | null
          event_at: string | null
          first_name: string
          ico: string | null
          id: string
          insurer: string | null
          insurer_record: string | null
          last_name: string
          liquidation_type: string | null
          loan_lease: string | null
          location: string | null
          notes: string | null
          phone: string
          pu_number: string | null
          signature: string
          status: Database["public"]["Enums"]["claim_status"]
          updated_at: string
          upload_token: string
          vat_paid: boolean
          vat_payer: string | null
        }
        Insert: {
          accident_record?: string | null
          address?: string | null
          assignee_id?: string | null
          assignee_name?: string | null
          claim_number?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          event_at?: string | null
          first_name: string
          ico?: string | null
          id?: string
          insurer?: string | null
          insurer_record?: string | null
          last_name: string
          liquidation_type?: string | null
          loan_lease?: string | null
          location?: string | null
          notes?: string | null
          phone: string
          pu_number?: string | null
          signature: string
          status?: Database["public"]["Enums"]["claim_status"]
          updated_at?: string
          upload_token?: string
          vat_paid?: boolean
          vat_payer?: string | null
        }
        Update: {
          accident_record?: string | null
          address?: string | null
          assignee_id?: string | null
          assignee_name?: string | null
          claim_number?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          event_at?: string | null
          first_name?: string
          ico?: string | null
          id?: string
          insurer?: string | null
          insurer_record?: string | null
          last_name?: string
          liquidation_type?: string | null
          loan_lease?: string | null
          location?: string | null
          notes?: string | null
          phone?: string
          pu_number?: string | null
          signature?: string
          status?: Database["public"]["Enums"]["claim_status"]
          updated_at?: string
          upload_token?: string
          vat_paid?: boolean
          vat_payer?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          company: string | null
          created_at: string
          dic: string | null
          email: string | null
          full_name: string
          ico: string | null
          id: string
          notes: string | null
          owner_id: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company?: string | null
          created_at?: string
          dic?: string | null
          email?: string | null
          full_name: string
          ico?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company?: string | null
          created_at?: string
          dic?: string | null
          email?: string | null
          full_name?: string
          ico?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      deal_stage_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          changed_by_name: string | null
          deal_id: string
          duration_seconds: number | null
          from_stage: string | null
          id: string
          to_stage: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          changed_by_name?: string | null
          deal_id: string
          duration_seconds?: number | null
          from_stage?: string | null
          id?: string
          to_stage: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          changed_by_name?: string | null
          deal_id?: string
          duration_seconds?: number | null
          from_stage?: string | null
          id?: string
          to_stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_stage_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          client_name: string | null
          contact: string | null
          created_at: string
          expected_close_date: string | null
          follow_up_at: string | null
          follow_up_notified_at: string | null
          id: string
          notes: string | null
          owner_id: string | null
          owner_name: string | null
          stage: string
          stage_changed_at: string
          title: string
          updated_at: string
          value_czk: number | null
          vehicle: string | null
        }
        Insert: {
          client_name?: string | null
          contact?: string | null
          created_at?: string
          expected_close_date?: string | null
          follow_up_at?: string | null
          follow_up_notified_at?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          owner_name?: string | null
          stage?: string
          stage_changed_at?: string
          title: string
          updated_at?: string
          value_czk?: number | null
          vehicle?: string | null
        }
        Update: {
          client_name?: string | null
          contact?: string | null
          created_at?: string
          expected_close_date?: string | null
          follow_up_at?: string | null
          follow_up_notified_at?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          owner_name?: string | null
          stage?: string
          stage_changed_at?: string
          title?: string
          updated_at?: string
          value_czk?: number | null
          vehicle?: string | null
        }
        Relationships: []
      }
      defects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          photos: Json
          priority: string
          reported_by: string
          reporter_name: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          resolver_name: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          photos?: Json
          priority?: string
          reported_by: string
          reporter_name?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolver_name?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          photos?: Json
          priority?: string
          reported_by?: string
          reporter_name?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolver_name?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      deletion_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          entity_id: string
          entity_label: string
          entity_type: string
          id: string
          reason: string
          requested_by: string
          status: Database["public"]["Enums"]["deletion_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          entity_id: string
          entity_label?: string
          entity_type: string
          id?: string
          reason: string
          requested_by: string
          status?: Database["public"]["Enums"]["deletion_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          entity_id?: string
          entity_label?: string
          entity_type?: string
          id?: string
          reason?: string
          requested_by?: string
          status?: Database["public"]["Enums"]["deletion_status"]
          updated_at?: string
        }
        Relationships: []
      }
      demo_order_documents: {
        Row: {
          client_id: string
          created_at: string
          file_name: string
          id: string
          kind: string
          mime: string
          order_id: string
          signed_at: string | null
          storage_path: string
        }
        Insert: {
          client_id: string
          created_at?: string
          file_name: string
          id?: string
          kind: string
          mime?: string
          order_id: string
          signed_at?: string | null
          storage_path: string
        }
        Update: {
          client_id?: string
          created_at?: string
          file_name?: string
          id?: string
          kind?: string
          mime?: string
          order_id?: string
          signed_at?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_order_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_order_documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "demo_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_order_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          created_at: string
          id: string
          message: string
          meta: Json | null
          order_id: string
          type: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          id?: string
          message: string
          meta?: Json | null
          order_id: string
          type: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          id?: string
          message?: string
          meta?: Json | null
          order_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "demo_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_order_signatures: {
        Row: {
          consumed_at: string | null
          created_at: string
          id: string
          ip: string | null
          mode: string
          order_id: string
          signature_data: string | null
          signed_at: string | null
          signer_name: string | null
          token: string | null
          token_expires_at: string | null
          user_agent: string | null
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          mode: string
          order_id: string
          signature_data?: string | null
          signed_at?: string | null
          signer_name?: string | null
          token?: string | null
          token_expires_at?: string | null
          user_agent?: string | null
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          mode?: string
          order_id?: string
          signature_data?: string | null
          signed_at?: string | null
          signer_name?: string | null
          token?: string | null
          token_expires_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_order_signatures_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "demo_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_orders: {
        Row: {
          assignee_id: string | null
          assignee_name: string | null
          barva: string | null
          cena_celkem_bez_dph: number
          cena_celkem_s_dph: number
          client_id: string
          created_at: string
          created_by: string | null
          datum_dodani: string | null
          datum_objednavky: string
          id: string
          invoice_number: string | null
          line_items: Json
          model_verze: string | null
          najete_km: number | null
          notes: string | null
          order_number: string | null
          registrace_datum: string | null
          rok_vyroby: number | null
          rz: string | null
          seller_signature_data: string | null
          seller_signed_at: string | null
          seller_signer_name: string | null
          status: string
          updated_at: string
          vin: string | null
          zaloha: number
          zaruka_spustena_od: string | null
        }
        Insert: {
          assignee_id?: string | null
          assignee_name?: string | null
          barva?: string | null
          cena_celkem_bez_dph?: number
          cena_celkem_s_dph?: number
          client_id: string
          created_at?: string
          created_by?: string | null
          datum_dodani?: string | null
          datum_objednavky?: string
          id?: string
          invoice_number?: string | null
          line_items?: Json
          model_verze?: string | null
          najete_km?: number | null
          notes?: string | null
          order_number?: string | null
          registrace_datum?: string | null
          rok_vyroby?: number | null
          rz?: string | null
          seller_signature_data?: string | null
          seller_signed_at?: string | null
          seller_signer_name?: string | null
          status?: string
          updated_at?: string
          vin?: string | null
          zaloha?: number
          zaruka_spustena_od?: string | null
        }
        Update: {
          assignee_id?: string | null
          assignee_name?: string | null
          barva?: string | null
          cena_celkem_bez_dph?: number
          cena_celkem_s_dph?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          datum_dodani?: string | null
          datum_objednavky?: string
          id?: string
          invoice_number?: string | null
          line_items?: Json
          model_verze?: string | null
          najete_km?: number | null
          notes?: string | null
          order_number?: string | null
          registrace_datum?: string | null
          rok_vyroby?: number | null
          rz?: string | null
          seller_signature_data?: string | null
          seller_signed_at?: string | null
          seller_signer_name?: string | null
          status?: string
          updated_at?: string
          vin?: string | null
          zaloha?: number
          zaruka_spustena_od?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          key: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          key: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          key?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      evidence_orders: {
        Row: {
          assignee_id: string | null
          assignee_name: string | null
          cislo_zakazky: string | null
          complete_by: string | null
          created_at: string
          created_by: string | null
          den: string | null
          hodina: string | null
          id: string
          kdo_predava: string | null
          klient: string
          pickup_from: string | null
          poznamka: string | null
          stav: string
          updated_at: string
          vis: string | null
          vozidlo: string
        }
        Insert: {
          assignee_id?: string | null
          assignee_name?: string | null
          cislo_zakazky?: string | null
          complete_by?: string | null
          created_at?: string
          created_by?: string | null
          den?: string | null
          hodina?: string | null
          id?: string
          kdo_predava?: string | null
          klient: string
          pickup_from?: string | null
          poznamka?: string | null
          stav?: string
          updated_at?: string
          vis?: string | null
          vozidlo: string
        }
        Update: {
          assignee_id?: string | null
          assignee_name?: string | null
          cislo_zakazky?: string | null
          complete_by?: string | null
          created_at?: string
          created_by?: string | null
          den?: string | null
          hodina?: string | null
          id?: string
          kdo_predava?: string | null
          klient?: string
          pickup_from?: string | null
          poznamka?: string | null
          stav?: string
          updated_at?: string
          vis?: string | null
          vozidlo?: string
        }
        Relationships: []
      }
      evidence_wash_assignments: {
        Row: {
          confirm_token: string
          decided_at: string | null
          id: string
          last_reminder_at: string | null
          order_id: string
          reminder_count: number
          sent_at: string
          status: string
          washer_id: string
        }
        Insert: {
          confirm_token?: string
          decided_at?: string | null
          id?: string
          last_reminder_at?: string | null
          order_id: string
          reminder_count?: number
          sent_at?: string
          status?: string
          washer_id: string
        }
        Update: {
          confirm_token?: string
          decided_at?: string | null
          id?: string
          last_reminder_at?: string | null
          order_id?: string
          reminder_count?: number
          sent_at?: string
          status?: string
          washer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_wash_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "evidence_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_wash_assignments_washer_id_fkey"
            columns: ["washer_id"]
            isOneToOne: false
            referencedRelation: "washers"
            referencedColumns: ["id"]
          },
        ]
      }
      logbook_entries: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string | null
          entry_date: string
          fuel_cost_czk: number | null
          fuel_liters: number | null
          id: string
          km_driven: number | null
          note: string | null
          odometer: number | null
          purpose: string | null
          receipt_path: string | null
          route: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          entry_date: string
          fuel_cost_czk?: number | null
          fuel_liters?: number | null
          id?: string
          km_driven?: number | null
          note?: string | null
          odometer?: number | null
          purpose?: string | null
          receipt_path?: string | null
          route?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          entry_date?: string
          fuel_cost_czk?: number | null
          fuel_liters?: number | null
          id?: string
          km_driven?: number | null
          note?: string | null
          odometer?: number | null
          purpose?: string | null
          receipt_path?: string | null
          route?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "logbook_entries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "logbook_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      logbook_vehicles: {
        Row: {
          active: boolean
          body_number: string | null
          created_at: string
          created_by: string | null
          id: string
          responsible_person: string | null
          responsible_user_id: string | null
          spz: string | null
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body_number?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          responsible_person?: string | null
          responsible_user_id?: string | null
          spz?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body_number?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          responsible_person?: string | null
          responsible_user_id?: string | null
          spz?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      pin_attempt_log: {
        Row: {
          attempted_at: string
          employee_id: string | null
          id: number
          ip: unknown
          success: boolean
        }
        Insert: {
          attempted_at?: string
          employee_id?: string | null
          id?: number
          ip?: unknown
          success: boolean
        }
        Update: {
          attempted_at?: string
          employee_id?: string | null
          id?: number
          ip?: unknown
          success?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved: boolean
          created_at: string
          department: Database["public"]["Enums"]["app_department"] | null
          email: string | null
          full_name: string | null
          id: string
          is_department_head: boolean
        }
        Insert: {
          approved?: boolean
          created_at?: string
          department?: Database["public"]["Enums"]["app_department"] | null
          email?: string | null
          full_name?: string | null
          id: string
          is_department_head?: boolean
        }
        Update: {
          approved?: boolean
          created_at?: string
          department?: Database["public"]["Enums"]["app_department"] | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_department_head?: boolean
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount: number | null
          amount_net: number | null
          created_at: string
          currency: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          description: string | null
          id: string
          requested_by: string | null
          status: Database["public"]["Enums"]["approval_status"]
          supplier_id: string | null
          title: string
          updated_at: string
          vat_rate: number
        }
        Insert: {
          amount?: number | null
          amount_net?: number | null
          created_at?: string
          currency?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          description?: string | null
          id?: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          supplier_id?: string | null
          title: string
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          amount?: number | null
          amount_net?: number | null
          created_at?: string
          currency?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          description?: string | null
          id?: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          supplier_id?: string | null
          title?: string
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          dic: string | null
          email: string | null
          ico: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          requested_by: string | null
          status: Database["public"]["Enums"]["approval_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          dic?: string | null
          email?: string | null
          ico?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          requested_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          dic?: string | null
          email?: string | null
          ico?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          requested_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      task_attachments: {
        Row: {
          content_type: string | null
          created_at: string
          file_name: string
          id: string
          size_bytes: number | null
          storage_path: string
          task_id: string
          uploader_id: string
          uploader_name: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          file_name: string
          id?: string
          size_bytes?: number | null
          storage_path: string
          task_id: string
          uploader_id: string
          uploader_name?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string
          file_name?: string
          id?: string
          size_bytes?: number | null
          storage_path?: string
          task_id?: string
          uploader_id?: string
          uploader_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string
          author_name: string | null
          body: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_id: string
          author_name?: string | null
          body: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_id?: string
          author_name?: string | null
          body?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          assignee_name: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          creator_name: string | null
          description: string | null
          due_date: string | null
          id: string
          last_activity_at: string
          last_activity_by: string | null
          last_recurrence_at: string | null
          overdue_notified_at: string | null
          priority: string
          recurrence: string | null
          recurrence_parent_id: string | null
          recurrence_until: string | null
          reminder_24h_sent_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          assignee_name?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          creator_name?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          last_activity_at?: string
          last_activity_by?: string | null
          last_recurrence_at?: string | null
          overdue_notified_at?: string | null
          priority?: string
          recurrence?: string | null
          recurrence_parent_id?: string | null
          recurrence_until?: string | null
          reminder_24h_sent_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          assignee_name?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          creator_name?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          last_activity_at?: string
          last_activity_by?: string | null
          last_recurrence_at?: string | null
          overdue_notified_at?: string | null
          priority?: string
          recurrence?: string | null
          recurrence_parent_id?: string | null
          recurrence_until?: string | null
          reminder_24h_sent_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_recurrence_parent_id_fkey"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_modules: {
        Row: {
          created_at: string
          id: string
          module: Database["public"]["Enums"]["app_module"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          module: Database["public"]["Enums"]["app_module"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          module?: Database["public"]["Enums"]["app_module"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vykup_photos: {
        Row: {
          content_type: string | null
          created_at: string
          defect_note: string | null
          file_name: string
          has_defect: boolean
          id: string
          size_bytes: number
          storage_path: string
          updated_at: string
          uploader_id: string | null
          uploader_name: string | null
          vykup_id: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          defect_note?: string | null
          file_name: string
          has_defect?: boolean
          id?: string
          size_bytes?: number
          storage_path: string
          updated_at?: string
          uploader_id?: string | null
          uploader_name?: string | null
          vykup_id: string
        }
        Update: {
          content_type?: string | null
          created_at?: string
          defect_note?: string | null
          file_name?: string
          has_defect?: boolean
          id?: string
          size_bytes?: number
          storage_path?: string
          updated_at?: string
          uploader_id?: string | null
          uploader_name?: string | null
          vykup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vykup_photos_vykup_id_fkey"
            columns: ["vykup_id"]
            isOneToOne: false
            referencedRelation: "vykupy"
            referencedColumns: ["id"]
          },
        ]
      }
      vykupy: {
        Row: {
          assignee_id: string | null
          assignee_name: string | null
          barva: string | null
          created_at: string
          created_by: string | null
          datum_vykupu: string | null
          external_priced_amount: number | null
          external_priced_at: string | null
          external_priced_by: string | null
          follow_up_at: string | null
          follow_up_notified_at: string | null
          id: string
          internal_priced_amount: number | null
          internal_priced_at: string | null
          internal_priced_by_user_id: string | null
          klient: string
          model: string
          naceneno_od: number | null
          naklady: number
          naklady_popis: string | null
          new_in_cz: boolean | null
          owner_expectation_czk: number | null
          pocet_km: number | null
          poznamka: string | null
          prodano_za: number | null
          rok_vyroby: number | null
          service_history: boolean | null
          stav: string
          stav_changed_at: string
          telefon: string | null
          vykoupeno_za: number | null
          zdroj: string | null
          znacka: string
          zpracoval: string | null
        }
        Insert: {
          assignee_id?: string | null
          assignee_name?: string | null
          barva?: string | null
          created_at?: string
          created_by?: string | null
          datum_vykupu?: string | null
          external_priced_amount?: number | null
          external_priced_at?: string | null
          external_priced_by?: string | null
          follow_up_at?: string | null
          follow_up_notified_at?: string | null
          id?: string
          internal_priced_amount?: number | null
          internal_priced_at?: string | null
          internal_priced_by_user_id?: string | null
          klient: string
          model: string
          naceneno_od?: number | null
          naklady?: number
          naklady_popis?: string | null
          new_in_cz?: boolean | null
          owner_expectation_czk?: number | null
          pocet_km?: number | null
          poznamka?: string | null
          prodano_za?: number | null
          rok_vyroby?: number | null
          service_history?: boolean | null
          stav?: string
          stav_changed_at?: string
          telefon?: string | null
          vykoupeno_za?: number | null
          zdroj?: string | null
          znacka: string
          zpracoval?: string | null
        }
        Update: {
          assignee_id?: string | null
          assignee_name?: string | null
          barva?: string | null
          created_at?: string
          created_by?: string | null
          datum_vykupu?: string | null
          external_priced_amount?: number | null
          external_priced_at?: string | null
          external_priced_by?: string | null
          follow_up_at?: string | null
          follow_up_notified_at?: string | null
          id?: string
          internal_priced_amount?: number | null
          internal_priced_at?: string | null
          internal_priced_by_user_id?: string | null
          klient?: string
          model?: string
          naceneno_od?: number | null
          naklady?: number
          naklady_popis?: string | null
          new_in_cz?: boolean | null
          owner_expectation_czk?: number | null
          pocet_km?: number | null
          poznamka?: string | null
          prodano_za?: number | null
          rok_vyroby?: number | null
          service_history?: boolean | null
          stav?: string
          stav_changed_at?: string
          telefon?: string | null
          vykoupeno_za?: number | null
          zdroj?: string | null
          znacka?: string
          zpracoval?: string | null
        }
        Relationships: []
      }
      washers: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          email: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_approve_attendance: { Args: { _uid: string }; Returns: boolean }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_attendance_pin_pepper: { Args: never; Returns: string }
      get_cron_auth_secret: { Args: never; Returns: string }
      has_module: {
        Args: {
          _module: Database["public"]["Enums"]["app_module"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved_user: { Args: { _uid: string }; Returns: boolean }
      is_dept_head_of: {
        Args: { _head: string; _requester: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      next_demo_invoice_number: { Args: never; Returns: string }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      set_employee_pin: {
        Args: { _employee_id: string; _pin: string }
        Returns: undefined
      }
      verify_employee_pin_v2: {
        Args: { _ip?: unknown; _pin: string }
        Returns: {
          employee_id: string
          name: string
          retry_after_seconds: number
          status: string
        }[]
      }
    }
    Enums: {
      app_department: "vedeni" | "obchod" | "servis" | "nahradni_dily"
      app_module:
        | "claims"
        | "vykupy"
        | "users"
        | "approvals"
        | "dashboard"
        | "vykupy_external"
        | "dochazka"
        | "defects"
        | "deals"
        | "logbook"
        | "tasks"
        | "demo_orders"
        | "evidence_zakazek"
      app_role: "admin" | "employee"
      approval_status: "pending" | "approved" | "rejected"
      claim_status:
        | "new"
        | "in_progress"
        | "closed"
        | "in_repair"
        | "waiting_vat"
        | "done"
      deletion_status: "pending" | "approved" | "rejected"
      dochazka_absence_status: "pending" | "approved" | "rejected"
      dochazka_absence_type:
        | "dovolena"
        | "nemoc"
        | "lekar"
        | "neplacene_volno"
        | "jine"
      dochazka_notification_type:
        | "late_arrival"
        | "shift_ending"
        | "no_show"
        | "absence_pending"
        | "absence_resolved"
        | "custom"
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
      app_department: ["vedeni", "obchod", "servis", "nahradni_dily"],
      app_module: [
        "claims",
        "vykupy",
        "users",
        "approvals",
        "dashboard",
        "vykupy_external",
        "dochazka",
        "defects",
        "deals",
        "logbook",
        "tasks",
        "demo_orders",
        "evidence_zakazek",
      ],
      app_role: ["admin", "employee"],
      approval_status: ["pending", "approved", "rejected"],
      claim_status: [
        "new",
        "in_progress",
        "closed",
        "in_repair",
        "waiting_vat",
        "done",
      ],
      deletion_status: ["pending", "approved", "rejected"],
      dochazka_absence_status: ["pending", "approved", "rejected"],
      dochazka_absence_type: [
        "dovolena",
        "nemoc",
        "lekar",
        "neplacene_volno",
        "jine",
      ],
      dochazka_notification_type: [
        "late_arrival",
        "shift_ending",
        "no_show",
        "absence_pending",
        "absence_resolved",
        "custom",
      ],
    },
  },
} as const
