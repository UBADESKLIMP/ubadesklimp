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
      keep_alive_log: {
        Row: {
          id: number
          pinged_at: string
        }
        Insert: {
          id?: never
          pinged_at?: string
        }
        Update: {
          id?: never
          pinged_at?: string
        }
        Relationships: []
      }
      missing_products: {
        Row: {
          created_at: string
          fragrance_id: string | null
          id: string
          product_id: string
          report_count: number
          reported_by: string | null
          reported_by_name: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          stock_remaining: number | null
          updated_at: string
          variation_id: string | null
        }
        Insert: {
          created_at?: string
          fragrance_id?: string | null
          id?: string
          product_id: string
          report_count?: number
          reported_by?: string | null
          reported_by_name: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          stock_remaining?: number | null
          updated_at?: string
          variation_id?: string | null
        }
        Update: {
          created_at?: string
          fragrance_id?: string | null
          id?: string
          product_id?: string
          report_count?: number
          reported_by?: string | null
          reported_by_name?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          stock_remaining?: number | null
          updated_at?: string
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "missing_products_fragrance_id_fkey"
            columns: ["fragrance_id"]
            isOneToOne: false
            referencedRelation: "product_fragrances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missing_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missing_products_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "missing_products_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "missing_products_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "product_variations"
            referencedColumns: ["id"]
          },
        ]
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
      quote_batch_items: {
        Row: {
          created_at: string
          id: string
          missing_product_id: string
          quantity: number
          quote_batch_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          missing_product_id: string
          quantity?: number
          quote_batch_id: string
        }
        Update: {
          created_at?: string
          id?: string
          missing_product_id?: string
          quantity?: number
          quote_batch_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_batch_items_missing_product_id_fkey"
            columns: ["missing_product_id"]
            isOneToOne: false
            referencedRelation: "missing_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_batch_items_quote_batch_id_fkey"
            columns: ["quote_batch_id"]
            isOneToOne: false
            referencedRelation: "quote_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_batch_suppliers: {
        Row: {
          created_at: string
          id: string
          quote_batch_id: string
          status: string
          supplier_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          quote_batch_id: string
          status?: string
          supplier_id: string
        }
        Update: {
          created_at?: string
          id?: string
          quote_batch_id?: string
          status?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_batch_suppliers_quote_batch_id_fkey"
            columns: ["quote_batch_id"]
            isOneToOne: false
            referencedRelation: "quote_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_batch_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_batches: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          completed_by_name: string | null
          created_at: string
          created_by: string | null
          created_by_name: string
          id: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          completed_by_name?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name: string
          id?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          completed_by_name?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_batches_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "quote_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
        ]
      }
      quote_files: {
        Row: {
          created_at: string
          id: string
          processed_at: string | null
          quote_batch_supplier_id: string
          storage_path: string
          uploaded_by: string | null
          uploaded_by_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          processed_at?: string | null
          quote_batch_supplier_id: string
          storage_path: string
          uploaded_by?: string | null
          uploaded_by_name: string
        }
        Update: {
          created_at?: string
          id?: string
          processed_at?: string | null
          quote_batch_supplier_id?: string
          storage_path?: string
          uploaded_by?: string | null
          uploaded_by_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_files_quote_batch_supplier_id_fkey"
            columns: ["quote_batch_supplier_id"]
            isOneToOne: false
            referencedRelation: "quote_batch_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
        ]
      }
      quote_item_winners: {
        Row: {
          id: string
          quote_batch_item_id: string
          quote_batch_supplier_id: string
          set_at: string
          set_by: string | null
          set_by_name: string
          source: string
        }
        Insert: {
          id?: string
          quote_batch_item_id: string
          quote_batch_supplier_id: string
          set_at?: string
          set_by?: string | null
          set_by_name: string
          source: string
        }
        Update: {
          id?: string
          quote_batch_item_id?: string
          quote_batch_supplier_id?: string
          set_at?: string
          set_by?: string | null
          set_by_name?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_item_winners_quote_batch_item_id_fkey"
            columns: ["quote_batch_item_id"]
            isOneToOne: true
            referencedRelation: "quote_batch_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_item_winners_quote_batch_supplier_id_fkey"
            columns: ["quote_batch_supplier_id"]
            isOneToOne: false
            referencedRelation: "quote_batch_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_item_winners_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
        ]
      }
      quote_line_items: {
        Row: {
          id: string
          price: number | null
          quote_batch_item_id: string
          quote_batch_supplier_id: string
          updated_at: string
          updated_by: string | null
          updated_by_name: string
        }
        Insert: {
          id?: string
          price?: number | null
          quote_batch_item_id: string
          quote_batch_supplier_id: string
          updated_at?: string
          updated_by?: string | null
          updated_by_name?: string
        }
        Update: {
          id?: string
          price?: number | null
          quote_batch_item_id?: string
          quote_batch_supplier_id?: string
          updated_at?: string
          updated_by?: string | null
          updated_by_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_line_items_quote_batch_item_id_fkey"
            columns: ["quote_batch_item_id"]
            isOneToOne: false
            referencedRelation: "quote_batch_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_items_quote_batch_supplier_id_fkey"
            columns: ["quote_batch_supplier_id"]
            isOneToOne: false
            referencedRelation: "quote_batch_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
        ]
      }
      staff_members: {
        Row: {
          created_at: string
          display_name: string
          is_admin: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          is_admin?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          is_admin?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      staff_permissions: {
        Row: {
          permission: Database["public"]["Enums"]["staff_permission"]
          user_id: string
        }
        Insert: {
          permission: Database["public"]["Enums"]["staff_permission"]
          user_id: string
        }
        Update: {
          permission?: Database["public"]["Enums"]["staff_permission"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
        ]
      }
      suppliers: {
        Row: {
          avg_delivery_days: number | null
          company_name: string
          contact_name: string
          created_at: string
          email: string | null
          id: string
          max_installments: number | null
          notes: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          avg_delivery_days?: number | null
          company_name: string
          contact_name: string
          created_at?: string
          email?: string | null
          id?: string
          max_installments?: number | null
          notes?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          avg_delivery_days?: number | null
          company_name?: string
          contact_name?: string
          created_at?: string
          email?: string | null
          id?: string
          max_installments?: number | null
          notes?: string | null
          phone?: string
          updated_at?: string
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
      has_staff_permission: {
        Args: { perm: Database["public"]["Enums"]["staff_permission"] }
        Returns: boolean
      }
      is_staff_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      staff_permission: "faltantes" | "produtos" | "fornecedores" | "financeiro"
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
      staff_permission: ["faltantes", "produtos", "fornecedores", "financeiro"],
    },
  },
} as const
