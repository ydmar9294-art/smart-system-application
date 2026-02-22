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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_request_logs: {
        Row: {
          created_at: string
          id: string
          request_hash: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          request_hash?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          request_hash?: string | null
          user_id?: string
        }
        Relationships: []
      }
      api_rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          identifier: string
          request_count: number
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          identifier: string
          request_count?: number
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          identifier?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      app_versions: {
        Row: {
          created_at: string
          force_update: boolean
          id: string
          is_active: boolean
          min_required_version: string
          platform: string
          release_notes: string | null
          update_url: string | null
          version_code: number
          version_name: string
        }
        Insert: {
          created_at?: string
          force_update?: boolean
          id?: string
          is_active?: boolean
          min_required_version: string
          platform: string
          release_notes?: string | null
          update_url?: string | null
          version_code: number
          version_name: string
        }
        Update: {
          created_at?: string
          force_update?: boolean
          id?: string
          is_active?: boolean
          min_required_version?: string
          platform?: string
          release_notes?: string | null
          update_url?: string | null
          version_code?: number
          version_name?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_hash: string | null
          organization_id: string | null
          resource_id: string | null
          resource_type: string
          severity: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_hash?: string | null
          organization_id?: string | null
          resource_id?: string | null
          resource_type: string
          severity?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_hash?: string | null
          organization_id?: string | null
          resource_id?: string | null
          resource_type?: string
          severity?: string
          user_id?: string | null
        }
        Relationships: []
      }
      collections: {
        Row: {
          amount: number
          collected_by: string | null
          created_at: string
          id: string
          is_reversed: boolean
          notes: string | null
          organization_id: string
          reverse_reason: string | null
          sale_id: string
        }
        Insert: {
          amount?: number
          collected_by?: string | null
          created_at?: string
          id?: string
          is_reversed?: boolean
          notes?: string | null
          organization_id: string
          reverse_reason?: string | null
          sale_id: string
        }
        Update: {
          amount?: number
          collected_by?: string | null
          created_at?: string
          id?: string
          is_reversed?: boolean
          notes?: string | null
          organization_id?: string
          reverse_reason?: string | null
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "view_sales_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          balance: number
          created_at: string
          created_by: string | null
          id: string
          location: string | null
          name: string
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          name: string
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          name?: string
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          created_at: string
          created_by: string | null
          distributor_id: string | null
          distributor_name: string
          id: string
          notes: string | null
          organization_id: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          distributor_id?: string | null
          distributor_name: string
          id?: string
          notes?: string | null
          organization_id: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          distributor_id?: string | null
          distributor_name?: string
          id?: string
          notes?: string | null
          organization_id?: string
          status?: string
        }
        Relationships: []
      }
      delivery_items: {
        Row: {
          created_at: string
          delivery_id: string
          id: string
          product_id: string
          product_name: string
          quantity: number
        }
        Insert: {
          created_at?: string
          delivery_id: string
          id?: string
          product_id: string
          product_name: string
          quantity: number
        }
        Update: {
          created_at?: string
          delivery_id?: string
          id?: string
          product_id?: string
          product_name?: string
          quantity?: number
        }
        Relationships: []
      }
      developer_allowlist: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      developer_licenses: {
        Row: {
          days_valid: number | null
          expiryDate: string | null
          id: string
          issuedAt: string
          licenseKey: string
          max_employees: number
          orgName: string
          owner_phone: string | null
          ownerId: string | null
          status: Database["public"]["Enums"]["license_status"]
          type: Database["public"]["Enums"]["license_type"]
        }
        Insert: {
          days_valid?: number | null
          expiryDate?: string | null
          id?: string
          issuedAt?: string
          licenseKey: string
          max_employees?: number
          orgName: string
          owner_phone?: string | null
          ownerId?: string | null
          status?: Database["public"]["Enums"]["license_status"]
          type?: Database["public"]["Enums"]["license_type"]
        }
        Update: {
          days_valid?: number | null
          expiryDate?: string | null
          id?: string
          issuedAt?: string
          licenseKey?: string
          max_employees?: number
          orgName?: string
          owner_phone?: string | null
          ownerId?: string | null
          status?: Database["public"]["Enums"]["license_status"]
          type?: Database["public"]["Enums"]["license_type"]
        }
        Relationships: []
      }
      distributor_inventory: {
        Row: {
          created_at: string
          distributor_id: string
          id: string
          organization_id: string
          product_id: string
          product_name: string
          quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          distributor_id: string
          id?: string
          organization_id: string
          product_id: string
          product_name: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          distributor_id?: string
          id?: string
          organization_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "distributor_inventory_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distributor_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_snapshots: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string | null
          customer_id: string | null
          customer_name: string
          grand_total: number
          id: string
          invoice_date: string
          invoice_number: string
          invoice_type: string
          items: Json
          legal_info: Json | null
          notes: string | null
          org_name: string | null
          organization_id: string
          paid_amount: number | null
          payment_type: string | null
          reason: string | null
          reference_id: string
          remaining: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          customer_id?: string | null
          customer_name: string
          grand_total?: number
          id?: string
          invoice_date?: string
          invoice_number: string
          invoice_type: string
          items?: Json
          legal_info?: Json | null
          notes?: string | null
          org_name?: string | null
          organization_id: string
          paid_amount?: number | null
          payment_type?: string | null
          reason?: string | null
          reference_id: string
          remaining?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          customer_id?: string | null
          customer_name?: string
          grand_total?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          invoice_type?: string
          items?: Json
          legal_info?: Json | null
          notes?: string | null
          org_name?: string | null
          organization_id?: string
          paid_amount?: number | null
          payment_type?: string | null
          reason?: string | null
          reference_id?: string
          remaining?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_snapshots: {
        Row: {
          avg_invoice_value: number | null
          cash_sales_ratio: number | null
          collection_rate: number | null
          collections_count: number | null
          created_at: string
          delivered_items_count: number | null
          deliveries_count: number | null
          delivery_fulfillment_rate: number | null
          employee_id: string
          employee_name: string
          employee_type: string
          id: string
          inventory_accuracy: number | null
          new_customers_count: number | null
          organization_id: string
          overall_score: number | null
          purchase_returns_amount: number | null
          purchases_count: number | null
          return_amount: number | null
          return_rate: number | null
          sales_count: number | null
          snapshot_date: string
          stock_movements_count: number | null
          total_collections: number | null
          total_sales_amount: number | null
        }
        Insert: {
          avg_invoice_value?: number | null
          cash_sales_ratio?: number | null
          collection_rate?: number | null
          collections_count?: number | null
          created_at?: string
          delivered_items_count?: number | null
          deliveries_count?: number | null
          delivery_fulfillment_rate?: number | null
          employee_id: string
          employee_name: string
          employee_type: string
          id?: string
          inventory_accuracy?: number | null
          new_customers_count?: number | null
          organization_id: string
          overall_score?: number | null
          purchase_returns_amount?: number | null
          purchases_count?: number | null
          return_amount?: number | null
          return_rate?: number | null
          sales_count?: number | null
          snapshot_date?: string
          stock_movements_count?: number | null
          total_collections?: number | null
          total_sales_amount?: number | null
        }
        Update: {
          avg_invoice_value?: number | null
          cash_sales_ratio?: number | null
          collection_rate?: number | null
          collections_count?: number | null
          created_at?: string
          delivered_items_count?: number | null
          deliveries_count?: number | null
          delivery_fulfillment_rate?: number | null
          employee_id?: string
          employee_name?: string
          employee_type?: string
          id?: string
          inventory_accuracy?: number | null
          new_customers_count?: number | null
          organization_id?: string
          overall_score?: number | null
          purchase_returns_amount?: number | null
          purchases_count?: number | null
          return_amount?: number | null
          return_rate?: number | null
          sales_count?: number | null
          snapshot_date?: string
          stock_movements_count?: number | null
          total_collections?: number | null
          total_sales_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          attempted_at: string
          email_hash: string | null
          id: string
          ip_hash: string
          success: boolean
        }
        Insert: {
          attempted_at?: string
          email_hash?: string | null
          id?: string
          ip_hash: string
          success?: boolean
        }
        Update: {
          attempted_at?: string
          email_hash?: string | null
          id?: string
          ip_hash?: string
          success?: boolean
        }
        Relationships: []
      }
      organization_legal_info: {
        Row: {
          commercial_registration: string | null
          created_at: string
          id: string
          industrial_registration: string | null
          organization_id: string
          tax_identification: string | null
          trademark_name: string | null
          updated_at: string
        }
        Insert: {
          commercial_registration?: string | null
          created_at?: string
          id?: string
          industrial_registration?: string | null
          organization_id: string
          tax_identification?: string | null
          trademark_name?: string | null
          updated_at?: string
        }
        Update: {
          commercial_registration?: string | null
          created_at?: string
          id?: string
          industrial_registration?: string | null
          organization_id?: string
          tax_identification?: string | null
          trademark_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_legal_info_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_users: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      pending_employees: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          activation_code: string
          created_at: string
          created_by: string | null
          employee_type: Database["public"]["Enums"]["employee_type"]
          expires_at: string | null
          id: string
          is_used: boolean
          name: string
          organization_id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          activation_code: string
          created_at?: string
          created_by?: string | null
          employee_type: Database["public"]["Enums"]["employee_type"]
          expires_at?: string | null
          id?: string
          is_used?: boolean
          name: string
          organization_id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          activation_code?: string
          created_at?: string
          created_by?: string | null
          employee_type?: Database["public"]["Enums"]["employee_type"]
          expires_at?: string | null
          id?: string
          is_used?: boolean
          name?: string
          organization_id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      products: {
        Row: {
          base_price: number
          category: string
          consumer_price: number
          cost_price: number
          created_at: string
          id: string
          is_deleted: boolean
          min_stock: number
          name: string
          organization_id: string
          stock: number
          unit: string
          updated_at: string
        }
        Insert: {
          base_price?: number
          category?: string
          consumer_price?: number
          cost_price?: number
          created_at?: string
          id?: string
          is_deleted?: boolean
          min_stock?: number
          name: string
          organization_id: string
          stock?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          base_price?: number
          category?: string
          consumer_price?: number
          cost_price?: number
          created_at?: string
          id?: string
          is_deleted?: boolean
          min_stock?: number
          name?: string
          organization_id?: string
          stock?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          email_verified: boolean | null
          employee_type: Database["public"]["Enums"]["employee_type"] | null
          full_name: string
          google_id: string | null
          id: string
          is_active: boolean
          license_key: string | null
          organization_id: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          email_verified?: boolean | null
          employee_type?: Database["public"]["Enums"]["employee_type"] | null
          full_name: string
          google_id?: string | null
          id: string
          is_active?: boolean
          license_key?: string | null
          organization_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          email_verified?: boolean | null
          employee_type?: Database["public"]["Enums"]["employee_type"] | null
          full_name?: string
          google_id?: string | null
          id?: string
          is_active?: boolean
          license_key?: string | null
          organization_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_batches: {
        Row: {
          batch_date: string
          created_at: string
          id: string
          organization_id: string
          product_id: string
          purchase_id: string | null
          quantity_purchased: number
          quantity_remaining: number
          unit_cost: number
        }
        Insert: {
          batch_date?: string
          created_at?: string
          id?: string
          organization_id: string
          product_id: string
          purchase_id?: string | null
          quantity_purchased?: number
          quantity_remaining?: number
          unit_cost?: number
        }
        Update: {
          batch_date?: string
          created_at?: string
          id?: string
          organization_id?: string
          product_id?: string
          purchase_id?: string | null
          quantity_purchased?: number
          quantity_remaining?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_batches_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_return_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          product_name: string
          quantity: number
          return_id: string
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          product_name: string
          quantity: number
          return_id: string
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          return_id?: string
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "purchase_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_returns: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          purchase_id: string | null
          reason: string | null
          supplier_name: string | null
          total_amount: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          purchase_id?: string | null
          reason?: string | null
          supplier_name?: string | null
          total_amount?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          purchase_id?: string | null
          reason?: string | null
          supplier_name?: string | null
          total_amount?: number
        }
        Relationships: []
      }
      purchases: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          organization_id: string
          product_id: string
          product_name: string
          quantity: number
          supplier_name: string | null
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          product_id: string
          product_name: string
          quantity: number
          supplier_name?: string | null
          total_price?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          supplier_name?: string | null
          total_price?: number
          unit_price?: number
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          product_name: string
          quantity: number
          sale_id: string
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          product_name: string
          quantity?: number
          sale_id: string
          total_price?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          sale_id?: string
          total_price?: number
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
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "view_sales_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          customer_name: string
          grand_total: number
          id: string
          is_voided: boolean
          organization_id: string
          paid_amount: number
          payment_type: Database["public"]["Enums"]["payment_type"]
          remaining: number
          void_reason: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          customer_name: string
          grand_total?: number
          id?: string
          is_voided?: boolean
          organization_id: string
          paid_amount?: number
          payment_type?: Database["public"]["Enums"]["payment_type"]
          remaining?: number
          void_reason?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          customer_name?: string
          grand_total?: number
          id?: string
          is_voided?: boolean
          organization_id?: string
          paid_amount?: number
          payment_type?: Database["public"]["Enums"]["payment_type"]
          remaining?: number
          void_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "view_customer_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_return_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          product_name: string
          quantity: number
          return_id: string
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          product_name: string
          quantity: number
          return_id: string
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          return_id?: string
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "sales_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_returns: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          customer_name: string
          id: string
          organization_id: string
          reason: string | null
          sale_id: string
          total_amount: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          customer_name: string
          id?: string
          organization_id: string
          reason?: string | null
          sale_id: string
          total_amount?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          customer_name?: string
          id?: string
          organization_id?: string
          reason?: string | null
          sale_id?: string
          total_amount?: number
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          destination_id: string | null
          destination_type: string
          id: string
          movement_type: string
          notes: string | null
          organization_id: string
          product_id: string
          quantity: number
          reference_id: string | null
          source_id: string | null
          source_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          destination_id?: string | null
          destination_type: string
          id?: string
          movement_type: string
          notes?: string | null
          organization_id: string
          product_id: string
          quantity: number
          reference_id?: string | null
          source_id?: string | null
          source_type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          destination_id?: string | null
          destination_type?: string
          id?: string
          movement_type?: string
          notes?: string | null
          organization_id?: string
          product_id?: string
          quantity?: number
          reference_id?: string | null
          source_id?: string | null
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          created_at: string
          description: string
          id: string
          is_read: boolean
          metadata: Json | null
          organization_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          organization_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          organization_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      customers_public: {
        Row: {
          balance: number | null
          created_at: string | null
          created_by: string | null
          id: string | null
          name: string | null
          organization_id: string | null
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          name?: string | null
          organization_id?: string | null
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          name?: string | null
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_employees_public: {
        Row: {
          created_at: string | null
          created_by: string | null
          employee_type: Database["public"]["Enums"]["employee_type"] | null
          expires_at: string | null
          id: string | null
          is_used: boolean | null
          name: string | null
          organization_id: string | null
          role: Database["public"]["Enums"]["user_role"] | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          employee_type?: Database["public"]["Enums"]["employee_type"] | null
          expires_at?: string | null
          id?: string | null
          is_used?: boolean | null
          name?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          employee_type?: Database["public"]["Enums"]["employee_type"] | null
          expires_at?: string | null
          id?: string | null
          is_used?: boolean | null
          name?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
        }
        Relationships: []
      }
      profiles_public: {
        Row: {
          created_at: string | null
          employee_type: Database["public"]["Enums"]["employee_type"] | null
          full_name: string | null
          id: string | null
          organization_id: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          employee_type?: Database["public"]["Enums"]["employee_type"] | null
          full_name?: string | null
          id?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          employee_type?: Database["public"]["Enums"]["employee_type"] | null
          full_name?: string | null
          id?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      view_customer_balances: {
        Row: {
          balance: number | null
          created_at: string | null
          id: string | null
          name: string | null
          organization_id: string | null
          phone: string | null
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          organization_id?: string | null
          phone?: string | null
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          organization_id?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      view_sales_summary: {
        Row: {
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          grand_total: number | null
          id: string | null
          is_voided: boolean | null
          organization_id: string | null
          paid_amount: number | null
          payment_type: Database["public"]["Enums"]["payment_type"] | null
          remaining: number | null
          timestamp: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          grand_total?: number | null
          id?: string | null
          is_voided?: boolean | null
          organization_id?: string | null
          paid_amount?: number | null
          payment_type?: Database["public"]["Enums"]["payment_type"] | null
          remaining?: number | null
          timestamp?: never
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          grand_total?: number | null
          id?: string | null
          is_voided?: boolean | null
          organization_id?: string | null
          paid_amount?: number | null
          payment_type?: Database["public"]["Enums"]["payment_type"] | null
          remaining?: number | null
          timestamp?: never
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "view_customer_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      activate_employee:
        | {
            Args: { p_activation_code: string; p_user_id: string }
            Returns: undefined
          }
        | {
            Args: { p_activation_code: string; p_user_id: string }
            Returns: undefined
          }
      activate_employee_oauth: {
        Args: {
          p_activation_code: string
          p_email: string
          p_full_name: string
          p_google_id: string
          p_user_id: string
        }
        Returns: Json
      }
      activate_license_oauth: {
        Args: {
          p_email: string
          p_full_name: string
          p_google_id: string
          p_license_key: string
          p_user_id: string
        }
        Returns: Json
      }
      add_collection_rpc: {
        Args: { p_amount: number; p_notes?: string; p_sale_id: string }
        Returns: string
      }
      add_employee_rpc: {
        Args: {
          p_name: string
          p_phone: string
          p_role: Database["public"]["Enums"]["user_role"]
          p_type: Database["public"]["Enums"]["employee_type"]
        }
        Returns: string
      }
      add_purchase_rpc: {
        Args: {
          p_notes?: string
          p_product_id: string
          p_quantity: number
          p_supplier_name?: string
          p_unit_price: number
        }
        Returns: string
      }
      bootstrap_developer_oauth: {
        Args: {
          p_bootstrap_code: string
          p_email: string
          p_full_name: string
          p_google_id: string
          p_user_id: string
        }
        Returns: Json
      }
      can_create_employee_type: {
        Args: {
          p_creator_employee_type: Database["public"]["Enums"]["employee_type"]
          p_creator_role: Database["public"]["Enums"]["user_role"]
          p_target_employee_type: Database["public"]["Enums"]["employee_type"]
        }
        Returns: boolean
      }
      check_ai_rate_limit: {
        Args: { p_request_hash?: string; p_user_id: string }
        Returns: Json
      }
      check_and_assign_developer_role: {
        Args: { p_email: string; p_full_name?: string; p_user_id: string }
        Returns: boolean
      }
      check_endpoint_rate_limit: {
        Args: {
          p_endpoint: string
          p_identifier: string
          p_max_requests?: number
          p_window_seconds?: number
        }
        Returns: Json
      }
      check_login_rate_limit: { Args: { p_ip_hash: string }; Returns: boolean }
      check_oauth_profile: { Args: { p_user_id: string }; Returns: Json }
      cleanup_old_audit_logs: { Args: never; Returns: undefined }
      cleanup_old_notifications: { Args: never; Returns: undefined }
      create_delivery_rpc: {
        Args: {
          p_distributor_id?: string
          p_distributor_name: string
          p_items: Json
          p_notes?: string
        }
        Returns: string
      }
      create_purchase_return_rpc: {
        Args: { p_items: Json; p_reason?: string; p_supplier_name?: string }
        Returns: string
      }
      create_sale_rpc:
        | { Args: { p_customer_id: string; p_items: Json }; Returns: string }
        | {
            Args: {
              p_customer_id: string
              p_items: Json
              p_payment_type?: string
            }
            Returns: string
          }
      create_sales_return_rpc: {
        Args: { p_items: Json; p_reason?: string; p_sale_id: string }
        Returns: string
      }
      deactivate_employee_rpc: {
        Args: { p_employee_id: string }
        Returns: Json
      }
      developer_exists: { Args: never; Returns: boolean }
      generate_invoice_number: {
        Args: { p_org_id: string; p_type: string }
        Returns: string
      }
      generate_license_key: { Args: never; Returns: string }
      get_active_employee_count: { Args: { p_org_id: string }; Returns: number }
      get_org_member_name: { Args: { _user_id: string }; Returns: string }
      get_organization_stats_rpc: { Args: never; Returns: Json }
      get_user_organization_id: { Args: { _user_id: string }; Returns: string }
      has_employee_type: {
        Args: {
          _type: Database["public"]["Enums"]["employee_type"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_same_organization: {
        Args: { _target_user_id: string; _user_id: string }
        Returns: boolean
      }
      issue_license_rpc:
        | {
            Args: {
              p_days?: number
              p_org_name: string
              p_type: Database["public"]["Enums"]["license_type"]
            }
            Returns: string
          }
        | {
            Args: {
              p_days?: number
              p_max_employees?: number
              p_org_name: string
              p_owner_phone?: string
              p_type: Database["public"]["Enums"]["license_type"]
            }
            Returns: string
          }
      log_audit_event: {
        Args: {
          p_action: string
          p_details?: Json
          p_organization_id?: string
          p_resource_id?: string
          p_resource_type: string
          p_severity?: string
          p_user_id: string
        }
        Returns: undefined
      }
      make_license_permanent_rpc: {
        Args: { p_license_id: string }
        Returns: undefined
      }
      reactivate_employee_rpc: {
        Args: { p_employee_id: string }
        Returns: Json
      }
      record_login_attempt: {
        Args: { p_email_hash: string; p_ip_hash: string; p_success: boolean }
        Returns: undefined
      }
      reverse_payment_rpc: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: undefined
      }
      save_invoice_snapshot: {
        Args: {
          p_customer_id: string
          p_customer_name: string
          p_grand_total: number
          p_items?: Json
          p_notes?: string
          p_paid_amount?: number
          p_payment_type?: string
          p_reason?: string
          p_reference_id: string
          p_remaining?: number
          p_type: string
        }
        Returns: string
      }
      secure_generate_license_key: { Args: never; Returns: string }
      transfer_to_main_warehouse_rpc: {
        Args: { p_items: Json }
        Returns: string
      }
      update_license_max_employees_rpc: {
        Args: { p_license_id: string; p_max_employees: number }
        Returns: Json
      }
      update_license_status_rpc: {
        Args: {
          p_license_id: string
          p_status: Database["public"]["Enums"]["license_status"]
        }
        Returns: undefined
      }
      use_license: {
        Args: { p_license_key: string; p_user_id: string }
        Returns: undefined
      }
      void_sale_rpc: {
        Args: { p_reason: string; p_sale_id: string }
        Returns: undefined
      }
    }
    Enums: {
      employee_type:
        | "FIELD_AGENT"
        | "ACCOUNTANT"
        | "SALES_MANAGER"
        | "WAREHOUSE_KEEPER"
      license_status: "READY" | "ACTIVE" | "SUSPENDED" | "EXPIRED"
      license_type: "TRIAL" | "PERMANENT"
      payment_type: "CASH" | "CREDIT"
      user_role: "DEVELOPER" | "OWNER" | "EMPLOYEE"
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
      employee_type: [
        "FIELD_AGENT",
        "ACCOUNTANT",
        "SALES_MANAGER",
        "WAREHOUSE_KEEPER",
      ],
      license_status: ["READY", "ACTIVE", "SUSPENDED", "EXPIRED"],
      license_type: ["TRIAL", "PERMANENT"],
      payment_type: ["CASH", "CREDIT"],
      user_role: ["DEVELOPER", "OWNER", "EMPLOYEE"],
    },
  },
} as const
