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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      image_urls_backup: {
        Row: {
          created_at: string | null
          id: string
          image_url: string
          source_id: string
          source_table: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url: string
          source_id: string
          source_table: string
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string
          source_id?: string
          source_table?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string
          id: string
          items: Json
          notes: string | null
          status: string | null
          total_amount: number
          updated_at: string
          user_id: string | null
          whatsapp_sent_at: string | null
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone: string
          id?: string
          items: Json
          notes?: string | null
          status?: string | null
          total_amount: number
          updated_at?: string
          user_id?: string | null
          whatsapp_sent_at?: string | null
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string
          id?: string
          items?: Json
          notes?: string | null
          status?: string | null
          total_amount?: number
          updated_at?: string
          user_id?: string | null
          whatsapp_sent_at?: string | null
        }
        Relationships: []
      }
      product_fragrances: {
        Row: {
          available_literages: string[] | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          order_index: number | null
          product_id: string
          updated_at: string
        }
        Insert: {
          available_literages?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          order_index?: number | null
          product_id: string
          updated_at?: string
        }
        Update: {
          available_literages?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          order_index?: number | null
          product_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_variations: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_primary: boolean | null
          literage: string
          price: number
          product_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_primary?: boolean | null
          literage: string
          price: number
          product_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_primary?: boolean | null
          literage?: string
          price?: number
          product_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          action_type: string | null
          application_area: string | null
          brand: string | null
          category: string
          created_at: string
          description: string | null
          display_order: number | null
          has_fragrances: boolean | null
          has_variations: boolean | null
          highlight_type: string | null
          id: string
          image_url: string | null
          line_type: string | null
          literage_single: string | null
          material: string | null
          name: string
          out_of_stock: boolean | null
          ph_level: string | null
          price: number
          price_position: string | null
          priority: boolean
          priority_order: number | null
          size_unit: string | null
          specifications: string | null
          updated_at: string
          validity: string | null
        }
        Insert: {
          action_type?: string | null
          application_area?: string | null
          brand?: string | null
          category: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          has_fragrances?: boolean | null
          has_variations?: boolean | null
          highlight_type?: string | null
          id?: string
          image_url?: string | null
          line_type?: string | null
          literage_single?: string | null
          material?: string | null
          name: string
          out_of_stock?: boolean | null
          ph_level?: string | null
          price: number
          price_position?: string | null
          priority?: boolean
          priority_order?: number | null
          size_unit?: string | null
          specifications?: string | null
          updated_at?: string
          validity?: string | null
        }
        Update: {
          action_type?: string | null
          application_area?: string | null
          brand?: string | null
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          has_fragrances?: boolean | null
          has_variations?: boolean | null
          highlight_type?: string | null
          id?: string
          image_url?: string | null
          line_type?: string | null
          literage_single?: string | null
          material?: string | null
          name?: string
          out_of_stock?: boolean | null
          ph_level?: string | null
          price?: number
          price_position?: string | null
          priority?: boolean
          priority_order?: number | null
          size_unit?: string | null
          specifications?: string | null
          updated_at?: string
          validity?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          billing_email: string | null
          cnpj: string | null
          company_name: string | null
          contact_phone: string | null
          cpf: string | null
          created_at: string
          delivery_address: string | null
          email: string | null
          id: string
          name: string | null
          notes: string | null
          person_type: string | null
          phone: string | null
          state_registration: string | null
          trade_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_email?: string | null
          cnpj?: string | null
          company_name?: string | null
          contact_phone?: string | null
          cpf?: string | null
          created_at?: string
          delivery_address?: string | null
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          person_type?: string | null
          phone?: string | null
          state_registration?: string | null
          trade_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_email?: string | null
          cnpj?: string | null
          company_name?: string | null
          contact_phone?: string | null
          cpf?: string | null
          created_at?: string
          delivery_address?: string | null
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          person_type?: string | null
          phone?: string | null
          state_registration?: string | null
          trade_name?: string | null
          updated_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
