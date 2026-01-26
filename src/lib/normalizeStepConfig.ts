import type { StepConfig, StepType, ValidationMode, ScoringConfig } from '@/types/intake';

/**
 * CANONICAL VALUES (snake_case only):
 * 
 * validation_mode: auto_gps | qr_code | manual | photo | code | free
 * step_type: story | information | mcq | enigme | code | hangman | memory | gps | photo | terrain | defi
 * scoring keys: points | hint_penalty | fail_penalty | time_limit_sec | time_bonus
 */

/**
 * Legacy value mappings for validation_mode normalization
 */
const LEGACY_VALIDATION_MODE_MAP: Record<string, ValidationMode> = {
  // French labels
  'code qr': 'qr_code',
  'gps automatique': 'auto_gps',
  'gps auto': 'auto_gps',
  'manuel': 'manual',
  'manuelle': 'manual',
  'libre': 'free',
  'gratuit': 'free',
  // Legacy snake/camel variants
  'code_qr': 'qr_code',
  'qr': 'qr_code',
  'qrcode': 'qr_code',
  'qr-code': 'qr_code',
  'gps': 'auto_gps',
  'gps_auto': 'auto_gps',
  'autogps': 'auto_gps',
  'auto-gps': 'auto_gps',
};

/**
 * Legacy value mappings for step_type normalization
 */
const LEGACY_STEP_TYPE_MAP: Record<string, StepType> = {
  // French labels
  'narration': 'story',
  'histoire': 'story',
  'récit': 'story',
  'qcm': 'mcq',
  'énigme': 'enigme',
  'code secret': 'code',
  'pendu': 'hangman',
  'mémoire': 'memory',
  'défi': 'defi',
  // Legacy variants
  'question': 'mcq',
  'quiz': 'mcq',
  'multiple_choice': 'mcq',
  'multiplechoice': 'mcq',
  'puzzle': 'enigme',
  'riddle': 'enigme',
  'narrative': 'story',
  'info': 'information',
  'secret_code': 'code',
  'secretcode': 'code',
  'challenge': 'defi',
  'field': 'terrain',
};

/**
 * Legacy scoring key mappings -> canonical snake_case
 */
const LEGACY_SCORING_KEY_MAP: Record<string, keyof ScoringConfig> = {
  // French
  'pénalité_indice': 'hint_penalty',
  'penalite_indice': 'hint_penalty',
  'pénalité indice': 'hint_penalty',
  'penalite indice': 'hint_penalty',
  'pénalité_échec': 'fail_penalty',
  'penalite_echec': 'fail_penalty',
  'pénalité échec': 'fail_penalty',
  'penalite echec': 'fail_penalty',
  'temps_limite': 'time_limit_sec',
  'temps limite': 'time_limit_sec',
  'bonus_temps': 'time_bonus',
  'bonus temps': 'time_bonus',
  // CamelCase legacy
  'hintPenalty': 'hint_penalty',
  'failPenalty': 'fail_penalty',
  'timeLimitSec': 'time_limit_sec',
  'timeLimit': 'time_limit_sec',
  'timeBonus': 'time_bonus',
  // Already canonical (passthrough)
  'points': 'points',
  'hint_penalty': 'hint_penalty',
  'fail_penalty': 'fail_penalty',
  'time_limit_sec': 'time_limit_sec',
  'time_limit': 'time_limit_sec',
  'time_bonus': 'time_bonus',
};

/**
 * Normalize a step_config object to use canonical snake_case enum values and keys
 */
export function normalizeStepConfig(config: StepConfig | null | undefined): StepConfig {
  if (!config) return {};
  
  const normalized: StepConfig = { ...config };
  
  // Normalize validationMode (keep camelCase property name, but value is snake_case)
  if (normalized.validationMode) {
    const lower = String(normalized.validationMode).toLowerCase().trim();
    if (LEGACY_VALIDATION_MODE_MAP[lower]) {
      normalized.validationMode = LEGACY_VALIDATION_MODE_MAP[lower];
    }
  }
  
  // Normalize stepType (keep camelCase property name, but value is snake_case)
  if (normalized.stepType) {
    const lower = String(normalized.stepType).toLowerCase().trim();
    if (LEGACY_STEP_TYPE_MAP[lower]) {
      normalized.stepType = LEGACY_STEP_TYPE_MAP[lower];
    }
  }
  
  // Normalize scoring keys to snake_case
  if (normalized.scoring) {
    const rawScoring = normalized.scoring as Record<string, unknown>;
    const normalizedScoring: ScoringConfig = {};
    
    for (const [key, value] of Object.entries(rawScoring)) {
      const lowerKey = key.toLowerCase().trim();
      const canonicalKey = LEGACY_SCORING_KEY_MAP[lowerKey] || LEGACY_SCORING_KEY_MAP[key];
      
      if (canonicalKey && typeof value === 'number') {
        normalizedScoring[canonicalKey] = value;
      } else if (key === 'points' && typeof value === 'number') {
        normalizedScoring.points = value;
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
  return !config.stepType || !config.validationMode || !config.scoring;
}
