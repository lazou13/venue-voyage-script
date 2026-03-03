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
      app_configs: {
        Row: {
          created_at: string
          id: string
          key: string
          payload: Json
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          payload: Json
          status: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          payload?: Json
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      avatars: {
        Row: {
          age: string
          created_at: string | null
          id: string
          image_url: string
          name: string
          outfit: string
          persona: string
          project_id: string | null
          style: string
        }
        Insert: {
          age: string
          created_at?: string | null
          id?: string
          image_url: string
          name: string
          outfit: string
          persona: string
          project_id?: string | null
          style: string
        }
        Update: {
          age?: string
          created_at?: string | null
          id?: string
          image_url?: string
          name?: string
          outfit?: string
          persona?: string
          project_id?: string | null
          style?: string
        }
        Relationships: [
          {
            foreignKeyName: "avatars_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      forbidden_zones: {
        Row: {
          id: string
          project_id: string
          reason: string | null
          zone: string
        }
        Insert: {
          id?: string
          project_id: string
          reason?: string | null
          zone: string
        }
        Update: {
          id?: string
          project_id?: string
          reason?: string | null
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "forbidden_zones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      medina_pois: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          lat: number | null
          lng: number | null
          metadata: Json
          name: string
          radius_m: number
          step_config: Json
          updated_at: string
          zone: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          metadata?: Json
          name: string
          radius_m?: number
          step_config?: Json
          updated_at?: string
          zone?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          metadata?: Json
          name?: string
          radius_m?: number
          step_config?: Json
          updated_at?: string
          zone?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount_total: number | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string
          experience_mode: string
          id: string
          locale: string
          metadata: Json
          notes: string | null
          party_size: number
          payment_status: string
          project_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_total?: number | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string
          experience_mode?: string
          id?: string
          locale?: string
          metadata?: Json
          notes?: string | null
          party_size?: number
          payment_status?: string
          project_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_total?: number | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string
          experience_mode?: string
          id?: string
          locale?: string
          metadata?: Json
          notes?: string | null
          party_size?: number
          payment_status?: string
          project_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      poi_media: {
        Row: {
          caption: string | null
          created_at: string
          duration_sec: number | null
          extra: Json
          id: string
          is_cover: boolean
          media_type: string
          medina_poi_id: string
          mime_type: string | null
          role_tags: Json
          size_bytes: number | null
          sort_order: number
          storage_bucket: string
          storage_path: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          duration_sec?: number | null
          extra?: Json
          id?: string
          is_cover?: boolean
          media_type: string
          medina_poi_id: string
          mime_type?: string | null
          role_tags?: Json
          size_bytes?: number | null
          sort_order?: number
          storage_bucket?: string
          storage_path: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          duration_sec?: number | null
          extra?: Json
          id?: string
          is_cover?: boolean
          media_type?: string
          medina_poi_id?: string
          mime_type?: string | null
          role_tags?: Json
          size_bytes?: number | null
          sort_order?: number
          storage_bucket?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "poi_media_medina_poi_id_fkey"
            columns: ["medina_poi_id"]
            isOneToOne: false
            referencedRelation: "medina_pois"
            referencedColumns: ["id"]
          },
        ]
      }
      pois: {
        Row: {
          created_at: string
          id: string
          interaction: Database["public"]["Enums"]["interaction_type"]
          library_poi_id: string | null
          minutes_from_prev: number | null
          name: string
          notes: string | null
          photo_url: string | null
          project_id: string
          risk: Database["public"]["Enums"]["risk_level"]
          sort_order: number
          step_config: Json
          zone: string
        }
        Insert: {
          created_at?: string
          id?: string
          interaction?: Database["public"]["Enums"]["interaction_type"]
          library_poi_id?: string | null
          minutes_from_prev?: number | null
          name: string
          notes?: string | null
          photo_url?: string | null
          project_id: string
          risk?: Database["public"]["Enums"]["risk_level"]
          sort_order?: number
          step_config?: Json
          zone: string
        }
        Update: {
          created_at?: string
          id?: string
          interaction?: Database["public"]["Enums"]["interaction_type"]
          library_poi_id?: string | null
          minutes_from_prev?: number | null
          name?: string
          notes?: string | null
          photo_url?: string | null
          project_id?: string
          risk?: Database["public"]["Enums"]["risk_level"]
          sort_order?: number
          step_config?: Json
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "pois_library_poi_id_fkey"
            columns: ["library_poi_id"]
            isOneToOne: false
            referencedRelation: "medina_pois"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pois_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          city: string
          created_at: string
          difficulty: Database["public"]["Enums"]["difficulty_level"] | null
          floors: number
          hotel_name: string
          id: string
          is_complete: boolean | null
          map_uploaded_at: string | null
          map_url: string | null
          props_allowed: boolean | null
          quest_config: Json
          reset_time_mins: number | null
          staff_available: boolean | null
          story_i18n: Json
          target_duration_mins: number | null
          theme: string | null
          title_i18n: Json
          updated_at: string
          visit_date: string | null
        }
        Insert: {
          city: string
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"] | null
          floors?: number
          hotel_name: string
          id?: string
          is_complete?: boolean | null
          map_uploaded_at?: string | null
          map_url?: string | null
          props_allowed?: boolean | null
          quest_config?: Json
          reset_time_mins?: number | null
          staff_available?: boolean | null
          story_i18n?: Json
          target_duration_mins?: number | null
          theme?: string | null
          title_i18n?: Json
          updated_at?: string
          visit_date?: string | null
        }
        Update: {
          city?: string
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"] | null
          floors?: number
          hotel_name?: string
          id?: string
          is_complete?: boolean | null
          map_uploaded_at?: string | null
          map_url?: string | null
          props_allowed?: boolean | null
          quest_config?: Json
          reset_time_mins?: number | null
          staff_available?: boolean | null
          story_i18n?: Json
          target_duration_mins?: number | null
          theme?: string | null
          title_i18n?: Json
          updated_at?: string
          visit_date?: string | null
        }
        Relationships: []
      }
      quest_instances: {
        Row: {
          access_token: string
          created_at: string
          device_id: string | null
          device_uses: number
          devices_allowed: number
          expires_at: string | null
          id: string
          order_id: string
          project_id: string
          score: Json
          starts_at: string | null
          status: string
          ttl_minutes: number
          updated_at: string
        }
        Insert: {
          access_token?: string
          created_at?: string
          device_id?: string | null
          device_uses?: number
          devices_allowed?: number
          expires_at?: string | null
          id?: string
          order_id: string
          project_id: string
          score?: Json
          starts_at?: string | null
          status?: string
          ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          device_id?: string | null
          device_uses?: number
          devices_allowed?: number
          expires_at?: string | null
          id?: string
          order_id?: string
          project_id?: string
          score?: Json
          starts_at?: string | null
          status?: string
          ttl_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quest_instances_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quest_instances_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      route_markers: {
        Row: {
          audio_url: string | null
          created_at: string
          id: string
          lat: number
          lng: number
          note: string | null
          photo_url: string | null
          trace_id: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          id?: string
          lat: number
          lng: number
          note?: string | null
          photo_url?: string | null
          trace_id: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          note?: string | null
          photo_url?: string | null
          trace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_markers_trace_id_fkey"
            columns: ["trace_id"]
            isOneToOne: false
            referencedRelation: "route_traces"
            referencedColumns: ["id"]
          },
        ]
      }
      route_traces: {
        Row: {
          created_at: string
          distance_meters: number | null
          ended_at: string | null
          geojson: Json
          id: string
          name: string | null
          project_id: string
          started_at: string | null
        }
        Insert: {
          created_at?: string
          distance_meters?: number | null
          ended_at?: string | null
          geojson?: Json
          id?: string
          name?: string | null
          project_id: string
          started_at?: string | null
        }
        Update: {
          created_at?: string
          distance_meters?: number | null
          ended_at?: string | null
          geojson?: Json
          id?: string
          name?: string | null
          project_id?: string
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "route_traces_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
      wifi_zones: {
        Row: {
          id: string
          project_id: string
          strength: Database["public"]["Enums"]["wifi_strength"]
          zone: string
        }
        Insert: {
          id?: string
          project_id: string
          strength?: Database["public"]["Enums"]["wifi_strength"]
          zone: string
        }
        Update: {
          id?: string
          project_id?: string
          strength?: Database["public"]["Enums"]["wifi_strength"]
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "wifi_zones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_data: { Args: never; Returns: Json }
      find_catalog_project: {
        Args: { p_slug: string }
        Returns: {
          id: string
          quest_config: Json
          title_i18n: Json
        }[]
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
      app_role: "admin"
      difficulty_level: "easy" | "medium" | "hard"
      interaction_type:
        | "puzzle"
        | "qr_scan"
        | "photo"
        | "hidden_object"
        | "npc"
        | "audio"
        | "storytelling"
        | "video"
      risk_level: "low" | "medium" | "high"
      wifi_strength: "ok" | "weak" | "dead"
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
      app_role: ["admin"],
      difficulty_level: ["easy", "medium", "hard"],
      interaction_type: [
        "puzzle",
        "qr_scan",
        "photo",
        "hidden_object",
        "npc",
        "audio",
        "storytelling",
        "video",
      ],
      risk_level: ["low", "medium", "high"],
      wifi_strength: ["ok", "weak", "dead"],
    },
  },
} as const
