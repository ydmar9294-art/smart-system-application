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
          updated_at: string
          version_code: number
          version_name: string
        }
        Insert: {
          created_at?: string
          force_update?: boolean
          id?: string
          is_active?: boolean
          min_required_version?: string
          platform: string
          release_notes?: string | null
          update_url?: string | null
          updated_at?: string
          version_code?: number
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
          updated_at?: string
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
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          organization_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          organization_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          organization_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          amount: number
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
      deletion_requests: {
        Row: {
          approval_status: string
          approved_at: string | null
          created_at: string
          executed_at: string | null
          executed_by: string | null
          id: string
          organization_id: string
          owner_id: string
          request_date: string
          request_method: string
          request_notes: string | null
          verification_method: string | null
          verification_notes: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          created_at?: string
          executed_at?: string | null
          executed_by?: string | null
          id?: string
          organization_id: string
          owner_id: string
          request_date?: string
          request_method: string
          request_notes?: string | null
          verification_method?: string | null
          verification_notes?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          created_at?: string
          executed_at?: string | null
          executed_by?: string | null
          id?: string
          organization_id?: string
          owner_id?: string
          request_date?: string
          request_method?: string
          request_notes?: string | null
          verification_method?: string | null
          verification_notes?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deletion_requests_organization_id_fkey"
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
        Relationships: [
          {
            foreignKeyName: "deliveries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_allowlist: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      developer_licenses: {
        Row: {
          created_at: string
          days_valid: number | null
          expiryDate: string | null
          id: string
          issuedAt: string
          licenseKey: string
          max_employees: number
          organization_id: string | null
          orgName: string
          owner_phone: string | null
          ownerId: string | null
          status: string
          type: string
        }
        Insert: {
          created_at?: string
          days_valid?: number | null
          expiryDate?: string | null
          id?: string
          issuedAt?: string
          licenseKey: string
          max_employees?: number
          organization_id?: string | null
          orgName: string
          owner_phone?: string | null
          ownerId?: string | null
          status?: string
          type?: string
        }
        Update: {
          created_at?: string
          days_valid?: number | null
          expiryDate?: string | null
          id?: string
          issuedAt?: string
          licenseKey?: string
          max_employees?: number
          organization_id?: string | null
          orgName?: string
          owner_phone?: string | null
          ownerId?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_licenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          created_at: string
          device_id: string
          device_name: string
          id: string
          is_active: boolean
          last_seen: string
          replaced_device_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          device_name?: string
          id?: string
          is_active?: boolean
          last_seen?: string
          replaced_device_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          device_name?: string
          id?: string
          is_active?: boolean
          last_seen?: string
          replaced_device_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      distributor_inventory: {
        Row: {
          distributor_id: string
          id: string
          organization_id: string
          product_id: string
          product_name: string
          quantity: number
          updated_at: string
        }
        Insert: {
          distributor_id: string
          id?: string
          organization_id: string
          product_id: string
          product_name: string
          quantity?: number
          updated_at?: string
        }
        Update: {
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
          items: Json | null
          legal_info: Json | null
          notes: string | null
          org_name: string | null
          organization_id: string
          paid_amount: number | null
          payment_type: string | null
          reason: string | null
          reference_id: string | null
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
          items?: Json | null
          legal_info?: Json | null
          notes?: string | null
          org_name?: string | null
          organization_id: string
          paid_amount?: number | null
          payment_type?: string | null
          reason?: string | null
          reference_id?: string | null
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
          items?: Json | null
          legal_info?: Json | null
          notes?: string | null
          org_name?: string | null
          organization_id?: string
          paid_amount?: number | null
          payment_type?: string | null
          reason?: string | null
          reference_id?: string | null
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
      organization_legal_info: {
        Row: {
          commercial_registration: string | null
          created_at: string
          id: string
          industrial_registration: string | null
          organization_id: string
          stamp_url: string | null
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
          stamp_url?: string | null
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
          stamp_url?: string | null
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
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
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
          employee_type: string
          id: string
          is_used: boolean
          name: string
          organization_id: string
          phone: string | null
          role: string
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          activation_code: string
          created_at?: string
          created_by?: string | null
          employee_type: string
          id?: string
          is_used?: boolean
          name: string
          organization_id: string
          phone?: string | null
          role?: string
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          activation_code?: string
          created_at?: string
          created_by?: string | null
          employee_type?: string
          id?: string
          is_used?: boolean
          name?: string
          organization_id?: string
          phone?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          employee_type: string | null
          full_name: string | null
          id: string
          is_active: boolean
          license_key: string | null
          organization_id: string | null
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          employee_type?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          license_key?: string | null
          organization_id?: string | null
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          employee_type?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          license_key?: string | null
          organization_id?: string | null
          phone?: string | null
          role?: string
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
            foreignKeyName: "purchase_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
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
          reason: string | null
          supplier_name: string | null
          total_amount: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          reason?: string | null
          supplier_name?: string | null
          total_amount?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          reason?: string | null
          supplier_name?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_returns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          total_price: number
          unit_price: number
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
        Relationships: [
          {
            foreignKeyName: "purchases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          endpoint: string
          id: string
          identifier: string
          request_count: number
          window_start: string
        }
        Insert: {
          endpoint: string
          id?: string
          identifier: string
          request_count?: number
          window_start?: string
        }
        Update: {
          endpoint?: string
          id?: string
          identifier?: string
          request_count?: number
          window_start?: string
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
          quantity: number
          sale_id: string
          total_price: number
          unit_price: number
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
          payment_type: string
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
          payment_type?: string
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
          payment_type?: string
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
            foreignKeyName: "sales_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
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
          customer_name: string
          id: string
          organization_id: string
          reason: string | null
          sale_id: string | null
          total_amount: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_name: string
          id?: string
          organization_id: string
          reason?: string | null
          sale_id?: string | null
          total_amount?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_name?: string
          id?: string
          organization_id?: string
          reason?: string | null
          sale_id?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_returns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
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
      user_consents: {
        Row: {
          accepted_at: string
          app_version: string
          consent_type: string
          id: string
          ip_address: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          app_version?: string
          consent_type?: string
          id?: string
          ip_address?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          app_version?: string
          consent_type?: string
          id?: string
          ip_address?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          created_at: string
          data: Json | null
          description: string | null
          id: string
          is_read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          description?: string | null
          id?: string
          is_read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          description?: string | null
          id?: string
          is_read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
          p_role: string
          p_type: string
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
      check_and_assign_developer_role: {
        Args: { p_email: string; p_full_name?: string; p_user_id: string }
        Returns: undefined
      }
      check_email_exists_rpc: { Args: { p_email: string }; Returns: boolean }
      check_endpoint_rate_limit: {
        Args: {
          p_endpoint: string
          p_identifier: string
          p_max_requests?: number
          p_window_seconds?: number
        }
        Returns: Json
      }
      create_delivery_rpc: {
        Args: {
          p_distributor_id?: string
          p_distributor_name: string
          p_items: Json
          p_notes?: string
        }
        Returns: string
      }
      create_distributor_return_rpc: {
        Args: { p_items: Json; p_reason?: string; p_sale_id: string }
        Returns: string
      }
      create_distributor_sale_rpc: {
        Args: { p_customer_id: string; p_items: Json; p_payment_type?: string }
        Returns: string
      }
      create_purchase_return_rpc: {
        Args: { p_items: Json; p_reason?: string; p_supplier_name?: string }
        Returns: string
      }
      create_sale_rpc: {
        Args: { p_customer_id: string; p_items: Json; p_payment_type?: string }
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
      delete_own_account_rpc: { Args: never; Returns: Json }
      execute_org_deletion_rpc: {
        Args: { p_confirmation_org_name: string; p_deletion_request_id: string }
        Returns: Json
      }
      get_my_org_id: { Args: never; Returns: string }
      get_my_role: { Args: never; Returns: string }
      get_organization_stats_rpc: {
        Args: never
        Returns: {
          employee_count: number
          expiry_date: string
          license_id: string
          license_status: string
          license_type: string
          max_employees: number
          org_id: string
          org_name: string
          pending_employees: number
          total_collections: number
          total_customers: number
          total_deliveries: number
          total_products: number
          total_purchases: number
          total_records: number
          total_revenue: number
          total_sales: number
          total_users: number
        }[]
      }
      is_developer: { Args: never; Returns: boolean }
      issue_license_rpc: {
        Args: {
          p_days: number
          p_max_employees?: number
          p_org_name: string
          p_owner_phone?: string
          p_type: string
        }
        Returns: string
      }
      make_license_permanent_rpc: {
        Args: { p_license_id: string }
        Returns: undefined
      }
      reactivate_employee_rpc: {
        Args: { p_employee_id: string }
        Returns: Json
      }
      reverse_payment_rpc: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: undefined
      }
      transfer_to_main_warehouse_rpc: {
        Args: { p_items: Json }
        Returns: undefined
      }
      update_license_max_employees_rpc: {
        Args: { p_license_id: string; p_max_employees: number }
        Returns: Json
      }
      update_license_status_rpc: {
        Args: { p_license_id: string; p_status: string }
        Returns: undefined
      }
      void_sale_rpc: {
        Args: { p_reason: string; p_sale_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
