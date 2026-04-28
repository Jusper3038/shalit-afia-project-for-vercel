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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: string | null
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      drugs: {
        Row: {
          buying_price: number
          created_at: string
          date_of_purchase: string | null
          expiry_date: string | null
          id: string
          low_stock_threshold: number
          name: string
          serial_number: string | null
          selling_price: number
          stock_quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          buying_price?: number
          created_at?: string
          date_of_purchase?: string | null
          expiry_date?: string | null
          id?: string
          low_stock_threshold?: number
          name: string
          serial_number?: string | null
          selling_price?: number
          stock_quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          buying_price?: number
          created_at?: string
          date_of_purchase?: string | null
          expiry_date?: string | null
          id?: string
          low_stock_threshold?: number
          name?: string
          serial_number?: string | null
          selling_price?: number
          stock_quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          clinic_name: string
          created_at: string
          email: string
          full_name: string
          id: string
          notes: string | null
          page_path: string
          source: string
          status: string
        }
        Insert: {
          clinic_name: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          notes?: string | null
          page_path?: string
          source?: string
          status?: string
        }
        Update: {
          clinic_name?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          notes?: string | null
          page_path?: string
          source?: string
          status?: string
        }
        Relationships: []
      }
      patients: {
        Row: {
          created_at: string
          diagnosis: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          diagnosis?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          diagnosis?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          status: string
          transaction_reference: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          status?: string
          transaction_reference?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          status?: string
          transaction_reference?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          clinic_name: string
          created_at: string
          deactivated_at: string | null
          deactivation_reason: string | null
          email: string
          id: string
          is_active: boolean
          minimum_profit_retention_percentage: number
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clinic_name?: string
          created_at?: string
          deactivated_at?: string | null
          deactivation_reason?: string | null
          email?: string
          id?: string
          is_active?: boolean
          minimum_profit_retention_percentage?: number
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clinic_name?: string
          created_at?: string
          deactivated_at?: string | null
          deactivation_reason?: string | null
          email?: string
          id?: string
          is_active?: boolean
          minimum_profit_retention_percentage?: number
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_owners: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          created_at: string
          date: string
          discount_amount: number
          discount_percentage: number
          drug_id: string | null
          id: string
          patient_id: string | null
          quantity: number
          sale_day: string
          sale_month: number
          sale_week_start: string
          sale_year: number
          total_cost: number
          unit_buying_price: number
          unit_list_price: number
          unit_selling_price: number
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          discount_amount?: number
          discount_percentage?: number
          drug_id?: string | null
          id?: string
          patient_id?: string | null
          quantity?: number
          sale_day?: string
          sale_month?: number
          sale_week_start?: string
          sale_year?: number
          total_cost?: number
          unit_buying_price?: number
          unit_list_price?: number
          unit_selling_price?: number
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          discount_amount?: number
          discount_percentage?: number
          drug_id?: string | null
          id?: string
          patient_id?: string | null
          quantity?: number
          sale_day?: string
          sale_month?: number
          sale_week_start?: string
          sale_year?: number
          total_cost?: number
          unit_buying_price?: number
          unit_list_price?: number
          unit_selling_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_drug_id_fkey"
            columns: ["drug_id"]
            isOneToOne: false
            referencedRelation: "drugs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_delete_user: {
        Args: {
          p_user_id: string
        }
        Returns: undefined
      }
      get_system_users: {
        Args: Record<PropertyKey, never>
        Returns: {
          clinic_name: string
          created_at: string
          email: string
          name: string
          profile_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_owner_security_pin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      verify_owner_security_pin: {
        Args: {
          p_pin: string
        }
        Returns: boolean
      }
      set_owner_security_pin: {
        Args: {
          p_current_pin?: string | null
          p_pin: string
        }
        Returns: undefined
      }
      clear_owner_security_pin: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      claim_platform_owner_access: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      get_platform_accounts: {
        Args: Record<PropertyKey, never>
        Returns: {
          clinic_name: string
          created_at: string
          deactivated_at: string | null
          email: string
          is_active: boolean
          name: string
          profile_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }[]
      }
      is_platform_owner: {
        Args: {
          _user_id: string
        }
        Returns: boolean
      }
      platform_delete_account: {
        Args: {
          p_user_id: string
        }
        Returns: undefined
      }
      platform_set_account_status: {
        Args: {
          p_is_active: boolean
          p_reason?: string | null
          p_user_id: string
        }
        Returns: undefined
      }
      record_sale: {
        Args: {
          p_items?: Json
          p_patient_id?: string | null
          p_recorded_at?: string | null
        }
        Returns: {
          created_at: string
          date: string
          discount_amount: number
          discount_percentage: number
          drug_id: string | null
          id: string
          patient_id: string | null
          quantity: number
          sale_day: string
          sale_month: number
          sale_week_start: string
          sale_year: number
          total_cost: number
          unit_buying_price: number
          unit_list_price: number
          unit_selling_price: number
          user_id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "staff"
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
      app_role: ["admin", "staff"],
    },
  },
} as const
