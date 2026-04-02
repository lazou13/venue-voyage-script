import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ━━━━━━━━━━━━━━ RE-EXPORTED TYPES ━━━━━━━━━━━━━━

export type EngineMode = "treasure_hunt" | "guided_tour";
export type Theme = "architecture" | "artisan" | "hidden_gems" | "food" | "family" | "history" | "photography" | "complete";
export type Difficulty = "easy" | "medium" | "hard";
export type Audience = "solo" | "couple" | "family" | "friends" | "school" | "teambuilding" | "vip" | "tourist";

export interface Stop {
  order: number;
  poi_id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  distance_from_prev_m: number;
  walk_time_min: number;
  visit_time_min: number;
  cumulative_time_min: number;
  riddle?: string;
  challenge?: string;
  points?: number;
  validation_radius_m?: number;
  story?: string;
  history_context?: string;
  local_anecdote?: string;
  tourist_tips?: string;
  photo_spot?: boolean;
  address?: string;
  description?: string;
  // Enriched fields
  price_info?: string | null;
  opening_hours?: Record<string, string> | null;
  must_see_details?: string | null;
  must_try?: string | null;
  must_visit_nearby?: string | null;
  is_photo_spot?: boolean;
  photo_tip?: string | null;
  ruelle_etroite?: boolean;
}

export interface QuestResult {
  id: string;
  mode: EngineMode;
  theme: Theme;
  difficulty: Difficulty;
  language: string;
  start: { name: string; lat: number; lng: number };
  total_stops: number;
  total_distance_m: number;
  walking_time_min: number;
  visit_time_min: number;
  total_time_min: number;
  total_points: number;
  stops: Stop[];
  title: string;
  teaser: string;
  algorithm_version: string;
  generated_at: string;
}

// ━━━━━━━━━━━━━━ MIGRATED TYPE ━━━━━━━━━━━━━━

export interface StartHub {
  id: string;
  name: string;
  lat: number;
  lng: number;
  hub_theme?: string;
}

// ━━━━━━━━━━━━━━ CLIENT INPUT ━━━━━━━━━━━━━━

export interface QuestInput {
  start_lat: number;
  start_lng: number;
  start_name?: string;
  mode: EngineMode;
  theme: Theme;
  audience: Audience;
  difficulty: Difficulty;
  max_duration_min: number;
  radius_m: number;
  max_stops: number;
  include_food_break: boolean;
  circular: boolean;
  language: 'fr' | 'en' | 'ar';
  exclude_place_ids?: string[];
}

// ━━━━━━━━━━━━━━ HOOK ━━━━━━━━━━━━━━

export function useQuestEngine() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuestResult | null>(null);

  const generate = useCallback(async (input: QuestInput): Promise<QuestResult | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-quest', {
        body: input,
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      setResult(data as QuestResult);
      return data as QuestResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { generate, reset, isLoading, error, result };
}
