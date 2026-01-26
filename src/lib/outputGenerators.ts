import type { Project, POI, WifiZone, ForbiddenZone, TeamConfig, ProjectType, Avatar } from '@/types/intake';
import { 
  STEP_TYPE_LABELS, 
  VALIDATION_MODE_LABELS, 
  WIFI_LABELS, 
  QUEST_TYPE_LABELS,
  TARGET_AUDIENCE_LABELS,
  COMPETITION_MODE_LABELS,
  LANGUAGE_LABELS,
  PROJECT_TYPE_LABELS
} from '@/types/intake';

export interface OutputData {
  project: Project;
  pois: POI[];
  wifiZones: WifiZone[];
  forbiddenZones: ForbiddenZone[];
  avatars?: Avatar[];
}

// Helper to safely access teamConfig
function getTeamConfig(questConfig: Project['quest_config']): TeamConfig {
  return questConfig?.teamConfig || { enabled: false };
}

export function generateChecklist(data: OutputData): string {
  const { project, pois, wifiZones, forbiddenZones } = data;
  const questConfig = project.quest_config || {};
  
  // Determine validation requirements from steps
  const validationModes = new Set(
    pois.flatMap(p => p.step_config?.possible_validation_modes || [p.step_config?.validationMode].filter(Boolean))
  );
  const hasQrValidation = validationModes.has('qr_code');
  const hasPhotoValidation = validationModes.has('photo');
  
  return `# FIELDWORK CHECKLIST
## ${project.hotel_name} - ${project.city}
Date de visite: ${project.visit_date ? new Date(project.visit_date).toLocaleDateString('fr-FR') : 'Non définie'}
Quest Type: ${questConfig.questType ? QUEST_TYPE_LABELS[questConfig.questType] : 'Non défini'}

---

## 📱 ÉQUIPEMENT REQUIS

${hasQrValidation ? '- [ ] Scanner QR Code testé' : ''}
${hasPhotoValidation ? '- [ ] Appareil photo / caméra prêt' : ''}
- [ ] Application installée et configurée
- [ ] Connexion Wi-Fi vérifiée

---

## 📷 PHOTOS REQUISES

### Photos générales
- [ ] Entrée principale
- [ ] Réception
- [ ] Couloirs principaux
- [ ] Patio/Jardin
- [ ] Rooftop (si accessible)
- [ ] Restaurant/Bar

### Photos Étapes (${pois.length} points)
${pois.map((poi, i) => `- [ ] Étape ${i + 1}: ${poi.name} (${poi.zone})`).join('\n')}

---

## 📍 ÉTAPES À VALIDER SUR SITE

${pois.map((poi, i) => {
  const config = poi.step_config || {};
  const stepTypes = config.possible_step_types?.join(', ') || config.stepType || 'Non défini';
  const validationModes = config.possible_validation_modes?.join(', ') || config.validationMode || 'Manuel';
  return `### ${i + 1}. ${poi.name}
- Zone: ${poi.zone}
- Types possibles: ${stepTypes}
- Validations possibles: ${validationModes}
${config.possible_validation_modes?.includes('qr_code') || config.validationMode === 'qr_code' ? '- [ ] QR Code installé et testé' : ''}
${(config.possible_validation_modes?.includes('photo') || config.validationMode === 'photo') && config.photoValidation?.type === 'reference' ? '- [ ] Photo de référence prise' : ''}
- [ ] Accessibilité confirmée
- [ ] Interaction testée
`;
}).join('\n')}

---

## 📶 WIFI À TESTER

${wifiZones.map((wz) => `- [ ] ${wz.zone}: ${WIFI_LABELS[wz.strength]} confirmé`).join('\n') || '- Aucune zone définie'}

---

## 🚫 ZONES INTERDITES À CONFIRMER

${forbiddenZones.map((fz) => `- [ ] ${fz.zone}${fz.reason ? ` (${fz.reason})` : ''}`).join('\n') || '- Aucune zone définie'}

---

## ⚙️ OPS À VALIDER

- [ ] Staff disponible: ${project.staff_available ? 'Oui' : 'Non'}
- [ ] Temps reset: ${project.reset_time_mins || 'N/A'} min
- [ ] Props autorisés: ${project.props_allowed ? 'Oui' : 'Non'}

---

## ✅ VALIDATION FINALE

- [ ] Carte/plan récupéré
- [ ] ${pois.length} étapes documentées
- [ ] ${forbiddenZones.length} zones interdites confirmées
- [ ] Tests Wi-Fi effectués
- [ ] Contraintes ops validées avec staff
`;
}

export function generatePRD(data: OutputData): string {
  const { project, pois, wifiZones, forbiddenZones } = data;
  const questConfig = project.quest_config || {};
  const teamConfig = getTeamConfig(project.quest_config);
  const scoring = questConfig.scoring || {};
  const projectType = questConfig.project_type || 'establishment';
  const core = questConfig.core || {};
  
  // Count step types
  const stepTypeCounts: Record<string, number> = {};
  pois.forEach(poi => {
    const type = poi.step_config?.stepType || 'undefined';
    stepTypeCounts[type] = (stepTypeCounts[type] || 0) + 1;
  });
  
  // Count validation modes
  const validationCounts: Record<string, number> = {};
  pois.forEach(poi => {
    const mode = poi.step_config?.validationMode || 'manual';
    validationCounts[mode] = (validationCounts[mode] || 0) + 1;
  });

  // Build PROJECT_CONTEXT section
  const projectContextSection = buildProjectContextMarkdown(project);
  
  return `# PRD - Quest Configuration
## ${project.hotel_name}

---

## 1. PROJECT_CONTEXT

${projectContextSection}

---

## 2. OVERVIEW

| Paramètre | Valeur |
|-----------|--------|
| Nom | ${project.hotel_name} |
| Ville | ${project.city} |
| Type | ${PROJECT_TYPE_LABELS[projectType]} |
| Étages | ${project.floors} |
| Date visite | ${project.visit_date ? new Date(project.visit_date).toLocaleDateString('fr-FR') : 'TBD'} |

---

## 3. QUEST CONFIGURATION

### 3.1 Type & Audience
- **Type de quête**: ${questConfig.questType ? QUEST_TYPE_LABELS[questConfig.questType] : 'Non défini'}
- **Public cible**: ${(core.target_audience || [questConfig.targetAudience]).filter(Boolean).map(a => TARGET_AUDIENCE_LABELS[a as keyof typeof TARGET_AUDIENCE_LABELS]).join(', ') || 'Non défini'}
- **Langues**: ${(core.languages || questConfig.languages || ['fr']).map(l => LANGUAGE_LABELS[l]).join(', ')}
- **Durée estimée**: ${core.duration_min ? `${core.duration_min} min` : 'Non définie'}
- **Difficulté**: ${core.difficulty ? `${core.difficulty}/5` : 'Non définie'}

### 3.2 Titre & Histoire
- **Titre (FR)**: ${project.title_i18n?.fr || 'Non défini'}
- **Histoire (FR)**: ${project.story_i18n?.fr || 'Non définie'}

### 3.3 Team Configuration
${teamConfig.enabled ? `
- **Mode équipe**: Activé
- **Mode compétition**: ${teamConfig.competitionMode ? COMPETITION_MODE_LABELS[teamConfig.competitionMode] : 'N/A'}
- **Max équipes**: ${teamConfig.maxTeams || 'N/A'}
- **Joueurs/équipe**: ${teamConfig.maxPlayersPerTeam || 'N/A'}
${teamConfig.competitionMode === 'timed' ? `- **Temps limite**: ${teamConfig.timeLimitMinutes || 'N/A'} min` : ''}
` : '- **Mode équipe**: Désactivé'}

---

## 4. STEPS ANALYSIS

### 4.1 Summary
- **Total étapes**: ${pois.length}

### 4.2 Types d'étapes
${Object.entries(stepTypeCounts).map(([type, count]) => 
  `- ${type in STEP_TYPE_LABELS ? STEP_TYPE_LABELS[type as keyof typeof STEP_TYPE_LABELS] : type}: ${count}`
).join('\n')}

### 4.3 Modes de validation
${Object.entries(validationCounts).map(([mode, count]) => 
  `- ${mode in VALIDATION_MODE_LABELS ? VALIDATION_MODE_LABELS[mode as keyof typeof VALIDATION_MODE_LABELS] : mode}: ${count}`
).join('\n')}

---

## 5. SCORING & RULES

### 5.1 Scoring par défaut
- **Points/étape**: ${scoring.points || 10}
- **Pénalité indice**: ${scoring.hint_penalty || 2}
- **Pénalité échec**: ${scoring.fail_penalty || 5}
- **Temps limite**: ${scoring.time_limit_sec ? `${scoring.time_limit_sec}s` : 'Illimité'}
- **Bonus temps**: ${scoring.time_bonus || 0}

### 5.2 Indices
- **Max indices**: ${questConfig.hintRules?.maxHints || 3}
- **Auto-révélation**: ${questConfig.hintRules?.autoRevealAfterSec ? `${questConfig.hintRules.autoRevealAfterSec}s` : 'Désactivé'}

### 5.3 Branchement
- **Succès**: ${questConfig.branchingPresets?.onSuccess || 'next'}
- **Échec**: ${questConfig.branchingPresets?.onFailure || 'retry'}

---

## 6. CONSTRAINTS

### 6.1 Opérationnelles
- Staff disponible: ${project.staff_available ? '✅ Oui' : '❌ Non'}
- Temps de reset: ${project.reset_time_mins || 'N/A'} min
- Props autorisés: ${project.props_allowed ? '✅ Oui' : '❌ Non'}

### 6.2 Zones Interdites
${forbiddenZones.map((fz) => `- ${fz.zone}${fz.reason ? `: ${fz.reason}` : ''}`).join('\n') || '- Aucune restriction définie'}

### 6.3 Connectivité
${wifiZones.filter(wz => wz.strength !== 'ok').map((wz) => `- ⚠️ ${wz.zone}: ${WIFI_LABELS[wz.strength]}`).join('\n') || '- Toutes zones OK'}

---

## 7. ASSETS

- Carte: ${project.map_url ? '✅ Uploadée' : '❌ Manquante'}
- Photos étapes: ${pois.filter(p => p.photo_url).length}/${pois.length}
`;
}

/**
 * Build PROJECT_CONTEXT as structured markdown (no narrative)
 */
function buildProjectContextMarkdown(project: Project): string {
  const questConfig = project.quest_config || {};
  const projectType = questConfig.project_type || 'establishment';
  const core = questConfig.core || {};

  let md = `### Type: ${PROJECT_TYPE_LABELS[projectType]}

### Core
| Paramètre | Valeur |
|-----------|--------|
| Langues | ${(core.languages || ['fr']).join(', ')} |
| Public cible | ${(core.target_audience || []).join(', ') || '-'} |
| Durée estimée | ${core.duration_min ? `${core.duration_min} min` : '-'} |
| Difficulté | ${core.difficulty ? `${core.difficulty}/5` : '-'} |

**Objectifs business:**
${(core.objective_business || []).map(o => `- ${o}`).join('\n') || '- Aucun défini'}

**Contraintes générales:**
${(core.constraints_general || []).map(c => `- ${c}`).join('\n') || '- Aucune définie'}
`;

  // Type-specific details
  if (projectType === 'establishment' && questConfig.establishment_details) {
    const d = questConfig.establishment_details;
    md += `
### Détails Établissement
**Espaces:** ${(d.spaces || []).join(', ') || '-'}
**Zones privées:** ${(d.private_zones || []).join(', ') || '-'}
**Ops staff:** ${(d.staff_ops || []).join(', ') || '-'}
**Notes Wi-Fi:** ${(d.wifi_notes || []).join(', ') || '-'}
`;
  } else if (projectType === 'tourist_spot' && questConfig.tourist_spot_details) {
    const d = questConfig.tourist_spot_details;
    md += `
### Détails Site Touristique
**Points départ:** ${(d.start_points || []).join(', ') || '-'}
**Points arrivée:** ${(d.end_points || []).join(', ') || '-'}
**Landmarks:** ${(d.landmarks || []).join(', ') || '-'}
**Zones à éviter:** ${(d.avoid_zones || []).join(', ') || '-'}
**Créneaux:** ${(d.time_windows || []).join(', ') || '-'}
`;
  } else if (projectType === 'route_recon' && questConfig.route_recon_details) {
    const d = questConfig.route_recon_details;
    md += `
### Détails Reconnaissance Parcours
**Type route:** ${d.route_type || '-'}
**Segments:** ${(d.segments || []).join(', ') || '-'}
**Points danger:** ${(d.danger_points || []).join(', ') || '-'}
**Arrêts obligatoires:** ${(d.mandatory_stops || []).join(', ') || '-'}
**Consignes sécurité:** ${(d.safety_brief || []).join(', ') || '-'}
`;
  }

  return md;
}

// Helper to build validation summary
function getValidationSummary(config: POI['step_config']): string {
  if (!config) return '-';
  const parts: string[] = [];
  
  // Handle multi-select modes
  const modes = config.possible_validation_modes || (config.validationMode ? [config.validationMode] : []);
  
  if (modes.includes('qr_code')) {
    parts.push(`QR:${config.photoValidation?.qrExpectedValue || '?'}`);
  }
  if (modes.includes('photo') && config.photoValidation) {
    if (config.photoValidation.type === 'reference') {
      parts.push(`Photo:ref${config.photoValidation.referenceUrl ? '✓' : '?'}`);
    } else if (config.photoValidation.type === 'qr_code') {
      parts.push(`Photo:qr${config.photoValidation.qrExpectedValue ? '✓' : '?'}`);
    } else {
      parts.push('Photo:free');
    }
  }
  
  return parts.length > 0 ? parts.join(' ') : '-';
}

// Helper to build scoring summary (snake_case keys)
function getScoringSummary(config: POI['step_config'], defaults: { points?: number; hint_penalty?: number; fail_penalty?: number }): string {
  const scoring = config?.scoring || {};
  const pts = scoring.points ?? defaults.points ?? 10;
  const hint = scoring.hint_penalty ?? defaults.hint_penalty ?? 2;
  const fail = scoring.fail_penalty ?? defaults.fail_penalty ?? 5;
  const time = scoring.time_limit_sec ? `/${scoring.time_limit_sec}s` : '';
  return `${pts}pts/-${hint}h/-${fail}f${time}`;
}

// Helper to build branching summary
function getBranchingSummary(config: POI['step_config']): string {
  if (!config?.branching) return '-';
  const b = config.branching;
  const parts: string[] = [];
  if (b.onSuccess && b.onSuccess !== 'next') parts.push(`✓→${b.onSuccess}`);
  if (b.onFailure && b.onFailure !== 'retry') parts.push(`✗→${b.onFailure}`);
  if (b.scoreAbove) parts.push(`>${b.scoreAbove}→${b.scoreAboveTarget || '?'}`);
  return parts.length > 0 ? parts.join(' ') : '-';
}

// ============= Canonical value sets =============
const CANONICAL_VALIDATION_MODES = new Set(['auto_gps', 'qr_code', 'manual', 'photo', 'code', 'free']);
const CANONICAL_STEP_TYPES = new Set(['story', 'information', 'mcq', 'enigme', 'code', 'hangman', 'memory', 'gps', 'photo', 'terrain', 'defi']);
const CANONICAL_SCORING_KEYS = new Set(['points', 'hint_penalty', 'fail_penalty', 'time_limit_sec', 'time_bonus']);

// ============= Legacy French -> Canonical mappings =============
const VALIDATION_MODE_MAP: Record<string, string> = {
  'gps automatique': 'auto_gps',
  'gps auto': 'auto_gps',
  'auto_gps': 'auto_gps',
  'code qr': 'qr_code',
  'qr code': 'qr_code',
  'qr_code': 'qr_code',
  'manuel': 'manual',
  'manual': 'manual',
  'photo': 'photo',
  'code': 'code',
  'gratuit': 'free',
  'libre': 'free',
  'free': 'free',
};

const STEP_TYPE_MAP: Record<string, string> = {
  'histoire': 'story',
  'récit': 'story',
  'story': 'story',
  'information': 'information',
  'qcm': 'mcq',
  'mcq': 'mcq',
  'énigme': 'enigme',
  'enigme': 'enigme',
  'code secret': 'code',
  'code': 'code',
  'pendu': 'hangman',
  'hangman': 'hangman',
  'mémoire': 'memory',
  'memory': 'memory',
  'gps': 'gps',
  'photo': 'photo',
  'terrain': 'terrain',
  'défi': 'defi',
  'defi': 'defi',
  'narration': 'story',
};

const SCORING_KEY_MAP: Record<string, string> = {
  'points': 'points',
  'hint_penalty': 'hint_penalty',
  'pénalité_indice': 'hint_penalty',
  'penalite_indice': 'hint_penalty',
  'fail_penalty': 'fail_penalty',
  'pénalité_échec': 'fail_penalty',
  'penalite_echec': 'fail_penalty',
  'time_limit_sec': 'time_limit_sec',
  'limite_temps_sec': 'time_limit_sec',
  'time_bonus': 'time_bonus',
  'bonus_temps': 'time_bonus',
};

function canonicalizeValidationMode(val: unknown): string {
  if (!val) return 'manual';
  const normalized = String(val).toLowerCase().trim();
  const mapped = VALIDATION_MODE_MAP[normalized];
  if (mapped && CANONICAL_VALIDATION_MODES.has(mapped)) return mapped;
  if (CANONICAL_VALIDATION_MODES.has(normalized)) return normalized;
  throw new Error(`Invalid validationMode: "${val}". Must be one of: ${[...CANONICAL_VALIDATION_MODES].join('|')}`);
}

function canonicalizeStepType(val: unknown): string {
  if (!val) return 'enigme';
  const normalized = String(val).toLowerCase().trim();
  const mapped = STEP_TYPE_MAP[normalized];
  if (mapped && CANONICAL_STEP_TYPES.has(mapped)) return mapped;
  if (CANONICAL_STEP_TYPES.has(normalized)) return normalized;
  throw new Error(`Invalid stepType: "${val}". Must be one of: ${[...CANONICAL_STEP_TYPES].join('|')}`);
}

function canonicalizeScoringKeys(scoring: unknown): Record<string, unknown> {
  if (!scoring || typeof scoring !== 'object') return {};
  const result: Record<string, unknown> = {};
  const invalidKeys: string[] = [];
  
  for (const [key, value] of Object.entries(scoring as Record<string, unknown>)) {
    const normalized = key.toLowerCase().trim();
    const mapped = SCORING_KEY_MAP[normalized];
    if (mapped && CANONICAL_SCORING_KEYS.has(mapped)) {
      result[mapped] = value;
    } else if (CANONICAL_SCORING_KEYS.has(normalized)) {
      result[normalized] = value;
    } else {
      invalidKeys.push(key);
    }
  }
  
  if (invalidKeys.length > 0) {
    throw new Error(`Invalid scoring keys: ${invalidKeys.join(', ')}. Must be one of: ${[...CANONICAL_SCORING_KEYS].join('|')}`);
  }
  
  return result;
}

/**
 * Build the canonical quest export object (used for JSON export)
 * Enforces canonical values at export time and fails fast on invalid data.
 */
export function buildQuestExport(data: OutputData) {
  const { project, pois, wifiZones, forbiddenZones, avatars = [] } = data;
  const questConfig = project.quest_config || {};
  const teamConfig = getTeamConfig(project.quest_config);

  // Canonicalize quest-level scoring
  const canonicalQuestScoring = canonicalizeScoringKeys(questConfig.scoring);

  // Build steps with canonical values and multi-select arrays
  const steps = pois.map((poi, i) => {
    const config = poi.step_config || {};
    return {
      order: i + 1,
      name: poi.name,
      zone: poi.zone,
      possible_step_types: config.possible_step_types || (config.stepType ? [config.stepType] : ['enigme']),
      possible_validation_modes: config.possible_validation_modes || (config.validationMode ? [config.validationMode] : ['manual']),
      final_step_type: config.final_step_type || null,
      final_validation_mode: config.final_validation_mode || null,
      photoValidation: config.photoValidation,
      // Photo reference fields
      photo_reference_required: config.photo_reference_required || false,
      reference_image_url: config.reference_image_url || null,
      reference_image_caption: config.reference_image_caption || null,
      scoring: canonicalizeScoringKeys(config.scoring),
      hints: config.hints,
      branching: config.branching,
      contentI18n: config.contentI18n,
    };
  });

  // Build project context based on project_type
  const projectContext = buildProjectContext(project);

  // Build storytelling/narrator data
  const storytelling = questConfig.storytelling;
  let storytellingData: {
    enabled: boolean;
    narrator: {
      avatar_id: string;
      avatar_image_url: string;
      avatar_tags: {
        name: string;
        style: string;
        persona: string;
        age: string;
        outfit: string;
      };
    } | null;
  } = {
    enabled: storytelling?.enabled || false,
    narrator: null,
  };

  if (storytelling?.enabled && storytelling.narrator?.avatar_id) {
    const avatar = avatars.find(a => a.id === storytelling.narrator?.avatar_id);
    if (avatar) {
      storytellingData.narrator = {
        avatar_id: avatar.id,
        avatar_image_url: avatar.image_url,
        avatar_tags: {
          name: avatar.name,
          style: avatar.style,
          persona: avatar.persona,
          age: avatar.age,
          outfit: avatar.outfit,
        },
      };
    }
  }

  return {
    quest: {
      type: questConfig.questType,
      targetAudience: questConfig.targetAudience,
      languages: questConfig.languages || ['fr'],
      title: project.title_i18n,
      story: project.story_i18n,
      teamConfig: teamConfig.enabled ? {
        enabled: true,
        competitionMode: teamConfig.competitionMode,
        maxTeams: teamConfig.maxTeams,
        maxPlayersPerTeam: teamConfig.maxPlayersPerTeam,
        timeLimitMinutes: teamConfig.timeLimitMinutes,
      } : { enabled: false },
      scoring: canonicalQuestScoring,
      hintRules: questConfig.hintRules || {},
      branching: questConfig.branchingPresets || {},
    },
    storytelling: storytellingData,
    steps,
    projectContext,
    venue: {
      hotelName: project.hotel_name,
      city: project.city,
      floors: project.floors,
      mapUrl: project.map_url,
    },
    constraints: {
      forbiddenZones: forbiddenZones.map(fz => ({ zone: fz.zone, reason: fz.reason })),
      wifiZones: wifiZones.map(wz => ({ zone: wz.zone, strength: wz.strength })),
      staffAvailable: project.staff_available,
      propsAllowed: project.props_allowed,
      resetTimeMins: project.reset_time_mins,
    },
  };
}

/**
 * Build PROJECT_CONTEXT based on project_type
 */
function buildProjectContext(project: Project) {
  const questConfig = project.quest_config || {};
  const projectType = questConfig.project_type || 'establishment';
  const core = questConfig.core || {};

  const context: Record<string, unknown> = {
    project_type: projectType,
    core: {
      languages: core.languages || questConfig.languages || ['fr'],
      target_audience: core.target_audience || (questConfig.targetAudience ? [questConfig.targetAudience] : []),
      duration_min: core.duration_min,
      difficulty: core.difficulty,
      objective_business: core.objective_business || [],
      constraints_general: core.constraints_general || [],
    },
  };

  // Add type-specific details
  if (projectType === 'establishment' && questConfig.establishment_details) {
    context.establishment_details = questConfig.establishment_details;
  } else if (projectType === 'tourist_spot' && questConfig.tourist_spot_details) {
    context.tourist_spot_details = questConfig.tourist_spot_details;
  } else if (projectType === 'route_recon' && questConfig.route_recon_details) {
    context.route_recon_details = questConfig.route_recon_details;
  }

  return context;
}

// French labels that must NEVER appear in export
const FORBIDDEN_FRENCH_LABELS = [
  'GPS automatique',
  'code QR',
  'gratuit',
  'QCM',
  'énigme',
  'mémoire',
  'défi',
  'pénalité',
  'limite de temps en secondes',
];

/**
 * Generate the QUEST_EXPORT_JSON as a formatted string.
 * Includes hard assertions to ensure no non-ASCII or French labels leak through.
 */
export function generateQuestExportJSON(data: OutputData): string {
  const exportData = buildQuestExport(data);
  const jsonString = JSON.stringify(exportData, null, 2);
  
  // Hard assertion: no non-ASCII characters
  if (/[^\x00-\x7F]/.test(jsonString)) {
    const nonAscii = jsonString.match(/[^\x00-\x7F]+/g) || [];
    throw new Error(`Non-ASCII found in QUEST_EXPORT_JSON: ${nonAscii.slice(0, 5).join(', ')}`);
  }
  
  // Hard assertion: no French labels
  const foundLabels = FORBIDDEN_FRENCH_LABELS.filter(label => 
    jsonString.toLowerCase().includes(label.toLowerCase())
  );
  if (foundLabels.length > 0) {
    throw new Error(`French labels found in QUEST_EXPORT_JSON: ${foundLabels.join(', ')}`);
  }
  
  return jsonString;
}

export function generatePrompt(data: OutputData): string {
  const { project, pois, wifiZones, forbiddenZones, avatars = [] } = data;
  const questConfig = project.quest_config || {};
  const teamConfig = getTeamConfig(project.quest_config);
  const defaultScoring = questConfig.scoring || {};
  const projectType = questConfig.project_type || 'establishment';
  const core = questConfig.core || {};
  const storytelling = questConfig.storytelling;

  // Build narrator summary for STEP_TABLE
  let narratorSummary = '';
  if (storytelling?.enabled && storytelling.narrator?.avatar_id) {
    const avatar = avatars.find(a => a.id === storytelling.narrator?.avatar_id);
    if (avatar) {
      narratorSummary = `\n| Narrateur | ${avatar.name} (${avatar.persona}, ${avatar.style}) |`;
    }
  }

  // Build enhanced STEP_TABLE with all required columns
  const stepTableHeader = '| # | Nom | Zone | Type | Validation | QR/Photo | PhotoRef | Scoring | Hints | Branching | FR Content |';
  const stepTableSeparator = '|---|-----|------|------|------------|----------|----------|---------|-------|-----------|------------|';
  const stepTable = pois.map((poi, i) => {
    const config = poi.step_config || {};
    const orderIndex = poi.sort_order ?? i;
    const stepType = config.stepType ? STEP_TYPE_LABELS[config.stepType] : 'enigme';
    const validationMode = config.validationMode ? VALIDATION_MODE_LABELS[config.validationMode] : 'Manuel';
    const validationSummary = getValidationSummary(config);
    const photoRefSummary = config.photo_reference_required 
      ? (config.reference_image_url ? 'yes' : 'MISSING') 
      : 'no';
    const scoringSummary = getScoringSummary(config, defaultScoring);
    const hintsCount = config.hints?.length || 0;
    const branchingSummary = getBranchingSummary(config);
    const frExcerpt = config.contentI18n?.fr?.substring(0, 40) || '-';
    
    return `| ${orderIndex + 1} | ${poi.name} | ${poi.zone} | ${stepType} | ${validationMode} | ${validationSummary} | ${photoRefSummary} | ${scoringSummary} | ${hintsCount} | ${branchingSummary} | ${frExcerpt}${config.contentI18n?.fr && config.contentI18n.fr.length > 40 ? '…' : ''} |`;
  }).join('\n');

  // Use the shared buildQuestExport function
  const questExport = buildQuestExport(data);

  // Build PROJECT_CONTEXT section (structured, no narrative)
  const projectContextSection = buildProjectContextMarkdown(project);

  return `# PRODUCTION PROMPT

## PROJECT_CONTEXT
${projectContextSection}

## PROFILE
| Paramètre | Valeur |
|-----------|--------|
| Nom | ${project.hotel_name} |
| Ville | ${project.city} |
| Type | ${PROJECT_TYPE_LABELS[projectType]} |
| Étages | ${project.floors} |
| Titre | ${project.title_i18n?.fr || '-'} |
| Histoire | ${project.story_i18n?.fr || '-'} |

## QUEST CONFIGURATION
| Paramètre | Valeur |
|-----------|--------|
| Type quête | ${questConfig.questType ? QUEST_TYPE_LABELS[questConfig.questType] : 'sequential'} |
| Public | ${(core.target_audience || [questConfig.targetAudience]).filter(Boolean).map(a => TARGET_AUDIENCE_LABELS[a as keyof typeof TARGET_AUDIENCE_LABELS]).join(', ') || 'family'} |
| Langues | ${(core.languages || questConfig.languages || ['fr']).map(l => LANGUAGE_LABELS[l]).join(', ')} |
| Durée | ${core.duration_min ? `${core.duration_min} min` : '-'} |
| Difficulté | ${core.difficulty ? `${core.difficulty}/5` : '-'} |

${teamConfig.enabled ? `### TEAM MODE
| Paramètre | Valeur |
|-----------|--------|
| Mode compétition | ${teamConfig.competitionMode ? COMPETITION_MODE_LABELS[teamConfig.competitionMode] : 'race'} |
| Max équipes | ${teamConfig.maxTeams || '-'} |
| Joueurs/équipe | ${teamConfig.maxPlayersPerTeam || '-'} |
${teamConfig.timeLimitMinutes ? `| Temps limite | ${teamConfig.timeLimitMinutes} min |` : ''}
` : ''}

## SCORING DEFAULTS
| Paramètre | Valeur |
|-----------|--------|
| Points/étape | ${questConfig.scoring?.points || 10} |
| Pénalité indice | ${questConfig.scoring?.hint_penalty || 2} |
| Pénalité échec | ${questConfig.scoring?.fail_penalty || 5} |
| Temps limite | ${questConfig.scoring?.time_limit_sec ? `${questConfig.scoring.time_limit_sec}s` : '-'} |
| Bonus temps | ${questConfig.scoring?.time_bonus || 0} |

## CONSTRAINTS
| Paramètre | Valeur |
|-----------|--------|
| Staff disponible | ${project.staff_available ? 'Oui' : 'Non'} |
| Props autorisés | ${project.props_allowed ? 'Oui' : 'Non'} |
| Temps reset | ${project.reset_time_mins || '-'} min |

## ZONES INTERDITES
${forbiddenZones.map(fz => `- ${fz.zone}${fz.reason ? ` (${fz.reason})` : ''}`).join('\n') || '- Aucune'}

## WIFI COVERAGE
${wifiZones.map(wz => `- ${wz.zone}: ${WIFI_LABELS[wz.strength]}`).join('\n') || '- Non documenté'}

## STEP_TABLE${narratorSummary}
${stepTableHeader}
${stepTableSeparator}
${stepTable}

## MAP REFERENCE
${project.map_url ? `Carte: ${project.map_url}` : 'Aucune carte'}

## QUEST_EXPORT_JSON
\`\`\`json
${JSON.stringify(questExport, null, 2)}
\`\`\`
`;
}
