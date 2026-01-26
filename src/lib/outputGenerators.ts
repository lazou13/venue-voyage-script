import type { Project, POI, WifiZone, ForbiddenZone } from '@/types/intake';
import { INTERACTION_LABELS, RISK_LABELS, WIFI_LABELS, DIFFICULTY_LABELS } from '@/types/intake';

interface OutputData {
  project: Project;
  pois: POI[];
  wifiZones: WifiZone[];
  forbiddenZones: ForbiddenZone[];
}

export function generateChecklist(data: OutputData): string {
  const { project, pois, wifiZones, forbiddenZones } = data;
  
  return `# FIELDWORK CHECKLIST
## ${project.hotel_name} - ${project.city}
Date de visite: ${project.visit_date ? new Date(project.visit_date).toLocaleDateString('fr-FR') : 'Non définie'}

---

## 📷 PHOTOS REQUISES

### Photos générales
- [ ] Entrée principale
- [ ] Réception
- [ ] Couloirs principaux
- [ ] Patio/Jardin
- [ ] Rooftop (si accessible)
- [ ] Restaurant/Bar

### Photos POIs (${pois.length} points)
${pois.map((poi, i) => `- [ ] POI ${i + 1}: ${poi.name} (${poi.zone})`).join('\n')}

---

## 📍 POIs À VALIDER SUR SITE

${pois.map((poi, i) => `### ${i + 1}. ${poi.name}
- Zone: ${poi.zone}
- Type: ${INTERACTION_LABELS[poi.interaction]}
- Risque: ${RISK_LABELS[poi.risk]}
- [ ] Photo prise
- [ ] Accessibilité confirmée
- [ ] Interaction testée
`).join('\n')}

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
- [ ] ${pois.length} POIs documentés
- [ ] ${forbiddenZones.length} zones interdites confirmées
- [ ] Tests Wi-Fi effectués
- [ ] Contraintes ops validées avec staff
`;
}

export function generatePRD(data: OutputData): string {
  const { project, pois, wifiZones, forbiddenZones } = data;
  const totalDuration = pois.reduce((sum, poi) => sum + (poi.minutes_from_prev || 0), 0);
  
  return `# PRD - Treasure Hunt
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

## 2. REQUIREMENTS

### 2.1 Durée & Difficulté
- **Durée cible**: ${project.target_duration_mins || 60} minutes
- **Durée estimée (POIs)**: ${totalDuration} minutes
- **Difficulté**: ${project.difficulty ? DIFFICULTY_LABELS[project.difficulty] : 'Non définie'}
- **Thème**: ${project.theme || 'Non défini'}

### 2.2 Points d'Intérêt
- **Total**: ${pois.length} POIs
- **Types d'interaction**:
${Object.entries(
  pois.reduce((acc, poi) => {
    acc[poi.interaction] = (acc[poi.interaction] || 0) + 1;
    return acc;
  }, {} as Record<string, number>)
).map(([type, count]) => `  - ${INTERACTION_LABELS[type as keyof typeof INTERACTION_LABELS]}: ${count}`).join('\n')}

### 2.3 Zones
- **Zones Wi-Fi couvertes**: ${wifiZones.length}
- **Zones interdites**: ${forbiddenZones.length}

---

## 3. CONSTRAINTS

### 3.1 Opérationnelles
- Staff disponible: ${project.staff_available ? '✅ Oui' : '❌ Non'}
- Temps de reset: ${project.reset_time_mins || 'N/A'} min
- Props autorisés: ${project.props_allowed ? '✅ Oui' : '❌ Non'}

### 3.2 Zones Interdites
${forbiddenZones.map((fz) => `- ${fz.zone}${fz.reason ? `: ${fz.reason}` : ''}`).join('\n') || '- Aucune restriction définie'}

### 3.3 Connectivité
${wifiZones.filter(wz => wz.strength !== 'ok').map((wz) => `- ⚠️ ${wz.zone}: ${WIFI_LABELS[wz.strength]}`).join('\n') || '- Toutes zones OK'}

---

## 4. ASSETS

- Carte: ${project.map_url ? '✅ Uploadée' : '❌ Manquante'}
- Photos POIs: ${pois.filter(p => p.photo_url).length}/${pois.length}

---

## 5. RISKS

${pois.filter(p => p.risk === 'high').length > 0 ? `### POIs à risque élevé
${pois.filter(p => p.risk === 'high').map(p => `- ${p.name} (${p.zone})`).join('\n')}` : '- Aucun POI à risque élevé identifié'}

${wifiZones.filter(wz => wz.strength === 'dead').length > 0 ? `### Zones sans Wi-Fi
${wifiZones.filter(wz => wz.strength === 'dead').map(wz => `- ${wz.zone}`).join('\n')}` : ''}
`;
}

export function generatePrompt(data: OutputData): string {
  const { project, pois, wifiZones, forbiddenZones } = data;
  
  const poiTable = pois.map((poi, i) => 
    `| ${i + 1} | ${poi.name} | ${poi.zone} | ${INTERACTION_LABELS[poi.interaction]} | ${RISK_LABELS[poi.risk]} | ${poi.minutes_from_prev} | ${poi.notes || '-'} |`
  ).join('\n');

  return `# PERFECT PRODUCTION PROMPT

## CONTEXT
Tu es un game designer spécialisé dans les treasure hunts immersifs pour hôtels de luxe.
Tu dois créer une expérience complète pour l'hôtel suivant.

## HOTEL PROFILE
- **Nom**: ${project.hotel_name}
- **Ville**: ${project.city}
- **Étages**: ${project.floors}
- **Thème souhaité**: ${project.theme || 'À définir selon l\'identité de l\'hôtel'}

## CONSTRAINTS
- **Durée cible**: ${project.target_duration_mins || 60} minutes
- **Difficulté**: ${project.difficulty ? DIFFICULTY_LABELS[project.difficulty] : 'Moyenne'}
- **Staff disponible**: ${project.staff_available ? 'Oui (peut participer)' : 'Non (autonome)'}
- **Props autorisés**: ${project.props_allowed ? 'Oui' : 'Non (digital only)'}
- **Temps reset entre sessions**: ${project.reset_time_mins || 'N/A'} min

## ZONES INTERDITES
${forbiddenZones.map(fz => `- ${fz.zone}${fz.reason ? ` (${fz.reason})` : ''}`).join('\n') || '- Aucune'}

## WIFI COVERAGE
${wifiZones.map(wz => `- ${wz.zone}: ${WIFI_LABELS[wz.strength]}`).join('\n') || '- Non documenté'}

## POI_TABLE
| # | Nom | Zone | Interaction | Risque | Min depuis précédent | Notes |
|---|-----|------|-------------|--------|---------------------|-------|
${poiTable}

## MAP REFERENCE
${project.map_url ? `Carte disponible: ${project.map_url}` : 'Aucune carte fournie'}

## DELIVERABLES ATTENDUS
1. **Scénario narratif** (histoire, personnages, intrigue)
2. **Parcours détaillé** (ordre des POIs, transitions)
3. **Énigmes par POI** (description, solution, indices)
4. **Script NPC** (si applicable)
5. **Liste matériel** (props, QR codes, éléments à imprimer)
6. **Guide reset** (instructions pour préparer la prochaine session)

## FORMAT DE SORTIE
Structure ta réponse en sections claires avec:
- Titres markdown
- Tableaux pour les énigmes
- Checklist pour le matériel
- Timeline visuelle du parcours
`;
}
