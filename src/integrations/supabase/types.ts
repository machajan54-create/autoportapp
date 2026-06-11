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
            foreignKeyName: "attendance_absences_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
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
          id: string
          name: string
          pin: string
          role: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          avatar_color?: string
          can_approve_absences?: boolean
          created_at?: string
          id?: string
          name: string
          pin: string
          role?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          avatar_color?: string
          can_approve_absences?: boolean
          created_at?: string
          id?: string
          name?: string
          pin?: string
          role?: string
          updated_at?: string
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
      attendance_records: {
        Row: {
          break_duration: number
          check_in: string
          check_out: string | null
          created_at: string
          date: string
          employee_id: string
          hours_worked: number
          id: string
          note: string | null
          shift_id: string | null
          updated_at: string
        }
        Insert: {
          break_duration?: number
          check_in: string
          check_out?: string | null
          created_at?: string
          date: string
          employee_id: string
          hours_worked?: number
          id?: string
          note?: string | null
          shift_id?: string | null
          updated_at?: string
        }
        Update: {
          break_duration?: number
          check_in?: string
          check_out?: string | null
          created_at?: string
          date?: string
          employee_id?: string
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
          id: boolean
          late_arrival_buffer_minutes: number
          no_show_buffer_minutes: number
          notify_employee_absence_resolved: boolean
          notify_employee_late: boolean
          notify_employee_shift_ending: boolean
          notify_manager_absence_pending: boolean
          notify_manager_no_show: boolean
          shift_ending_minutes_threshold: number
          updated_at: string
        }
        Insert: {
          custom_message_prefix?: string
          id?: boolean
          late_arrival_buffer_minutes?: number
          no_show_buffer_minutes?: number
          notify_employee_absence_resolved?: boolean
          notify_employee_late?: boolean
          notify_employee_shift_ending?: boolean
          notify_manager_absence_pending?: boolean
          notify_manager_no_show?: boolean
          shift_ending_minutes_threshold?: number
          updated_at?: string
        }
        Update: {
          custom_message_prefix?: string
          id?: boolean
          late_arrival_buffer_minutes?: number
          no_show_buffer_minutes?: number
          notify_employee_absence_resolved?: boolean
          notify_employee_late?: boolean
          notify_employee_shift_ending?: boolean
          notify_manager_absence_pending?: boolean
          notify_manager_no_show?: boolean
          shift_ending_minutes_threshold?: number
          updated_at?: string
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
          claim_number: string | null
          company: string | null
          created_at: string
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
          claim_number?: string | null
          company?: string | null
          created_at?: string
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
          claim_number?: string | null
          company?: string | null
          created_at?: string
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
      profiles: {
        Row: {
          approved: boolean
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount: number | null
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
        }
        Insert: {
          amount?: number | null
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
        }
        Update: {
          amount?: number | null
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
      vykupy: {
        Row: {
          created_at: string
          datum_vykupu: string | null
          external_priced_amount: number | null
          external_priced_at: string | null
          external_priced_by: string | null
          id: string
          internal_priced_amount: number | null
          internal_priced_at: string | null
          internal_priced_by_user_id: string | null
          klient: string
          model: string
          naceneno_od: number | null
          naklady: number
          pocet_km: number | null
          poznamka: string | null
          prodano_za: number | null
          rok_vyroby: number | null
          stav: string
          telefon: string | null
          vykoupeno_za: number | null
          zdroj: string | null
          znacka: string
          zpracoval: string | null
        }
        Insert: {
          created_at?: string
          datum_vykupu?: string | null
          external_priced_amount?: number | null
          external_priced_at?: string | null
          external_priced_by?: string | null
          id?: string
          internal_priced_amount?: number | null
          internal_priced_at?: string | null
          internal_priced_by_user_id?: string | null
          klient: string
          model: string
          naceneno_od?: number | null
          naklady?: number
          pocet_km?: number | null
          poznamka?: string | null
          prodano_za?: number | null
          rok_vyroby?: number | null
          stav?: string
          telefon?: string | null
          vykoupeno_za?: number | null
          zdroj?: string | null
          znacka: string
          zpracoval?: string | null
        }
        Update: {
          created_at?: string
          datum_vykupu?: string | null
          external_priced_amount?: number | null
          external_priced_at?: string | null
          external_priced_by?: string | null
          id?: string
          internal_priced_amount?: number | null
          internal_priced_at?: string | null
          internal_priced_by_user_id?: string | null
          klient?: string
          model?: string
          naceneno_od?: number | null
          naklady?: number
          pocet_km?: number | null
          poznamka?: string | null
          prodano_za?: number | null
          rok_vyroby?: number | null
          stav?: string
          telefon?: string | null
          vykoupeno_za?: number | null
          zdroj?: string | null
          znacka?: string
          zpracoval?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
    }
    Enums: {
      app_module:
        | "claims"
        | "vykupy"
        | "users"
        | "approvals"
        | "dashboard"
        | "vykupy_external"
        | "dochazka"
      app_role: "admin" | "employee"
      approval_status: "pending" | "approved" | "rejected"
      claim_status:
        | "new"
        | "in_progress"
        | "closed"
        | "in_repair"
        | "waiting_vat"
        | "done"
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
      app_module: [
        "claims",
        "vykupy",
        "users",
        "approvals",
        "dashboard",
        "vykupy_external",
        "dochazka",
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
