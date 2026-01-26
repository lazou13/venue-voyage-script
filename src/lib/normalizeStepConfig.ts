import type { StepConfig, StepType, ValidationMode, ScoringConfig } from '@/types/intake';

/**
 * CANONICAL VALUES (strict ASCII, engine-like, no spaces, no accents):
 * 
 * validation_mode: qr_code | photo | code | manual | free (GPS REMOVED)
 * step_type: story | information | mcq | enigme | code | hangman | memory | photo | terrain | defi (GPS REMOVED)
 * scoring keys: points | hint_penalty | fail_penalty | time_limit_sec | time_bonus
 */

/**
 * Legacy value mappings for validation_mode normalization
 * GPS values are mapped to 'manual' with a warning flag
 */
const LEGACY_VALIDATION_MODE_MAP: Record<string, ValidationMode | '_gps_migrated'> = {
  // GPS values - will be migrated to manual with warning
  'gps automatique': '_gps_migrated',
  'gps auto': '_gps_migrated',
  'auto_gps': '_gps_migrated',
  'autogps': '_gps_migrated',
  'auto-gps': '_gps_migrated',
  'auto gps': '_gps_migrated',
  'gps_auto': '_gps_migrated',
  'gps': '_gps_migrated',
  // French labels (exact user inputs)
  'code qr': 'qr_code',
  'gratuit': 'free',
  'libre': 'free',
  'manuel': 'manual',
  'manuelle': 'manual',
  // Legacy snake/camel/dash variants
  'code_qr': 'qr_code',
  'qr': 'qr_code',
  'qrcode': 'qr_code',
  'qr-code': 'qr_code',
  'qr code': 'qr_code',
  // Passthrough canonical values
  'qr_code': 'qr_code',
  'manual': 'manual',
  'photo': 'photo',
  'code': 'code',
  'free': 'free',
};

/**
 * Legacy value mappings for step_type normalization
 * GPS step type is mapped to 'terrain' with a warning flag
 */
const LEGACY_STEP_TYPE_MAP: Record<string, StepType | '_gps_migrated'> = {
  // GPS values - will be migrated to terrain with warning
  'gps': '_gps_migrated',
  // French labels (exact user inputs)
  'histoire': 'story',
  'qcm': 'mcq',
  'narration': 'story',
  'récit': 'story',
  'recit': 'story',
  'énigme': 'enigme',
  'code secret': 'code',
  'pendu': 'hangman',
  'mémoire': 'memory',
  'memoire': 'memory',
  'défi': 'defi',
  // English/legacy variants
  'question': 'mcq',
  'quiz': 'mcq',
  'multiple_choice': 'mcq',
  'multiplechoice': 'mcq',
  'multiple choice': 'mcq',
  'puzzle': 'enigme',
  'riddle': 'enigme',
  'narrative': 'story',
  'info': 'information',
  'secret_code': 'code',
  'secretcode': 'code',
  'secret code': 'code',
  'challenge': 'defi',
  'field': 'terrain',
  // Passthrough canonical values (10 step types, no gps)
  'story': 'story',
  'information': 'information',
  'mcq': 'mcq',
  'enigme': 'enigme',
  'code': 'code',
  'hangman': 'hangman',
  'memory': 'memory',
  'photo': 'photo',
  'terrain': 'terrain',
  'defi': 'defi',
};

/**
 * Legacy scoring key mappings -> canonical snake_case ASCII keys
 */
const LEGACY_SCORING_KEY_MAP: Record<string, keyof ScoringConfig> = {
  // French labels
  'indice_pénalité': 'hint_penalty',
  'indice_penalite': 'hint_penalty',
  'indice pénalité': 'hint_penalty',
  'indice penalite': 'hint_penalty',
  'pénalité_indice': 'hint_penalty',
  'penalite_indice': 'hint_penalty',
  'pénalité indice': 'hint_penalty',
  'penalite indice': 'hint_penalty',
  'pénalité_échec': 'fail_penalty',
  'penalite_echec': 'fail_penalty',
  'pénalité échec': 'fail_penalty',
  'penalite echec': 'fail_penalty',
  'limite de temps en secondes': 'time_limit_sec',
  'limite_de_temps_en_secondes': 'time_limit_sec',
  'temps_limite': 'time_limit_sec',
  'temps limite': 'time_limit_sec',
  'temps limite sec': 'time_limit_sec',
  'bonus_temps': 'time_bonus',
  'bonus temps': 'time_bonus',
  // CamelCase legacy
  'hintpenalty': 'hint_penalty',
  'hintPenalty': 'hint_penalty',
  'failpenalty': 'fail_penalty',
  'failPenalty': 'fail_penalty',
  'timelimitsec': 'time_limit_sec',
  'timeLimitSec': 'time_limit_sec',
  'timelimit': 'time_limit_sec',
  'timeLimit': 'time_limit_sec',
  'timebonus': 'time_bonus',
  'timeBonus': 'time_bonus',
  // Passthrough canonical values
  'points': 'points',
  'hint_penalty': 'hint_penalty',
  'fail_penalty': 'fail_penalty',
  'time_limit_sec': 'time_limit_sec',
  'time_limit': 'time_limit_sec',
  'time_bonus': 'time_bonus',
};

/**
 * Normalize a step_config object to use canonical ASCII enum values and keys.
 * Migrates legacy single values to multi-select arrays.
 * GPS values are migrated to manual/terrain with a warning flag.
 */
export function normalizeStepConfig(config: StepConfig | null | undefined): StepConfig {
  if (!config) return {};
  
  const normalized: StepConfig = { ...config };
  let gpsMigrated = false;
  
  // Normalize and migrate legacy validationMode to possible_validation_modes
  if (normalized.validationMode && !normalized.possible_validation_modes) {
    const lower = String(normalized.validationMode).toLowerCase().trim();
    const mapped = LEGACY_VALIDATION_MODE_MAP[lower];
    
    if (mapped === '_gps_migrated') {
      normalized.possible_validation_modes = ['manual'];
      gpsMigrated = true;
    } else if (mapped) {
      normalized.possible_validation_modes = [mapped];
    } else {
      // Keep as-is if valid
      const validModes: ValidationMode[] = ['qr_code', 'photo', 'code', 'manual', 'free'];
      if (validModes.includes(normalized.validationMode)) {
        normalized.possible_validation_modes = [normalized.validationMode];
      } else {
        normalized.possible_validation_modes = ['manual'];
      }
    }
  }
  
  // Normalize and migrate legacy stepType to possible_step_types
  if (normalized.stepType && !normalized.possible_step_types) {
    const lower = String(normalized.stepType).toLowerCase().trim();
    const mapped = LEGACY_STEP_TYPE_MAP[lower];
    
    if (mapped === '_gps_migrated') {
      normalized.possible_step_types = ['terrain'];
      gpsMigrated = true;
    } else if (mapped) {
      normalized.possible_step_types = [mapped];
    } else {
      // Keep as-is if valid
      const validTypes: StepType[] = ['story', 'information', 'mcq', 'enigme', 'code', 'hangman', 'memory', 'photo', 'terrain', 'defi'];
      if (validTypes.includes(normalized.stepType)) {
        normalized.possible_step_types = [normalized.stepType];
      } else {
        normalized.possible_step_types = ['enigme'];
      }
    }
  }
  
  // Set GPS migration warning flag
  if (gpsMigrated) {
    normalized._gps_migrated_warning = true;
  }
  
  // Normalize scoring keys to canonical snake_case ASCII
  if (normalized.scoring) {
    const rawScoring = normalized.scoring as Record<string, unknown>;
    const normalizedScoring: ScoringConfig = {};
    
    for (const [key, value] of Object.entries(rawScoring)) {
      if (typeof value !== 'number') continue;
      
      // Try exact match first, then lowercase
      let canonicalKey = LEGACY_SCORING_KEY_MAP[key];
      if (!canonicalKey) {
        const lowerKey = key.toLowerCase().trim();
        canonicalKey = LEGACY_SCORING_KEY_MAP[lowerKey];
      }
      
      if (canonicalKey) {
        normalizedScoring[canonicalKey] = value;
      }
    }
    
    normalized.scoring = normalizedScoring;
  }
  
  return normalized;
}

/**
 * Check if a step config has missing required values
 */
export function stepConfigHasMissingDefaults(config: StepConfig | null | undefined): boolean {
  if (!config) return true;
  const hasPossibleTypes = config.possible_step_types && config.possible_step_types.length > 0;
  const hasPossibleModes = config.possible_validation_modes && config.possible_validation_modes.length > 0;
  // Fallback to legacy single values
  const hasLegacyType = config.stepType;
  const hasLegacyMode = config.validationMode;
  return (!hasPossibleTypes && !hasLegacyType) || (!hasPossibleModes && !hasLegacyMode) || !config.scoring;
}
