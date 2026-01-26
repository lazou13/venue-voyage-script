// ============= Existing enums =============
export type WifiStrength = 'ok' | 'weak' | 'dead';
export type RiskLevel = 'low' | 'medium' | 'high';
export type InteractionType = 'puzzle' | 'qr_scan' | 'photo' | 'hidden_object' | 'npc' | 'audio';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

// ============= New Quest Config enums =============
export type QuestType = 'exploration' | 'sequential' | 'timed_race' | 'collaborative' | 'team_competition';
export type StepType = 'story' | 'information' | 'mcq' | 'enigme' | 'code' | 'hangman' | 'memory' | 'gps' | 'photo' | 'terrain' | 'defi';
export type ValidationMode = 'auto_gps' | 'qr_code' | 'manual' | 'photo' | 'code' | 'free';
export type PhotoValidationType = 'free' | 'reference' | 'qr_code';
export type CompetitionMode = 'race' | 'score' | 'timed';
export type TargetAudience = 'family' | 'couples' | 'corporate' | 'teens' | 'seniors';
export type SupportedLanguage = 'fr' | 'en' | 'ar' | 'es' | 'ary';

// ============= Project Type (new) =============
export type ProjectType = 'establishment' | 'tourist_spot' | 'route_recon';

// ============= I18n types =============
export interface I18nText {
  fr?: string;
  en?: string;
  ar?: string;
  es?: string;
  ary?: string;
}

// ============= Team Config =============
export interface TeamConfig {
  enabled: boolean;
  competitionMode?: CompetitionMode;
  maxTeams?: number;
  maxPlayersPerTeam?: number;
  timeLimitMinutes?: number;
}

// ============= Scoring Config (snake_case keys) =============
export interface ScoringConfig {
  points?: number;
  hint_penalty?: number;
  fail_penalty?: number;
  time_limit_sec?: number;
  time_bonus?: number;
}

// ============= Branching Logic =============
export interface BranchingLogic {
  onSuccess?: string; // UUID | 'next' | 'end'
  onFailure?: string; // UUID | 'retry' | 'end'
  scoreAbove?: number;
  scoreAboveTarget?: string;
  scoreBelowTarget?: string;
}

// ============= Photo Validation Config =============
export interface PhotoValidationConfig {
  type?: PhotoValidationType;
  referenceUrl?: string;
  qrExpectedValue?: string;
}

// ============= GPS Config =============
export interface GpsConfig {
  lat?: number;
  lng?: number;
  radius?: number;
}

// ============= Core Details (common to all project types) =============
export interface CoreDetails {
  languages?: SupportedLanguage[];
  target_audience?: TargetAudience[];
  duration_min?: number;
  difficulty?: number; // 1-5
  objective_business?: string[];
  constraints_general?: string[];
}

// ============= Establishment Details =============
export interface EstablishmentDetails {
  spaces?: string[];
  private_zones?: string[];
  staff_ops?: string[];
  wifi_notes?: string[];
}

// ============= Tourist Spot Details =============
export interface TouristSpotDetails {
  start_points?: string[];
  end_points?: string[];
  avoid_zones?: string[];
  time_windows?: string[];
  landmarks?: string[];
}

// ============= Route Recon Details =============
export interface RouteReconDetails {
  route_type?: string;
  segments?: string[];
  danger_points?: string[];
  mandatory_stops?: string[];
  safety_brief?: string[];
}

// ============= Quest Config (stored in projects.quest_config) =============
export interface QuestConfig {
  // Existing fields
  questType?: QuestType;
  targetAudience?: TargetAudience;
  languages?: SupportedLanguage[];
  teamConfig?: TeamConfig;
  scoring?: ScoringConfig;
  hintRules?: {
    maxHints?: number;
    autoRevealAfterSec?: number;
  };
  branchingPresets?: BranchingLogic;
  // New project_type system
  project_type?: ProjectType;
  core?: CoreDetails;
  establishment_details?: EstablishmentDetails;
  tourist_spot_details?: TouristSpotDetails;
  route_recon_details?: RouteReconDetails;
}

// ============= Step Config (stored in pois.step_config) =============
export interface StepConfig {
  stepType?: StepType;
  validationMode?: ValidationMode;
  photoValidation?: PhotoValidationConfig;
  gps?: GpsConfig;
  scoring?: ScoringConfig;
  hints?: string[];
  branching?: BranchingLogic;
  contentI18n?: I18nText;
}

// ============= Main interfaces =============
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
  // New JSONB fields
  quest_config: QuestConfig;
  title_i18n: I18nText;
  story_i18n: I18nText;
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
  // New JSONB field
  step_config: StepConfig;
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
  warnings: string[];
}

// ============= Labels =============
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

export const QUEST_TYPE_LABELS: Record<QuestType, string> = {
  exploration: 'Exploration libre',
  sequential: 'Séquentiel',
  timed_race: 'Course chronométrée',
  collaborative: 'Collaboratif',
  team_competition: 'Compétition équipes',
};

export const STEP_TYPE_LABELS: Record<StepType, string> = {
  story: 'Narration',
  information: 'Information',
  mcq: 'QCM',
  enigme: 'Énigme',
  code: 'Code secret',
  hangman: 'Pendu',
  memory: 'Memory',
  gps: 'GPS',
  photo: 'Photo',
  terrain: 'Terrain',
  defi: 'Défi',
};

export const VALIDATION_MODE_LABELS: Record<ValidationMode, string> = {
  auto_gps: 'GPS auto',
  qr_code: 'QR Code',
  manual: 'Manuel',
  photo: 'Photo',
  code: 'Code',
  free: 'Libre',
};

export const PHOTO_VALIDATION_LABELS: Record<PhotoValidationType, string> = {
  free: 'Libre',
  reference: 'Référence',
  qr_code: 'QR Code',
};

export const COMPETITION_MODE_LABELS: Record<CompetitionMode, string> = {
  race: 'Course',
  score: 'Score',
  timed: 'Temps limité',
};

export const TARGET_AUDIENCE_LABELS: Record<TargetAudience, string> = {
  family: 'Famille',
  couples: 'Couples',
  corporate: 'Corporate',
  teens: 'Ados',
  seniors: 'Seniors',
};

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  fr: 'Français',
  en: 'English',
  ar: 'العربية',
  es: 'Español',
  ary: 'Darija',
};

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  establishment: 'Établissement',
  tourist_spot: 'Site Touristique',
  route_recon: 'Reconnaissance Parcours',
};
