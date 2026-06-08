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
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
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
          id: string
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
          id?: string
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
          id?: string
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
      app_module: "claims" | "vykupy" | "users"
      app_role: "admin" | "employee"
      claim_status:
        | "new"
        | "in_progress"
        | "closed"
        | "in_repair"
        | "waiting_vat"
        | "done"
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
      app_module: ["claims", "vykupy", "users"],
      app_role: ["admin", "employee"],
      claim_status: [
        "new",
        "in_progress",
        "closed",
        "in_repair",
        "waiting_vat",
        "done",
      ],
    },
  },
} as const
