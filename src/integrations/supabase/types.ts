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
      api_keys: {
        Row: {
          app_id: string | null
          app_name: string
          created_at: string | null
          id: string
          is_active: boolean | null
          key: string
          last_used_at: string | null
          rate_limit: number | null
          requests_count: number | null
        }
        Insert: {
          app_id?: string | null
          app_name: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key: string
          last_used_at?: string | null
          rate_limit?: number | null
          requests_count?: number | null
        }
        Update: {
          app_id?: string | null
          app_name?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key?: string
          last_used_at?: string | null
          rate_limit?: number | null
          requests_count?: number | null
        }
        Relationships: []
      }
      api_usage: {
        Row: {
          api_key_id: string | null
          created_at: string | null
          id: string
          request_count: number | null
          window_start: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string | null
          id?: string
          request_count?: number | null
          window_start?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string | null
          id?: string
          request_count?: number | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
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
      client_photos: {
        Row: {
          caption: string | null
          id: string
          is_approved: boolean | null
          metadata: Json | null
          photo_type: string | null
          photo_url: string
          player_email: string | null
          poi_id: string | null
          quality_score: number | null
          quest_code: string | null
          taken_at: string | null
        }
        Insert: {
          caption?: string | null
          id?: string
          is_approved?: boolean | null
          metadata?: Json | null
          photo_type?: string | null
          photo_url: string
          player_email?: string | null
          poi_id?: string | null
          quality_score?: number | null
          quest_code?: string | null
          taken_at?: string | null
        }
        Update: {
          caption?: string | null
          id?: string
          is_approved?: boolean | null
          metadata?: Json | null
          photo_type?: string | null
          photo_url?: string
          player_email?: string | null
          poi_id?: string | null
          quality_score?: number | null
          quest_code?: string | null
          taken_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_photos_poi_id_fkey"
            columns: ["poi_id"]
            isOneToOne: false
            referencedRelation: "medina_pois"
            referencedColumns: ["id"]
          },
        ]
      }
      client_poi_recommendations: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          medina_poi_id: string | null
          photo_url: string | null
          poi_name: string | null
          rating: number | null
          reviewed_at: string | null
          source_instance_id: string | null
          source_project: string | null
          status: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          medina_poi_id?: string | null
          photo_url?: string | null
          poi_name?: string | null
          rating?: number | null
          reviewed_at?: string | null
          source_instance_id?: string | null
          source_project?: string | null
          status?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          medina_poi_id?: string | null
          photo_url?: string | null
          poi_name?: string | null
          rating?: number | null
          reviewed_at?: string | null
          source_instance_id?: string | null
          source_project?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_poi_recommendations_medina_poi_id_fkey"
            columns: ["medina_poi_id"]
            isOneToOne: false
            referencedRelation: "medina_pois"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_poi_recommendations_source_instance_id_fkey"
            columns: ["source_instance_id"]
            isOneToOne: false
            referencedRelation: "quest_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      client_recommendations: {
        Row: {
          admin_notes: string | null
          category_suggestion: string | null
          comment: string
          created_at: string | null
          id: string
          lat: number | null
          lng: number | null
          photo_url: string | null
          player_email: string | null
          poi_id: string | null
          poi_name: string | null
          quest_code: string | null
          rating: number | null
          status: string | null
        }
        Insert: {
          admin_notes?: string | null
          category_suggestion?: string | null
          comment: string
          created_at?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          photo_url?: string | null
          player_email?: string | null
          poi_id?: string | null
          poi_name?: string | null
          quest_code?: string | null
          rating?: number | null
          status?: string | null
        }
        Update: {
          admin_notes?: string | null
          category_suggestion?: string | null
          comment?: string
          created_at?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          photo_url?: string | null
          player_email?: string | null
          poi_id?: string | null
          poi_name?: string | null
          quest_code?: string | null
          rating?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_recommendations_poi_id_fkey"
            columns: ["poi_id"]
            isOneToOne: false
            referencedRelation: "medina_pois"
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
      generated_quests: {
        Row: {
          difficulty: string
          generated_at: string | null
          id: string
          mode: string
          played_at: string | null
          player_session_id: string | null
          start_lat: number
          start_lng: number
          start_name: string | null
          stops_data: Json | null
          theme: string
          total_distance_m: number | null
          total_points: number | null
          total_stops: number | null
          total_time_min: number | null
        }
        Insert: {
          difficulty: string
          generated_at?: string | null
          id: string
          mode: string
          played_at?: string | null
          player_session_id?: string | null
          start_lat: number
          start_lng: number
          start_name?: string | null
          stops_data?: Json | null
          theme: string
          total_distance_m?: number | null
          total_points?: number | null
          total_stops?: number | null
          total_time_min?: number | null
        }
        Update: {
          difficulty?: string
          generated_at?: string | null
          id?: string
          mode?: string
          played_at?: string | null
          player_session_id?: string | null
          start_lat?: number
          start_lng?: number
          start_name?: string | null
          stops_data?: Json | null
          theme?: string
          total_distance_m?: number | null
          total_points?: number | null
          total_stops?: number | null
          total_time_min?: number | null
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          bbox: Json | null
          completed_at: string | null
          created_at: string | null
          error_msg: string | null
          id: string
          params: Json | null
          pois_added: number | null
          pois_merged: number | null
          pois_updated: number | null
          source: string
          started_at: string | null
          status: string
        }
        Insert: {
          bbox?: Json | null
          completed_at?: string | null
          created_at?: string | null
          error_msg?: string | null
          id?: string
          params?: Json | null
          pois_added?: number | null
          pois_merged?: number | null
          pois_updated?: number | null
          source: string
          started_at?: string | null
          status?: string
        }
        Update: {
          bbox?: Json | null
          completed_at?: string | null
          created_at?: string | null
          error_msg?: string | null
          id?: string
          params?: Json | null
          pois_added?: number | null
          pois_merged?: number | null
          pois_updated?: number | null
          source?: string
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      medina_pois: {
        Row: {
          accessibility_notes: string | null
          address: string | null
          agent_enriched_at: string | null
          audience_tags: string[] | null
          best_client_photo_url: string | null
          best_time_visit: string | null
          category: string
          category_ai: string | null
          category_google: string | null
          challenge: string | null
          client_photos_count: number | null
          created_at: string
          crowd_level: string | null
          data_sources: string[] | null
          description_short: string | null
          district: string | null
          enrichment_quality: string | null
          enrichment_status: string | null
          foursquare_id: string | null
          fun_fact_en: string | null
          fun_fact_fr: string | null
          geom: unknown
          google_raw: Json | null
          history_context: string | null
          hub_theme: string | null
          id: string
          instagram_score: number | null
          instagram_spot: boolean | null
          instagram_tips: string | null
          is_active: boolean
          is_photo_spot: boolean | null
          is_start_hub: boolean
          last_enriched_at: string | null
          last_visited_at: string | null
          lat: number | null
          lng: number | null
          local_anecdote: string | null
          local_anecdote_en: string | null
          local_anecdote_fr: string | null
          metadata: Json
          must_see_details: string | null
          must_try: string | null
          must_visit_nearby: string | null
          name: string
          name_ar: string | null
          name_en: string | null
          name_fr: string | null
          nearby_pois_data: Json | null
          nearby_pois_ids: string[] | null
          nearby_restaurants: Json | null
          nearest_node_id: number | null
          opening_hours: Json | null
          osm_id: string | null
          phone: string | null
          photo_spot_score: number | null
          photo_tip: string | null
          place_id: string | null
          poi_quality_score: number | null
          price_info: string | null
          radius_m: number
          rating: number | null
          recommendations_count: number | null
          reviews_count: number | null
          riddle_easy: string | null
          riddle_hard: string | null
          riddle_medium: string | null
          route_tags: string[] | null
          ruelle_etroite: boolean | null
          souks_nearby: string[] | null
          status: string
          step_config: Json
          street_food_details: string | null
          street_food_spot: boolean | null
          street_type: string | null
          subcategory: string | null
          terrain_validated: boolean | null
          terrain_validated_at: string | null
          tourist_interest: string | null
          updated_at: string
          validated_at: string | null
          visit_count: number | null
          visit_route: Json | null
          website: string | null
          website_url: string | null
          wikidata_id: string | null
          wikipedia_summary: string | null
          zone: string
        }
        Insert: {
          accessibility_notes?: string | null
          address?: string | null
          agent_enriched_at?: string | null
          audience_tags?: string[] | null
          best_client_photo_url?: string | null
          best_time_visit?: string | null
          category?: string
          category_ai?: string | null
          category_google?: string | null
          challenge?: string | null
          client_photos_count?: number | null
          created_at?: string
          crowd_level?: string | null
          data_sources?: string[] | null
          description_short?: string | null
          district?: string | null
          enrichment_quality?: string | null
          enrichment_status?: string | null
          foursquare_id?: string | null
          fun_fact_en?: string | null
          fun_fact_fr?: string | null
          geom?: unknown
          google_raw?: Json | null
          history_context?: string | null
          hub_theme?: string | null
          id?: string
          instagram_score?: number | null
          instagram_spot?: boolean | null
          instagram_tips?: string | null
          is_active?: boolean
          is_photo_spot?: boolean | null
          is_start_hub?: boolean
          last_enriched_at?: string | null
          last_visited_at?: string | null
          lat?: number | null
          lng?: number | null
          local_anecdote?: string | null
          local_anecdote_en?: string | null
          local_anecdote_fr?: string | null
          metadata?: Json
          must_see_details?: string | null
          must_try?: string | null
          must_visit_nearby?: string | null
          name: string
          name_ar?: string | null
          name_en?: string | null
          name_fr?: string | null
          nearby_pois_data?: Json | null
          nearby_pois_ids?: string[] | null
          nearby_restaurants?: Json | null
          nearest_node_id?: number | null
          opening_hours?: Json | null
          osm_id?: string | null
          phone?: string | null
          photo_spot_score?: number | null
          photo_tip?: string | null
          place_id?: string | null
          poi_quality_score?: number | null
          price_info?: string | null
          radius_m?: number
          rating?: number | null
          recommendations_count?: number | null
          reviews_count?: number | null
          riddle_easy?: string | null
          riddle_hard?: string | null
          riddle_medium?: string | null
          route_tags?: string[] | null
          ruelle_etroite?: boolean | null
          souks_nearby?: string[] | null
          status?: string
          step_config?: Json
          street_food_details?: string | null
          street_food_spot?: boolean | null
          street_type?: string | null
          subcategory?: string | null
          terrain_validated?: boolean | null
          terrain_validated_at?: string | null
          tourist_interest?: string | null
          updated_at?: string
          validated_at?: string | null
          visit_count?: number | null
          visit_route?: Json | null
          website?: string | null
          website_url?: string | null
          wikidata_id?: string | null
          wikipedia_summary?: string | null
          zone?: string
        }
        Update: {
          accessibility_notes?: string | null
          address?: string | null
          agent_enriched_at?: string | null
          audience_tags?: string[] | null
          best_client_photo_url?: string | null
          best_time_visit?: string | null
          category?: string
          category_ai?: string | null
          category_google?: string | null
          challenge?: string | null
          client_photos_count?: number | null
          created_at?: string
          crowd_level?: string | null
          data_sources?: string[] | null
          description_short?: string | null
          district?: string | null
          enrichment_quality?: string | null
          enrichment_status?: string | null
          foursquare_id?: string | null
          fun_fact_en?: string | null
          fun_fact_fr?: string | null
          geom?: unknown
          google_raw?: Json | null
          history_context?: string | null
          hub_theme?: string | null
          id?: string
          instagram_score?: number | null
          instagram_spot?: boolean | null
          instagram_tips?: string | null
          is_active?: boolean
          is_photo_spot?: boolean | null
          is_start_hub?: boolean
          last_enriched_at?: string | null
          last_visited_at?: string | null
          lat?: number | null
          lng?: number | null
          local_anecdote?: string | null
          local_anecdote_en?: string | null
          local_anecdote_fr?: string | null
          metadata?: Json
          must_see_details?: string | null
          must_try?: string | null
          must_visit_nearby?: string | null
          name?: string
          name_ar?: string | null
          name_en?: string | null
          name_fr?: string | null
          nearby_pois_data?: Json | null
          nearby_pois_ids?: string[] | null
          nearby_restaurants?: Json | null
          nearest_node_id?: number | null
          opening_hours?: Json | null
          osm_id?: string | null
          phone?: string | null
          photo_spot_score?: number | null
          photo_tip?: string | null
          place_id?: string | null
          poi_quality_score?: number | null
          price_info?: string | null
          radius_m?: number
          rating?: number | null
          recommendations_count?: number | null
          reviews_count?: number | null
          riddle_easy?: string | null
          riddle_hard?: string | null
          riddle_medium?: string | null
          route_tags?: string[] | null
          ruelle_etroite?: boolean | null
          souks_nearby?: string[] | null
          status?: string
          step_config?: Json
          street_food_details?: string | null
          street_food_spot?: boolean | null
          street_type?: string | null
          subcategory?: string | null
          terrain_validated?: boolean | null
          terrain_validated_at?: string | null
          tourist_interest?: string | null
          updated_at?: string
          validated_at?: string | null
          visit_count?: number | null
          visit_route?: Json | null
          website?: string | null
          website_url?: string | null
          wikidata_id?: string | null
          wikipedia_summary?: string | null
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
      poi_quality_reports: {
        Row: {
          auto_fixed: number
          dry_run: boolean
          id: string
          issues_detail: Json
          needs_review: number
          pois_to_review: string[] | null
          quality_score: number | null
          run_at: string
          total_pois: number | null
        }
        Insert: {
          auto_fixed?: number
          dry_run?: boolean
          id?: string
          issues_detail?: Json
          needs_review?: number
          pois_to_review?: string[] | null
          quality_score?: number | null
          run_at?: string
          total_pois?: number | null
        }
        Update: {
          auto_fixed?: number
          dry_run?: boolean
          id?: string
          issues_detail?: Json
          needs_review?: number
          pois_to_review?: string[] | null
          quality_score?: number | null
          run_at?: string
          total_pois?: number | null
        }
        Relationships: []
      }
      pois: {
        Row: {
          accessibility_notes: string | null
          best_time: string | null
          created_at: string
          crowd_level: string | null
          enriched_at: string | null
          enrichment_status: string | null
          fun_fact_en: string | null
          fun_fact_fr: string | null
          history_context: string | null
          id: string
          interaction: Database["public"]["Enums"]["interaction_type"]
          library_poi_id: string | null
          local_anecdote: string | null
          local_anecdote_en: string | null
          local_anecdote_fr: string | null
          minutes_from_prev: number | null
          name: string
          name_ar: string | null
          name_en: string | null
          name_fr: string | null
          notes: string | null
          opening_hours: Json | null
          photo_url: string | null
          poi_score: number | null
          project_id: string
          riddle_easy: string | null
          riddle_hard: string | null
          riddle_medium: string | null
          risk: Database["public"]["Enums"]["risk_level"]
          sort_order: number
          step_config: Json
          themes: string[] | null
          visit_duration_min: number | null
          wikidata_id: string | null
          wikimedia_photo_url: string | null
          wikipedia_summary: string | null
          zone: string
        }
        Insert: {
          accessibility_notes?: string | null
          best_time?: string | null
          created_at?: string
          crowd_level?: string | null
          enriched_at?: string | null
          enrichment_status?: string | null
          fun_fact_en?: string | null
          fun_fact_fr?: string | null
          history_context?: string | null
          id?: string
          interaction?: Database["public"]["Enums"]["interaction_type"]
          library_poi_id?: string | null
          local_anecdote?: string | null
          local_anecdote_en?: string | null
          local_anecdote_fr?: string | null
          minutes_from_prev?: number | null
          name: string
          name_ar?: string | null
          name_en?: string | null
          name_fr?: string | null
          notes?: string | null
          opening_hours?: Json | null
          photo_url?: string | null
          poi_score?: number | null
          project_id: string
          riddle_easy?: string | null
          riddle_hard?: string | null
          riddle_medium?: string | null
          risk?: Database["public"]["Enums"]["risk_level"]
          sort_order?: number
          step_config?: Json
          themes?: string[] | null
          visit_duration_min?: number | null
          wikidata_id?: string | null
          wikimedia_photo_url?: string | null
          wikipedia_summary?: string | null
          zone: string
        }
        Update: {
          accessibility_notes?: string | null
          best_time?: string | null
          created_at?: string
          crowd_level?: string | null
          enriched_at?: string | null
          enrichment_status?: string | null
          fun_fact_en?: string | null
          fun_fact_fr?: string | null
          history_context?: string | null
          id?: string
          interaction?: Database["public"]["Enums"]["interaction_type"]
          library_poi_id?: string | null
          local_anecdote?: string | null
          local_anecdote_en?: string | null
          local_anecdote_fr?: string | null
          minutes_from_prev?: number | null
          name?: string
          name_ar?: string | null
          name_en?: string | null
          name_fr?: string | null
          notes?: string | null
          opening_hours?: Json | null
          photo_url?: string | null
          poi_score?: number | null
          project_id?: string
          riddle_easy?: string | null
          riddle_hard?: string | null
          riddle_medium?: string | null
          risk?: Database["public"]["Enums"]["risk_level"]
          sort_order?: number
          step_config?: Json
          themes?: string[] | null
          visit_duration_min?: number | null
          wikidata_id?: string | null
          wikimedia_photo_url?: string | null
          wikipedia_summary?: string | null
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
      quest_instance_devices: {
        Row: {
          attempt_count: number | null
          device_id: string
          fingerprint_hash: string | null
          first_seen_at: string
          id: string
          last_seen_at: string | null
          quest_instance_id: string
          user_agent: string | null
        }
        Insert: {
          attempt_count?: number | null
          device_id: string
          fingerprint_hash?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string | null
          quest_instance_id: string
          user_agent?: string | null
        }
        Update: {
          attempt_count?: number | null
          device_id?: string
          fingerprint_hash?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string | null
          quest_instance_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quest_instance_devices_quest_instance_id_fkey"
            columns: ["quest_instance_id"]
            isOneToOne: false
            referencedRelation: "quest_instances"
            referencedColumns: ["id"]
          },
        ]
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
      quest_library: {
        Row: {
          agent_version: string | null
          audience: string
          best_time: string | null
          created_at: string | null
          description_en: string | null
          description_fr: string | null
          difficulty: string
          distance_m: number | null
          duration_min: number | null
          generated_at: string | null
          highlights: string[] | null
          id: string
          mode: string
          quality_score: number | null
          start_hub: string
          start_lat: number
          start_lng: number
          stops_count: number | null
          stops_data: Json | null
          theme: string
          title_en: string | null
          title_fr: string | null
          updated_at: string | null
        }
        Insert: {
          agent_version?: string | null
          audience: string
          best_time?: string | null
          created_at?: string | null
          description_en?: string | null
          description_fr?: string | null
          difficulty?: string
          distance_m?: number | null
          duration_min?: number | null
          generated_at?: string | null
          highlights?: string[] | null
          id?: string
          mode?: string
          quality_score?: number | null
          start_hub: string
          start_lat: number
          start_lng: number
          stops_count?: number | null
          stops_data?: Json | null
          theme?: string
          title_en?: string | null
          title_fr?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_version?: string | null
          audience?: string
          best_time?: string | null
          created_at?: string | null
          description_en?: string | null
          description_fr?: string | null
          difficulty?: string
          distance_m?: number | null
          duration_min?: number | null
          generated_at?: string | null
          highlights?: string[] | null
          id?: string
          mode?: string
          quality_score?: number | null
          start_hub?: string
          start_lat?: number
          start_lng?: number
          stops_count?: number | null
          stops_data?: Json | null
          theme?: string
          title_en?: string | null
          title_fr?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      quest_narratives_cache: {
        Row: {
          audience: string
          created_at: string
          difficulty: number
          id: string
          narrative: Json
          narrative_version: string
          poi_ids: Json
          signature: string
          theme: string
        }
        Insert: {
          audience: string
          created_at?: string
          difficulty: number
          id?: string
          narrative: Json
          narrative_version: string
          poi_ids: Json
          signature: string
          theme: string
        }
        Update: {
          audience?: string
          created_at?: string
          difficulty?: number
          id?: string
          narrative?: Json
          narrative_version?: string
          poi_ids?: Json
          signature?: string
          theme?: string
        }
        Relationships: []
      }
      quest_photos: {
        Row: {
          caption: string | null
          created_at: string
          device_id: string | null
          id: string
          lat: number | null
          lng: number | null
          media_type: string
          medina_poi_id: string | null
          quest_instance_id: string | null
          source_instance_id: string | null
          source_project: string | null
          storage_bucket: string
          storage_path: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          media_type?: string
          medina_poi_id?: string | null
          quest_instance_id?: string | null
          source_instance_id?: string | null
          source_project?: string | null
          storage_bucket?: string
          storage_path: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          media_type?: string
          medina_poi_id?: string | null
          quest_instance_id?: string | null
          source_instance_id?: string | null
          source_project?: string | null
          storage_bucket?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "quest_photos_medina_poi_id_fkey"
            columns: ["medina_poi_id"]
            isOneToOne: false
            referencedRelation: "medina_pois"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quest_photos_quest_instance_id_fkey"
            columns: ["quest_instance_id"]
            isOneToOne: false
            referencedRelation: "quest_instances"
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
          photo_urls: string[] | null
          promoted: boolean
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
          photo_urls?: string[] | null
          promoted?: boolean
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
          photo_urls?: string[] | null
          promoted?: boolean
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
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      street_nodes: {
        Row: {
          created_at: string | null
          geom: unknown
          id: number
          is_intersection: boolean | null
          osm_node_id: number | null
        }
        Insert: {
          created_at?: string | null
          geom: unknown
          id?: number
          is_intersection?: boolean | null
          osm_node_id?: number | null
        }
        Update: {
          created_at?: string | null
          geom?: unknown
          id?: number
          is_intersection?: boolean | null
          osm_node_id?: number | null
        }
        Relationships: []
      }
      streets: {
        Row: {
          cost: number | null
          created_at: string | null
          geom: unknown
          id: number
          is_covered: boolean | null
          length_m: number | null
          metadata: Json | null
          name: string | null
          name_ar: string | null
          name_fr: string | null
          osm_id: number | null
          reverse_cost: number | null
          source: number | null
          street_type: string | null
          surface: string | null
          target: number | null
        }
        Insert: {
          cost?: number | null
          created_at?: string | null
          geom: unknown
          id?: number
          is_covered?: boolean | null
          length_m?: number | null
          metadata?: Json | null
          name?: string | null
          name_ar?: string | null
          name_fr?: string | null
          osm_id?: number | null
          reverse_cost?: number | null
          source?: number | null
          street_type?: string | null
          surface?: string | null
          target?: number | null
        }
        Update: {
          cost?: number | null
          created_at?: string | null
          geom?: unknown
          id?: number
          is_covered?: boolean | null
          length_m?: number | null
          metadata?: Json | null
          name?: string | null
          name_ar?: string | null
          name_fr?: string | null
          osm_id?: number | null
          reverse_cost?: number | null
          source?: number | null
          street_type?: string | null
          surface?: string | null
          target?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "streets_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "street_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "streets_target_fkey"
            columns: ["target"]
            isOneToOne: false
            referencedRelation: "street_nodes"
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
      visit_types: {
        Row: {
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          label_ar: string | null
          label_en: string
          label_fr: string
          max_duration_min: number | null
          min_duration_min: number | null
          price_multiplier: number | null
          theme_key: string | null
        }
        Insert: {
          description?: string | null
          icon?: string | null
          id: string
          is_active?: boolean | null
          label_ar?: string | null
          label_en: string
          label_fr: string
          max_duration_min?: number | null
          min_duration_min?: number | null
          price_multiplier?: number | null
          theme_key?: string | null
        }
        Update: {
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          label_ar?: string | null
          label_en?: string
          label_fr?: string
          max_duration_min?: number | null
          min_duration_min?: number | null
          price_multiplier?: number | null
          theme_key?: string | null
        }
        Relationships: []
      }
      watchdog_reports: {
        Row: {
          created_at: string
          details: Json
          id: string
          report_type: string
          resolved: boolean
          resolved_at: string | null
          severity: string
          summary: string
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: string
          report_type: string
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          summary: string
        }
        Update: {
          created_at?: string
          details?: Json
          id?: string
          report_type?: string
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          summary?: string
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
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      streets_walking_cost: {
        Row: {
          cost: number | null
          geom: unknown
          id: number | null
          length_m: number | null
          name: string | null
          reverse_cost: number | null
          source: number | null
          street_type: string | null
          target: number | null
        }
        Insert: {
          cost?: number | null
          geom?: unknown
          id?: number | null
          length_m?: number | null
          name?: string | null
          reverse_cost?: number | null
          source?: number | null
          street_type?: string | null
          target?: number | null
        }
        Update: {
          cost?: number | null
          geom?: unknown
          id?: number | null
          length_m?: number | null
          name?: string | null
          reverse_cost?: number | null
          source?: number | null
          street_type?: string | null
          target?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "streets_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "street_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "streets_target_fkey"
            columns: ["target"]
            isOneToOne: false
            referencedRelation: "street_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      suspicious_devices: {
        Row: {
          device_ids: string[] | null
          fingerprint_hash: string | null
          instance_count: number | null
          instance_ids: string[] | null
          last_seen: string | null
          total_accesses: number | null
        }
        Relationships: []
      }
      v_top_pois: {
        Row: {
          content_level: string | null
          enrichment_status: string | null
          fun_fact_fr: string | null
          history_context: string | null
          id: string | null
          local_anecdote_fr: string | null
          name: string | null
          photo_url: string | null
          poi_score: number | null
          riddle_easy: string | null
          riddle_hard: string | null
          riddle_medium: string | null
          visit_duration_min: number | null
        }
        Insert: {
          content_level?: never
          enrichment_status?: string | null
          fun_fact_fr?: string | null
          history_context?: string | null
          id?: string | null
          local_anecdote_fr?: string | null
          name?: string | null
          photo_url?: string | null
          poi_score?: number | null
          riddle_easy?: string | null
          riddle_hard?: string | null
          riddle_medium?: string | null
          visit_duration_min?: number | null
        }
        Update: {
          content_level?: never
          enrichment_status?: string | null
          fun_fact_fr?: string | null
          history_context?: string | null
          id?: string | null
          local_anecdote_fr?: string | null
          name?: string | null
          photo_url?: string | null
          poi_score?: number | null
          riddle_easy?: string | null
          riddle_hard?: string | null
          riddle_medium?: string | null
          visit_duration_min?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _pgr_articulationpoints: {
        Args: { edges_sql: string }
        Returns: Record<string, unknown>[]
      }
      _pgr_astar:
        | {
            Args: {
              combinations_sql: string
              directed?: boolean
              edges_sql: string
              epsilon?: number
              factor?: number
              heuristic?: number
              only_cost?: boolean
            }
            Returns: Record<string, unknown>[]
          }
        | {
            Args: {
              directed?: boolean
              edges_sql: string
              end_vids: unknown
              epsilon?: number
              factor?: number
              heuristic?: number
              normal?: boolean
              only_cost?: boolean
              start_vids: unknown
            }
            Returns: Record<string, unknown>[]
          }
      _pgr_bellmanford:
        | {
            Args: {
              combinations_sql: string
              directed: boolean
              edges_sql: string
              only_cost: boolean
            }
            Returns: Record<string, unknown>[]
          }
        | {
            Args: {
              directed: boolean
              edges_sql: string
              from_vids: unknown
              only_cost: boolean
              to_vids: unknown
            }
            Returns: Record<string, unknown>[]
          }
      _pgr_biconnectedcomponents: {
        Args: { edges_sql: string }
        Returns: Record<string, unknown>[]
      }
      _pgr_binarybreadthfirstsearch:
        | {
            Args: {
              combinations_sql: string
              directed?: boolean
              edges_sql: string
            }
            Returns: Record<string, unknown>[]
          }
        | {
            Args: {
              directed?: boolean
              edges_sql: string
              from_vids: unknown
              to_vids: unknown
            }
            Returns: Record<string, unknown>[]
          }
      _pgr_bipartite: {
        Args: { edges_sql: string }
        Returns: Record<string, unknown>[]
      }
      _pgr_boost_version: { Args: never; Returns: string }
      _pgr_breadthfirstsearch: {
        Args: {
          directed: boolean
          edges_sql: string
          from_vids: unknown
          max_depth: number
        }
        Returns: Record<string, unknown>[]
      }
      _pgr_bridges: {
        Args: { edges_sql: string }
        Returns: Record<string, unknown>[]
      }
      _pgr_build_type: { Args: never; Returns: string }
      _pgr_checkquery: { Args: { "": string }; Returns: string }
      _pgr_checkverttab: {
        Args: {
          columnsarr: string[]
          fnname?: string
          reporterrs?: number
          vertname: string
        }
        Returns: Record<string, unknown>
      }
      _pgr_chinesepostman: {
        Args: { edges_sql: string; only_cost: boolean }
        Returns: Record<string, unknown>[]
      }
      _pgr_compilation_date: { Args: never; Returns: string }
      _pgr_compiler_version: { Args: never; Returns: string }
      _pgr_connectedcomponents: {
        Args: { edges_sql: string }
        Returns: Record<string, unknown>[]
      }
      _pgr_contraction: {
        Args: {
          contraction_order: number[]
          directed?: boolean
          edges_sql: string
          forbidden_vertices?: number[]
          max_cycles?: number
        }
        Returns: Record<string, unknown>[]
      }
      _pgr_createindex:
        | {
            Args: {
              colname: string
              fnname?: string
              indext: string
              reporterrs?: number
              sname: string
              tname: string
            }
            Returns: undefined
          }
        | {
            Args: {
              colname: string
              fnname?: string
              indext: string
              reporterrs?: number
              tabname: string
            }
            Returns: undefined
          }
      _pgr_cuthillmckeeordering: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      _pgr_depthfirstsearch: {
        Args: {
          directed: boolean
          edges_sql: string
          max_depth: number
          root_vids: unknown
        }
        Returns: Record<string, unknown>[]
      }
      _pgr_dijkstra:
        | {
            Args: {
              combinations_sql: string
              directed?: boolean
              edges_sql: string
              normal?: boolean
              only_cost?: boolean
            }
            Returns: Record<string, unknown>[]
          }
        | {
            Args: {
              combinations_sql: string
              directed: boolean
              edges_sql: string
              global: boolean
              n_goals: number
              only_cost: boolean
            }
            Returns: Record<string, unknown>[]
          }
        | {
            Args: {
              directed?: boolean
              edges_sql: string
              end_vids: unknown
              n_goals?: number
              normal?: boolean
              only_cost?: boolean
              start_vids: unknown
            }
            Returns: Record<string, unknown>[]
          }
        | {
            Args: {
              directed: boolean
              edges_sql: string
              end_vids: unknown
              global: boolean
              n_goals: number
              normal: boolean
              only_cost: boolean
              start_vids: unknown
            }
            Returns: Record<string, unknown>[]
          }
      _pgr_dijkstravia: {
        Args: {
          directed: boolean
          edges_sql: string
          strict: boolean
          u_turn_on_edge: boolean
          via_vids: unknown
        }
        Returns: Record<string, unknown>[]
      }
      _pgr_drivingdistance: {
        Args: {
          directed?: boolean
          distance: number
          edges_sql: string
          equicost?: boolean
          start_vids: unknown
        }
        Returns: Record<string, unknown>[]
      }
      _pgr_edgecoloring: {
        Args: { edges_sql: string }
        Returns: Record<string, unknown>[]
      }
      _pgr_edwardmoore:
        | {
            Args: {
              combinations_sql: string
              directed?: boolean
              edges_sql: string
            }
            Returns: Record<string, unknown>[]
          }
        | {
            Args: {
              directed?: boolean
              edges_sql: string
              from_vids: unknown
              to_vids: unknown
            }
            Returns: Record<string, unknown>[]
          }
      _pgr_endpoint: { Args: { g: unknown }; Returns: unknown }
      _pgr_floydwarshall: {
        Args: { directed: boolean; edges_sql: string }
        Returns: Record<string, unknown>[]
      }
      _pgr_get_statement: { Args: { o_sql: string }; Returns: string }
      _pgr_getcolumnname:
        | {
            Args: {
              col: string
              fnname?: string
              reporterrs?: number
              sname: string
              tname: string
            }
            Returns: string
          }
        | {
            Args: {
              col: string
              fnname?: string
              reporterrs?: number
              tab: string
            }
            Returns: string
          }
      _pgr_getcolumntype:
        | {
            Args: {
              cname: string
              fnname?: string
              reporterrs?: number
              sname: string
              tname: string
            }
            Returns: string
          }
        | {
            Args: {
              col: string
              fnname?: string
              reporterrs?: number
              tab: string
            }
            Returns: string
          }
      _pgr_gettablename: {
        Args: { fnname?: string; reporterrs?: number; tab: string }
        Returns: Record<string, unknown>
      }
      _pgr_git_hash: { Args: never; Returns: string }
      _pgr_hawickcircuits: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      _pgr_iscolumnindexed:
        | {
            Args: {
              cname: string
              fnname?: string
              reporterrs?: number
              sname: string
              tname: string
            }
            Returns: boolean
          }
        | {
            Args: {
              col: string
              fnname?: string
              reporterrs?: number
              tab: string
            }
            Returns: boolean
          }
      _pgr_iscolumnintable: {
        Args: { col: string; tab: string }
        Returns: boolean
      }
      _pgr_isplanar: { Args: { "": string }; Returns: boolean }
      _pgr_johnson: {
        Args: { directed: boolean; edges_sql: string }
        Returns: Record<string, unknown>[]
      }
      _pgr_ksp: {
        Args: {
          directed: boolean
          edges_sql: string
          end_vid: number
          heap_paths: boolean
          k: number
          start_vid: number
        }
        Returns: Record<string, unknown>[]
      }
      _pgr_lengauertarjandominatortree: {
        Args: { edges_sql: string; root_vid: number }
        Returns: Record<string, unknown>[]
      }
      _pgr_lib_version: { Args: never; Returns: string }
      _pgr_linegraphfull: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      _pgr_makeconnected: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      _pgr_maxcardinalitymatch: {
        Args: { directed: boolean; edges_sql: string }
        Returns: Record<string, unknown>[]
      }
      _pgr_maxflow:
        | {
            Args: {
              algorithm?: number
              combinations_sql: string
              edges_sql: string
              only_flow?: boolean
            }
            Returns: Record<string, unknown>[]
          }
        | {
            Args: {
              algorithm?: number
              edges_sql: string
              only_flow?: boolean
              sources: unknown
              targets: unknown
            }
            Returns: Record<string, unknown>[]
          }
      _pgr_maxflowmincost:
        | {
            Args: {
              combinations_sql: string
              edges_sql: string
              only_cost?: boolean
            }
            Returns: Record<string, unknown>[]
          }
        | {
            Args: {
              edges_sql: string
              only_cost?: boolean
              sources: unknown
              targets: unknown
            }
            Returns: Record<string, unknown>[]
          }
      _pgr_msg: {
        Args: { fnname: string; msg?: string; msgkind: number }
        Returns: undefined
      }
      _pgr_onerror: {
        Args: {
          errcond: boolean
          fnname: string
          hinto?: string
          msgerr: string
          msgok?: string
          reporterrs: number
        }
        Returns: undefined
      }
      _pgr_operating_system: { Args: never; Returns: string }
      _pgr_parameter_check: {
        Args: { big?: boolean; fn: string; sql: string }
        Returns: boolean
      }
      _pgr_pgsql_version: { Args: never; Returns: string }
      _pgr_pointtoid: {
        Args: {
          point: unknown
          srid: number
          tolerance: number
          vertname: string
        }
        Returns: number
      }
      _pgr_quote_ident: { Args: { idname: string }; Returns: string }
      _pgr_sequentialvertexcoloring: {
        Args: { edges_sql: string }
        Returns: Record<string, unknown>[]
      }
      _pgr_startpoint: { Args: { g: unknown }; Returns: unknown }
      _pgr_stoerwagner: {
        Args: { edges_sql: string }
        Returns: Record<string, unknown>[]
      }
      _pgr_strongcomponents: {
        Args: { edges_sql: string }
        Returns: Record<string, unknown>[]
      }
      _pgr_topologicalsort: {
        Args: { edges_sql: string }
        Returns: Record<string, unknown>[]
      }
      _pgr_transitiveclosure: {
        Args: { edges_sql: string }
        Returns: Record<string, unknown>[]
      }
      _pgr_trsp: {
        Args: {
          directed: boolean
          has_reverse_cost: boolean
          source_eid: number
          source_pos: number
          sql: string
          target_eid: number
          target_pos: number
          turn_restrict_sql?: string
        }
        Returns: Record<string, unknown>[]
      }
      _pgr_trspviavertices: {
        Args: {
          directed: boolean
          has_rcost: boolean
          sql: string
          turn_restrict_sql?: string
          vids: number[]
        }
        Returns: Record<string, unknown>[]
      }
      _pgr_tsp: {
        Args: {
          cooling_factor?: number
          end_id?: number
          final_temperature?: number
          initial_temperature?: number
          matrix_row_sql: string
          max_changes_per_temperature?: number
          max_consecutive_non_changes?: number
          max_processing_time?: number
          randomize?: boolean
          start_id?: number
          tries_per_temperature?: number
        }
        Returns: Record<string, unknown>[]
      }
      _pgr_tspeuclidean: {
        Args: {
          cooling_factor?: number
          coordinates_sql: string
          end_id?: number
          final_temperature?: number
          initial_temperature?: number
          max_changes_per_temperature?: number
          max_consecutive_non_changes?: number
          max_processing_time?: number
          randomize?: boolean
          start_id?: number
          tries_per_temperature?: number
        }
        Returns: Record<string, unknown>[]
      }
      _pgr_versionless: { Args: { v1: string; v2: string }; Returns: boolean }
      _pgr_withpoints:
        | {
            Args: {
              combinations_sql: string
              details: boolean
              directed: boolean
              driving_side: string
              edges_sql: string
              only_cost?: boolean
              points_sql: string
            }
            Returns: Record<string, unknown>[]
          }
        | {
            Args: {
              details: boolean
              directed: boolean
              driving_side: string
              edges_sql: string
              end_pids: unknown
              normal?: boolean
              only_cost?: boolean
              points_sql: string
              start_pids: unknown
            }
            Returns: Record<string, unknown>[]
          }
      _pgr_withpointsdd: {
        Args: {
          details?: boolean
          directed?: boolean
          distance: number
          driving_side?: string
          edges_sql: string
          equicost?: boolean
          points_sql: string
          start_pid: unknown
        }
        Returns: Record<string, unknown>[]
      }
      _pgr_withpointsksp: {
        Args: {
          details: boolean
          directed: boolean
          driving_side: string
          edges_sql: string
          end_pid: number
          heap_paths: boolean
          k: number
          points_sql: string
          start_pid: number
        }
        Returns: Record<string, unknown>[]
      }
      _pgr_withpointsvia: {
        Args: {
          directed?: boolean
          fraction: number[]
          sql: string
          via_edges: number[]
        }
        Returns: Record<string, unknown>[]
      }
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      clean_low_quality_pois: { Args: never; Returns: Json }
      cleanup_expired_data: { Args: never; Returns: Json }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      find_catalog_project: {
        Args: { p_slug: string }
        Returns: {
          id: string
          quest_config: Json
          title_i18n: Json
        }[]
      }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_graph_stats: { Args: never; Returns: Json }
      get_poi_enrichment_stats: { Args: never; Returns: Json }
      get_walking_cost_matrix: {
        Args: { node_ids: number[] }
        Returns: {
          agg_cost: number
          end_vid: number
          start_vid: number
        }[]
      }
      get_walking_route: {
        Args: { from_node: number; to_node: number }
        Returns: {
          cost_sec: number
          edge_id: number
          geojson: string
          seq: number
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      link_pois_to_nearest_nodes: { Args: never; Returns: number }
      longtransactionsenabled: { Args: never; Returns: boolean }
      merge_duplicate_pois: { Args: never; Returns: Json }
      nearby_nodes_knn: {
        Args: { p_lat: number; p_limit?: number; p_lng: number }
        Returns: {
          distance_m: number
          id: number
        }[]
      }
      nearby_pois: {
        Args: {
          p_category?: string
          p_lat: number
          p_limit?: number
          p_lng: number
          p_radius_m?: number
        }
        Returns: {
          category: string
          distance_m: number
          id: string
          lat: number
          lng: number
          name: string
          name_ar: string
          name_fr: string
          poi_quality_score: number
        }[]
      }
      pgr_articulationpoints: { Args: { "": string }; Returns: number[] }
      pgr_biconnectedcomponents: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      pgr_bipartite: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      pgr_bridges: { Args: { "": string }; Returns: number[] }
      pgr_chinesepostman: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      pgr_chinesepostmancost: { Args: { "": string }; Returns: number }
      pgr_connectedcomponents: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      pgr_cuthillmckeeordering: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      pgr_edgecoloring: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      pgr_full_version: { Args: never; Returns: Record<string, unknown> }
      pgr_hawickcircuits: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      pgr_isplanar: { Args: { "": string }; Returns: boolean }
      pgr_kruskal: { Args: { "": string }; Returns: Record<string, unknown>[] }
      pgr_linegraphfull: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      pgr_makeconnected: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      pgr_maxcardinalitymatch: { Args: { "": string }; Returns: number[] }
      pgr_prim: { Args: { "": string }; Returns: Record<string, unknown>[] }
      pgr_sequentialvertexcoloring: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      pgr_stoerwagner: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      pgr_strongcomponents: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      pgr_topologicalsort: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      pgr_transitiveclosure: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      pgr_version: { Args: never; Returns: string }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
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
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
