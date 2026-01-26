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
      pois: {
        Row: {
          created_at: string
          id: string
          interaction: Database["public"]["Enums"]["interaction_type"]
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
      [_ in never]: never
    }
    Enums: {
      difficulty_level: "easy" | "medium" | "hard"
      interaction_type:
        | "puzzle"
        | "qr_scan"
        | "photo"
        | "hidden_object"
        | "npc"
        | "audio"
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
      difficulty_level: ["easy", "medium", "hard"],
      interaction_type: [
        "puzzle",
        "qr_scan",
        "photo",
        "hidden_object",
        "npc",
        "audio",
      ],
      risk_level: ["low", "medium", "high"],
      wifi_strength: ["ok", "weak", "dead"],
    },
  },
} as const
