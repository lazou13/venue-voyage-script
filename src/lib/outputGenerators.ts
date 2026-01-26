import type { Project, POI, WifiZone, ForbiddenZone, TeamConfig } from '@/types/intake';
import { 
  STEP_TYPE_LABELS, 
  VALIDATION_MODE_LABELS, 
  WIFI_LABELS, 
  QUEST_TYPE_LABELS,
  TARGET_AUDIENCE_LABELS,
  COMPETITION_MODE_LABELS,
  LANGUAGE_LABELS
} from '@/types/intake';

interface OutputData {
  project: Project;
  pois: POI[];
  wifiZones: WifiZone[];
  forbiddenZones: ForbiddenZone[];
}

// Helper to safely access teamConfig
function getTeamConfig(questConfig: Project['quest_config']): TeamConfig {
  return questConfig?.teamConfig || { enabled: false };
}

export function generateChecklist(data: OutputData): string {
  const { project, pois, wifiZones, forbiddenZones } = data;
  const questConfig = project.quest_config || {};
  
  // Determine validation requirements from steps
  const validationModes = new Set(pois.map(p => p.step_config?.validationMode).filter(Boolean));
  const hasQrValidation = validationModes.has('qr_code');
  const hasGpsValidation = validationModes.has('auto_gps');
  const hasPhotoValidation = validationModes.has('photo');
  
  return `# FIELDWORK CHECKLIST
## ${project.hotel_name} - ${project.city}
Date de visite: ${project.visit_date ? new Date(project.visit_date).toLocaleDateString('fr-FR') : 'Non définie'}
Quest Type: ${questConfig.questType ? QUEST_TYPE_LABELS[questConfig.questType] : 'Non défini'}

---

## 📱 ÉQUIPEMENT REQUIS

${hasQrValidation ? '- [ ] Scanner QR Code testé' : ''}
${hasGpsValidation ? '- [ ] GPS activé et fonctionnel' : ''}
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
  return `### ${i + 1}. ${poi.name}
- Zone: ${poi.zone}
- Type: ${config.stepType ? STEP_TYPE_LABELS[config.stepType] : 'Non défini'}
- Validation: ${config.validationMode ? VALIDATION_MODE_LABELS[config.validationMode] : 'Manuelle'}
${config.validationMode === 'auto_gps' ? `- GPS: ${config.gps?.lat || '?'}, ${config.gps?.lng || '?'} (rayon ${config.gps?.radius || '?'}m)` : ''}
${config.validationMode === 'qr_code' ? '- [ ] QR Code installé et testé' : ''}
${config.validationMode === 'photo' && config.photoValidation?.type === 'reference' ? '- [ ] Photo de référence prise' : ''}
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
  
  return `# PRD - Quest Configuration
## ${project.hotel_name}

---

## 1. OVERVIEW

| Paramètre | Valeur |
|-----------|--------|
| Hôtel | ${project.hotel_name} |
| Ville | ${project.city} |
| Étages | ${project.floors} |
| Date visite | ${project.visit_date ? new Date(project.visit_date).toLocaleDateString('fr-FR') : 'TBD'} |

---

## 2. QUEST CONFIGURATION

### 2.1 Type & Audience
- **Type de quête**: ${questConfig.questType ? QUEST_TYPE_LABELS[questConfig.questType] : 'Non défini'}
- **Public cible**: ${questConfig.targetAudience ? TARGET_AUDIENCE_LABELS[questConfig.targetAudience] : 'Non défini'}
- **Langues**: ${(questConfig.languages || ['fr']).map(l => LANGUAGE_LABELS[l]).join(', ')}

### 2.2 Titre & Histoire
- **Titre (FR)**: ${project.title_i18n?.fr || 'Non défini'}
- **Histoire (FR)**: ${project.story_i18n?.fr || 'Non définie'}

### 2.3 Team Configuration
${teamConfig.enabled ? `
- **Mode équipe**: Activé
- **Mode compétition**: ${teamConfig.competitionMode ? COMPETITION_MODE_LABELS[teamConfig.competitionMode] : 'N/A'}
- **Max équipes**: ${teamConfig.maxTeams || 'N/A'}
- **Joueurs/équipe**: ${teamConfig.maxPlayersPerTeam || 'N/A'}
${teamConfig.competitionMode === 'timed' ? `- **Temps limite**: ${teamConfig.timeLimitMinutes || 'N/A'} min` : ''}
` : '- **Mode équipe**: Désactivé'}

---

## 3. STEPS ANALYSIS

### 3.1 Summary
- **Total étapes**: ${pois.length}

### 3.2 Types d'étapes
${Object.entries(stepTypeCounts).map(([type, count]) => 
  `- ${type in STEP_TYPE_LABELS ? STEP_TYPE_LABELS[type as keyof typeof STEP_TYPE_LABELS] : type}: ${count}`
).join('\n')}

### 3.3 Modes de validation
${Object.entries(validationCounts).map(([mode, count]) => 
  `- ${mode in VALIDATION_MODE_LABELS ? VALIDATION_MODE_LABELS[mode as keyof typeof VALIDATION_MODE_LABELS] : mode}: ${count}`
).join('\n')}

---

## 4. SCORING & RULES

### 4.1 Scoring par défaut
- **Points/étape**: ${scoring.points || 10}
- **Pénalité indice**: ${scoring.hint_penalty || 2}
- **Pénalité échec**: ${scoring.fail_penalty || 5}
- **Temps limite**: ${scoring.time_limit_sec ? `${scoring.time_limit_sec}s` : 'Illimité'}
- **Bonus temps**: ${scoring.time_bonus || 0}

### 4.2 Indices
- **Max indices**: ${questConfig.hintRules?.maxHints || 3}
- **Auto-révélation**: ${questConfig.hintRules?.autoRevealAfterSec ? `${questConfig.hintRules.autoRevealAfterSec}s` : 'Désactivé'}

### 4.3 Branchement
- **Succès**: ${questConfig.branchingPresets?.onSuccess || 'next'}
- **Échec**: ${questConfig.branchingPresets?.onFailure || 'retry'}

---

## 5. CONSTRAINTS

### 5.1 Opérationnelles
- Staff disponible: ${project.staff_available ? '✅ Oui' : '❌ Non'}
- Temps de reset: ${project.reset_time_mins || 'N/A'} min
- Props autorisés: ${project.props_allowed ? '✅ Oui' : '❌ Non'}

### 5.2 Zones Interdites
${forbiddenZones.map((fz) => `- ${fz.zone}${fz.reason ? `: ${fz.reason}` : ''}`).join('\n') || '- Aucune restriction définie'}

### 5.3 Connectivité
${wifiZones.filter(wz => wz.strength !== 'ok').map((wz) => `- ⚠️ ${wz.zone}: ${WIFI_LABELS[wz.strength]}`).join('\n') || '- Toutes zones OK'}

---

## 6. ASSETS

- Carte: ${project.map_url ? '✅ Uploadée' : '❌ Manquante'}
- Photos étapes: ${pois.filter(p => p.photo_url).length}/${pois.length}
`;
}

// Helper to build validation summary
function getValidationSummary(config: POI['step_config']): string {
  if (!config) return '-';
  const parts: string[] = [];
  
  if (config.validationMode === 'auto_gps' && config.gps) {
    parts.push(`GPS(${config.gps.lat?.toFixed(4) || '?'},${config.gps.lng?.toFixed(4) || '?'},r${config.gps.radius || '?'}m)`);
  } else if (config.validationMode === 'qr_code') {
    parts.push(`QR:${config.photoValidation?.qrExpectedValue || '?'}`);
  } else if (config.validationMode === 'photo' && config.photoValidation) {
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

/**
 * Build the canonical quest export object (used for JSON export)
 */
export function buildQuestExport(data: OutputData) {
  const { project, pois, wifiZones, forbiddenZones } = data;
  const questConfig = project.quest_config || {};
  const teamConfig = getTeamConfig(project.quest_config);

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
      scoring: questConfig.scoring || {},
      hintRules: questConfig.hintRules || {},
      branching: questConfig.branchingPresets || {},
    },
    steps: pois.map((poi, i) => ({
      order: i + 1,
      name: poi.name,
      zone: poi.zone,
      ...poi.step_config,
    })),
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
 * Generate the QUEST_EXPORT_JSON as a formatted string
 */
export function generateQuestExportJSON(data: OutputData): string {
  return JSON.stringify(buildQuestExport(data), null, 2);
}

export function generatePrompt(data: OutputData): string {
  const { project, pois, wifiZones, forbiddenZones } = data;
  const questConfig = project.quest_config || {};
  const teamConfig = getTeamConfig(project.quest_config);
  const defaultScoring = questConfig.scoring || {};

  // Build enhanced STEP_TABLE with all required columns
  const stepTableHeader = '| # | Nom | Zone | Type | Validation | GPS/QR/Photo | Scoring | Hints | Branching | FR Content |';
  const stepTableSeparator = '|---|-----|------|------|------------|--------------|---------|-------|-----------|------------|';
  const stepTable = pois.map((poi, i) => {
    const config = poi.step_config || {};
    const orderIndex = poi.sort_order ?? i;
    const stepType = config.stepType ? STEP_TYPE_LABELS[config.stepType] : 'enigme';
    const validationMode = config.validationMode ? VALIDATION_MODE_LABELS[config.validationMode] : 'Manuel';
    const validationSummary = getValidationSummary(config);
    const scoringSummary = getScoringSummary(config, defaultScoring);
    const hintsCount = config.hints?.length || 0;
    const branchingSummary = getBranchingSummary(config);
    const frExcerpt = config.contentI18n?.fr?.substring(0, 40) || '-';
    
    return `| ${orderIndex + 1} | ${poi.name} | ${poi.zone} | ${stepType} | ${validationMode} | ${validationSummary} | ${scoringSummary} | ${hintsCount} | ${branchingSummary} | ${frExcerpt}${config.contentI18n?.fr && config.contentI18n.fr.length > 40 ? '…' : ''} |`;
  }).join('\n');

  // Use the shared buildQuestExport function
  const questExport = buildQuestExport(data);

  return `# PERFECT PRODUCTION PROMPT

## CONTEXT
Tu es un game designer spécialisé dans les treasure hunts immersifs pour hôtels de luxe.
Tu dois créer une expérience complète pour l'hôtel suivant.

## HOTEL PROFILE
- **Nom**: ${project.hotel_name}
- **Ville**: ${project.city}
- **Étages**: ${project.floors}
- **Titre**: ${project.title_i18n?.fr || 'À définir'}
- **Histoire**: ${project.story_i18n?.fr || 'À définir'}

## QUEST CONFIGURATION
- **Type**: ${questConfig.questType ? QUEST_TYPE_LABELS[questConfig.questType] : 'sequential'}
- **Public**: ${questConfig.targetAudience ? TARGET_AUDIENCE_LABELS[questConfig.targetAudience] : 'family'}
- **Langues**: ${(questConfig.languages || ['fr']).map(l => LANGUAGE_LABELS[l]).join(', ')}
${teamConfig.enabled ? `
### TEAM MODE
- Competition: ${teamConfig.competitionMode ? COMPETITION_MODE_LABELS[teamConfig.competitionMode] : 'race'}
- Max teams: ${teamConfig.maxTeams}
- Players/team: ${teamConfig.maxPlayersPerTeam}
${teamConfig.timeLimitMinutes ? `- Time limit: ${teamConfig.timeLimitMinutes} min` : ''}
` : ''}

## SCORING DEFAULTS
- Points/step: ${questConfig.scoring?.points || 10}
- Hint penalty: ${questConfig.scoring?.hint_penalty || 2}
- Fail penalty: ${questConfig.scoring?.fail_penalty || 5}
- Time limit: ${questConfig.scoring?.time_limit_sec ? `${questConfig.scoring.time_limit_sec}s` : 'none'}
- Time bonus: ${questConfig.scoring?.time_bonus || 0}

## CONSTRAINTS
- **Staff disponible**: ${project.staff_available ? 'Oui (peut participer)' : 'Non (autonome)'}
- **Props autorisés**: ${project.props_allowed ? 'Oui' : 'Non (digital only)'}
- **Temps reset entre sessions**: ${project.reset_time_mins || 'N/A'} min

## ZONES INTERDITES
${forbiddenZones.map(fz => `- ${fz.zone}${fz.reason ? ` (${fz.reason})` : ''}`).join('\n') || '- Aucune'}

## WIFI COVERAGE
${wifiZones.map(wz => `- ${wz.zone}: ${WIFI_LABELS[wz.strength]}`).join('\n') || '- Non documenté'}

## STEP_TABLE
${stepTableHeader}
${stepTableSeparator}
${stepTable}

## MAP REFERENCE
${project.map_url ? `Carte disponible: ${project.map_url}` : 'Aucune carte fournie'}

## QUEST_EXPORT_JSON
\`\`\`json
${JSON.stringify(questExport, null, 2)}
\`\`\`

## DELIVERABLES ATTENDUS
1. **Scénario narratif** (histoire, personnages, intrigue)
2. **Parcours détaillé** (ordre des étapes, transitions)
3. **Énigmes par étape** (description, solution, indices)
4. **Script NPC** (si applicable)
5. **Liste matériel** (props, QR codes, éléments à imprimer)
6. **Guide reset** (instructions pour préparer la prochaine session)
7. **Fichier i18n** (traductions pour toutes les langues configurées)

## FORMAT DE SORTIE
Structure ta réponse en sections claires avec:
- Titres markdown
- Tableaux pour les énigmes
- Checklist pour le matériel
- Timeline visuelle du parcours
- JSON exportable pour l'application
`;
}
