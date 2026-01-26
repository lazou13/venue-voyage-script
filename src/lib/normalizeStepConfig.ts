import type { StepConfig, StepType, ValidationMode, ScoringConfig } from '@/types/intake';

/**
 * CANONICAL VALUES (strict ASCII, engine-like, no spaces, no accents):
 * 
 * validation_mode: auto_gps | qr_code | manual | photo | code | free
 * step_type: story | information | mcq | enigme | code | hangman | memory | gps | photo | terrain | defi
 * scoring keys: points | hint_penalty | fail_penalty | time_limit_sec | time_bonus
 */

/**
 * Legacy value mappings for validation_mode normalization
 * Accepts French labels, accented text, spaces, various formats -> outputs canonical ASCII
 */
const LEGACY_VALIDATION_MODE_MAP: Record<string, ValidationMode> = {
  // French labels (exact user inputs)
  'gps automatique': 'auto_gps',
  'code qr': 'qr_code',
  'gratuit': 'free',
  'libre': 'free',
  'manuel': 'manual',
  'manuelle': 'manual',
  // Accented variants
  'gps automatiqué': 'auto_gps',
  // Legacy snake/camel/dash variants
  'code_qr': 'qr_code',
  'qr': 'qr_code',
  'qrcode': 'qr_code',
  'qr-code': 'qr_code',
  'qr code': 'qr_code',
  'gps': 'auto_gps',
  'gps_auto': 'auto_gps',
  'autogps': 'auto_gps',
  'auto-gps': 'auto_gps',
  'auto gps': 'auto_gps',
  'gps auto': 'auto_gps',
  // Passthrough canonical values
  'auto_gps': 'auto_gps',
  'qr_code': 'qr_code',
  'manual': 'manual',
  'photo': 'photo',
  'code': 'code',
  'free': 'free',
};

/**
 * Legacy value mappings for step_type normalization
 * Accepts French labels, accented text -> outputs canonical ASCII
 */
const LEGACY_STEP_TYPE_MAP: Record<string, StepType> = {
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
  // Passthrough canonical values (all 11 step types)
  'story': 'story',
  'information': 'information',
  'mcq': 'mcq',
  'enigme': 'enigme',
  'code': 'code',
  'hangman': 'hangman',
  'memory': 'memory',
  'gps': 'gps',
  'photo': 'photo',
  'terrain': 'terrain',
  'defi': 'defi',
};

/**
 * Legacy scoring key mappings -> canonical snake_case ASCII keys
 * Accepts French, accented, camelCase, spaces -> outputs canonical ASCII
 */
const LEGACY_SCORING_KEY_MAP: Record<string, keyof ScoringConfig> = {
  // French labels (exact user inputs)
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
 * Normalize a step_config object to use canonical ASCII enum values and keys
 * Input: any legacy/French/accented values
 * Output: strict ASCII canonical values only
 */
export function normalizeStepConfig(config: StepConfig | null | undefined): StepConfig {
  if (!config) return {};
  
  const normalized: StepConfig = { ...config };
  
  // Normalize validationMode value to canonical ASCII
  if (normalized.validationMode) {
    const lower = String(normalized.validationMode).toLowerCase().trim();
    const mapped = LEGACY_VALIDATION_MODE_MAP[lower];
    if (mapped) {
      normalized.validationMode = mapped;
    }
    // If not in map, keep as-is (might already be canonical)
  }
  
  // Normalize stepType value to canonical ASCII
  if (normalized.stepType) {
    const lower = String(normalized.stepType).toLowerCase().trim();
    const mapped = LEGACY_STEP_TYPE_MAP[lower];
    if (mapped) {
      normalized.stepType = mapped;
    }
    // If not in map, keep as-is (might already be canonical)
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
  return !config.stepType || !config.validationMode || !config.scoring;
}
