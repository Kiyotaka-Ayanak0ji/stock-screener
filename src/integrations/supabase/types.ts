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
      app_reviews: {
        Row: {
          created_at: string
          designation: string | null
          display_name: string | null
          id: string
          is_approved: boolean
          rating: number
          review: string
          user_id: string
        }
        Insert: {
          created_at?: string
          designation?: string | null
          display_name?: string | null
          id?: string
          is_approved?: boolean
          rating: number
          review: string
          user_id: string
        }
        Update: {
          created_at?: string
          designation?: string | null
          display_name?: string | null
          id?: string
          is_approved?: boolean
          rating?: number
          review?: string
          user_id?: string
        }
        Relationships: []
      }
      cached_stock_prices: {
        Row: {
          change: number
          change_percent: number
          exchange: string
          high: number
          low: number
          market_cap: number
          name: string
          open_price: number
          pe: number
          previous_close: number
          price: number
          ticker: string
          updated_at: string
          volume: number
        }
        Insert: {
          change: number
          change_percent: number
          exchange: string
          high: number
          low: number
          market_cap: number
          name: string
          open_price: number
          pe?: number
          previous_close: number
          price: number
          ticker: string
          updated_at?: string
          volume: number
        }
        Update: {
          change?: number
          change_percent?: number
          exchange?: string
          high?: number
          low?: number
          market_cap?: number
          name?: string
          open_price?: number
          pe?: number
          previous_close?: number
          price?: number
          ticker?: string
          updated_at?: string
          volume?: number
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      portfolio_holdings: {
        Row: {
          buy_date: string
          buy_price: number
          created_at: string
          exchange: string
          id: string
          quantity: number
          sector: string | null
          ticker: string
          updated_at: string
          user_id: string
        }
        Insert: {
          buy_date?: string
          buy_price: number
          created_at?: string
          exchange?: string
          id?: string
          quantity: number
          sector?: string | null
          ticker: string
          updated_at?: string
          user_id: string
        }
        Update: {
          buy_date?: string
          buy_price?: number
          created_at?: string
          exchange?: string
          id?: string
          quantity?: number
          sector?: string | null
          ticker?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email_opt_in: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email_opt_in?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email_opt_in?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sector_cache: {
        Row: {
          created_at: string
          sector: string
          source: string
          ticker: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          sector: string
          source?: string
          ticker: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          sector?: string
          source?: string
          ticker?: string
          updated_at?: string
        }
        Relationships: []
      }
      shared_watchlists: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          owner_id: string
          share_token: string
          stock_data: Json | null
          tickers: string
          watchlist_name: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          owner_id: string
          share_token: string
          stock_data?: Json | null
          tickers: string
          watchlist_name: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          owner_id?: string
          share_token?: string
          stock_data?: Json | null
          tickers?: string
          watchlist_name?: string
        }
        Relationships: []
      }
      stock_price_history: {
        Row: {
          exchange: string
          id: number
          price: number
          recorded_at: string
          ticker: string
        }
        Insert: {
          exchange: string
          id?: number
          price: number
          recorded_at?: string
          ticker: string
        }
        Update: {
          exchange?: string
          id?: number
          price?: number
          recorded_at?: string
          ticker?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          column_visibility: string | null
          created_at: string
          custom_column_data: string | null
          custom_columns: string | null
          events: string | null
          id: string
          notes: string | null
          price_triggers: string | null
          updated_at: string
          user_id: string
          watchlist: string | null
        }
        Insert: {
          column_visibility?: string | null
          created_at?: string
          custom_column_data?: string | null
          custom_columns?: string | null
          events?: string | null
          id?: string
          notes?: string | null
          price_triggers?: string | null
          updated_at?: string
          user_id: string
          watchlist?: string | null
        }
        Update: {
          column_visibility?: string | null
          created_at?: string
          custom_column_data?: string | null
          custom_columns?: string | null
          events?: string | null
          id?: string
          notes?: string | null
          price_triggers?: string | null
          updated_at?: string
          user_id?: string
          watchlist?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          amount_inr: number | null
          amount_usd: number | null
          created_at: string
          id: string
          payment_method: string | null
          plan: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          status: string
          subscription_ends_at: string | null
          subscription_starts_at: string | null
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_inr?: number | null
          amount_usd?: number | null
          created_at?: string
          id?: string
          payment_method?: string | null
          plan?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string
          subscription_ends_at?: string | null
          subscription_starts_at?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_inr?: number | null
          amount_usd?: number | null
          created_at?: string
          id?: string
          payment_method?: string | null
          plan?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string
          subscription_ends_at?: string | null
          subscription_starts_at?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_watchlists: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          tickers: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          tickers: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          tickers?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
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
