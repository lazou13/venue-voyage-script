import type { StepConfig, StepType, ValidationMode } from '@/types/intake';

/**
 * Legacy value mappings for normalization
 */
const LEGACY_VALIDATION_MODE_MAP: Record<string, ValidationMode> = {
  'code_qr': 'qr_code',
  'qr': 'qr_code',
  'gps': 'auto_gps',
  'gps_auto': 'auto_gps',
  'manuel': 'manual',
  'libre': 'free',
};

const LEGACY_STEP_TYPE_MAP: Record<string, StepType> = {
  'question': 'mcq',
  'quiz': 'mcq',
  'qcm': 'mcq',
  'puzzle': 'enigme',
  'riddle': 'enigme',
  'narrative': 'story',
  'info': 'information',
  'secret_code': 'code',
  'challenge': 'defi',
  'field': 'terrain',
};

const LEGACY_SCORING_KEY_MAP: Record<string, string> = {
  'pénalité_indice': 'hintPenalty',
  'penalite_indice': 'hintPenalty',
  'hint_penalty': 'hintPenalty',
  'pénalité_échec': 'failPenalty',
  'penalite_echec': 'failPenalty',
  'fail_penalty': 'failPenalty',
  'time_limit_sec': 'timeLimitSec',
  'time_limit': 'timeLimitSec',
  'time_bonus': 'timeBonus',
};

/**
 * Normalize a step_config object to use canonical enum values and keys
 */
export function normalizeStepConfig(config: StepConfig | null | undefined): StepConfig {
  if (!config) return {};
  
  const normalized: StepConfig = { ...config };
  
  // Normalize validationMode
  if (normalized.validationMode) {
    const lower = String(normalized.validationMode).toLowerCase();
    if (LEGACY_VALIDATION_MODE_MAP[lower]) {
      normalized.validationMode = LEGACY_VALIDATION_MODE_MAP[lower];
    }
  }
  
  // Normalize stepType
  if (normalized.stepType) {
    const lower = String(normalized.stepType).toLowerCase();
    if (LEGACY_STEP_TYPE_MAP[lower]) {
      normalized.stepType = LEGACY_STEP_TYPE_MAP[lower];
    }
  }
  
  // Normalize scoring keys
  if (normalized.scoring) {
    const rawScoring = normalized.scoring as Record<string, unknown>;
    const normalizedScoring: StepConfig['scoring'] = {};
    
    for (const [key, value] of Object.entries(rawScoring)) {
      const normalizedKey = LEGACY_SCORING_KEY_MAP[key] || key;
      switch (normalizedKey) {
        case 'points':
          normalizedScoring.points = typeof value === 'number' ? value : undefined;
          break;
        case 'hintPenalty':
          normalizedScoring.hintPenalty = typeof value === 'number' ? value : undefined;
          break;
        case 'failPenalty':
          normalizedScoring.failPenalty = typeof value === 'number' ? value : undefined;
          break;
        case 'timeLimitSec':
          normalizedScoring.timeLimitSec = typeof value === 'number' ? value : undefined;
          break;
        case 'timeBonus':
          normalizedScoring.timeBonus = typeof value === 'number' ? value : undefined;
          break;
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
