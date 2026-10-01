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
      empresas: {
        Row: {
          ativo: boolean
          cnpj: string
          created_at: string
          id: string
          razao_social: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj: string
          created_at?: string
          id?: string
          razao_social: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string
          created_at?: string
          id?: string
          razao_social?: string
          updated_at?: string
        }
        Relationships: []
      }
      equipe_aberturas: {
        Row: {
          created_at: string
          data: string
          empresa_id: string
          hora_abertura: string
          motivo: string | null
          registrado_por: string
        }
        Insert: {
          created_at?: string
          data: string
          empresa_id: string
          hora_abertura: string
          motivo?: string | null
          registrado_por: string
        }
        Update: {
          created_at?: string
          data?: string
          empresa_id?: string
          hora_abertura?: string
          motivo?: string | null
          registrado_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipe_aberturas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_aberturas_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "equipe_funcionarios_gestor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "equipe_aberturas_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
        ]
      }
      equipe_atrasos: {
        Row: {
          colaborador_id: string
          created_at: string
          criado_por: string
          data: string
          dentro_tolerancia: boolean | null
          desvio_saida_almoco_min: number | null
          duracao_almoco_override_min: number | null
          empresa_id: string
          estava_na_porta: boolean
          hora_chegada: string
          hora_chegada_porta: string | null
          horario_previsto: string | null
          horario_referencia: string | null
          id: string
          justificativa_ponto_id: string | null
          marcacao: Database["public"]["Enums"]["equipe_marcacao"]
          minutos_atraso: number | null
          saida_almoco_real: string | null
          status: Database["public"]["Enums"]["equipe_atraso_status"]
          substitui_id: string | null
          updated_at: string
          variacao_bruta_min: number | null
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          criado_por: string
          data: string
          dentro_tolerancia?: boolean | null
          desvio_saida_almoco_min?: number | null
          duracao_almoco_override_min?: number | null
          empresa_id: string
          estava_na_porta?: boolean
          hora_chegada: string
          hora_chegada_porta?: string | null
          horario_previsto?: string | null
          horario_referencia?: string | null
          id?: string
          justificativa_ponto_id?: string | null
          marcacao: Database["public"]["Enums"]["equipe_marcacao"]
          minutos_atraso?: number | null
          saida_almoco_real?: string | null
          status?: Database["public"]["Enums"]["equipe_atraso_status"]
          substitui_id?: string | null
          updated_at?: string
          variacao_bruta_min?: number | null
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          criado_por?: string
          data?: string
          dentro_tolerancia?: boolean | null
          desvio_saida_almoco_min?: number | null
          duracao_almoco_override_min?: number | null
          empresa_id?: string
          estava_na_porta?: boolean
          hora_chegada?: string
          hora_chegada_porta?: string | null
          horario_previsto?: string | null
          horario_referencia?: string | null
          id?: string
          justificativa_ponto_id?: string | null
          marcacao?: Database["public"]["Enums"]["equipe_marcacao"]
          minutos_atraso?: number | null
          saida_almoco_real?: string | null
          status?: Database["public"]["Enums"]["equipe_atraso_status"]
          substitui_id?: string | null
          updated_at?: string
          variacao_bruta_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equipe_atrasos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "equipe_funcionarios_gestor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "equipe_atrasos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "equipe_atrasos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "equipe_funcionarios_gestor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "equipe_atrasos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "equipe_atrasos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_atrasos_substitui_id_fkey"
            columns: ["substitui_id"]
            isOneToOne: false
            referencedRelation: "equipe_atrasos"
            referencedColumns: ["id"]
          },
        ]
      }
      equipe_audit_log: {
        Row: {
          acao: string
          created_at: string
          dados_antes: Json | null
          dados_depois: Json | null
          id: string
          registro_id: string
          tabela: string
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          id?: string
          registro_id: string
          tabela: string
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          id?: string
          registro_id?: string
          tabela?: string
          user_id?: string | null
        }
        Relationships: []
      }
      equipe_ciencias: {
        Row: {
          acao: Database["public"]["Enums"]["equipe_ciencia_acao"]
          alvo_id: string
          alvo_tipo: Database["public"]["Enums"]["equipe_ciencia_alvo"]
          assinatura_path: string | null
          colaborador_id: string
          id: string
          ip: unknown
          justificativa: string | null
          payload_hash: string
          signed_at: string
          testemunha_1: string | null
          testemunha_2: string | null
          user_agent: string | null
        }
        Insert: {
          acao: Database["public"]["Enums"]["equipe_ciencia_acao"]
          alvo_id: string
          alvo_tipo: Database["public"]["Enums"]["equipe_ciencia_alvo"]
          assinatura_path?: string | null
          colaborador_id: string
          id?: string
          ip?: unknown
          justificativa?: string | null
          payload_hash: string
          signed_at?: string
          testemunha_1?: string | null
          testemunha_2?: string | null
          user_agent?: string | null
        }
        Update: {
          acao?: Database["public"]["Enums"]["equipe_ciencia_acao"]
          alvo_id?: string
          alvo_tipo?: Database["public"]["Enums"]["equipe_ciencia_alvo"]
          assinatura_path?: string | null
          colaborador_id?: string
          id?: string
          ip?: unknown
          justificativa?: string | null
          payload_hash?: string
          signed_at?: string
          testemunha_1?: string | null
          testemunha_2?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipe_ciencias_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "equipe_funcionarios_gestor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "equipe_ciencias_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
        ]
      }
      equipe_config: {
        Row: {
          chave: string
          empresa_id: string
          updated_at: string
          valor: Json
        }
        Insert: {
          chave: string
          empresa_id: string
          updated_at?: string
          valor: Json
        }
        Update: {
          chave?: string
          empresa_id?: string
          updated_at?: string
          valor?: Json
        }
        Relationships: [
          {
            foreignKeyName: "equipe_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      equipe_escalas: {
        Row: {
          ativo: boolean
          created_at: string
          dias_semana: number[]
          empresa_id: string
          entrada: string
          id: string
          nome: string
          saida: string
          tol_dia_min: number
          tol_marcacao_min: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dias_semana?: number[]
          empresa_id: string
          entrada?: string
          id?: string
          nome: string
          saida: string
          tol_dia_min?: number
          tol_marcacao_min?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dias_semana?: number[]
          empresa_id?: string
          entrada?: string
          id?: string
          nome?: string
          saida?: string
          tol_dia_min?: number
          tol_marcacao_min?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipe_escalas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      equipe_gestor_empresas: {
        Row: {
          empresa_id: string
          user_id: string
        }
        Insert: {
          empresa_id: string
          user_id: string
        }
        Update: {
          empresa_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipe_gestor_empresas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_gestor_empresas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "equipe_papeis"
            referencedColumns: ["user_id"]
          },
        ]
      }
      equipe_justificativas_atraso: {
        Row: {
          anexo_path: string | null
          atraso_id: string
          created_at: string
          decidido_em: string | null
          decidido_por: string | null
          decisao: Database["public"]["Enums"]["equipe_justificativa_decisao"]
          id: string
          motivo_decisao: string | null
          texto: string
        }
        Insert: {
          anexo_path?: string | null
          atraso_id: string
          created_at?: string
          decidido_em?: string | null
          decidido_por?: string | null
          decisao?: Database["public"]["Enums"]["equipe_justificativa_decisao"]
          id?: string
          motivo_decisao?: string | null
          texto: string
        }
        Update: {
          anexo_path?: string | null
          atraso_id?: string
          created_at?: string
          decidido_em?: string | null
          decidido_por?: string | null
          decisao?: Database["public"]["Enums"]["equipe_justificativa_decisao"]
          id?: string
          motivo_decisao?: string | null
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipe_justificativas_atraso_atraso_id_fkey"
            columns: ["atraso_id"]
            isOneToOne: false
            referencedRelation: "equipe_atrasos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_justificativas_atraso_decidido_por_fkey"
            columns: ["decidido_por"]
            isOneToOne: false
            referencedRelation: "equipe_funcionarios_gestor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "equipe_justificativas_atraso_decidido_por_fkey"
            columns: ["decidido_por"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
        ]
      }
      equipe_medida_atrasos: {
        Row: {
          atraso_id: string
          medida_id: string
        }
        Insert: {
          atraso_id: string
          medida_id: string
        }
        Update: {
          atraso_id?: string
          medida_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipe_medida_atrasos_atraso_id_fkey"
            columns: ["atraso_id"]
            isOneToOne: true
            referencedRelation: "equipe_atrasos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_medida_atrasos_medida_id_fkey"
            columns: ["medida_id"]
            isOneToOne: false
            referencedRelation: "equipe_medidas"
            referencedColumns: ["id"]
          },
        ]
      }
      equipe_medidas: {
        Row: {
          assinado_path: string | null
          colaborador_id: string
          created_at: string
          criado_por: string
          data_aplicacao: string
          dias_suspensao: number | null
          fundamento: string
          id: string
          pdf_path: string | null
          status: Database["public"]["Enums"]["equipe_medida_status"]
          tipo: Database["public"]["Enums"]["equipe_medida_tipo"]
        }
        Insert: {
          assinado_path?: string | null
          colaborador_id: string
          created_at?: string
          criado_por: string
          data_aplicacao?: string
          dias_suspensao?: number | null
          fundamento: string
          id?: string
          pdf_path?: string | null
          status?: Database["public"]["Enums"]["equipe_medida_status"]
          tipo: Database["public"]["Enums"]["equipe_medida_tipo"]
        }
        Update: {
          assinado_path?: string | null
          colaborador_id?: string
          created_at?: string
          criado_por?: string
          data_aplicacao?: string
          dias_suspensao?: number | null
          fundamento?: string
          id?: string
          pdf_path?: string | null
          status?: Database["public"]["Enums"]["equipe_medida_status"]
          tipo?: Database["public"]["Enums"]["equipe_medida_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "equipe_medidas_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "equipe_funcionarios_gestor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "equipe_medidas_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "equipe_medidas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "equipe_funcionarios_gestor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "equipe_medidas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
        ]
      }
      equipe_papeis: {
        Row: {
          created_at: string
          papel: Database["public"]["Enums"]["equipe_papel"]
          user_id: string
        }
        Insert: {
          created_at?: string
          papel: Database["public"]["Enums"]["equipe_papel"]
          user_id: string
        }
        Update: {
          created_at?: string
          papel?: Database["public"]["Enums"]["equipe_papel"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipe_papeis_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "equipe_funcionarios_gestor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "equipe_papeis_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
        ]
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
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          fragrance_id: string | null
          id: string
          order_quantity: number | null
          order_sent_at: string | null
          order_sent_by: string | null
          order_supplier_name: string | null
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
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          fragrance_id?: string | null
          id?: string
          order_quantity?: number | null
          order_sent_at?: string | null
          order_sent_by?: string | null
          order_supplier_name?: string | null
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
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          fragrance_id?: string | null
          id?: string
          order_quantity?: number | null
          order_sent_at?: string | null
          order_sent_by?: string | null
          order_supplier_name?: string | null
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
            foreignKeyName: "missing_products_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "equipe_funcionarios_gestor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "missing_products_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "missing_products_fragrance_id_fkey"
            columns: ["fragrance_id"]
            isOneToOne: false
            referencedRelation: "product_fragrances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missing_products_order_sent_by_fkey"
            columns: ["order_sent_by"]
            isOneToOne: false
            referencedRelation: "equipe_funcionarios_gestor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "missing_products_order_sent_by_fkey"
            columns: ["order_sent_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
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
            referencedRelation: "equipe_funcionarios_gestor"
            referencedColumns: ["user_id"]
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
            referencedRelation: "equipe_funcionarios_gestor"
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
          is_public: boolean
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
          purchase_max_quantity: string | null
          purchase_min_quantity: string | null
          purchase_notes: string | null
          size_unit: string | null
          slug: string
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
          is_public?: boolean
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
          purchase_max_quantity?: string | null
          purchase_min_quantity?: string | null
          purchase_notes?: string | null
          size_unit?: string | null
          slug: string
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
          is_public?: boolean
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
          purchase_max_quantity?: string | null
          purchase_min_quantity?: string | null
          purchase_notes?: string | null
          size_unit?: string | null
          slug?: string
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
          quantity: number | null
          quote_batch_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          missing_product_id: string
          quantity?: number | null
          quote_batch_id: string
        }
        Update: {
          created_at?: string
          id?: string
          missing_product_id?: string
          quantity?: number | null
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
          order_generated_at: string | null
          order_generated_by: string | null
          order_generated_by_name: string | null
          quote_batch_id: string
          status: string
          supplier_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_generated_at?: string | null
          order_generated_by?: string | null
          order_generated_by_name?: string | null
          quote_batch_id: string
          status?: string
          supplier_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_generated_at?: string | null
          order_generated_by?: string | null
          order_generated_by_name?: string | null
          quote_batch_id?: string
          status?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_batch_suppliers_order_generated_by_fkey"
            columns: ["order_generated_by"]
            isOneToOne: false
            referencedRelation: "equipe_funcionarios_gestor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "quote_batch_suppliers_order_generated_by_fkey"
            columns: ["order_generated_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
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
            referencedRelation: "equipe_funcionarios_gestor"
            referencedColumns: ["user_id"]
          },
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
            referencedRelation: "equipe_funcionarios_gestor"
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
            referencedRelation: "equipe_funcionarios_gestor"
            referencedColumns: ["user_id"]
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
            referencedRelation: "equipe_funcionarios_gestor"
            referencedColumns: ["user_id"]
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
          corrected_at: string | null
          excluded_at: string | null
          excluded_by: string | null
          excluded_by_name: string | null
          id: string
          notes: string | null
          price: number | null
          quote_batch_item_id: string
          quote_batch_supplier_id: string
          updated_at: string
          updated_by: string | null
          updated_by_name: string
        }
        Insert: {
          corrected_at?: string | null
          excluded_at?: string | null
          excluded_by?: string | null
          excluded_by_name?: string | null
          id?: string
          notes?: string | null
          price?: number | null
          quote_batch_item_id: string
          quote_batch_supplier_id: string
          updated_at?: string
          updated_by?: string | null
          updated_by_name?: string
        }
        Update: {
          corrected_at?: string | null
          excluded_at?: string | null
          excluded_by?: string | null
          excluded_by_name?: string | null
          id?: string
          notes?: string | null
          price?: number | null
          quote_batch_item_id?: string
          quote_batch_supplier_id?: string
          updated_at?: string
          updated_by?: string | null
          updated_by_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_line_items_excluded_by_fkey"
            columns: ["excluded_by"]
            isOneToOne: false
            referencedRelation: "equipe_funcionarios_gestor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "quote_line_items_excluded_by_fkey"
            columns: ["excluded_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
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
            referencedRelation: "equipe_funcionarios_gestor"
            referencedColumns: ["user_id"]
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
          almoco_previsto: string | null
          bloqueado_em: string | null
          created_at: string
          display_name: string
          duracao_almoco_min: number
          empresa_id: string | null
          escala_id: string | null
          is_admin: boolean
          tentativas_login: number
          termo_adesao_path: string | null
          termo_assinado_em: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          almoco_previsto?: string | null
          bloqueado_em?: string | null
          created_at?: string
          display_name: string
          duracao_almoco_min?: number
          empresa_id?: string | null
          escala_id?: string | null
          is_admin?: boolean
          tentativas_login?: number
          termo_adesao_path?: string | null
          termo_assinado_em?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          almoco_previsto?: string | null
          bloqueado_em?: string | null
          created_at?: string
          display_name?: string
          duracao_almoco_min?: number
          empresa_id?: string | null
          escala_id?: string | null
          is_admin?: boolean
          tentativas_login?: number
          termo_adesao_path?: string | null
          termo_assinado_em?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_members_escala_id_fkey"
            columns: ["escala_id"]
            isOneToOne: false
            referencedRelation: "equipe_escalas"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "equipe_funcionarios_gestor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "staff_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
        ]
      }
      supplier_exclusive_brands: {
        Row: {
          brand: string
          created_at: string
          id: string
          supplier_id: string
        }
        Insert: {
          brand: string
          created_at?: string
          id?: string
          supplier_id: string
        }
        Update: {
          brand?: string
          created_at?: string
          id?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_exclusive_brands_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
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
      equipe_funcionarios_gestor: {
        Row: {
          almoco_previsto: string | null
          display_name: string | null
          duracao_almoco_min: number | null
          empresa_id: string | null
          escala_id: string | null
          termo_adesao_enviado: boolean | null
          termo_assinado_em: string | null
          user_id: string | null
        }
        Insert: {
          almoco_previsto?: string | null
          display_name?: string | null
          duracao_almoco_min?: number | null
          empresa_id?: string | null
          escala_id?: string | null
          termo_adesao_enviado?: never
          termo_assinado_em?: string | null
          user_id?: string | null
        }
        Update: {
          almoco_previsto?: string | null
          display_name?: string | null
          duracao_almoco_min?: number | null
          empresa_id?: string | null
          escala_id?: string | null
          termo_adesao_enviado?: never
          termo_assinado_em?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_members_escala_id_fkey"
            columns: ["escala_id"]
            isOneToOne: false
            referencedRelation: "equipe_escalas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      equipe_calcular_atraso: {
        Args: {
          p_colaborador_id: string
          p_data: string
          p_duracao_almoco_override_min?: number
          p_empresa_id: string
          p_estava_na_porta?: boolean
          p_hora_chegada: string
          p_hora_chegada_porta?: string
          p_marcacao: Database["public"]["Enums"]["equipe_marcacao"]
          p_saida_almoco_real?: string
        }
        Returns: {
          abertura_atrasada: boolean
          dentro_tolerancia: boolean
          desvio_saida_almoco_min: number
          horario_previsto: string
          horario_referencia: string
          minutos_atraso: number
          soma_dia_min: number
          variacao_bruta_min: number
        }[]
      }
      equipe_checar_login: { Args: { p_user_id: string }; Returns: boolean }
      equipe_contagem_funcionarios: {
        Args: { p_empresa_id: string }
        Returns: number
      }
      equipe_contar_atrasos_mes: {
        Args: { p_colaborador_id: string; p_referencia: string }
        Returns: number
      }
      equipe_dados_advertencia: { Args: { p_medida_id: string }; Returns: Json }
      equipe_decidir_justificativa: {
        Args: {
          p_decisao: Database["public"]["Enums"]["equipe_justificativa_decisao"]
          p_justificativa_id: string
          p_motivo?: string
        }
        Returns: undefined
      }
      equipe_empresas_visiveis: { Args: never; Returns: string[] }
      equipe_recalcular_tolerancia_dia: {
        Args: { p_colaborador_id: string; p_data: string }
        Returns: undefined
      }
      equipe_registrar_assinatura_medida: {
        Args: { p_assinado_path: string; p_medida_id: string }
        Returns: undefined
      }
      equipe_registrar_ciencia: {
        Args: {
          p_acao: Database["public"]["Enums"]["equipe_ciencia_acao"]
          p_alvo_id: string
          p_alvo_tipo: Database["public"]["Enums"]["equipe_ciencia_alvo"]
          p_justificativa?: string
          p_testemunha_1?: string
          p_testemunha_2?: string
        }
        Returns: string
      }
      equipe_registrar_tentativa_login: {
        Args: { p_sucesso: boolean; p_user_id: string }
        Returns: undefined
      }
      equipe_relatorio_mensal: {
        Args: { p_competencia: string; p_empresa_id: string }
        Returns: {
          colaborador: string
          colaborador_id: string
          medidas_no_mes: number
          minutos_compensados: number
          minutos_desconto: number
          ocorrencias: number
          ocorrencias_abonadas: number
          ocorrencias_compensadas: number
          ocorrencias_na_tolerancia: number
        }[]
      }
      equipe_sugerir_medida: {
        Args: { p_colaborador_id: string; p_referencia: string }
        Returns: Database["public"]["Enums"]["equipe_medida_tipo"]
      }
      generate_product_slug: { Args: { product_name: string }; Returns: string }
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
      immutable_unaccent: { Args: { "": string }; Returns: string }
      is_equipe_admin: { Args: never; Returns: boolean }
      is_equipe_gestor_ou_admin: { Args: never; Returns: boolean }
      is_staff_admin: { Args: never; Returns: boolean }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      equipe_atraso_status:
        | "pendente_ciencia"
        | "ciente"
        | "sem_ciencia"
        | "justificativa_pendente"
        | "abonado"
        | "compensado"
        | "substituido"
      equipe_ciencia_acao: "ciente" | "recusa"
      equipe_ciencia_alvo: "atraso" | "medida" | "fechamento"
      equipe_justificativa_decisao: "pendente" | "abonado" | "rejeitado"
      equipe_marcacao: "entrada" | "retorno_almoco"
      equipe_medida_status:
        | "rascunho"
        | "aguardando_assinatura"
        | "aplicada"
        | "recusada"
      equipe_medida_tipo:
        | "orientacao_verbal"
        | "orientacao_verbal_coletiva"
        | "advertencia_escrita"
        | "suspensao"
      equipe_papel: "admin" | "gestor" | "colaborador"
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
      app_role: ["admin", "moderator", "user"],
      equipe_atraso_status: [
        "pendente_ciencia",
        "ciente",
        "sem_ciencia",
        "justificativa_pendente",
        "abonado",
        "compensado",
        "substituido",
      ],
      equipe_ciencia_acao: ["ciente", "recusa"],
      equipe_ciencia_alvo: ["atraso", "medida", "fechamento"],
      equipe_justificativa_decisao: ["pendente", "abonado", "rejeitado"],
      equipe_marcacao: ["entrada", "retorno_almoco"],
      equipe_medida_status: [
        "rascunho",
        "aguardando_assinatura",
        "aplicada",
        "recusada",
      ],
      equipe_medida_tipo: [
        "orientacao_verbal",
        "orientacao_verbal_coletiva",
        "advertencia_escrita",
        "suspensao",
      ],
      equipe_papel: ["admin", "gestor", "colaborador"],
      staff_permission: ["faltantes", "produtos", "fornecedores", "financeiro"],
    },
  },
} as const
