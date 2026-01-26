export type WifiStrength = 'ok' | 'weak' | 'dead';
export type RiskLevel = 'low' | 'medium' | 'high';
export type InteractionType = 'puzzle' | 'qr_scan' | 'photo' | 'hidden_object' | 'npc' | 'audio';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface Project {
  id: string;
  created_at: string;
  updated_at: string;
  hotel_name: string;
  city: string;
  floors: number;
  visit_date: string | null;
  map_url: string | null;
  map_uploaded_at: string | null;
  staff_available: boolean;
  reset_time_mins: number | null;
  props_allowed: boolean;
  target_duration_mins: number | null;
  difficulty: DifficultyLevel | null;
  theme: string | null;
  is_complete: boolean;
}

export interface POI {
  id: string;
  project_id: string;
  created_at: string;
  name: string;
  zone: string;
  photo_url: string | null;
  interaction: InteractionType;
  risk: RiskLevel;
  minutes_from_prev: number;
  notes: string | null;
  sort_order: number;
}

export interface WifiZone {
  id: string;
  project_id: string;
  zone: string;
  strength: WifiStrength;
}

export interface ForbiddenZone {
  id: string;
  project_id: string;
  zone: string;
  reason: string | null;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export const INTERACTION_LABELS: Record<InteractionType, string> = {
  puzzle: 'Puzzle',
  qr_scan: 'QR Scan',
  photo: 'Photo',
  hidden_object: 'Objet caché',
  npc: 'NPC',
  audio: 'Audio',
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Faible',
  medium: 'Moyen',
  high: 'Élevé',
};

export const WIFI_LABELS: Record<WifiStrength, string> = {
  ok: 'OK',
  weak: 'Faible',
  dead: 'Mort',
};

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  easy: 'Facile',
  medium: 'Moyen',
  hard: 'Difficile',
};
