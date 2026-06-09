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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: unknown
          new_data: Json | null
          oficina_id: string
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          oficina_id: string
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          oficina_id?: string
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_reactivation: {
        Row: {
          created_at: string | null
          dia_sequencia: number
          dias_desde_cadastro: number | null
          email: string
          email_d2_enviado: boolean | null
          id: string
          nome: string | null
          segmento: string
          telefone: string | null
          trial_estendido: boolean | null
          updated_at: string | null
          whatsapp_d1_enviado: boolean | null
          whatsapp_d3_enviado: boolean | null
        }
        Insert: {
          created_at?: string | null
          dia_sequencia?: number
          dias_desde_cadastro?: number | null
          email: string
          email_d2_enviado?: boolean | null
          id?: string
          nome?: string | null
          segmento: string
          telefone?: string | null
          trial_estendido?: boolean | null
          updated_at?: string | null
          whatsapp_d1_enviado?: boolean | null
          whatsapp_d3_enviado?: boolean | null
        }
        Update: {
          created_at?: string | null
          dia_sequencia?: number
          dias_desde_cadastro?: number | null
          email?: string
          email_d2_enviado?: boolean | null
          id?: string
          nome?: string | null
          segmento?: string
          telefone?: string | null
          trial_estendido?: boolean | null
          updated_at?: string | null
          whatsapp_d1_enviado?: boolean | null
          whatsapp_d3_enviado?: boolean | null
        }
        Relationships: []
      }
      catalogo_servicos: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          oficina_id: string
          tempo_estimado_minutos: number | null
          tipo_veiculo: string | null
          updated_at: string | null
          valor_mao_obra: number
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          oficina_id: string
          tempo_estimado_minutos?: number | null
          tipo_veiculo?: string | null
          updated_at?: string | null
          valor_mao_obra?: number
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          oficina_id?: string
          tempo_estimado_minutos?: number | null
          tipo_veiculo?: string | null
          updated_at?: string | null
          valor_mao_obra?: number
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_servicos_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_financeiras: {
        Row: {
          ativo: boolean | null
          cor: string | null
          created_at: string | null
          icone: string | null
          id: string
          nome: string
          oficina_id: string
          padrao: boolean | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          icone?: string | null
          id?: string
          nome: string
          oficina_id: string
          padrao?: boolean | null
          tipo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          icone?: string | null
          id?: string
          nome?: string
          oficina_id?: string
          padrao?: boolean | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categorias_financeiras_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
        ]
      }
      centros_custo: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          oficina_id: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          oficina_id: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          oficina_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "centros_custo_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          oficina_id: string
          portal_token: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          oficina_id: string
          portal_token?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          oficina_id?: string
          portal_token?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
        ]
      }
      comissoes_funcionarios: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          oficina_id: string
          percentual: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          oficina_id: string
          percentual?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          oficina_id?: string
          percentual?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_funcionarios_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_emails: {
        Row: {
          context_data: Json | null
          created_at: string
          email: string
          id: string
          oficina_id: string
          sent_at: string
          trigger_type: string
          user_id: string
        }
        Insert: {
          context_data?: Json | null
          created_at?: string
          email: string
          id?: string
          oficina_id: string
          sent_at?: string
          trigger_type: string
          user_id: string
        }
        Update: {
          context_data?: Json | null
          created_at?: string
          email?: string
          id?: string
          oficina_id?: string
          sent_at?: string
          trigger_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_emails_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque: {
        Row: {
          alerta_minimo: number | null
          arquivado: boolean
          arquivado_em: string | null
          categoria: string
          codigo: string | null
          created_at: string
          custo_unitario: number | null
          fornecedor_email: string | null
          fornecedor_nome: string | null
          fornecedor_telefone: string | null
          id: string
          localizacao: string | null
          ncm: string | null
          nome: string
          oficina_id: string
          preco_venda: number | null
          quantidade: number
          tipo_item: string | null
          tipo_veiculo: string | null
          ultima_entrada: string | null
          ultima_saida: string | null
          updated_at: string
        }
        Insert: {
          alerta_minimo?: number | null
          arquivado?: boolean
          arquivado_em?: string | null
          categoria: string
          codigo?: string | null
          created_at?: string
          custo_unitario?: number | null
          fornecedor_email?: string | null
          fornecedor_nome?: string | null
          fornecedor_telefone?: string | null
          id?: string
          localizacao?: string | null
          ncm?: string | null
          nome: string
          oficina_id: string
          preco_venda?: number | null
          quantidade?: number
          tipo_item?: string | null
          tipo_veiculo?: string | null
          ultima_entrada?: string | null
          ultima_saida?: string | null
          updated_at?: string
        }
        Update: {
          alerta_minimo?: number | null
          arquivado?: boolean
          arquivado_em?: string | null
          categoria?: string
          codigo?: string | null
          created_at?: string
          custo_unitario?: number | null
          fornecedor_email?: string | null
          fornecedor_nome?: string | null
          fornecedor_telefone?: string | null
          id?: string
          localizacao?: string | null
          ncm?: string | null
          nome?: string
          oficina_id?: string
          preco_venda?: number | null
          quantidade?: number
          tipo_item?: string | null
          tipo_veiculo?: string | null
          ultima_entrada?: string | null
          ultima_saida?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_movimentacoes: {
        Row: {
          created_at: string
          custo_unitario: number | null
          estoque_id: string
          id: string
          motivo: string | null
          oficina_id: string
          quantidade: number
          quantidade_anterior: number
          quantidade_nova: number
          referencia_id: string | null
          referencia_tipo: string | null
          tipo: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          custo_unitario?: number | null
          estoque_id: string
          id?: string
          motivo?: string | null
          oficina_id: string
          quantidade: number
          quantidade_anterior: number
          quantidade_nova: number
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          custo_unitario?: number | null
          estoque_id?: string
          id?: string
          motivo?: string | null
          oficina_id?: string
          quantidade?: number
          quantidade_anterior?: number
          quantidade_nova?: number
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_movimentacoes_estoque_id_fkey"
            columns: ["estoque_id"]
            isOneToOne: false
            referencedRelation: "estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro: {
        Row: {
          categoria: string
          categoria_id: string | null
          centro_custo_id: string | null
          classificacao:
            | Database["public"]["Enums"]["classificacao_financeira"]
            | null
          comprovante_url: string | null
          created_at: string
          data: string
          data_competencia: string | null
          data_pagamento: string | null
          descricao: string | null
          forma_pagamento_id: string | null
          fornecedor_id: string | null
          id: string
          numero_documento: string | null
          observacoes_contador: string | null
          oficina_id: string
          ordem_servico_id: string | null
          origem: string
          recorrencia_tipo: string | null
          recorrente: boolean | null
          status: Database["public"]["Enums"]["status_pagamento"] | null
          tipo: string
          updated_at: string | null
          valor: number
          valor_mao_obra: number | null
          valor_pecas: number | null
          venda_balcao_id: string | null
        }
        Insert: {
          categoria?: string
          categoria_id?: string | null
          centro_custo_id?: string | null
          classificacao?:
            | Database["public"]["Enums"]["classificacao_financeira"]
            | null
          comprovante_url?: string | null
          created_at?: string
          data?: string
          data_competencia?: string | null
          data_pagamento?: string | null
          descricao?: string | null
          forma_pagamento_id?: string | null
          fornecedor_id?: string | null
          id?: string
          numero_documento?: string | null
          observacoes_contador?: string | null
          oficina_id: string
          ordem_servico_id?: string | null
          origem: string
          recorrencia_tipo?: string | null
          recorrente?: boolean | null
          status?: Database["public"]["Enums"]["status_pagamento"] | null
          tipo: string
          updated_at?: string | null
          valor: number
          valor_mao_obra?: number | null
          valor_pecas?: number | null
          venda_balcao_id?: string | null
        }
        Update: {
          categoria?: string
          categoria_id?: string | null
          centro_custo_id?: string | null
          classificacao?:
            | Database["public"]["Enums"]["classificacao_financeira"]
            | null
          comprovante_url?: string | null
          created_at?: string
          data?: string
          data_competencia?: string | null
          data_pagamento?: string | null
          descricao?: string | null
          forma_pagamento_id?: string | null
          fornecedor_id?: string | null
          id?: string
          numero_documento?: string | null
          observacoes_contador?: string | null
          oficina_id?: string
          ordem_servico_id?: string | null
          origem?: string
          recorrencia_tipo?: string | null
          recorrente?: boolean | null
          status?: Database["public"]["Enums"]["status_pagamento"] | null
          tipo?: string
          updated_at?: string | null
          valor?: number
          valor_mao_obra?: number | null
          valor_pecas?: number | null
          venda_balcao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_forma_pagamento_id_fkey"
            columns: ["forma_pagamento_id"]
            isOneToOne: false
            referencedRelation: "formas_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "v_auditoria_financeira_os"
            referencedColumns: ["os_id"]
          },
          {
            foreignKeyName: "financeiro_venda_balcao_id_fkey"
            columns: ["venda_balcao_id"]
            isOneToOne: false
            referencedRelation: "vendas_balcao"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_historico: {
        Row: {
          acao: string
          created_at: string | null
          dados_anteriores: Json | null
          dados_novos: Json | null
          financeiro_id: string
          id: string
          oficina_id: string
          user_id: string
        }
        Insert: {
          acao: string
          created_at?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          financeiro_id: string
          id?: string
          oficina_id: string
          user_id: string
        }
        Update: {
          acao?: string
          created_at?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          financeiro_id?: string
          id?: string
          oficina_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_historico_financeiro_id_fkey"
            columns: ["financeiro_id"]
            isOneToOne: false
            referencedRelation: "financeiro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_historico_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
        ]
      }
      formas_pagamento: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          dias_recebimento: number | null
          id: string
          nome: string
          oficina_id: string
          padrao: boolean | null
          taxa_percentual: number | null
          tipo: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          dias_recebimento?: number | null
          id?: string
          nome: string
          oficina_id: string
          padrao?: boolean | null
          taxa_percentual?: number | null
          tipo: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          dias_recebimento?: number | null
          id?: string
          nome?: string
          oficina_id?: string
          padrao?: boolean | null
          taxa_percentual?: number | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "formas_pagamento_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          ativo: boolean | null
          cnpj_cpf: string | null
          created_at: string | null
          email: string | null
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          oficina_id: string
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cnpj_cpf?: string | null
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          oficina_id: string
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cnpj_cpf?: string | null
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          oficina_id?: string
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_events: {
        Row: {
          created_at: string
          dedup_key: string
          event: string
          id: string
          metadata: Json | null
          oficina_id: string
          plan_type: string | null
          session_id: string | null
          source: string | null
          step: string | null
          trial_day: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          dedup_key?: string
          event: string
          id?: string
          metadata?: Json | null
          oficina_id: string
          plan_type?: string | null
          session_id?: string | null
          source?: string | null
          step?: string | null
          trial_day?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          dedup_key?: string
          event?: string
          id?: string
          metadata?: Json | null
          oficina_id?: string
          plan_type?: string | null
          session_id?: string | null
          source?: string | null
          step?: string | null
          trial_day?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_events_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_base_conhecimento: {
        Row: {
          conteudo: string
          created_at: string
          id: string
          oficina_id: string
          updated_at: string
        }
        Insert: {
          conteudo?: string
          created_at?: string
          id?: string
          oficina_id: string
          updated_at?: string
        }
        Update: {
          conteudo?: string
          created_at?: string
          id?: string
          oficina_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ia_base_conhecimento_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: true
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          action: string
          created_at: string | null
          expires_at: string
          id: string
          key: string
          oficina_id: string
          result: Json
        }
        Insert: {
          action: string
          created_at?: string | null
          expires_at: string
          id?: string
          key: string
          oficina_id: string
          result: Json
        }
        Update: {
          action?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          key?: string
          oficina_id?: string
          result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "idempotency_keys_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
        ]
      }
      itens_orcamento: {
        Row: {
          created_at: string
          custo_unitario: number | null
          estoque_id: string | null
          id: string
          nome_item: string
          orcamento_id: string
          quantidade: number
          tipo: string
          valor_mao_obra: number | null
          valor_total: number | null
          valor_unitario: number | null
        }
        Insert: {
          created_at?: string
          custo_unitario?: number | null
          estoque_id?: string | null
          id?: string
          nome_item: string
          orcamento_id: string
          quantidade?: number
          tipo?: string
          valor_mao_obra?: number | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Update: {
          created_at?: string
          custo_unitario?: number | null
          estoque_id?: string | null
          id?: string
          nome_item?: string
          orcamento_id?: string
          quantidade?: number
          tipo?: string
          valor_mao_obra?: number | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "itens_orcamento_estoque_id_fkey"
            columns: ["estoque_id"]
            isOneToOne: false
            referencedRelation: "estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_orcamento_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      itens_os: {
        Row: {
          created_at: string
          custo_unitario: number | null
          estoque_id: string | null
          id: string
          nome_item: string
          ordem_servico_id: string
          quantidade: number
          tipo: string
          valor_mao_obra: number | null
          valor_total: number | null
          valor_unitario: number | null
        }
        Insert: {
          created_at?: string
          custo_unitario?: number | null
          estoque_id?: string | null
          id?: string
          nome_item: string
          ordem_servico_id: string
          quantidade?: number
          tipo?: string
          valor_mao_obra?: number | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Update: {
          created_at?: string
          custo_unitario?: number | null
          estoque_id?: string | null
          id?: string
          nome_item?: string
          ordem_servico_id?: string
          quantidade?: number
          tipo?: string
          valor_mao_obra?: number | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "itens_os_estoque_id_fkey"
            columns: ["estoque_id"]
            isOneToOne: false
            referencedRelation: "estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_os_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_os_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "v_auditoria_financeira_os"
            referencedColumns: ["os_id"]
          },
        ]
      }
      itens_venda_balcao: {
        Row: {
          created_at: string
          custo_unitario: number | null
          estoque_id: string | null
          id: string
          nome_item: string
          quantidade: number
          valor_total: number | null
          valor_unitario: number
          venda_id: string
        }
        Insert: {
          created_at?: string
          custo_unitario?: number | null
          estoque_id?: string | null
          id?: string
          nome_item: string
          quantidade?: number
          valor_total?: number | null
          valor_unitario?: number
          venda_id: string
        }
        Update: {
          created_at?: string
          custo_unitario?: number | null
          estoque_id?: string | null
          id?: string
          nome_item?: string
          quantidade?: number
          valor_total?: number | null
          valor_unitario?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "itens_venda_balcao_estoque_id_fkey"
            columns: ["estoque_id"]
            isOneToOne: false
            referencedRelation: "estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_venda_balcao_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas_balcao"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_followups: {
        Row: {
          created_at: string
          email: string
          id: string
          nome: string | null
          sent_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          nome?: string | null
          sent_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nome?: string | null
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      log_backfill_custo_itens_os: {
        Row: {
          criterio_usado: string
          custo_anterior: number | null
          custo_novo: number
          estoque_id: string | null
          executado_em: string | null
          executado_por: string | null
          id: string
          impacto_total: number | null
          item_os_id: string
          lote_id: string
          observacao: string | null
          ordem_servico_id: string
          quantidade: number | null
          revertido: boolean | null
          revertido_em: string | null
        }
        Insert: {
          criterio_usado: string
          custo_anterior?: number | null
          custo_novo: number
          estoque_id?: string | null
          executado_em?: string | null
          executado_por?: string | null
          id?: string
          impacto_total?: number | null
          item_os_id: string
          lote_id: string
          observacao?: string | null
          ordem_servico_id: string
          quantidade?: number | null
          revertido?: boolean | null
          revertido_em?: string | null
        }
        Update: {
          criterio_usado?: string
          custo_anterior?: number | null
          custo_novo?: number
          estoque_id?: string | null
          executado_em?: string | null
          executado_por?: string | null
          id?: string
          impacto_total?: number | null
          item_os_id?: string
          lote_id?: string
          observacao?: string | null
          ordem_servico_id?: string
          quantidade?: number | null
          revertido?: boolean | null
          revertido_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "log_backfill_custo_itens_os_estoque_id_fkey"
            columns: ["estoque_id"]
            isOneToOne: false
            referencedRelation: "estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_backfill_custo_itens_os_item_os_id_fkey"
            columns: ["item_os_id"]
            isOneToOne: false
            referencedRelation: "itens_os"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_backfill_custo_itens_os_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_backfill_custo_itens_os_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "v_auditoria_financeira_os"
            referencedColumns: ["os_id"]
          },
        ]
      }
      log_financeiro_estoque_audit: {
        Row: {
          acao: string
          created_at: string | null
          dados_anteriores: Json | null
          dados_novos: Json | null
          entidade_id: string
          entidade_tipo: string
          id: string
          oficina_id: string
        }
        Insert: {
          acao: string
          created_at?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          entidade_id: string
          entidade_tipo: string
          id?: string
          oficina_id: string
        }
        Update: {
          acao?: string
          created_at?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          entidade_id?: string
          entidade_tipo?: string
          id?: string
          oficina_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "log_financeiro_estoque_audit_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_events: {
        Row: {
          button_location: string | null
          created_at: string
          currency: string | null
          event_id: string
          event_name: string
          fbclid: string | null
          gclid: string | null
          id: string
          metadata: Json | null
          method: string | null
          mrp_event_name: string | null
          page_path: string | null
          page_url: string | null
          plan_name: string | null
          plan_period: string | null
          plan_price: number | null
          session_id: string | null
          status: string | null
          user_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          value: number | null
          visitor_id: string | null
        }
        Insert: {
          button_location?: string | null
          created_at?: string
          currency?: string | null
          event_id: string
          event_name: string
          fbclid?: string | null
          gclid?: string | null
          id?: string
          metadata?: Json | null
          method?: string | null
          mrp_event_name?: string | null
          page_path?: string | null
          page_url?: string | null
          plan_name?: string | null
          plan_period?: string | null
          plan_price?: number | null
          session_id?: string | null
          status?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          value?: number | null
          visitor_id?: string | null
        }
        Update: {
          button_location?: string | null
          created_at?: string
          currency?: string | null
          event_id?: string
          event_name?: string
          fbclid?: string | null
          gclid?: string | null
          id?: string
          metadata?: Json | null
          method?: string | null
          mrp_event_name?: string | null
          page_path?: string | null
          page_url?: string | null
          plan_name?: string | null
          plan_period?: string | null
          plan_price?: number | null
          session_id?: string | null
          status?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          value?: number | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      marketing_sessions: {
        Row: {
          first_seen: string
          first_utm_campaign: string | null
          first_utm_medium: string | null
          first_utm_source: string | null
          id: string
          last_page_url: string | null
          last_seen: string
          metadata: Json | null
          session_id: string
          visitor_id: string
        }
        Insert: {
          first_seen?: string
          first_utm_campaign?: string | null
          first_utm_medium?: string | null
          first_utm_source?: string | null
          id?: string
          last_page_url?: string | null
          last_seen?: string
          metadata?: Json | null
          session_id: string
          visitor_id: string
        }
        Update: {
          first_seen?: string
          first_utm_campaign?: string | null
          first_utm_medium?: string | null
          first_utm_source?: string | null
          id?: string
          last_page_url?: string | null
          last_seen?: string
          metadata?: Json | null
          session_id?: string
          visitor_id?: string
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          created_at: string
          data: string
          id: string
          lida: boolean | null
          mensagem: string | null
          oficina_id: string
          referencia_id: string | null
          referencia_tipo: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string
          data?: string
          id?: string
          lida?: boolean | null
          mensagem?: string | null
          oficina_id: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          lida?: boolean | null
          mensagem?: string | null
          oficina_id?: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
        ]
      }
      oficina_configuracoes: {
        Row: {
          agendamento_online_ativo: boolean
          agendamento_online_capacidade_simultanea: number
          agendamento_online_dias_antecedencia_max: number
          agendamento_online_duracao_slot_minutos: number
          agendamento_online_horarios: Json
          agendamento_online_mensagem_aprovacao: string | null
          agendamento_online_mensagem_confirmacao: string | null
          agendamento_online_mensagem_recusa: string | null
          agendamento_online_mensagem_sugestao: string | null
          agendamento_online_mostrar_precos: boolean
          agendamento_online_servicos_permitidos: string[]
          agendamento_online_slug: string | null
          cfop_servicos: string | null
          cfop_vendas: string | null
          cnpj: string | null
          cor_primaria: string | null
          created_at: string
          dias_funcionamento: string[] | null
          estoque_alertas: boolean | null
          horario_abertura: string | null
          horario_fechamento: string | null
          id: string
          inscricao_municipal: string | null
          moeda: string | null
          municipio: string | null
          oficina_id: string
          razao_social: string | null
          recorrencia_lembretes: boolean | null
          regime_tributario: string | null
          resumo_diario: boolean | null
          updated_at: string
          whatsapp_notificacoes: boolean | null
        }
        Insert: {
          agendamento_online_ativo?: boolean
          agendamento_online_capacidade_simultanea?: number
          agendamento_online_dias_antecedencia_max?: number
          agendamento_online_duracao_slot_minutos?: number
          agendamento_online_horarios?: Json
          agendamento_online_mensagem_aprovacao?: string | null
          agendamento_online_mensagem_confirmacao?: string | null
          agendamento_online_mensagem_recusa?: string | null
          agendamento_online_mensagem_sugestao?: string | null
          agendamento_online_mostrar_precos?: boolean
          agendamento_online_servicos_permitidos?: string[]
          agendamento_online_slug?: string | null
          cfop_servicos?: string | null
          cfop_vendas?: string | null
          cnpj?: string | null
          cor_primaria?: string | null
          created_at?: string
          dias_funcionamento?: string[] | null
          estoque_alertas?: boolean | null
          horario_abertura?: string | null
          horario_fechamento?: string | null
          id?: string
          inscricao_municipal?: string | null
          moeda?: string | null
          municipio?: string | null
          oficina_id: string
          razao_social?: string | null
          recorrencia_lembretes?: boolean | null
          regime_tributario?: string | null
          resumo_diario?: boolean | null
          updated_at?: string
          whatsapp_notificacoes?: boolean | null
        }
        Update: {
          agendamento_online_ativo?: boolean
          agendamento_online_capacidade_simultanea?: number
          agendamento_online_dias_antecedencia_max?: number
          agendamento_online_duracao_slot_minutos?: number
          agendamento_online_horarios?: Json
          agendamento_online_mensagem_aprovacao?: string | null
          agendamento_online_mensagem_confirmacao?: string | null
          agendamento_online_mensagem_recusa?: string | null
          agendamento_online_mensagem_sugestao?: string | null
          agendamento_online_mostrar_precos?: boolean
          agendamento_online_servicos_permitidos?: string[]
          agendamento_online_slug?: string | null
          cfop_servicos?: string | null
          cfop_vendas?: string | null
          cnpj?: string | null
          cor_primaria?: string | null
          created_at?: string
          dias_funcionamento?: string[] | null
          estoque_alertas?: boolean | null
          horario_abertura?: string | null
          horario_fechamento?: string | null
          id?: string
          inscricao_municipal?: string | null
          moeda?: string | null
          municipio?: string | null
          oficina_id?: string
          razao_social?: string | null
          recorrencia_lembretes?: boolean | null
          regime_tributario?: string | null
          resumo_diario?: boolean | null
          updated_at?: string
          whatsapp_notificacoes?: boolean | null
        }
        Relationships: []
      }
      oficinas: {
        Row: {
          cpf_cnpj: string | null
          created_at: string
          email_contato: string | null
          endereco: string | null
          id: string
          logo_url: string | null
          nome: string
          responsavel_tecnico: string | null
          telefone: string | null
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cpf_cnpj?: string | null
          created_at?: string
          email_contato?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          responsavel_tecnico?: string | null
          telefone?: string | null
          tipo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cpf_cnpj?: string | null
          created_at?: string
          email_contato?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          responsavel_tecnico?: string | null
          telefone?: string | null
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      orcamentos: {
        Row: {
          cliente_id: string | null
          created_at: string
          custo_total: number | null
          desconto: number | null
          descricao: string | null
          id: string
          numero: number | null
          observacoes: string | null
          oficina_id: string
          status: string
          titulo: string
          updated_at: string
          validade: string | null
          valor_total: number | null
          veiculo_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          custo_total?: number | null
          desconto?: number | null
          descricao?: string | null
          id?: string
          numero?: number | null
          observacoes?: string | null
          oficina_id: string
          status?: string
          titulo: string
          updated_at?: string
          validade?: string | null
          valor_total?: number | null
          veiculo_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          custo_total?: number | null
          desconto?: number | null
          descricao?: string | null
          id?: string
          numero?: number | null
          observacoes?: string | null
          oficina_id?: string
          status?: string
          titulo?: string
          updated_at?: string
          validade?: string | null
          valor_total?: number | null
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_servico: {
        Row: {
          alerta_garantia_enviado: boolean | null
          assinatura_cliente_url: string | null
          checklist_alternador_ok: boolean | null
          checklist_carga_bateria: string | null
          checklist_combustivel: string | null
          checklist_estepe: boolean | null
          checklist_fusiveis_ok: boolean | null
          checklist_luzes: boolean | null
          checklist_motor_partida_ok: boolean | null
          checklist_riscos: boolean | null
          checklist_som: boolean | null
          checklist_voltagem_bateria: string | null
          cliente_id: string
          codigo_obd: string | null
          codigos_obd_lista: string[] | null
          created_at: string
          custo_servico: number | null
          data_conclusao: string | null
          data_servico: string
          desconto: number
          desconto_aplicado_em: string | null
          desconto_aplicado_por: string | null
          desconto_motivo: string | null
          descricao: string | null
          dias_garantia: number | null
          forma_pagamento: string | null
          fotos_entrada: string[] | null
          fotos_saida: string[] | null
          hipotese_diagnostico: string | null
          hora_agendamento: string | null
          id: string
          km_no_servico: number | null
          lucro: number | null
          modulos_testados: string[] | null
          numero: number | null
          observacoes: string | null
          observacoes_conclusao: string | null
          oficina_id: string
          responsavel_id: string | null
          solicitacao_agendamento_id: string | null
          status: string
          tem_garantia: boolean | null
          tempo_diagnostico_minutos: number | null
          tipo_servico: string
          updated_at: string
          valor_mao_obra: number | null
          valor_servico: number | null
          valor_sinal: number
          veiculo_id: string
        }
        Insert: {
          alerta_garantia_enviado?: boolean | null
          assinatura_cliente_url?: string | null
          checklist_alternador_ok?: boolean | null
          checklist_carga_bateria?: string | null
          checklist_combustivel?: string | null
          checklist_estepe?: boolean | null
          checklist_fusiveis_ok?: boolean | null
          checklist_luzes?: boolean | null
          checklist_motor_partida_ok?: boolean | null
          checklist_riscos?: boolean | null
          checklist_som?: boolean | null
          checklist_voltagem_bateria?: string | null
          cliente_id: string
          codigo_obd?: string | null
          codigos_obd_lista?: string[] | null
          created_at?: string
          custo_servico?: number | null
          data_conclusao?: string | null
          data_servico?: string
          desconto?: number
          desconto_aplicado_em?: string | null
          desconto_aplicado_por?: string | null
          desconto_motivo?: string | null
          descricao?: string | null
          dias_garantia?: number | null
          forma_pagamento?: string | null
          fotos_entrada?: string[] | null
          fotos_saida?: string[] | null
          hipotese_diagnostico?: string | null
          hora_agendamento?: string | null
          id?: string
          km_no_servico?: number | null
          lucro?: number | null
          modulos_testados?: string[] | null
          numero?: number | null
          observacoes?: string | null
          observacoes_conclusao?: string | null
          oficina_id: string
          responsavel_id?: string | null
          solicitacao_agendamento_id?: string | null
          status?: string
          tem_garantia?: boolean | null
          tempo_diagnostico_minutos?: number | null
          tipo_servico: string
          updated_at?: string
          valor_mao_obra?: number | null
          valor_servico?: number | null
          valor_sinal?: number
          veiculo_id: string
        }
        Update: {
          alerta_garantia_enviado?: boolean | null
          assinatura_cliente_url?: string | null
          checklist_alternador_ok?: boolean | null
          checklist_carga_bateria?: string | null
          checklist_combustivel?: string | null
          checklist_estepe?: boolean | null
          checklist_fusiveis_ok?: boolean | null
          checklist_luzes?: boolean | null
          checklist_motor_partida_ok?: boolean | null
          checklist_riscos?: boolean | null
          checklist_som?: boolean | null
          checklist_voltagem_bateria?: string | null
          cliente_id?: string
          codigo_obd?: string | null
          codigos_obd_lista?: string[] | null
          created_at?: string
          custo_servico?: number | null
          data_conclusao?: string | null
          data_servico?: string
          desconto?: number
          desconto_aplicado_em?: string | null
          desconto_aplicado_por?: string | null
          desconto_motivo?: string | null
          descricao?: string | null
          dias_garantia?: number | null
          forma_pagamento?: string | null
          fotos_entrada?: string[] | null
          fotos_saida?: string[] | null
          hipotese_diagnostico?: string | null
          hora_agendamento?: string | null
          id?: string
          km_no_servico?: number | null
          lucro?: number | null
          modulos_testados?: string[] | null
          numero?: number | null
          observacoes?: string | null
          observacoes_conclusao?: string | null
          oficina_id?: string
          responsavel_id?: string | null
          solicitacao_agendamento_id?: string | null
          status?: string
          tem_garantia?: boolean | null
          tempo_diagnostico_minutos?: number | null
          tipo_servico?: string
          updated_at?: string
          valor_mao_obra?: number | null
          valor_servico?: number | null
          valor_sinal?: number
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_ordens_servico_solicitacao"
            columns: ["solicitacao_agendamento_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_agendamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      os_sinais: {
        Row: {
          created_at: string
          created_by: string | null
          data_pagamento: string
          financeiro_id: string | null
          forma_pagamento: string | null
          forma_pagamento_id: string | null
          id: string
          observacao: string | null
          oficina_id: string
          ordem_servico_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_pagamento?: string
          financeiro_id?: string | null
          forma_pagamento?: string | null
          forma_pagamento_id?: string | null
          id?: string
          observacao?: string | null
          oficina_id: string
          ordem_servico_id: string
          valor: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_pagamento?: string
          financeiro_id?: string | null
          forma_pagamento?: string | null
          forma_pagamento_id?: string | null
          id?: string
          observacao?: string | null
          oficina_id?: string
          ordem_servico_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "os_sinais_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_sinais_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "v_auditoria_financeira_os"
            referencedColumns: ["os_id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          created_at: string
          external_reference: string | null
          id: string
          metodo_pagamento: string | null
          mp_payment_id: string
          mp_preference_id: string | null
          oficina_id: string | null
          orcamento_id: string | null
          payer_email: string | null
          payer_name: string | null
          processed_at: string | null
          raw_data: Json | null
          status: string
          status_detail: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          external_reference?: string | null
          id?: string
          metodo_pagamento?: string | null
          mp_payment_id: string
          mp_preference_id?: string | null
          oficina_id?: string | null
          orcamento_id?: string | null
          payer_email?: string | null
          payer_name?: string | null
          processed_at?: string | null
          raw_data?: Json | null
          status?: string
          status_detail?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          created_at?: string
          external_reference?: string | null
          id?: string
          metodo_pagamento?: string | null
          mp_payment_id?: string
          mp_preference_id?: string | null
          oficina_id?: string | null
          orcamento_id?: string | null
          payer_email?: string | null
          payer_name?: string | null
          processed_at?: string | null
          raw_data?: Json | null
          status?: string
          status_detail?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      parcelas_pagamento: {
        Row: {
          created_at: string
          data_pagamento: string | null
          data_vencimento: string
          forma_pagamento_id: string | null
          id: string
          numero_parcela: number
          observacoes: string | null
          oficina_id: string
          orcamento_id: string | null
          ordem_servico_id: string | null
          status: string
          total_parcelas: number
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          data_pagamento?: string | null
          data_vencimento: string
          forma_pagamento_id?: string | null
          id?: string
          numero_parcela?: number
          observacoes?: string | null
          oficina_id: string
          orcamento_id?: string | null
          ordem_servico_id?: string | null
          status?: string
          total_parcelas?: number
          updated_at?: string
          valor: number
        }
        Update: {
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          forma_pagamento_id?: string | null
          id?: string
          numero_parcela?: number
          observacoes?: string | null
          oficina_id?: string
          orcamento_id?: string | null
          ordem_servico_id?: string | null
          status?: string
          total_parcelas?: number
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "parcelas_pagamento_forma_pagamento_id_fkey"
            columns: ["forma_pagamento_id"]
            isOneToOne: false
            referencedRelation: "formas_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_pagamento_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_pagamento_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_pagamento_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_pagamento_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "v_auditoria_financeira_os"
            referencedColumns: ["os_id"]
          },
        ]
      }
      plan_features: {
        Row: {
          created_at: string
          enabled: boolean
          feature: Database["public"]["Enums"]["feature_type"]
          id: string
          plan_type: Database["public"]["Enums"]["plan_type"]
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature: Database["public"]["Enums"]["feature_type"]
          id?: string
          plan_type: Database["public"]["Enums"]["plan_type"]
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature?: Database["public"]["Enums"]["feature_type"]
          id?: string
          plan_type?: Database["public"]["Enums"]["plan_type"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          last_oficina_id: string | null
          nome: string
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          last_oficina_id?: string | null
          nome: string
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          last_oficina_id?: string | null
          nome?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_last_oficina_id_fkey"
            columns: ["last_oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_log: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          ip_hash: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          ip_hash: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          ip_hash?: string
        }
        Relationships: []
      }
      recorrencias: {
        Row: {
          ativo: boolean | null
          created_at: string
          id: string
          intervalo_dias: number | null
          intervalo_km: number | null
          oficina_id: string
          proxima_execucao: string | null
          tipo_servico: string
          ultima_execucao: string | null
          updated_at: string
          veiculo_id: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          id?: string
          intervalo_dias?: number | null
          intervalo_km?: number | null
          oficina_id: string
          proxima_execucao?: string | null
          tipo_servico: string
          ultima_execucao?: string | null
          updated_at?: string
          veiculo_id: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          id?: string
          intervalo_dias?: number | null
          intervalo_km?: number | null
          oficina_id?: string
          proxima_execucao?: string | null
          tipo_servico?: string
          ultima_execucao?: string | null
          updated_at?: string
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recorrencias_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recorrencias_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes_agendamento: {
        Row: {
          cliente_email: string | null
          cliente_nome: string
          cliente_telefone: string
          created_at: string
          data_agendamento_solicitada: string
          data_aprovacao: string | null
          data_recusa: string | null
          data_sugestao: string | null
          hora_agendamento_solicitada: string
          id: string
          ip_solicitante: unknown
          motivo_recusa: string | null
          nova_data_sugerida: string | null
          nova_hora_sugerida: string | null
          observacoes_cliente: string | null
          oficina_id: string
          ordem_servico_id: string | null
          servico_id: string | null
          servico_nome: string
          servico_valor_estimado: number | null
          status: string
          updated_at: string
          veiculo_modelo: string | null
          veiculo_placa: string | null
        }
        Insert: {
          cliente_email?: string | null
          cliente_nome: string
          cliente_telefone: string
          created_at?: string
          data_agendamento_solicitada: string
          data_aprovacao?: string | null
          data_recusa?: string | null
          data_sugestao?: string | null
          hora_agendamento_solicitada: string
          id?: string
          ip_solicitante?: unknown
          motivo_recusa?: string | null
          nova_data_sugerida?: string | null
          nova_hora_sugerida?: string | null
          observacoes_cliente?: string | null
          oficina_id: string
          ordem_servico_id?: string | null
          servico_id?: string | null
          servico_nome: string
          servico_valor_estimado?: number | null
          status?: string
          updated_at?: string
          veiculo_modelo?: string | null
          veiculo_placa?: string | null
        }
        Update: {
          cliente_email?: string | null
          cliente_nome?: string
          cliente_telefone?: string
          created_at?: string
          data_agendamento_solicitada?: string
          data_aprovacao?: string | null
          data_recusa?: string | null
          data_sugestao?: string | null
          hora_agendamento_solicitada?: string
          id?: string
          ip_solicitante?: unknown
          motivo_recusa?: string | null
          nova_data_sugerida?: string | null
          nova_hora_sugerida?: string | null
          observacoes_cliente?: string | null
          oficina_id?: string
          ordem_servico_id?: string | null
          servico_id?: string | null
          servico_nome?: string
          servico_valor_estimado?: number | null
          status?: string
          updated_at?: string
          veiculo_modelo?: string | null
          veiculo_placa?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          canceled_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          oficina_id: string
          plan_type: Database["public"]["Enums"]["plan_type"]
          started_at: string
          status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          oficina_id: string
          plan_type?: Database["public"]["Enums"]["plan_type"]
          started_at?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          canceled_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          oficina_id?: string
          plan_type?: Database["public"]["Enums"]["plan_type"]
          started_at?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: true
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          oficina_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          oficina_id: string
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          oficina_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Relationships: []
      }
      tipos_servico_oficina: {
        Row: {
          created_at: string
          id: string
          nome: string
          oficina_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          oficina_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          oficina_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tipos_servico_oficina_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_email_logs: {
        Row: {
          email: string
          email_type: string
          id: string
          oficina_id: string
          sent_at: string | null
          user_id: string
        }
        Insert: {
          email: string
          email_type: string
          id?: string
          oficina_id: string
          sent_at?: string | null
          user_id: string
        }
        Update: {
          email?: string
          email_type?: string
          id?: string
          oficina_id?: string
          sent_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_email_logs_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_migration_map: {
        Row: {
          created_at: string | null
          email: string
          migrated_at: string | null
          new_user_id: string | null
          nome: string | null
          old_user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          migrated_at?: string | null
          new_user_id?: string | null
          nome?: string | null
          old_user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          migrated_at?: string | null
          new_user_id?: string | null
          nome?: string | null
          old_user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          active: boolean | null
          created_at: string
          deactivated_at: string | null
          id: string
          last_accessed_at: string | null
          oficina_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          deactivated_at?: string | null
          id?: string
          last_accessed_at?: string | null
          oficina_id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          deactivated_at?: string | null
          id?: string
          last_accessed_at?: string | null
          oficina_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
        ]
      }
      veiculos: {
        Row: {
          ano: number | null
          chassi: string | null
          cliente_id: string
          cor: string | null
          created_at: string
          foto_url: string | null
          id: string
          km_atual: number | null
          marca: string
          modelo: string
          observacoes: string | null
          oficina_id: string
          placa: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          ano?: number | null
          chassi?: string | null
          cliente_id: string
          cor?: string | null
          created_at?: string
          foto_url?: string | null
          id?: string
          km_atual?: number | null
          marca: string
          modelo: string
          observacoes?: string | null
          oficina_id: string
          placa?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          ano?: number | null
          chassi?: string | null
          cliente_id?: string
          cor?: string | null
          created_at?: string
          foto_url?: string | null
          id?: string
          km_atual?: number | null
          marca?: string
          modelo?: string
          observacoes?: string | null
          oficina_id?: string
          placa?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "veiculos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veiculos_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas_balcao: {
        Row: {
          cliente_id: string | null
          created_at: string
          created_by: string | null
          financeiro_id: string | null
          forma_pagamento: string | null
          forma_pagamento_id: string | null
          id: string
          numero: number
          observacao: string | null
          oficina_id: string
          status: string
          valor_total: number
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          financeiro_id?: string | null
          forma_pagamento?: string | null
          forma_pagamento_id?: string | null
          id?: string
          numero?: number
          observacao?: string | null
          oficina_id: string
          status?: string
          valor_total?: number
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          financeiro_id?: string | null
          forma_pagamento?: string | null
          forma_pagamento_id?: string | null
          id?: string
          numero?: number
          observacao?: string | null
          oficina_id?: string
          status?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendas_balcao_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_balcao_financeiro_id_fkey"
            columns: ["financeiro_id"]
            isOneToOne: false
            referencedRelation: "financeiro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_balcao_forma_pagamento_id_fkey"
            columns: ["forma_pagamento_id"]
            isOneToOne: false
            referencedRelation: "formas_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_balcao_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_auditoria_financeira_os: {
        Row: {
          desconto: number | null
          divergencia: number | null
          os_id: string | null
          os_numero: number | null
          status: string | null
          total_financeiro_real: number | null
          valor_bruto: number | null
          valor_liquido_esperado: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_team_invite: { Args: { _token: string }; Returns: Json }
      add_team_member_by_email: {
        Args: {
          _email: string
          _oficina_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: Json
      }
      aprovar_solicitacao_agendamento: {
        Args: {
          p_cliente_id?: string
          p_solicitacao_id: string
          p_veiculo_id?: string
        }
        Returns: Json
      }
      atomic_delete_cliente: { Args: { p_cliente_id: string }; Returns: Json }
      atomic_delete_estoque: {
        Args: { p_estoque_id: string; p_oficina_id: string }
        Returns: Json
      }
      atomic_delete_orcamento: {
        Args: { p_orcamento_id: string }
        Returns: Json
      }
      atomic_delete_os: { Args: { p_os_id: string }; Returns: Json }
      atomic_delete_veiculo: {
        Args: { p_veiculo_id: string }
        Returns: undefined
      }
      atualizar_parcelas_atrasadas: { Args: never; Returns: undefined }
      baixar_estoque_orcamento: {
        Args: { p_orcamento_id: string }
        Returns: undefined
      }
      can_access_financial_data: {
        Args: { _oficina_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_sensitive_data: {
        Args: { _oficina_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_client_sensitive_data: {
        Args: { _oficina_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_full_client_data: {
        Args: { _oficina_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_profit_data: {
        Args: { _oficina_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_supplier_data: {
        Args: { _oficina_id: string; _user_id: string }
        Returns: boolean
      }
      cancelar_solicitacao_agendamento: {
        Args: { p_solicitacao_id: string }
        Returns: Json
      }
      cancelar_venda_balcao: { Args: { p_venda_id: string }; Returns: Json }
      check_dados_orfaos: { Args: never; Returns: number }
      check_divergencia_valores: { Args: never; Returns: number }
      check_legacy_migration: { Args: { p_email: string }; Returns: Json }
      check_os_sem_financeiro: { Args: never; Returns: number }
      check_rate_limit: {
        Args: { p_endpoint: string; p_ip_hash: string; p_max_requests?: number }
        Returns: boolean
      }
      check_user_rate_limit: {
        Args: {
          p_action: string
          p_max_requests?: number
          p_window_seconds?: number
        }
        Returns: boolean
      }
      cleanup_expired_idempotency_keys: { Args: never; Returns: undefined }
      cleanup_rate_limit_log: { Args: never; Returns: undefined }
      converter_orcamento_em_os: {
        Args: { p_oficina_id: string; p_orcamento_id: string }
        Returns: Json
      }
      create_team_invite: {
        Args: {
          _email: string
          _oficina_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: Json
      }
      criar_orcamento_completo: {
        Args: {
          p_cliente_id?: string
          p_desconto?: number
          p_descricao?: string
          p_itens?: Json
          p_observacoes?: string
          p_oficina_id: string
          p_titulo: string
          p_validade?: string
          p_veiculo_id?: string
        }
        Returns: Json
      }
      criar_os_completa: {
        Args: {
          p_assinatura_cliente_url?: string
          p_checklist_alternador_ok?: boolean
          p_checklist_carga_bateria?: string
          p_checklist_combustivel?: string
          p_checklist_estepe?: boolean
          p_checklist_fusiveis_ok?: boolean
          p_checklist_luzes?: boolean
          p_checklist_motor_partida_ok?: boolean
          p_checklist_riscos?: boolean
          p_checklist_som?: boolean
          p_checklist_voltagem_bateria?: string
          p_cliente_id: string
          p_codigo_obd?: string
          p_codigos_obd_lista?: string[]
          p_custo_servico?: number
          p_data_servico?: string
          p_descricao?: string
          p_dias_garantia?: number
          p_forma_pagamento?: string
          p_forma_pagamento_id?: string
          p_fotos_entrada?: string[]
          p_hipotese_diagnostico?: string
          p_hora_agendamento?: string
          p_itens?: Json
          p_km_no_servico?: number
          p_modulos_testados?: string[]
          p_numero_parcelas?: number
          p_observacoes?: string
          p_oficina_id: string
          p_responsavel_id?: string
          p_status?: string
          p_tem_garantia?: boolean
          p_tempo_diagnostico_minutos?: number
          p_tipo_servico: string
          p_valor_mao_de_obra?: number
          p_veiculo_id: string
        }
        Returns: Json
      }
      criar_venda_balcao: {
        Args: {
          p_cliente_id?: string
          p_forma_pagamento: string
          p_forma_pagamento_id?: string
          p_itens: Json
          p_observacao?: string
          p_oficina_id: string
        }
        Returns: Json
      }
      deletar_item_os_atomic: {
        Args: { p_item_id: string; p_oficina_id: string }
        Returns: Json
      }
      finalizar_os_atomica: {
        Args: {
          p_forma_pagamento?: string
          p_forma_pagamento_id?: string
          p_fotos_saida?: string[]
          p_itens_novos?: Json
          p_numero_parcelas?: number
          p_observacoes_conclusao?: string
          p_os_id: string
          p_valor_mao_obra?: number
        }
        Returns: Json
      }
      funnel_scoreboard:
        | {
            Args: { p_end_date?: string; p_start_date?: string }
            Returns: Json
          }
        | {
            Args: {
              p_end_date?: string
              p_oficina_tipo?: string
              p_start_date?: string
            }
            Returns: Json
          }
      gerar_parcelas_atomic: {
        Args: {
          p_data_primeira_parcela?: string
          p_forma_pagamento_id?: string
          p_intervalo_dias?: number
          p_numero_parcelas?: number
          p_oficina_id: string
          p_orcamento_id?: string
          p_ordem_servico_id?: string
          p_valor_total?: number
        }
        Returns: Json
      }
      get_client_portal_data: { Args: { p_token: string }; Returns: Json }
      get_financeiro_rankings_unificados: {
        Args: {
          p_data_fim: string
          p_data_inicio: string
          p_oficina_id: string
        }
        Returns: Json
      }
      get_financeiro_resumo: {
        Args: { p_meses_historico?: number; p_oficina_id: string }
        Returns: Json
      }
      get_financeiro_series_unificadas: {
        Args: {
          p_data_fim: string
          p_data_inicio: string
          p_oficina_id: string
        }
        Returns: Json
      }
      get_financeiro_v2: {
        Args: {
          p_data_fim: string
          p_data_inicio: string
          p_oficina_id: string
        }
        Returns: Json
      }
      get_financeiro_v2_preview_limpeza: {
        Args: {
          p_data_fim: string
          p_data_inicio: string
          p_oficina_id: string
        }
        Returns: Json
      }
      get_financeiro_v2_series: {
        Args: {
          p_data_fim: string
          p_data_inicio: string
          p_oficina_id: string
        }
        Returns: Json
      }
      get_invite_info: { Args: { _token: string }; Returns: Json }
      get_metrics_financeiras_unificadas: {
        Args: {
          p_data_fim?: string
          p_data_inicio?: string
          p_oficina_id: string
        }
        Returns: Json
      }
      get_oficina_features: {
        Args: { _oficina_id: string }
        Returns: {
          enabled: boolean
          feature: Database["public"]["Enums"]["feature_type"]
        }[]
      }
      get_oficina_funcionarios: {
        Args: { _oficina_id: string }
        Returns: {
          email: string
          nome: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      get_oficina_plan: {
        Args: { _oficina_id: string }
        Returns: Database["public"]["Enums"]["plan_type"]
      }
      get_oficina_publica_by_slug: { Args: { p_slug: string }; Returns: Json }
      get_os_with_financial_visibility: {
        Args: { p_os_id: string }
        Returns: Json
      }
      get_pre_fiscal_unificado: {
        Args: { p_fim: string; p_inicio: string; p_oficina_id: string }
        Returns: Json
      }
      get_public_orcamento: { Args: { orcamento_id: string }; Returns: Json }
      get_public_orcamento_by_numero: {
        Args: { p_numero: number }
        Returns: Json
      }
      get_public_os: { Args: { os_id: string }; Returns: Json }
      get_public_os_by_numero: { Args: { os_numero: number }; Returns: Json }
      get_slots_disponiveis: {
        Args: { p_data: string; p_slug: string }
        Returns: Json
      }
      get_user_role: {
        Args: { _oficina_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_feature: {
        Args: {
          _feature: Database["public"]["Enums"]["feature_type"]
          _oficina_id: string
        }
        Returns: boolean
      }
      has_oficina_access: {
        Args: { _oficina_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _oficina_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      importar_clientes_lote: {
        Args: { p_clientes: Json; p_lote_id: string; p_oficina_id: string }
        Returns: Json
      }
      ingest_upsert_bypass_triggers: {
        Args: { p_conflict_column?: string; p_rows: Json; p_table: string }
        Returns: Json
      }
      is_oficina_owner: {
        Args: { _oficina_id: string; _user_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { p_user_id: string }; Returns: boolean }
      mask_chassi: {
        Args: { can_view: boolean; chassi: string }
        Returns: string
      }
      mask_cpf_cnpj: {
        Args: { can_view: boolean; cpf_cnpj: string }
        Returns: string
      }
      portal_update_orcamento_status: {
        Args: { p_action: string; p_orcamento_id: string; p_token: string }
        Returns: Json
      }
      public_approve_orcamento: {
        Args: { p_action: string; p_orcamento_id: string }
        Returns: Json
      }
      rate_limit_os_insert: {
        Args: { p_oficina_id: string }
        Returns: undefined
      }
      reabrir_os_atomica:
        | { Args: { p_os_id: string }; Returns: Json }
        | { Args: { p_motivo?: string; p_os_id: string }; Returns: Json }
      reabrir_os_v2: { Args: { p_os_id: string }; Returns: Json }
      recalcular_totais_orcamento: {
        Args: { p_orcamento_id: string }
        Returns: undefined
      }
      recalcular_totais_os: { Args: { p_os_id: string }; Returns: undefined }
      recusar_solicitacao_agendamento: {
        Args: { p_motivo?: string; p_solicitacao_id: string }
        Returns: Json
      }
      registrar_sinal_os: {
        Args: {
          p_data_pagamento?: string
          p_forma_pagamento_id?: string
          p_forma_pagamento_nome?: string
          p_observacao?: string
          p_os_id: string
          p_valor: number
        }
        Returns: Json
      }
      reparar_financeiro_historico: { Args: never; Returns: Json }
      solicitar_agendamento_publico: {
        Args: {
          p_cliente_email: string
          p_cliente_nome: string
          p_cliente_telefone: string
          p_data: string
          p_hora: string
          p_ip_solicitante?: string
          p_observacoes: string
          p_servico_id: string
          p_slug: string
          p_veiculo_modelo: string
          p_veiculo_placa: string
        }
        Returns: Json
      }
      sugerir_novo_horario_agendamento: {
        Args: {
          p_nova_data: string
          p_nova_hora: string
          p_solicitacao_id: string
        }
        Returns: Json
      }
      upsert_financeiro_os: {
        Args: {
          p_forma_pagamento_id?: string
          p_mao_obra_valor: number
          p_numero_parcelas?: number
          p_oficina_id: string
          p_ordem_servico_id: string
          p_origem?: string
          p_tipo_servico: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "proprietario"
        | "administrador"
        | "funcionario"
        | "master"
        | "super_admin"
        | "platform_admin"
      classificacao_financeira: "empresa" | "pessoal"
      feature_type:
        | "clientes"
        | "veiculos_moto"
        | "veiculos_carro"
        | "ordens_servico"
        | "agenda"
        | "financeiro_basico"
        | "financeiro_completo"
        | "historico"
        | "orcamentos"
        | "estoque"
        | "relatorios"
        | "dashboard_completo"
      plan_type: "moto_pro" | "oficina_pro"
      status_pagamento:
        | "pago"
        | "a_receber"
        | "a_pagar"
        | "atrasado"
        | "cancelado"
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
      app_role: [
        "proprietario",
        "administrador",
        "funcionario",
        "master",
        "super_admin",
        "platform_admin",
      ],
      classificacao_financeira: ["empresa", "pessoal"],
      feature_type: [
        "clientes",
        "veiculos_moto",
        "veiculos_carro",
        "ordens_servico",
        "agenda",
        "financeiro_basico",
        "financeiro_completo",
        "historico",
        "orcamentos",
        "estoque",
        "relatorios",
        "dashboard_completo",
      ],
      plan_type: ["moto_pro", "oficina_pro"],
      status_pagamento: [
        "pago",
        "a_receber",
        "a_pagar",
        "atrasado",
        "cancelado",
      ],
    },
  },
} as const
