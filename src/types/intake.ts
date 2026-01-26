// ============= Existing enums =============
export type WifiStrength = 'ok' | 'weak' | 'dead';
export type RiskLevel = 'low' | 'medium' | 'high';
export type InteractionType = 'puzzle' | 'qr_scan' | 'photo' | 'hidden_object' | 'npc' | 'audio';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

// ============= New Quest Config enums =============
export type QuestType = 'exploration' | 'sequential' | 'timed_race' | 'collaborative' | 'team_competition';
// GPS removed from StepType - use terrain for outdoor activities
export type StepType = 'story' | 'information' | 'mcq' | 'enigme' | 'code' | 'hangman' | 'memory' | 'photo' | 'terrain' | 'defi';
// GPS removed from ValidationMode - use manual for GPS-like validation
export type ValidationMode = 'qr_code' | 'photo' | 'code' | 'manual' | 'free';
export type PhotoValidationType = 'free' | 'reference' | 'qr_code';
export type CompetitionMode = 'race' | 'score' | 'timed';
// Extended target audiences
export type TargetAudience = 'family' | 'couples' | 'corporate' | 'teens' | 'seniors' | 'kids' | 'friends';
export type SupportedLanguage = 'fr' | 'en' | 'ar' | 'es' | 'ary';
// New play mode enum
export type PlayMode = 'solo' | 'team' | 'one_vs_one' | 'multi_solo';

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

// ============= Team Config (only used when play_mode=team) =============
export interface TeamConfig {
  enabled?: boolean; // Legacy field
  competitionMode?: CompetitionMode;
  maxTeams?: number;
  maxPlayersPerTeam?: number;
  timeLimitMinutes?: number;
}

// ============= Multi Solo Config (only used when play_mode=multi_solo) =============
export interface MultiSoloConfig {
  maxPlayers?: number;
  leaderboardEnabled?: boolean;
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
  // New play mode system (required)
  play_mode?: PlayMode;
  multiSoloConfig?: MultiSoloConfig;
  // Storytelling / Narrator
  storytelling?: StorytellingConfig;
}

// ============= Step Config (stored in pois.step_config) =============
export interface StepConfig {
  // Multi-select possibilities (new)
  possible_step_types?: StepType[];
  possible_validation_modes?: ValidationMode[];
  // Final decision (optional, single select)
  final_step_type?: StepType | null;
  final_validation_mode?: ValidationMode | null;
  // Legacy single values (kept for migration)
  stepType?: StepType;
  validationMode?: ValidationMode;
  // Other config
  photoValidation?: PhotoValidationConfig;
  scoring?: ScoringConfig;
  hints?: string[];
  branching?: BranchingLogic;
  contentI18n?: I18nText;
  // Photo reference fields (for photo validation)
  photo_reference_required?: boolean;
  reference_image_url?: string | null;
  reference_image_caption?: string | null;
  // Migration warning flag
  _gps_migrated_warning?: boolean;
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
  photo: 'Photo',
  terrain: 'Terrain',
  defi: 'Défi',
};

export const VALIDATION_MODE_LABELS: Record<ValidationMode, string> = {
  qr_code: 'QR Code',
  photo: 'Photo',
  code: 'Code',
  manual: 'Manuel',
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
  kids: 'Enfants',
  friends: 'Amis',
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

export const PLAY_MODE_LABELS: Record<PlayMode, string> = {
  solo: 'Solo',
  team: 'Équipes',
  one_vs_one: '1 vs 1',
  multi_solo: 'Multi-joueurs (classement)',
};

// ============= Avatar types =============
export type AvatarStyle = 'cartoon' | 'realistic' | 'semi_realistic' | 'anime' | 'minimal';
export type AvatarAge = 'child' | 'teen' | 'adult' | 'senior';
export type AvatarPersona = 'guide_host' | 'detective' | 'explorer' | 'historian' | 'local_character' | 'mascot' | 'ai_assistant' | 'villain_light';
export type AvatarOutfit = 'traditional' | 'modern' | 'luxury' | 'adventure';

export interface Avatar {
  id: string;
  project_id: string | null;
  name: string;
  style: AvatarStyle;
  age: AvatarAge;
  persona: AvatarPersona;
  outfit: AvatarOutfit;
  image_url: string;
  created_at: string;
}

export interface StorytellingConfig {
  enabled: boolean;
  narrator?: {
    avatar_id: string | null;
  };
}

export const AVATAR_STYLE_LABELS: Record<AvatarStyle, string> = {
  cartoon: 'Cartoon',
  realistic: 'Réaliste',
  semi_realistic: 'Semi-réaliste',
  anime: 'Anime',
  minimal: 'Minimal',
};

export const AVATAR_AGE_LABELS: Record<AvatarAge, string> = {
  child: 'Enfant',
  teen: 'Ado',
  adult: 'Adulte',
  senior: 'Senior',
};

export const AVATAR_PERSONA_LABELS: Record<AvatarPersona, string> = {
  guide_host: 'Guide/Hôte',
  detective: 'Détective',
  explorer: 'Explorateur',
  historian: 'Historien',
  local_character: 'Personnage local',
  mascot: 'Mascotte',
  ai_assistant: 'Assistant IA',
  villain_light: 'Villain léger',
};

export const AVATAR_OUTFIT_LABELS: Record<AvatarOutfit, string> = {
  traditional: 'Traditionnel',
  modern: 'Moderne',
  luxury: 'Luxe',
  adventure: 'Aventure',
};
