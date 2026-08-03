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
      accounting_accounts: {
        Row: {
          accepts_posting: boolean
          active: boolean
          code: string
          company_id: string
          created_at: string
          id: string
          is_depreciation: boolean
          name: string
          nature: string
          parent_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          accepts_posting?: boolean
          active?: boolean
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_depreciation?: boolean
          name: string
          nature: string
          parent_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          accepts_posting?: boolean
          active?: boolean
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_depreciation?: boolean
          name?: string
          nature?: string
          parent_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounting_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_entries: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string
          document: string | null
          entry_date: string
          hash: string
          id: string
          origin: string
          origin_event: string
          origin_id: string | null
          reversal_of: string | null
          status: string
          total_amount: number
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description: string
          document?: string | null
          entry_date?: string
          hash?: string
          id?: string
          origin: string
          origin_event?: string
          origin_id?: string | null
          reversal_of?: string | null
          status?: string
          total_amount?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          document?: string | null
          entry_date?: string
          hash?: string
          id?: string
          origin?: string
          origin_event?: string
          origin_id?: string | null
          reversal_of?: string | null
          status?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "accounting_entries_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: false
            referencedRelation: "accounting_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_entry_items: {
        Row: {
          account_id: string
          amount: number
          company_id: string
          created_at: string
          entry_id: string
          id: string
          memo: string | null
          side: string
        }
        Insert: {
          account_id: string
          amount: number
          company_id: string
          created_at?: string
          entry_id: string
          id?: string
          memo?: string | null
          side: string
        }
        Update: {
          account_id?: string
          amount?: number
          company_id?: string
          created_at?: string
          entry_id?: string
          id?: string
          memo?: string | null
          side?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_entry_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounting_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_entry_items_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "accounting_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_events: {
        Row: {
          appointment_id: string
          company_id: string
          description: string | null
          event_type: string
          id: string
          metadata: Json | null
          occurred_at: string
          user_id: string | null
        }
        Insert: {
          appointment_id: string
          company_id: string
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          user_id?: string | null
        }
        Update: {
          appointment_id?: string
          company_id?: string
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_events_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_reminders: {
        Row: {
          appointment_id: string
          channel: string
          company_id: string
          created_at: string
          id: string
          offset_minutes: number
          scheduled_for: string | null
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          channel?: string
          company_id: string
          created_at?: string
          id?: string
          offset_minutes: number
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          channel?: string
          company_id?: string
          created_at?: string
          id?: string
          offset_minutes?: number
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reminders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_reminders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          all_day: boolean
          assignee: string | null
          bella_pay_charge_id: string | null
          cancelled_at: string | null
          color: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          ends_at: string
          financial_transaction_id: string | null
          id: string
          location: string | null
          notes: string | null
          priority: string
          sale_id: string | null
          starts_at: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          assignee?: string | null
          bella_pay_charge_id?: string | null
          cancelled_at?: string | null
          color?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          ends_at: string
          financial_transaction_id?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          priority?: string
          sale_id?: string | null
          starts_at: string
          status?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          assignee?: string | null
          bella_pay_charge_id?: string | null
          cancelled_at?: string | null
          color?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          ends_at?: string
          financial_transaction_id?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          priority?: string
          sale_id?: string | null
          starts_at?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_bella_pay_charge_id_fkey"
            columns: ["bella_pay_charge_id"]
            isOneToOne: false
            referencedRelation: "bella_pay_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_financial_transaction_id_fkey"
            columns: ["financial_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_alerts: {
        Row: {
          alert_type: string
          company_id: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          message: string | null
          metadata: Json
          resolved_at: string | null
          severity: string
          status: string
          title: string
          triggered_at: string
          updated_at: string
        }
        Insert: {
          alert_type: string
          company_id: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string | null
          metadata?: Json
          resolved_at?: string | null
          severity?: string
          status?: string
          title: string
          triggered_at?: string
          updated_at?: string
        }
        Update: {
          alert_type?: string
          company_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string | null
          metadata?: Json
          resolved_at?: string | null
          severity?: string
          status?: string
          title?: string
          triggered_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_context: {
        Row: {
          company_id: string
          context_type: string
          created_at: string
          expires_at: string | null
          id: string
          payload: Json
          reference_id: string | null
          scope: string | null
          summary: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          context_type: string
          created_at?: string
          expires_at?: string | null
          id?: string
          payload?: Json
          reference_id?: string | null
          scope?: string | null
          summary?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          context_type?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          payload?: Json
          reference_id?: string | null
          scope?: string | null
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_context_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_conversations: {
        Row: {
          company_id: string
          created_at: string
          id: string
          last_message_at: string | null
          message_count: number
          metadata: Json
          model: string | null
          provider: string
          status: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          message_count?: number
          metadata?: Json
          model?: string | null
          provider?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          message_count?: number
          metadata?: Json
          model?: string | null
          provider?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assistant_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_messages: {
        Row: {
          company_id: string
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json
          model: string | null
          provider: string | null
          role: string
          tokens_input: number | null
          tokens_output: number | null
        }
        Insert: {
          company_id: string
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json
          model?: string | null
          provider?: string | null
          role: string
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Update: {
          company_id?: string
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          model?: string | null
          provider?: string | null
          role?: string
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "assistant_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_recommendations: {
        Row: {
          action_url: string | null
          category: string
          company_id: string
          created_at: string
          description: string | null
          generated_at: string
          id: string
          metadata: Json
          priority: string
          resolved_at: string | null
          status: string
          target_id: string | null
          target_module: string | null
          title: string
          updated_at: string
        }
        Insert: {
          action_url?: string | null
          category: string
          company_id: string
          created_at?: string
          description?: string | null
          generated_at?: string
          id?: string
          metadata?: Json
          priority?: string
          resolved_at?: string | null
          status?: string
          target_id?: string | null
          target_module?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          action_url?: string | null
          category?: string
          company_id?: string
          created_at?: string
          description?: string | null
          generated_at?: string
          id?: string
          metadata?: Json
          priority?: string
          resolved_at?: string | null
          status?: string
          target_id?: string | null
          target_module?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_recommendations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bella_automation_runs: {
        Row: {
          actions_summary: Json
          automation_id: string
          company_id: string
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          status: string
          trigger_payload: Json
          trigger_type: string
        }
        Insert: {
          actions_summary?: Json
          automation_id: string
          company_id: string
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          status: string
          trigger_payload?: Json
          trigger_type: string
        }
        Update: {
          actions_summary?: Json
          automation_id?: string
          company_id?: string
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          status?: string
          trigger_payload?: Json
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "bella_automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "bella_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bella_automation_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bella_automations: {
        Row: {
          actions: Json
          company_id: string
          conditions: Json
          created_at: string
          created_by: string | null
          description: string | null
          enabled: boolean
          failure_count: number
          id: string
          last_run_at: string | null
          last_run_status: string | null
          name: string
          next_run_at: string | null
          run_count: number
          success_count: number
          template_id: string | null
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          company_id: string
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          failure_count?: number
          id?: string
          last_run_at?: string | null
          last_run_status?: string | null
          name: string
          next_run_at?: string | null
          run_count?: number
          success_count?: number
          template_id?: string | null
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          company_id?: string
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          failure_count?: number
          id?: string
          last_run_at?: string | null
          last_run_status?: string | null
          name?: string
          next_run_at?: string | null
          run_count?: number
          success_count?: number
          template_id?: string | null
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bella_automations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bella_executions: {
        Row: {
          company_id: string
          confirmation_required: boolean
          confirmed: boolean
          conversation_id: string | null
          created_at: string
          error_message: string | null
          execution_time_ms: number | null
          finished_at: string | null
          id: string
          intent: string | null
          parameters: Json
          result_code: string | null
          skill_id: string | null
          started_at: string
          success: boolean
          user_id: string | null
        }
        Insert: {
          company_id: string
          confirmation_required?: boolean
          confirmed?: boolean
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          finished_at?: string | null
          id?: string
          intent?: string | null
          parameters?: Json
          result_code?: string | null
          skill_id?: string | null
          started_at?: string
          success?: boolean
          user_id?: string | null
        }
        Update: {
          company_id?: string
          confirmation_required?: boolean
          confirmed?: boolean
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          finished_at?: string | null
          id?: string
          intent?: string | null
          parameters?: Json
          result_code?: string | null
          skill_id?: string | null
          started_at?: string
          success?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bella_executions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bella_pay_api_metrics: {
        Row: {
          company_id: string
          correlation_id: string | null
          created_at: string
          duration_ms: number | null
          endpoint: string
          environment: string
          error_body: Json | null
          error_message: string | null
          id: string
          metadata: Json
          method: string
          ok: boolean
          status: number | null
        }
        Insert: {
          company_id: string
          correlation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          endpoint: string
          environment: string
          error_body?: Json | null
          error_message?: string | null
          id?: string
          metadata?: Json
          method: string
          ok: boolean
          status?: number | null
        }
        Update: {
          company_id?: string
          correlation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          endpoint?: string
          environment?: string
          error_body?: Json | null
          error_message?: string | null
          id?: string
          metadata?: Json
          method?: string
          ok?: boolean
          status?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bella_pay_api_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bella_pay_charges: {
        Row: {
          asaas_customer_id: string | null
          asaas_id: string
          billing_type: string
          canceled_at: string | null
          company_id: string
          created_at: string
          customer_id: string | null
          description: string | null
          due_date: string
          environment: string
          external_reference: string | null
          financial_transaction_id: string | null
          id: string
          installment_count: number
          installment_value: number | null
          invoice_url: string | null
          net_value: number | null
          original_value: number | null
          paid_at: string | null
          payment_link: string | null
          pix_expires_at: string | null
          pix_payload: string | null
          pix_qr_code: string | null
          raw: Json | null
          sale_id: string | null
          status: string
          updated_at: string
          value: number
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_id: string
          billing_type: string
          canceled_at?: string | null
          company_id: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          due_date: string
          environment?: string
          external_reference?: string | null
          financial_transaction_id?: string | null
          id?: string
          installment_count?: number
          installment_value?: number | null
          invoice_url?: string | null
          net_value?: number | null
          original_value?: number | null
          paid_at?: string | null
          payment_link?: string | null
          pix_expires_at?: string | null
          pix_payload?: string | null
          pix_qr_code?: string | null
          raw?: Json | null
          sale_id?: string | null
          status?: string
          updated_at?: string
          value: number
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_id?: string
          billing_type?: string
          canceled_at?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          due_date?: string
          environment?: string
          external_reference?: string | null
          financial_transaction_id?: string | null
          id?: string
          installment_count?: number
          installment_value?: number | null
          invoice_url?: string | null
          net_value?: number | null
          original_value?: number | null
          paid_at?: string | null
          payment_link?: string | null
          pix_expires_at?: string | null
          pix_payload?: string | null
          pix_qr_code?: string | null
          raw?: Json | null
          sale_id?: string | null
          status?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "bella_pay_charges_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bella_pay_charges_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bella_pay_charges_financial_transaction_id_fkey"
            columns: ["financial_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bella_pay_charges_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      bella_pay_config: {
        Row: {
          api_key_production: string | null
          api_key_sandbox: string | null
          company_id: string
          connection_message: string | null
          connection_status: string
          created_at: string
          credit_card_absorb_fee: boolean
          credit_card_fee_percent: number
          credit_card_max_installments: number
          default_account_id: string | null
          environment: string
          id: string
          last_tested_at: string | null
          updated_at: string
          webhook_token: string
        }
        Insert: {
          api_key_production?: string | null
          api_key_sandbox?: string | null
          company_id: string
          connection_message?: string | null
          connection_status?: string
          created_at?: string
          credit_card_absorb_fee?: boolean
          credit_card_fee_percent?: number
          credit_card_max_installments?: number
          default_account_id?: string | null
          environment?: string
          id?: string
          last_tested_at?: string | null
          updated_at?: string
          webhook_token?: string
        }
        Update: {
          api_key_production?: string | null
          api_key_sandbox?: string | null
          company_id?: string
          connection_message?: string | null
          connection_status?: string
          created_at?: string
          credit_card_absorb_fee?: boolean
          credit_card_fee_percent?: number
          credit_card_max_installments?: number
          default_account_id?: string | null
          environment?: string
          id?: string
          last_tested_at?: string | null
          updated_at?: string
          webhook_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "bella_pay_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bella_pay_config_default_account_id_fkey"
            columns: ["default_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bella_pay_webhook_events: {
        Row: {
          asaas_event_id: string | null
          bella_pay_charge_id: string | null
          charge_status: string | null
          company_id: string | null
          created_at: string
          customer_id: string | null
          error: string | null
          event_type: string
          financial_transaction_id: string | null
          id: string
          payload: Json
          payment_id: string | null
          processed: boolean
          processed_at: string | null
          request_id: string | null
          sale_id: string | null
          transition_rejected: boolean
          value_mismatch: boolean
          warnings: Json | null
        }
        Insert: {
          asaas_event_id?: string | null
          bella_pay_charge_id?: string | null
          charge_status?: string | null
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          error?: string | null
          event_type: string
          financial_transaction_id?: string | null
          id?: string
          payload: Json
          payment_id?: string | null
          processed?: boolean
          processed_at?: string | null
          request_id?: string | null
          sale_id?: string | null
          transition_rejected?: boolean
          value_mismatch?: boolean
          warnings?: Json | null
        }
        Update: {
          asaas_event_id?: string | null
          bella_pay_charge_id?: string | null
          charge_status?: string | null
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          error?: string | null
          event_type?: string
          financial_transaction_id?: string | null
          id?: string
          payload?: Json
          payment_id?: string | null
          processed?: boolean
          processed_at?: string | null
          request_id?: string | null
          sale_id?: string | null
          transition_rejected?: boolean
          value_mismatch?: boolean
          warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "bella_pay_webhook_events_bella_pay_charge_id_fkey"
            columns: ["bella_pay_charge_id"]
            isOneToOne: false
            referencedRelation: "bella_pay_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bella_pay_webhook_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bella_pay_webhook_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bella_pay_webhook_events_financial_transaction_id_fkey"
            columns: ["financial_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bella_pay_webhook_events_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          reason: string
          session_id: string
          transaction_id: string | null
          type: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          reason: string
          session_id: string
          transaction_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          reason?: string
          session_id?: string
          transaction_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          by_method: Json | null
          cash_in_total: number | null
          cash_out_total: number | null
          closed_at: string | null
          closing_note: string | null
          company_id: string
          counted_cash: number | null
          created_at: string
          difference: number | null
          expected_cash: number | null
          id: string
          opened_at: string
          opening_balance: number
          opening_note: string | null
          operator_id: string
          operator_name: string | null
          sales_count: number | null
          sales_total: number | null
          status: string
          updated_at: string
        }
        Insert: {
          by_method?: Json | null
          cash_in_total?: number | null
          cash_out_total?: number | null
          closed_at?: string | null
          closing_note?: string | null
          company_id: string
          counted_cash?: number | null
          created_at?: string
          difference?: number | null
          expected_cash?: number | null
          id?: string
          opened_at?: string
          opening_balance?: number
          opening_note?: string | null
          operator_id: string
          operator_name?: string | null
          sales_count?: number | null
          sales_total?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          by_method?: Json | null
          cash_in_total?: number | null
          cash_out_total?: number | null
          closed_at?: string | null
          closing_note?: string | null
          company_id?: string
          counted_cash?: number | null
          created_at?: string
          difference?: number | null
          expected_cash?: number | null
          id?: string
          opened_at?: string
          opening_balance?: number
          opening_note?: string | null
          operator_id?: string
          operator_name?: string | null
          sales_count?: number | null
          sales_total?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      category_pricing_policies: {
        Row: {
          category_id: string
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          envelope: Json
          id: string
          updated_at: string
          version: number
        }
        Insert: {
          category_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          envelope: Json
          id?: string
          updated_at?: string
          version?: number
        }
        Update: {
          category_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          envelope?: Json
          id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "category_pricing_policies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          address_number: string | null
          city: string | null
          cnpj: string | null
          complement: string | null
          created_at: string
          default_freight: number
          default_insurance: number
          default_other_costs: number
          default_packaging: number
          email: string | null
          id: string
          ie: string | null
          im: string | null
          logo_path: string | null
          name: string
          neighborhood: string | null
          owner_id: string
          phone: string | null
          pix_key: string | null
          pix_key_type: string | null
          pix_recipient_city: string | null
          pix_recipient_name: string | null
          primary_color: string | null
          receipt_footer: string | null
          secondary_color: string | null
          segment: string | null
          size: string | null
          state: string | null
          timezone: string
          trade_name: string | null
          updated_at: string
          website: string | null
          whatsapp: string | null
          whatsapp_phone_number_id: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_number?: string | null
          city?: string | null
          cnpj?: string | null
          complement?: string | null
          created_at?: string
          default_freight?: number
          default_insurance?: number
          default_other_costs?: number
          default_packaging?: number
          email?: string | null
          id?: string
          ie?: string | null
          im?: string | null
          logo_path?: string | null
          name: string
          neighborhood?: string | null
          owner_id: string
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          pix_recipient_city?: string | null
          pix_recipient_name?: string | null
          primary_color?: string | null
          receipt_footer?: string | null
          secondary_color?: string | null
          segment?: string | null
          size?: string | null
          state?: string | null
          timezone?: string
          trade_name?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
          whatsapp_phone_number_id?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_number?: string | null
          city?: string | null
          cnpj?: string | null
          complement?: string | null
          created_at?: string
          default_freight?: number
          default_insurance?: number
          default_other_costs?: number
          default_packaging?: number
          email?: string | null
          id?: string
          ie?: string | null
          im?: string | null
          logo_path?: string | null
          name?: string
          neighborhood?: string | null
          owner_id?: string
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          pix_recipient_city?: string | null
          pix_recipient_name?: string | null
          primary_color?: string | null
          receipt_footer?: string | null
          secondary_color?: string | null
          segment?: string | null
          size?: string | null
          state?: string | null
          timezone?: string
          trade_name?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
          whatsapp_phone_number_id?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      company_inventory_settings: {
        Row: {
          allow_sale_without_cost: boolean
          company_id: string
          cost_method: string
          created_at: string
          updated_at: string
        }
        Insert: {
          allow_sale_without_cost?: boolean
          company_id: string
          cost_method?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          allow_sale_without_cost?: boolean
          company_id?: string
          cost_method?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_inventory_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          name: string | null
          role_id: string
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          name?: string | null
          role_id: string
          status?: string
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          name?: string | null
          role_id?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_invites_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_pricing_policies: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          envelope: Json
          id: string
          updated_at: string
          version: number
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          envelope: Json
          id?: string
          updated_at?: string
          version?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          envelope?: Json
          id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_pricing_policies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_tax_profile: {
        Row: {
          active: boolean
          cofins_regime: string
          company_id: string
          created_at: string
          due_day: number
          effective_rate: number
          icms_regime: string
          id: string
          ipi_regime: string
          iss_regime: string
          metadata: Json
          nominal_rate: number
          pis_regime: string
          rbt12: number
          simples_annex: string | null
          start_date: string
          tax_regime: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          cofins_regime?: string
          company_id: string
          created_at?: string
          due_day?: number
          effective_rate?: number
          icms_regime?: string
          id?: string
          ipi_regime?: string
          iss_regime?: string
          metadata?: Json
          nominal_rate?: number
          pis_regime?: string
          rbt12?: number
          simples_annex?: string | null
          start_date?: string
          tax_regime?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          cofins_regime?: string
          company_id?: string
          created_at?: string
          due_day?: number
          effective_rate?: number
          icms_regime?: string
          id?: string
          ipi_regime?: string
          iss_regime?: string
          metadata?: Json
          nominal_rate?: number
          pis_regime?: string
          rbt12?: number
          simples_annex?: string | null
          start_date?: string
          tax_regime?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_tax_profile_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_accounts: {
        Row: {
          balance: number
          cancelled_at: string | null
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          down_payment: number
          due_date: string | null
          id: string
          notes: string | null
          opened_at: string
          original_amount: number
          sale_id: string
          settled_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          balance?: number
          cancelled_at?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          down_payment?: number
          due_date?: string | null
          id?: string
          notes?: string | null
          opened_at?: string
          original_amount: number
          sale_id: string
          settled_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          balance?: number
          cancelled_at?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          down_payment?: number
          due_date?: string | null
          id?: string
          notes?: string | null
          opened_at?: string
          original_amount?: number
          sale_id?: string
          settled_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_accounts_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: true
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_installments: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          credit_account_id: string
          due_date: string | null
          id: string
          notes: string | null
          paid_amount: number
          paid_at: string | null
          sequence: number
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          credit_account_id: string
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          sequence?: number
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          credit_account_id?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          sequence?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_installments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_installments_credit_account_id_fkey"
            columns: ["credit_account_id"]
            isOneToOne: false
            referencedRelation: "credit_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_installments_credit_account_id_fkey"
            columns: ["credit_account_id"]
            isOneToOne: false
            referencedRelation: "sale_credit_summary"
            referencedColumns: ["credit_account_id"]
          },
        ]
      }
      credit_payments: {
        Row: {
          amount: number
          client_request_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          credit_account_id: string
          financial_transaction_id: string | null
          id: string
          installment_id: string | null
          kind: string
          notes: string | null
          paid_at: string
          payment_method: string
          updated_at: string
        }
        Insert: {
          amount: number
          client_request_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          credit_account_id: string
          financial_transaction_id?: string | null
          id?: string
          installment_id?: string | null
          kind?: string
          notes?: string | null
          paid_at?: string
          payment_method: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_request_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          credit_account_id?: string
          financial_transaction_id?: string | null
          id?: string
          installment_id?: string | null
          kind?: string
          notes?: string | null
          paid_at?: string
          payment_method?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_payments_credit_account_id_fkey"
            columns: ["credit_account_id"]
            isOneToOne: false
            referencedRelation: "credit_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_payments_credit_account_id_fkey"
            columns: ["credit_account_id"]
            isOneToOne: false
            referencedRelation: "sale_credit_summary"
            referencedColumns: ["credit_account_id"]
          },
          {
            foreignKeyName: "credit_payments_financial_transaction_id_fkey"
            columns: ["financial_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "credit_installments"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_events: {
        Row: {
          campaign_id: string | null
          company_id: string
          created_at: string
          customer_id: string | null
          description: string | null
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
          opportunity_id: string | null
          user_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          company_id: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
          opportunity_id?: string | null
          user_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          opportunity_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_events_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_interactions: {
        Row: {
          company_id: string
          content: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          occurred_at: string
          subject: string | null
          type: string
          updated_at: string
        }
        Insert: {
          company_id: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          occurred_at?: string
          subject?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          occurred_at?: string
          subject?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_interactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_interactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          address_complement: string | null
          address_number: string | null
          asaas_customer_id: string | null
          asaas_customer_id_production: string | null
          asaas_customer_id_sandbox: string | null
          birth_date: string | null
          city: string | null
          company_id: string
          created_at: string
          document: string | null
          email: string | null
          id: string
          last_interaction_at: string | null
          lead_source: string | null
          name: string
          neighborhood: string | null
          notes: string | null
          owner_id: string | null
          phone: string | null
          segment: string | null
          state: string | null
          status: string
          tags: string[]
          updated_at: string
          whatsapp: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          asaas_customer_id?: string | null
          asaas_customer_id_production?: string | null
          asaas_customer_id_sandbox?: string | null
          birth_date?: string | null
          city?: string | null
          company_id: string
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          last_interaction_at?: string | null
          lead_source?: string | null
          name: string
          neighborhood?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          segment?: string | null
          state?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
          whatsapp?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          asaas_customer_id?: string | null
          asaas_customer_id_production?: string | null
          asaas_customer_id_sandbox?: string | null
          birth_date?: string | null
          city?: string | null
          company_id?: string
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          last_interaction_at?: string | null
          lead_source?: string | null
          name?: string
          neighborhood?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          segment?: string | null
          state?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
          whatsapp?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_accounts: {
        Row: {
          account_number: string | null
          agency: string | null
          bank: string | null
          color: string | null
          company_id: string
          created_at: string
          created_by: string | null
          current_balance: number
          id: string
          initial_balance: number
          name: string
          notes: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          agency?: string | null
          bank?: string | null
          color?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          current_balance?: number
          id?: string
          initial_balance?: number
          name: string
          notes?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          agency?: string | null
          bank?: string | null
          color?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          current_balance?: number
          id?: string
          initial_balance?: number
          name?: string
          notes?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          accounting_account_id: string | null
          color: string | null
          company_id: string
          created_at: string
          icon: string | null
          id: string
          kind: string
          name: string
          parent_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accounting_account_id?: string | null
          color?: string | null
          company_id: string
          created_at?: string
          icon?: string | null
          id?: string
          kind: string
          name: string
          parent_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accounting_account_id?: string | null
          color?: string | null
          company_id?: string
          created_at?: string
          icon?: string | null
          id?: string
          kind?: string
          name?: string
          parent_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_categories_accounting_account_id_fkey"
            columns: ["accounting_account_id"]
            isOneToOne: false
            referencedRelation: "accounting_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          account_id: string | null
          amount: number
          asaas_charge_id: string | null
          bella_pay_charge_id: string | null
          category_id: string | null
          company_id: string
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          description: string
          discount_amount: number
          due_date: string | null
          id: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          reference_id: string | null
          reference_number: string | null
          settlement_session_id: string | null
          source: string
          status: string
          transaction_date: string
          transfer_to_account_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          asaas_charge_id?: string | null
          bella_pay_charge_id?: string | null
          category_id?: string | null
          company_id: string
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          discount_amount?: number
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          reference_id?: string | null
          reference_number?: string | null
          settlement_session_id?: string | null
          source?: string
          status?: string
          transaction_date?: string
          transfer_to_account_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          asaas_charge_id?: string | null
          bella_pay_charge_id?: string | null
          category_id?: string | null
          company_id?: string
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          discount_amount?: number
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          reference_id?: string | null
          reference_number?: string | null
          settlement_session_id?: string | null
          source?: string
          status?: string
          transaction_date?: string
          transfer_to_account_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_bella_pay_charge_id_fkey"
            columns: ["bella_pay_charge_id"]
            isOneToOne: false
            referencedRelation: "bella_pay_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_settlement_session_id_fkey"
            columns: ["settlement_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_transfer_to_account_id_fkey"
            columns: ["transfer_to_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_certificates: {
        Row: {
          alias: string
          company_id: string
          content_type: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          issuer_name: string | null
          last_rotated_at: string | null
          serial_number: string | null
          storage_path: string | null
          subject_cnpj: string | null
          subject_name: string | null
          thumbprint: string | null
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          alias: string
          company_id: string
          content_type?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          issuer_name?: string | null
          last_rotated_at?: string | null
          serial_number?: string | null
          storage_path?: string | null
          subject_cnpj?: string | null
          subject_name?: string | null
          thumbprint?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          alias?: string
          company_id?: string
          content_type?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          issuer_name?: string | null
          last_rotated_at?: string | null
          serial_number?: string | null
          storage_path?: string | null
          subject_cnpj?: string | null
          subject_name?: string | null
          thumbprint?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_certificates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_documents: {
        Row: {
          access_key: string | null
          artifacts_checked_at: string | null
          artifacts_last_error: string | null
          artifacts_pending: string[]
          cancellation_protocol: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cfop: string | null
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          danfe_path: string | null
          discard_reason: string | null
          discarded_at: string | null
          discarded_by: string | null
          doc_type: string
          environment: string
          id: string
          model: string
          number: number | null
          operation_nature: string | null
          protocol: string | null
          protocol_at: string | null
          provider: string
          rejection_code: string | null
          rejection_reason: string | null
          request_payload: Json
          response_payload: Json
          sale_id: string | null
          series: number | null
          status: string
          total_amount: number
          updated_at: string
          xml_authorized_path: string | null
          xml_cancellation_path: string | null
          xml_signed_path: string | null
        }
        Insert: {
          access_key?: string | null
          artifacts_checked_at?: string | null
          artifacts_last_error?: string | null
          artifacts_pending?: string[]
          cancellation_protocol?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cfop?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          danfe_path?: string | null
          discard_reason?: string | null
          discarded_at?: string | null
          discarded_by?: string | null
          doc_type?: string
          environment?: string
          id?: string
          model?: string
          number?: number | null
          operation_nature?: string | null
          protocol?: string | null
          protocol_at?: string | null
          provider?: string
          rejection_code?: string | null
          rejection_reason?: string | null
          request_payload?: Json
          response_payload?: Json
          sale_id?: string | null
          series?: number | null
          status?: string
          total_amount?: number
          updated_at?: string
          xml_authorized_path?: string | null
          xml_cancellation_path?: string | null
          xml_signed_path?: string | null
        }
        Update: {
          access_key?: string | null
          artifacts_checked_at?: string | null
          artifacts_last_error?: string | null
          artifacts_pending?: string[]
          cancellation_protocol?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cfop?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          danfe_path?: string | null
          discard_reason?: string | null
          discarded_at?: string | null
          discarded_by?: string | null
          doc_type?: string
          environment?: string
          id?: string
          model?: string
          number?: number | null
          operation_nature?: string | null
          protocol?: string | null
          protocol_at?: string | null
          provider?: string
          rejection_code?: string | null
          rejection_reason?: string | null
          request_payload?: Json
          response_payload?: Json
          sale_id?: string | null
          series?: number | null
          status?: string
          total_amount?: number
          updated_at?: string
          xml_authorized_path?: string | null
          xml_cancellation_path?: string | null
          xml_signed_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documents_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_events: {
        Row: {
          actor_id: string | null
          company_id: string
          created_at: string
          document_id: string
          event_type: string
          id: string
          payload: Json
        }
        Insert: {
          actor_id?: string | null
          company_id: string
          created_at?: string
          document_id: string
          event_type: string
          id?: string
          payload?: Json
        }
        Update: {
          actor_id?: string | null
          company_id?: string
          created_at?: string
          document_id?: string
          event_type?: string
          id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "fiscal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_health_snapshots: {
        Row: {
          annual_limit: number | null
          company_id: string
          created_at: string
          id: string
          monthly_revenue: number
          months_elapsed: number
          percent_used: number | null
          projection_year_end: number | null
          snapshot_month: string
          status: string
          tax_regime: string
          ytd_revenue: number
        }
        Insert: {
          annual_limit?: number | null
          company_id: string
          created_at?: string
          id?: string
          monthly_revenue?: number
          months_elapsed?: number
          percent_used?: number | null
          projection_year_end?: number | null
          snapshot_month: string
          status?: string
          tax_regime: string
          ytd_revenue?: number
        }
        Update: {
          annual_limit?: number | null
          company_id?: string
          created_at?: string
          id?: string
          monthly_revenue?: number
          months_elapsed?: number
          percent_used?: number | null
          projection_year_end?: number | null
          snapshot_month?: string
          status?: string
          tax_regime?: string
          ytd_revenue?: number
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_health_snapshots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_provider_config: {
        Row: {
          api_url: string | null
          company_id: string
          created_at: string
          environment: string
          last_health_check_at: string | null
          last_health_message: string | null
          last_health_status: string | null
          notes: string | null
          provider_id: string
          provisioned_at: string | null
          provisioned_by: string | null
          provisioned_certificate_id: string | null
          provisioned_environment: string | null
          provisioned_note: string | null
          updated_at: string
          updated_by: string | null
          webhook_url: string | null
        }
        Insert: {
          api_url?: string | null
          company_id: string
          created_at?: string
          environment?: string
          last_health_check_at?: string | null
          last_health_message?: string | null
          last_health_status?: string | null
          notes?: string | null
          provider_id?: string
          provisioned_at?: string | null
          provisioned_by?: string | null
          provisioned_certificate_id?: string | null
          provisioned_environment?: string | null
          provisioned_note?: string | null
          updated_at?: string
          updated_by?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_url?: string | null
          company_id?: string
          created_at?: string
          environment?: string
          last_health_check_at?: string | null
          last_health_message?: string | null
          last_health_status?: string | null
          notes?: string | null
          provider_id?: string
          provisioned_at?: string | null
          provisioned_by?: string | null
          provisioned_certificate_id?: string | null
          provisioned_environment?: string | null
          provisioned_note?: string | null
          updated_at?: string
          updated_by?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_provider_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_provider_environments: {
        Row: {
          api_url: string | null
          company_id: string
          created_at: string
          environment: string
          last_health_check_at: string | null
          last_health_message: string | null
          last_health_status: string | null
          provisioned_at: string | null
          provisioned_by: string | null
          provisioned_certificate_id: string | null
          provisioned_environment: string | null
          provisioned_note: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_url?: string | null
          company_id: string
          created_at?: string
          environment: string
          last_health_check_at?: string | null
          last_health_message?: string | null
          last_health_status?: string | null
          provisioned_at?: string | null
          provisioned_by?: string | null
          provisioned_certificate_id?: string | null
          provisioned_environment?: string | null
          provisioned_note?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_url?: string | null
          company_id?: string
          created_at?: string
          environment?: string
          last_health_check_at?: string | null
          last_health_message?: string | null
          last_health_status?: string | null
          provisioned_at?: string | null
          provisioned_by?: string | null
          provisioned_certificate_id?: string | null
          provisioned_environment?: string | null
          provisioned_note?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_provider_environments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_secrets: {
        Row: {
          ciphertext: string
          company_id: string
          environment: string | null
          id: string
          kind: string
          owner_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ciphertext: string
          company_id: string
          environment?: string | null
          id?: string
          kind: string
          owner_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ciphertext?: string
          company_id?: string
          environment?: string | null
          id?: string
          kind?: string
          owner_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_secrets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_settings: {
        Row: {
          alert_thresholds: Json
          annual_revenue_limit: number | null
          cnae_principal: string | null
          company_id: string
          created_at: string
          crt: number | null
          csc_id: string | null
          default_cfop: string
          default_csosn: string | null
          default_environment: string
          default_ncm: string
          default_origem: number
          email_fiscal: string | null
          emit_uf: string
          fiscal_year_start_month: number
          homologation_mode: boolean
          ie_st: string | null
          issue_only_after_payment: boolean
          nfce_next_number: number
          nfce_series: number
          nfe_next_number: number
          nfe_series: number
          operation_nature: string
          phone_fiscal: string | null
          stock_on_homologation: boolean
          tax_regime: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          alert_thresholds?: Json
          annual_revenue_limit?: number | null
          cnae_principal?: string | null
          company_id: string
          created_at?: string
          crt?: number | null
          csc_id?: string | null
          default_cfop?: string
          default_csosn?: string | null
          default_environment?: string
          default_ncm?: string
          default_origem?: number
          email_fiscal?: string | null
          emit_uf?: string
          fiscal_year_start_month?: number
          homologation_mode?: boolean
          ie_st?: string | null
          issue_only_after_payment?: boolean
          nfce_next_number?: number
          nfce_series?: number
          nfe_next_number?: number
          nfe_series?: number
          operation_nature?: string
          phone_fiscal?: string | null
          stock_on_homologation?: boolean
          tax_regime?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          alert_thresholds?: Json
          annual_revenue_limit?: number | null
          cnae_principal?: string | null
          company_id?: string
          created_at?: string
          crt?: number | null
          csc_id?: string | null
          default_cfop?: string
          default_csosn?: string | null
          default_environment?: string
          default_ncm?: string
          default_origem?: number
          email_fiscal?: string | null
          emit_uf?: string
          fiscal_year_start_month?: number
          homologation_mode?: boolean
          ie_st?: string | null
          issue_only_after_payment?: boolean
          nfce_next_number?: number
          nfce_series?: number
          nfe_next_number?: number
          nfe_series?: number
          operation_nature?: string
          phone_fiscal?: string | null
          stock_on_homologation?: boolean
          tax_regime?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_dead_letters: {
        Row: {
          attempts: number
          company_id: string | null
          created_at: string
          error_message: string | null
          id: string
          last_attempt_at: string | null
          payload: Json
          reference: string | null
          resolved_at: string | null
          source: string
          status: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          company_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          payload?: Json
          reference?: string | null
          resolved_at?: string | null
          source: string
          status?: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          company_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          payload?: Json
          reference?: string | null
          resolved_at?: string | null
          source?: string
          status?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          company_id: string
          created_at: string
          id: string
          movement_date: string
          notes: string | null
          product_id: string
          quantity: number
          reason: string | null
          reference_id: string | null
          reference_number: string | null
          source: string | null
          total_cost: number | null
          type: string
          unit_cost: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          movement_date?: string
          notes?: string | null
          product_id: string
          quantity: number
          reason?: string | null
          reference_id?: string | null
          reference_number?: string | null
          source?: string | null
          total_cost?: number | null
          type: string
          unit_cost?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          movement_date?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          reason?: string | null
          reference_id?: string | null
          reference_number?: string | null
          source?: string | null
          total_cost?: number | null
          type?: string
          unit_cost?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_reconciliation_audit: {
        Row: {
          adjustment: number
          before_stock: number
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          ledger_stock: number
          notes: string | null
          opening_movement_created: boolean
          opening_movement_id: string | null
          product_id: string
          unit_cost: number | null
        }
        Insert: {
          adjustment?: number
          before_stock?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          ledger_stock?: number
          notes?: string | null
          opening_movement_created?: boolean
          opening_movement_id?: string | null
          product_id: string
          unit_cost?: number | null
        }
        Update: {
          adjustment?: number
          before_stock?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          ledger_stock?: number
          notes?: string | null
          opening_movement_created?: boolean
          opening_movement_id?: string | null
          product_id?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_reconciliation_audit_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reconciliation_audit_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      job_runs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          id: string
          job_name: string
          result: Json
          started_at: string
          status: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_name: string
          result?: Json
          started_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_name?: string
          result?: Json
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      knowledge_chunks: {
        Row: {
          chunk_index: number
          company_id: string
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          token_estimate: number
        }
        Insert: {
          chunk_index: number
          company_id: string
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          token_estimate?: number
        }
        Update: {
          chunk_index?: number
          company_id?: string
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          token_estimate?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          author: string | null
          category: string | null
          chunk_count: number
          company_id: string
          content_hash: string | null
          created_at: string
          created_by: string | null
          file_name: string | null
          file_size: number | null
          file_type: string
          id: string
          index_error: string | null
          index_status: string
          indexed_at: string | null
          status: string
          tags: string[]
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          author?: string | null
          category?: string | null
          chunk_count?: number
          company_id: string
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string
          id?: string
          index_error?: string | null
          index_status?: string
          indexed_at?: string | null
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          version?: string
        }
        Update: {
          author?: string | null
          category?: string | null
          chunk_count?: number
          company_id?: string
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string
          id?: string
          index_error?: string | null
          index_status?: string
          indexed_at?: string | null
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_query_logs: {
        Row: {
          cache_hit: boolean
          company_id: string
          created_at: string
          document_ids: string[]
          duration_ms: number | null
          id: string
          query: string
          top_score: number | null
          user_id: string | null
        }
        Insert: {
          cache_hit?: boolean
          company_id: string
          created_at?: string
          document_ids?: string[]
          duration_ms?: number | null
          id?: string
          query: string
          top_score?: number | null
          user_id?: string | null
        }
        Update: {
          cache_hit?: boolean
          company_id?: string
          created_at?: string
          document_ids?: string[]
          duration_ms?: number | null
          id?: string
          query?: string
          top_score?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_query_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaigns: {
        Row: {
          budget: number
          channel: string
          company_id: string
          conversions_count: number
          created_at: string
          created_by: string | null
          ended_at: string | null
          id: string
          leads_count: number
          message: string | null
          name: string
          objective: string | null
          revenue_generated: number
          scheduled_for: string | null
          segment_filters: Json
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          budget?: number
          channel: string
          company_id: string
          conversions_count?: number
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          id?: string
          leads_count?: number
          message?: string | null
          name: string
          objective?: string | null
          revenue_generated?: number
          scheduled_for?: string | null
          segment_filters?: Json
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          budget?: number
          channel?: string
          company_id?: string
          conversions_count?: number
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          id?: string
          leads_count?: number
          message?: string | null
          name?: string
          objective?: string | null
          revenue_generated?: number
          scheduled_for?: string | null
          segment_filters?: Json
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_sync_queue: {
        Row: {
          attempts: number
          company_id: string
          created_at: string
          id: string
          last_attempt_at: string | null
          last_error: string | null
          marketplace: string
          processed_at: string | null
          product_id: string
          reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          company_id: string
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          marketplace?: string
          processed_at?: string | null
          product_id: string
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          company_id?: string
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          marketplace?: string
          processed_at?: string | null
          product_id?: string
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_sync_queue_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      mercadolivre_integrations: {
        Row: {
          access_token_encrypted: string | null
          client_id: string
          client_secret_encrypted: string
          company_id: string
          connected_by: string | null
          created_at: string
          id: string
          last_synced_at: string | null
          ml_nickname: string | null
          ml_user_id: string | null
          refresh_token_encrypted: string | null
          scopes: string[]
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token_encrypted?: string | null
          client_id: string
          client_secret_encrypted: string
          company_id: string
          connected_by?: string | null
          created_at?: string
          id?: string
          last_synced_at?: string | null
          ml_nickname?: string | null
          ml_user_id?: string | null
          refresh_token_encrypted?: string | null
          scopes?: string[]
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token_encrypted?: string | null
          client_id?: string
          client_secret_encrypted?: string
          company_id?: string
          connected_by?: string | null
          created_at?: string
          id?: string
          last_synced_at?: string | null
          ml_nickname?: string | null
          ml_user_id?: string | null
          refresh_token_encrypted?: string | null
          scopes?: string[]
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mercadolivre_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_integrations: {
        Row: {
          access_token: string
          catalog_id: string | null
          catalog_name: string | null
          commerce_merchant_settings_id: string | null
          company_id: string
          connected_by: string | null
          created_at: string
          facebook_page_id: string | null
          facebook_page_name: string | null
          facebook_page_token: string | null
          id: string
          instagram_business_id: string | null
          instagram_username: string | null
          last_synced_at: string | null
          meta_business_id: string | null
          meta_business_name: string | null
          scopes: string[]
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          catalog_id?: string | null
          catalog_name?: string | null
          commerce_merchant_settings_id?: string | null
          company_id: string
          connected_by?: string | null
          created_at?: string
          facebook_page_id?: string | null
          facebook_page_name?: string | null
          facebook_page_token?: string | null
          id?: string
          instagram_business_id?: string | null
          instagram_username?: string | null
          last_synced_at?: string | null
          meta_business_id?: string | null
          meta_business_name?: string | null
          scopes?: string[]
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          catalog_id?: string | null
          catalog_name?: string | null
          commerce_merchant_settings_id?: string | null
          company_id?: string
          connected_by?: string | null
          created_at?: string
          facebook_page_id?: string | null
          facebook_page_name?: string | null
          facebook_page_token?: string | null
          id?: string
          instagram_business_id?: string | null
          instagram_username?: string | null
          last_synced_at?: string | null
          meta_business_id?: string | null
          meta_business_name?: string | null
          scopes?: string[]
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      nexos_event_log: {
        Row: {
          company_id: string
          created_at: string
          dedupe_key: string | null
          error: string | null
          id: string
          module: string
          payload: Json
          priority: string
          processed_at: string | null
          result: Json | null
          source: string | null
          status: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          dedupe_key?: string | null
          error?: string | null
          id?: string
          module: string
          payload?: Json
          priority?: string
          processed_at?: string | null
          result?: Json | null
          source?: string | null
          status?: string
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          dedupe_key?: string | null
          error?: string | null
          id?: string
          module?: string
          payload?: Json
          priority?: string
          processed_at?: string | null
          result?: Json | null
          source?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nexos_event_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          assignee: string | null
          closed_at: string | null
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string | null
          estimated_value: number
          expected_close_date: string | null
          id: string
          lead_source: string | null
          lost_reason: string | null
          next_action: string | null
          next_action_at: string | null
          position: number
          probability: number
          stage_id: string | null
          status: string
          title: string
          updated_at: string
          won_reason: string | null
        }
        Insert: {
          assignee?: string | null
          closed_at?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          estimated_value?: number
          expected_close_date?: string | null
          id?: string
          lead_source?: string | null
          lost_reason?: string | null
          next_action?: string | null
          next_action_at?: string | null
          position?: number
          probability?: number
          stage_id?: string | null
          status?: string
          title: string
          updated_at?: string
          won_reason?: string | null
        }
        Update: {
          assignee?: string | null
          closed_at?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          estimated_value?: number
          expected_close_date?: string | null
          id?: string
          lead_source?: string | null
          lost_reason?: string | null
          next_action?: string | null
          next_action_at?: string | null
          position?: number
          probability?: number
          stage_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          won_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          bella_pay_charge_id: string | null
          company_id: string | null
          created_at: string
          customer_id: string | null
          error_message: string | null
          event_id: string | null
          event_type: string
          external_id: string | null
          financial_transaction_id: string | null
          id: string
          payload: Json
          payment_id: string | null
          processed: boolean
          processed_at: string | null
          provider: string
          sale_id: string | null
        }
        Insert: {
          bella_pay_charge_id?: string | null
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          error_message?: string | null
          event_id?: string | null
          event_type: string
          external_id?: string | null
          financial_transaction_id?: string | null
          id?: string
          payload?: Json
          payment_id?: string | null
          processed?: boolean
          processed_at?: string | null
          provider: string
          sale_id?: string | null
        }
        Update: {
          bella_pay_charge_id?: string | null
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          error_message?: string | null
          event_id?: string | null
          event_type?: string
          external_id?: string | null
          financial_transaction_id?: string | null
          id?: string
          payload?: Json
          payment_id?: string | null
          processed?: boolean
          processed_at?: string | null
          provider?: string
          sale_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_bella_pay_charge_id_fkey"
            columns: ["bella_pay_charge_id"]
            isOneToOne: false
            referencedRelation: "bella_pay_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_events_financial_transaction_id_fkey"
            columns: ["financial_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_events_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_method_fees: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          fee_fixed: number
          fee_percent: number
          id: string
          installments: number | null
          label: string
          method_key: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          fee_fixed?: number
          fee_percent?: number
          id?: string
          installments?: number | null
          label: string
          method_key: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          fee_fixed?: number
          fee_percent?: number
          id?: string
          installments?: number | null
          label?: string
          method_key?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_method_fees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          code: string
          created_at: string
          description: string | null
          id: string
          module: string
        }
        Insert: {
          action: string
          code: string
          created_at?: string
          description?: string | null
          id?: string
          module: string
        }
        Update: {
          action?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          module?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          color: string
          company_id: string
          created_at: string
          id: string
          is_lost: boolean
          is_won: boolean
          name: string
          position: number
          slug: string
          updated_at: string
        }
        Insert: {
          color?: string
          company_id: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name: string
          position?: number
          slug: string
          updated_at?: string
        }
        Update: {
          color?: string
          company_id?: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name?: string
          position?: number
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list_entries: {
        Row: {
          company_id: string
          created_at: string
          currency: string
          entry: Json
          fallback: string
          id: string
          max_qty: number | null
          min_qty: number | null
          price_cents: number
          price_list_id: string
          priority: number
          product_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          currency: string
          entry: Json
          fallback?: string
          id?: string
          max_qty?: number | null
          min_qty?: number | null
          price_cents: number
          price_list_id: string
          priority?: number
          product_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          currency?: string
          entry?: Json
          fallback?: string
          id?: string
          max_qty?: number | null
          min_qty?: number | null
          price_cents?: number
          price_list_id?: string
          priority?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_list_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_entries_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      price_lists: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          envelope: Json
          id: string
          name: string | null
          price_list_key: string
          priority: number
          scope: Json
          updated_at: string
          version: number
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          currency: string
          deleted_at?: string | null
          envelope: Json
          id?: string
          name?: string | null
          price_list_key: string
          priority?: number
          scope?: Json
          updated_at?: string
          version?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          envelope?: Json
          id?: string
          name?: string | null
          price_list_key?: string
          priority?: number
          scope?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_lists_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_decisions: {
        Row: {
          applied_rules: Json
          calculation_version: string
          company_id: string
          context: Json
          context_version: string
          created_at: string
          created_by: string | null
          engine_version: string
          explain_id: string
          explanation: Json | null
          id: string
          policy_version: string
          request_id: string
          result: Json
          result_version: string
          snapshot_hash: string
          warnings: Json
        }
        Insert: {
          applied_rules?: Json
          calculation_version: string
          company_id: string
          context: Json
          context_version: string
          created_at?: string
          created_by?: string | null
          engine_version: string
          explain_id: string
          explanation?: Json | null
          id?: string
          policy_version: string
          request_id: string
          result: Json
          result_version: string
          snapshot_hash: string
          warnings?: Json
        }
        Update: {
          applied_rules?: Json
          calculation_version?: string
          company_id?: string
          context?: Json
          context_version?: string
          created_at?: string
          created_by?: string | null
          engine_version?: string
          explain_id?: string
          explanation?: Json | null
          id?: string
          policy_version?: string
          request_id?: string
          result?: Json
          result_version?: string
          snapshot_hash?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "pricing_decisions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_market_references: {
        Row: {
          category_key: string
          common_pct: number
          company_id: string | null
          conservative_pct: number
          created_at: string
          id: string
          label: string
          premium_pct: number
          source_note: string | null
          updated_at: string
        }
        Insert: {
          category_key: string
          common_pct: number
          company_id?: string | null
          conservative_pct: number
          created_at?: string
          id?: string
          label: string
          premium_pct: number
          source_note?: string | null
          updated_at?: string
        }
        Update: {
          category_key?: string
          common_pct?: number
          company_id?: string | null
          conservative_pct?: number
          created_at?: string
          id?: string
          label?: string
          premium_pct?: number
          source_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_market_references_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          auto_pricing_policy: boolean
          color: string
          company_id: string
          created_at: string
          default_cest: string | null
          default_discount_pct: number | null
          default_ncm: string | null
          description: string | null
          icon: string
          id: string
          margin_policy_source: string
          max_margin_pct: number | null
          min_margin_pct: number | null
          name: string
          parent_id: string | null
          status: string
          target_margin_pct: number | null
          updated_at: string
        }
        Insert: {
          auto_pricing_policy?: boolean
          color?: string
          company_id: string
          created_at?: string
          default_cest?: string | null
          default_discount_pct?: number | null
          default_ncm?: string | null
          description?: string | null
          icon?: string
          id?: string
          margin_policy_source?: string
          max_margin_pct?: number | null
          min_margin_pct?: number | null
          name: string
          parent_id?: string | null
          status?: string
          target_margin_pct?: number | null
          updated_at?: string
        }
        Update: {
          auto_pricing_policy?: boolean
          color?: string
          company_id?: string
          created_at?: string
          default_cest?: string | null
          default_discount_pct?: number | null
          default_ncm?: string | null
          description?: string | null
          icon?: string
          id?: string
          margin_policy_source?: string
          max_margin_pct?: number | null
          min_margin_pct?: number | null
          name?: string
          parent_id?: string | null
          status?: string
          target_margin_pct?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_collection_items: {
        Row: {
          collection_id: string
          created_at: string
          id: string
          position: number
          product_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          id?: string
          position?: number
          product_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          id?: string
          position?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "product_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_collection_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_collections: {
        Row: {
          company_id: string
          cover_url: string | null
          created_at: string
          created_by: string | null
          cta_mode: string
          description: string | null
          id: string
          name: string
          scheduled_at: string | null
          show_brand: boolean
          show_installments: boolean
          show_price: boolean
          show_stock: boolean
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          cta_mode?: string
          description?: string | null
          id?: string
          name: string
          scheduled_at?: string | null
          show_brand?: boolean
          show_installments?: boolean
          show_price?: boolean
          show_stock?: boolean
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          cta_mode?: string
          description?: string | null
          id?: string
          name?: string
          scheduled_at?: string | null
          show_brand?: boolean
          show_installments?: boolean
          show_price?: boolean
          show_stock?: boolean
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_collections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          company_id: string
          created_at: string
          focal_x: number
          focal_y: number
          id: string
          path: string
          position: number
          product_id: string
          zoom: number
        }
        Insert: {
          company_id: string
          created_at?: string
          focal_x?: number
          focal_y?: number
          id?: string
          path: string
          position?: number
          product_id: string
          zoom?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          focal_x?: number
          focal_y?: number
          id?: string
          path?: string
          position?: number
          product_id?: string
          zoom?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_images_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_interests: {
        Row: {
          channel: Database["public"]["Enums"]["interest_channel"]
          company_id: string
          created_at: string
          customer_id: string | null
          customer_name: string
          id: string
          interest_date: string
          notes: string | null
          phone: string | null
          product_id: string
          responsible_user_id: string | null
          status: Database["public"]["Enums"]["interest_status"]
          updated_at: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["interest_channel"]
          company_id: string
          created_at?: string
          customer_id?: string | null
          customer_name: string
          id?: string
          interest_date?: string
          notes?: string | null
          phone?: string | null
          product_id: string
          responsible_user_id?: string | null
          status?: Database["public"]["Enums"]["interest_status"]
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["interest_channel"]
          company_id?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          id?: string
          interest_date?: string
          notes?: string | null
          phone?: string | null
          product_id?: string
          responsible_user_id?: string | null
          status?: Database["public"]["Enums"]["interest_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_interests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_interests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_interests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_pricing_policies: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          envelope: Json
          id: string
          product_id: string
          updated_at: string
          version: number
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          envelope: Json
          id?: string
          product_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          envelope?: Json
          id?: string
          product_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_pricing_policies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      product_suppliers: {
        Row: {
          address: string | null
          city: string | null
          company_id: string
          complement: string | null
          contact_name: string | null
          created_at: string
          delivery_days: number | null
          document: string | null
          email: string | null
          id: string
          legal_name: string | null
          municipal_registration: string | null
          name: string
          neighborhood: string | null
          notes: string | null
          number: string | null
          payment_terms: string | null
          phone: string | null
          state: string | null
          state_registration: string | null
          status: string
          updated_at: string
          website: string | null
          whatsapp: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_id: string
          complement?: string | null
          contact_name?: string | null
          created_at?: string
          delivery_days?: number | null
          document?: string | null
          email?: string | null
          id?: string
          legal_name?: string | null
          municipal_registration?: string | null
          name: string
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          payment_terms?: string | null
          phone?: string | null
          state?: string | null
          state_registration?: string | null
          status?: string
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_id?: string
          complement?: string | null
          contact_name?: string | null
          created_at?: string
          delivery_days?: number | null
          document?: string | null
          email?: string | null
          id?: string
          legal_name?: string | null
          municipal_registration?: string | null
          name?: string
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          payment_terms?: string | null
          phone?: string | null
          state?: string | null
          state_registration?: string | null
          status?: string
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          brand: string | null
          category_id: string | null
          cest: string | null
          channel_pricing_settings: Json
          company_id: string
          cost: number
          cover_image_path: string | null
          created_at: string
          description: string | null
          freight: number
          id: string
          insurance: number
          last_purchase_cost: number | null
          margin: number
          margin_mode: string
          min_stock: number
          ml_item_id: string | null
          ml_permalink: string | null
          ml_published_at: string | null
          name: string
          ncm: string | null
          other_costs: number
          packaging: number
          price: number
          sales_channel: string | null
          sales_channels: string[] | null
          sku: string | null
          status: string
          stock: number
          supplier_id: string | null
          tags: string[]
          unit: string
          updated_at: string
          use_category_margin: boolean
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          cest?: string | null
          channel_pricing_settings?: Json
          company_id: string
          cost?: number
          cover_image_path?: string | null
          created_at?: string
          description?: string | null
          freight?: number
          id?: string
          insurance?: number
          last_purchase_cost?: number | null
          margin?: number
          margin_mode?: string
          min_stock?: number
          ml_item_id?: string | null
          ml_permalink?: string | null
          ml_published_at?: string | null
          name: string
          ncm?: string | null
          other_costs?: number
          packaging?: number
          price?: number
          sales_channel?: string | null
          sales_channels?: string[] | null
          sku?: string | null
          status?: string
          stock?: number
          supplier_id?: string | null
          tags?: string[]
          unit?: string
          updated_at?: string
          use_category_margin?: boolean
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          cest?: string | null
          channel_pricing_settings?: Json
          company_id?: string
          cost?: number
          cover_image_path?: string | null
          created_at?: string
          description?: string | null
          freight?: number
          id?: string
          insurance?: number
          last_purchase_cost?: number | null
          margin?: number
          margin_mode?: string
          min_stock?: number
          ml_item_id?: string | null
          ml_permalink?: string | null
          ml_published_at?: string | null
          name?: string
          ncm?: string | null
          other_costs?: number
          packaging?: number
          price?: number
          sales_channel?: string | null
          sales_channels?: string[] | null
          sku?: string | null
          status?: string
          stock?: number
          supplier_id?: string | null
          tags?: string[]
          unit?: string
          updated_at?: string
          use_category_margin?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "product_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      products_backup_cost_audit_geral_20260802: {
        Row: {
          backed_up_at: string
          company_id: string | null
          cost: number | null
          freight: number | null
          id: string | null
          name: string | null
          sku: string | null
        }
        Insert: {
          backed_up_at?: string
          company_id?: string | null
          cost?: number | null
          freight?: number | null
          id?: string | null
          name?: string | null
          sku?: string | null
        }
        Update: {
          backed_up_at?: string
          company_id?: string | null
          cost?: number | null
          freight?: number | null
          id?: string | null
          name?: string | null
          sku?: string | null
        }
        Relationships: []
      }
      products_backup_cost_freight_20260802: {
        Row: {
          backed_up_at: string
          company_id: string | null
          cost: number | null
          freight: number | null
          id: string
          name: string | null
          price: number | null
          sku: string | null
        }
        Insert: {
          backed_up_at?: string
          company_id?: string | null
          cost?: number | null
          freight?: number | null
          id: string
          name?: string | null
          price?: number | null
          sku?: string | null
        }
        Update: {
          backed_up_at?: string
          company_id?: string | null
          cost?: number | null
          freight?: number | null
          id?: string
          name?: string | null
          price?: number | null
          sku?: string | null
        }
        Relationships: []
      }
      products_backup_costs_20260802: {
        Row: {
          backed_up_at: string | null
          company_id: string | null
          freight: number | null
          insurance: number | null
          other_costs: number | null
          packaging: number | null
          price: number | null
          product_id: string | null
        }
        Insert: {
          backed_up_at?: string | null
          company_id?: string | null
          freight?: number | null
          insurance?: number | null
          other_costs?: number | null
          packaging?: number | null
          price?: number | null
          product_id?: string | null
        }
        Update: {
          backed_up_at?: string | null
          company_id?: string | null
          freight?: number | null
          insurance?: number | null
          other_costs?: number | null
          packaging?: number | null
          price?: number | null
          product_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          current_company_id: string | null
          full_name: string | null
          id: string
          onboarded_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          current_company_id?: string | null
          full_name?: string | null
          id: string
          onboarded_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          current_company_id?: string | null
          full_name?: string | null
          id?: string
          onboarded_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_company_id_fkey"
            columns: ["current_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          created_at: string
          description: string
          discount: number
          id: string
          position: number
          product_id: string | null
          purchase_id: string
          quantity: number
          total: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          discount?: number
          id?: string
          position?: number
          product_id?: string | null
          purchase_id: string
          quantity?: number
          total?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          discount?: number
          id?: string
          position?: number
          product_id?: string | null
          purchase_id?: string
          quantity?: number
          total?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_receipt_audits: {
        Row: {
          company_id: string
          created_at: string
          id: string
          new_cost: number | null
          new_stock: number | null
          notes: string | null
          previous_cost: number | null
          previous_stock: number | null
          product_id: string
          purchase_id: string
          purchase_item_id: string | null
          quantity: number
          reason: string
          unit_cost: number
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          new_cost?: number | null
          new_stock?: number | null
          notes?: string | null
          previous_cost?: number | null
          previous_stock?: number | null
          product_id: string
          purchase_id: string
          purchase_item_id?: string | null
          quantity: number
          reason: string
          unit_cost: number
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          new_cost?: number | null
          new_stock?: number | null
          notes?: string | null
          previous_cost?: number | null
          previous_stock?: number | null
          product_id?: string
          purchase_id?: string
          purchase_item_id?: string | null
          quantity?: number
          reason?: string
          unit_cost?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_receipt_audits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipt_audits_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipt_audits_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipt_audits_purchase_item_id_fkey"
            columns: ["purchase_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_items"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          discount: number
          expected_delivery_date: string | null
          grand_total: number
          id: string
          insurance: number
          items_total: number
          notes: string | null
          number: string
          other_costs: number
          payment_terms: string | null
          purchase_date: string
          received_at: string | null
          shipping: number
          status: string
          stock_applied: boolean
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          discount?: number
          expected_delivery_date?: string | null
          grand_total?: number
          id?: string
          insurance?: number
          items_total?: number
          notes?: string | null
          number: string
          other_costs?: number
          payment_terms?: string | null
          purchase_date?: string
          received_at?: string | null
          shipping?: number
          status?: string
          stock_applied?: boolean
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          discount?: number
          expected_delivery_date?: string | null
          grand_total?: number
          id?: string
          insurance?: number
          items_total?: number
          notes?: string | null
          number?: string
          other_costs?: number
          payment_terms?: string | null
          purchase_date?: string
          received_at?: string | null
          shipping?: number
          status?: string
          stock_applied?: boolean
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "product_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
        }
        Relationships: []
      }
      sale_events: {
        Row: {
          company_id: string
          created_at: string
          event_type: string
          id: string
          payload: Json | null
          reason: string | null
          sale_id: string
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json | null
          reason?: string | null
          sale_id: string
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json | null
          reason?: string | null
          sale_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_events_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          applied_discount_pct: number | null
          average_cost: number | null
          below_min_margin: boolean | null
          category_default_discount_pct: number | null
          category_min_margin_pct: number | null
          category_target_margin_pct: number | null
          cost_method: string | null
          created_at: string
          description: string
          discount: number
          final_margin_pct: number | null
          id: string
          last_purchase_cost: number | null
          position: number
          product_id: string | null
          profit_snapshot: number | null
          quantity: number
          sale_id: string
          total: number
          total_cost: number | null
          unit_cost: number | null
          unit_price: number
        }
        Insert: {
          applied_discount_pct?: number | null
          average_cost?: number | null
          below_min_margin?: boolean | null
          category_default_discount_pct?: number | null
          category_min_margin_pct?: number | null
          category_target_margin_pct?: number | null
          cost_method?: string | null
          created_at?: string
          description: string
          discount?: number
          final_margin_pct?: number | null
          id?: string
          last_purchase_cost?: number | null
          position?: number
          product_id?: string | null
          profit_snapshot?: number | null
          quantity?: number
          sale_id: string
          total?: number
          total_cost?: number | null
          unit_cost?: number | null
          unit_price?: number
        }
        Update: {
          applied_discount_pct?: number | null
          average_cost?: number | null
          below_min_margin?: boolean | null
          category_default_discount_pct?: number | null
          category_min_margin_pct?: number | null
          category_target_margin_pct?: number | null
          cost_method?: string | null
          created_at?: string
          description?: string
          discount?: number
          final_margin_pct?: number | null
          id?: string
          last_purchase_cost?: number | null
          position?: number
          product_id?: string | null
          profit_snapshot?: number | null
          quantity?: number
          sale_id?: string
          total?: number
          total_cost?: number | null
          unit_cost?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_return_items: {
        Row: {
          created_at: string
          description: string
          id: string
          product_id: string | null
          quantity: number
          return_id: string
          sale_item_id: string | null
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          product_id?: string | null
          quantity: number
          return_id: string
          sale_item_id?: string | null
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          product_id?: string | null
          quantity?: number
          return_id?: string
          sale_item_id?: string | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "sale_returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_return_items_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_returns: {
        Row: {
          bella_pay_charge_id: string | null
          client_request_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          finance_ref: string | null
          id: string
          notes: string | null
          number: string
          reason: string
          refund_message: string | null
          refund_status: string
          sale_id: string
          status: string
          total_value: number
          updated_at: string
        }
        Insert: {
          bella_pay_charge_id?: string | null
          client_request_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          finance_ref?: string | null
          id?: string
          notes?: string | null
          number: string
          reason: string
          refund_message?: string | null
          refund_status?: string
          sale_id: string
          status?: string
          total_value?: number
          updated_at?: string
        }
        Update: {
          bella_pay_charge_id?: string | null
          client_request_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          finance_ref?: string | null
          id?: string
          notes?: string | null
          number?: string
          reason?: string
          refund_message?: string | null
          refund_status?: string
          sale_id?: string
          status?: string
          total_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_returns_bella_pay_charge_id_fkey"
            columns: ["bella_pay_charge_id"]
            isOneToOne: false
            referencedRelation: "bella_pay_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_returns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_returns_finance_ref_fkey"
            columns: ["finance_ref"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_returns_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          bella_pay_ref: string | null
          cash_session_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          discount: number
          due_date: string | null
          finance_ref: string | null
          grand_total: number
          id: string
          installments: number | null
          is_test: boolean
          items_total: number
          notes: string | null
          number: string
          paid_at: string | null
          payment_confirmed_at: string | null
          payment_method: string | null
          sale_date: string
          shipping: number
          status: string
          stock_applied: boolean
          stock_reversed: boolean
          updated_at: string
        }
        Insert: {
          bella_pay_ref?: string | null
          cash_session_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount?: number
          due_date?: string | null
          finance_ref?: string | null
          grand_total?: number
          id?: string
          installments?: number | null
          is_test?: boolean
          items_total?: number
          notes?: string | null
          number: string
          paid_at?: string | null
          payment_confirmed_at?: string | null
          payment_method?: string | null
          sale_date: string
          shipping?: number
          status?: string
          stock_applied?: boolean
          stock_reversed?: boolean
          updated_at?: string
        }
        Update: {
          bella_pay_ref?: string | null
          cash_session_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount?: number
          due_date?: string | null
          finance_ref?: string | null
          grand_total?: number
          id?: string
          installments?: number | null
          is_test?: boolean
          items_total?: number
          notes?: string | null
          number?: string
          paid_at?: string | null
          payment_confirmed_at?: string | null
          payment_method?: string | null
          sale_date?: string
          shipping?: number
          status?: string
          stock_applied?: boolean
          stock_reversed?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_log: {
        Row: {
          action: string
          after_value: Json | null
          before_value: Json | null
          company_id: string | null
          correlation_id: string | null
          created_at: string
          error: string | null
          id: string
          ip: string | null
          module: string
          resource_id: string | null
          resource_table: string | null
          result: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          after_value?: Json | null
          before_value?: Json | null
          company_id?: string | null
          correlation_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          ip?: string | null
          module: string
          resource_id?: string | null
          resource_table?: string | null
          result?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          after_value?: Json | null
          before_value?: Json | null
          company_id?: string | null
          correlation_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          ip?: string | null
          module?: string
          resource_id?: string | null
          resource_table?: string | null
          result?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      simples_brackets: {
        Row: {
          annex: string
          bracket: number
          created_at: string
          deduction: number
          id: string
          nominal_rate: number
          rbt12_from: number
          rbt12_to: number | null
        }
        Insert: {
          annex: string
          bracket: number
          created_at?: string
          deduction?: number
          id?: string
          nominal_rate: number
          rbt12_from: number
          rbt12_to?: number | null
        }
        Update: {
          annex?: string
          bracket?: number
          created_at?: string
          deduction?: number
          id?: string
          nominal_rate?: number
          rbt12_from?: number
          rbt12_to?: number | null
        }
        Relationships: []
      }
      sku_rename_audit: {
        Row: {
          applied_by: string | null
          company_id: string
          created_at: string
          id: string
          new_sku: string
          note: string | null
          old_sku: string
          product_id: string
          source: string
        }
        Insert: {
          applied_by?: string | null
          company_id: string
          created_at?: string
          id?: string
          new_sku: string
          note?: string | null
          old_sku: string
          product_id: string
          source?: string
        }
        Update: {
          applied_by?: string | null
          company_id?: string
          created_at?: string
          id?: string
          new_sku?: string
          note?: string | null
          old_sku?: string
          product_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "sku_rename_audit_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_rename_audit_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_apportionments: {
        Row: {
          base_amount: number
          bracket: number | null
          breakdown: Json
          company_id: string
          competence: string
          created_at: string
          created_by: string | null
          deduction: number
          due_date: string | null
          effective_rate: number
          entry_id: string | null
          id: string
          nominal_rate: number
          rbt12: number
          revenue: number
          simples_annex: string | null
          status: string
          tax_amount: number
          tax_regime: string
          updated_at: string
        }
        Insert: {
          base_amount?: number
          bracket?: number | null
          breakdown?: Json
          company_id: string
          competence: string
          created_at?: string
          created_by?: string | null
          deduction?: number
          due_date?: string | null
          effective_rate?: number
          entry_id?: string | null
          id?: string
          nominal_rate?: number
          rbt12?: number
          revenue?: number
          simples_annex?: string | null
          status?: string
          tax_amount?: number
          tax_regime: string
          updated_at?: string
        }
        Update: {
          base_amount?: number
          bracket?: number | null
          breakdown?: Json
          company_id?: string
          competence?: string
          created_at?: string
          created_by?: string | null
          deduction?: number
          due_date?: string | null
          effective_rate?: number
          entry_id?: string | null
          id?: string
          nominal_rate?: number
          rbt12?: number
          revenue?: number
          simples_annex?: string | null
          status?: string
          tax_amount?: number
          tax_regime?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_apportionments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_apportionments_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "accounting_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_commercial_inbox: {
        Row: {
          birth_date: string | null
          buyer_name: string | null
          city: string | null
          cnpj: string | null
          company_id: string
          complement: string | null
          converted_at: string | null
          cpf: string | null
          created_at: string
          delivery: Json
          district: string | null
          fulfillment: string
          full_name: string | null
          id: string
          item_count: number
          items: Json
          number: string | null
          origin: string
          payment: string | null
          person_type: string | null
          phone: string
          sale_id: string | null
          state: string | null
          status: string
          street: string | null
          total: number
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          birth_date?: string | null
          buyer_name?: string | null
          city?: string | null
          cnpj?: string | null
          company_id: string
          complement?: string | null
          converted_at?: string | null
          cpf?: string | null
          created_at?: string
          delivery?: Json
          district?: string | null
          fulfillment?: string
          full_name?: string | null
          id?: string
          item_count?: number
          items?: Json
          number?: string | null
          origin?: string
          payment?: string | null
          person_type?: string | null
          phone: string
          sale_id?: string | null
          state?: string | null
          status?: string
          street?: string | null
          total?: number
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          birth_date?: string | null
          buyer_name?: string | null
          city?: string | null
          cnpj?: string | null
          company_id?: string
          complement?: string | null
          converted_at?: string | null
          cpf?: string | null
          created_at?: string
          delivery?: Json
          district?: string | null
          fulfillment?: string
          full_name?: string | null
          id?: string
          item_count?: number
          items?: Json
          number?: string | null
          origin?: string
          payment?: string | null
          person_type?: string | null
          phone?: string
          sale_id?: string | null
          state?: string | null
          status?: string
          street?: string | null
          total?: number
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_commercial_inbox_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_commercial_inbox_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_contacts: {
        Row: {
          company_id: string
          created_at: string
          id: string
          last_seen_at: string
          phone: string | null
          profile_name: string | null
          updated_at: string
          wa_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          last_seen_at?: string
          phone?: string | null
          profile_name?: string | null
          updated_at?: string
          wa_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          last_seen_at?: string
          phone?: string | null
          profile_name?: string | null
          updated_at?: string
          wa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          assigned_at: string | null
          assigned_operator_id: string | null
          bella_state: Json
          company_id: string
          contact_id: string
          created_at: string
          id: string
          last_inbound_at: string | null
          last_outbound_at: string | null
          notes: Json
          protocol: string | null
          status: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_operator_id?: string | null
          bella_state?: Json
          company_id: string
          contact_id: string
          created_at?: string
          id?: string
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          notes?: Json
          protocol?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_operator_id?: string | null
          bella_state?: Json
          company_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          notes?: Json
          protocol?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_assigned_operator_id_fkey"
            columns: ["assigned_operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_message_events: {
        Row: {
          company_id: string
          created_at: string
          direction: string
          id: string
          sent_at: string
          status: string | null
          wa_message_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          direction?: string
          id?: string
          sent_at?: string
          status?: string | null
          wa_message_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          direction?: string
          id?: string
          sent_at?: string
          status?: string | null
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          company_id: string
          contact_id: string
          conversation_id: string
          created_at: string
          direction: string
          error: string | null
          id: string
          payload: Json | null
          processing_ms: number | null
          provider: string | null
          skill_id: string | null
          status: string | null
          text: string | null
          wa_message_id: string | null
        }
        Insert: {
          company_id: string
          contact_id: string
          conversation_id: string
          created_at?: string
          direction: string
          error?: string | null
          id?: string
          payload?: Json | null
          processing_ms?: number | null
          provider?: string | null
          skill_id?: string | null
          status?: string | null
          text?: string | null
          wa_message_id?: string | null
        }
        Update: {
          company_id?: string
          contact_id?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          error?: string | null
          id?: string
          payload?: Json | null
          processing_ms?: number | null
          provider?: string | null
          skill_id?: string | null
          status?: string | null
          text?: string | null
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_webhook_logs: {
        Row: {
          id: string
          payload: Json | null
          processing_error: string | null
          raw_body: string | null
          received_at: string
          signature: string | null
        }
        Insert: {
          id?: string
          payload?: Json | null
          processing_error?: string | null
          raw_body?: string | null
          received_at?: string
          signature?: string | null
        }
        Update: {
          id?: string
          payload?: Json | null
          processing_error?: string | null
          raw_body?: string | null
          received_at?: string
          signature?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      sale_credit_summary: {
        Row: {
          balance: number | null
          cancelled_at: string | null
          company_id: string | null
          credit_account_id: string | null
          customer_id: string | null
          down_payment: number | null
          due_date: string | null
          last_payment_at: string | null
          next_due_date: string | null
          opened_at: string | null
          original_amount: number | null
          sale_id: string | null
          settled_at: string | null
          status: string | null
          total_received_installments: number | null
        }
        Insert: {
          balance?: number | null
          cancelled_at?: string | null
          company_id?: string | null
          credit_account_id?: string | null
          customer_id?: string | null
          down_payment?: number | null
          due_date?: string | null
          last_payment_at?: never
          next_due_date?: never
          opened_at?: string | null
          original_amount?: number | null
          sale_id?: string | null
          settled_at?: string | null
          status?: string | null
          total_received_installments?: never
        }
        Update: {
          balance?: number | null
          cancelled_at?: string | null
          company_id?: string | null
          credit_account_id?: string | null
          customer_id?: string | null
          down_payment?: number | null
          due_date?: string | null
          last_payment_at?: never
          next_due_date?: never
          opened_at?: string | null
          original_amount?: number | null
          sale_id?: string | null
          settled_at?: string | null
          status?: string | null
          total_received_installments?: never
        }
        Relationships: [
          {
            foreignKeyName: "credit_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_accounts_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: true
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _sku_first3: { Args: { t: string }; Returns: string }
      _sku_prefix_for: { Args: { word: string }; Returns: string }
      _sku_strip_accents: { Args: { t: string }; Returns: string }
      accept_company_invite: { Args: { _token: string }; Returns: Json }
      accounting_account_id: {
        Args: { _code: string; _company_id: string }
        Returns: string
      }
      accounting_backfill: { Args: { _company_id: string }; Returns: Json }
      accounting_balances: {
        Args: { _company_id: string; _end: string; _start: string }
        Returns: {
          account_id: string
          balance: number
          code: string
          credit: number
          debit: number
          name: string
          type: string
        }[]
      }
      accounting_post_entry: {
        Args: {
          _company_id: string
          _description: string
          _document: string
          _entry_date: string
          _items: Json
          _origin: string
          _origin_event: string
          _origin_id: string
        }
        Returns: string
      }
      accounting_post_sale: { Args: { _sale_id: string }; Returns: string }
      accounting_reverse_origin: {
        Args: {
          _company_id: string
          _origin: string
          _origin_id: string
          _reason?: string
        }
        Returns: number
      }
      accounting_seed_chart: { Args: { _company_id: string }; Returns: number }
      bella_pay_apply_webhook_result: {
        Args: { _event_id: string; _finalize: Json; _intent: Json }
        Returns: Json
      }
      bella_pay_record_webhook_event: {
        Args: {
          _asaas_event_id: string
          _company_id: string
          _event_type: string
          _payload: Json
          _payment_id: string
          _request_id: string
        }
        Returns: Json
      }
      bella_pay_resolve_webhook_token: {
        Args: { _token: string }
        Returns: {
          company_id: string
          config_id: string
          environment: string
        }[]
      }
      can_view_platform_health: { Args: { _user_id: string }; Returns: boolean }
      cancel_sale:
        | {
            Args: { _sale_id: string }
            Returns: {
              bella_pay_ref: string | null
              cash_session_id: string | null
              company_id: string
              created_at: string
              created_by: string | null
              customer_id: string | null
              discount: number
              due_date: string | null
              finance_ref: string | null
              grand_total: number
              id: string
              installments: number | null
              is_test: boolean
              items_total: number
              notes: string | null
              number: string
              paid_at: string | null
              payment_confirmed_at: string | null
              payment_method: string | null
              sale_date: string
              shipping: number
              status: string
              stock_applied: boolean
              stock_reversed: boolean
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "sales"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { _reason?: string; _sale_id: string }
            Returns: {
              bella_pay_ref: string | null
              cash_session_id: string | null
              company_id: string
              created_at: string
              created_by: string | null
              customer_id: string | null
              discount: number
              due_date: string | null
              finance_ref: string | null
              grand_total: number
              id: string
              installments: number | null
              is_test: boolean
              items_total: number
              notes: string | null
              number: string
              paid_at: string | null
              payment_confirmed_at: string | null
              payment_method: string | null
              sale_date: string
              shipping: number
              status: string
              stock_applied: boolean
              stock_reversed: boolean
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "sales"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      category_name_key: { Args: { _name: string }; Returns: string }
      company_month_start: { Args: { _company_id: string }; Returns: string }
      company_monthly_revenue: {
        Args: { _company_id: string; _competence: string }
        Returns: number
      }
      company_rbt12: {
        Args: { _company_id: string; _competence: string }
        Returns: number
      }
      company_timezone: { Args: { _company_id: string }; Returns: string }
      company_today: { Args: { _company_id: string }; Returns: string }
      complete_settlement_data: {
        Args: {
          _account_id: string
          _notes?: string
          _payment_method: string
          _transaction_id: string
        }
        Returns: {
          account_id: string | null
          amount: number
          asaas_charge_id: string | null
          bella_pay_charge_id: string | null
          category_id: string | null
          company_id: string
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          description: string
          discount_amount: number
          due_date: string | null
          id: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          reference_id: string | null
          reference_number: string | null
          settlement_session_id: string | null
          source: string
          status: string
          transaction_date: string
          transfer_to_account_id: string | null
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "financial_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_credit_sale: { Args: { _input: Json }; Returns: Json }
      create_sale_return: { Args: { _input: Json }; Returns: Json }
      credit_resolve_account: {
        Args: { _account_id?: string; _company_id: string; _method: string }
        Returns: string
      }
      delete_sale: { Args: { _sale_id: string }; Returns: boolean }
      ensure_sale_receivable: {
        Args: { _sale_id: string }
        Returns: {
          account_id: string | null
          amount: number
          asaas_charge_id: string | null
          bella_pay_charge_id: string | null
          category_id: string | null
          company_id: string
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          description: string
          discount_amount: number
          due_date: string | null
          id: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          reference_id: string | null
          reference_number: string | null
          settlement_session_id: string | null
          source: string
          status: string
          transaction_date: string
          transfer_to_account_id: string | null
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "financial_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      financial_kpis: {
        Args: { _company_id: string; _end: string; _start: string }
        Returns: Json
      }
      find_existing_product: {
        Args: {
          _barcode?: string
          _company_id: string
          _name: string
          _sku?: string
        }
        Returns: string
      }
      fiscal_allocate_nfe_number: {
        Args: {
          _company_id: string
          _document_id: string
          _model?: string
          _series?: number
        }
        Returns: number
      }
      fiscal_delete_certificate: {
        Args: { _certificate_id: string }
        Returns: undefined
      }
      fiscal_has_secret: {
        Args: {
          _company_id: string
          _environment?: string
          _kind: string
          _owner_id: string
        }
        Returns: boolean
      }
      fiscal_record_provider_health: {
        Args: { _company_id: string; _message: string; _status: string }
        Returns: undefined
      }
      fiscal_release_nfe_number: {
        Args: { _company_id: string; _document_id: string }
        Returns: undefined
      }
      fiscal_set_secret: {
        Args: {
          _ciphertext: string
          _company_id: string
          _environment?: string
          _kind: string
          _owner_id: string
        }
        Returns: undefined
      }
      generate_balance_sheet: {
        Args: { _as_of?: string; _company_id: string }
        Returns: Json
      }
      generate_dre: {
        Args: { _company_id: string; _end: string; _start: string }
        Returns: Json
      }
      generate_executive_summary: {
        Args: { _company_id: string; _end?: string; _start?: string }
        Returns: Json
      }
      generate_product_sku: {
        Args: { _category_name?: string; _company_id: string; _name: string }
        Returns: string
      }
      generate_tax_apportionment: {
        Args: { _close?: boolean; _company_id: string; _competence: string }
        Returns: Json
      }
      get_company_invite_by_token: { Args: { _token: string }; Returns: Json }
      has_permission: {
        Args: {
          _company_id: string
          _permission_code: string
          _user_id: string
        }
        Returns: boolean
      }
      inventory_ledger_audit: {
        Args: { _company_id: string }
        Returns: {
          current_stock: number
          difference: number
          has_opening: boolean
          inbound: number
          inconsistent: boolean
          ledger_stock: number
          name: string
          opening: number
          outbound: number
          product_id: string
          sku: string
          unit_cost: number
        }[]
      }
      knowledge_match_chunks: {
        Args: {
          match_count?: number
          min_similarity?: number
          query_embedding: string
        }
        Returns: {
          chunk_id: string
          chunk_index: number
          content: string
          document_category: string
          document_id: string
          document_title: string
          similarity: number
        }[]
      }
      log_security_audit: {
        Args: {
          _action: string
          _after?: Json
          _before?: Json
          _company_id: string
          _correlation_id?: string
          _error?: string
          _ip?: string
          _module: string
          _resource_id?: string
          _resource_table?: string
          _result?: string
          _user_agent?: string
        }
        Returns: string
      }
      merge_duplicate_products: {
        Args: {
          _company_id: string
          _delete_unused?: boolean
          _dry_run?: boolean
        }
        Returns: Json
      }
      merge_product_categories: {
        Args: {
          _confirm_policy_conflict?: boolean
          _source_id: string
          _target_id: string
        }
        Returns: Json
      }
      nexos_jobs_status: { Args: never; Returns: Json }
      preview_duplicate_categories: {
        Args: { _company_id: string }
        Returns: Json
      }
      preview_duplicate_products: {
        Args: { _company_id: string }
        Returns: {
          duplicates: Json
          keeper_id: string
          keeper_name: string
          keeper_sku: string
          keeper_stock: number
          merged_stock: number
          name_key: string
        }[]
      }
      product_name_key: { Args: { _name: string }; Returns: string }
      products_inventory_metrics: {
        Args: { _company_id: string }
        Returns: Json
      }
      project_tax_scenarios: {
        Args: { _company_id: string; _competence: string; _growth?: number[] }
        Returns: Json
      }
      receive_credit_payment: { Args: { _input: Json }; Returns: Json }
      receive_purchase: {
        Args: { _purchase_id: string }
        Returns: {
          company_id: string
          created_at: string
          created_by: string | null
          discount: number
          expected_delivery_date: string | null
          grand_total: number
          id: string
          insurance: number
          items_total: number
          notes: string | null
          number: string
          other_costs: number
          payment_terms: string | null
          purchase_date: string
          received_at: string | null
          shipping: number
          status: string
          stock_applied: boolean
          supplier_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "purchases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reconcile_inventory_opening: {
        Args: { _company_id: string; _dry_run?: boolean }
        Returns: Json
      }
      reprocess_received_purchase: {
        Args: { _purchase_id: string }
        Returns: {
          company_id: string
          created_at: string
          created_by: string | null
          discount: number
          expected_delivery_date: string | null
          grand_total: number
          id: string
          insurance: number
          items_total: number
          notes: string | null
          number: string
          other_costs: number
          payment_terms: string | null
          purchase_date: string
          received_at: string | null
          shipping: number
          status: string
          stock_applied: boolean
          supplier_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "purchases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reverse_financial_transaction: {
        Args: { _notes?: string; _transaction_id: string }
        Returns: {
          account_id: string | null
          amount: number
          asaas_charge_id: string | null
          bella_pay_charge_id: string | null
          category_id: string | null
          company_id: string
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          description: string
          discount_amount: number
          due_date: string | null
          id: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          reference_id: string | null
          reference_number: string | null
          settlement_session_id: string | null
          source: string
          status: string
          transaction_date: string
          transfer_to_account_id: string | null
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "financial_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reverse_sale_finance: {
        Args: { _reason?: string; _sale_id: string }
        Returns: number
      }
      sales_status_breakdown: {
        Args: { _company_id: string; _from?: string; _to?: string }
        Returns: {
          count: number
          status: string
          total: number
        }[]
      }
      schedule_nexos_jobs: {
        Args: { _base_url: string; _secret: string }
        Returns: Json
      }
      settle_financial_transaction: {
        Args: {
          _account_id: string
          _notes?: string
          _paid_at?: string
          _payment_method: string
          _settled_amount?: number
          _transaction_id: string
        }
        Returns: {
          account_id: string | null
          amount: number
          asaas_charge_id: string | null
          bella_pay_charge_id: string | null
          category_id: string | null
          company_id: string
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          description: string
          discount_amount: number
          due_date: string | null
          id: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          reference_id: string | null
          reference_number: string | null
          settlement_session_id: string | null
          source: string
          status: string
          transaction_date: string
          transfer_to_account_id: string | null
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "financial_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      simples_compute: {
        Args: { _annex: string; _rbt12: number; _revenue: number }
        Returns: Json
      }
      suggest_product_fiscal: {
        Args: { _company_id: string; _limit?: number; _name: string }
        Returns: {
          cest: string
          ncm: string
          sample_name: string
          similarity: number
          usage_count: number
        }[]
      }
      user_has_company_access: {
        Args: { _company_id: string }
        Returns: boolean
      }
      user_owns_company: { Args: { _company_id: string }; Returns: boolean }
    }
    Enums: {
      interest_channel:
        | "facebook"
        | "instagram"
        | "whatsapp"
        | "loja"
        | "telefone"
        | "outro"
      interest_status:
        | "aguardando"
        | "disponivel"
        | "avisado"
        | "concluido"
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
      interest_channel: [
        "facebook",
        "instagram",
        "whatsapp",
        "loja",
        "telefone",
        "outro",
      ],
      interest_status: [
        "aguardando",
        "disponivel",
        "avisado",
        "concluido",
        "cancelado",
      ],
    },
  },
} as const
