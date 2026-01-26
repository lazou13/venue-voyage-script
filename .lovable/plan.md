
# Plan : Traduction complète de l'interface en français

## Contexte
L'interface utilise actuellement un mélange d'anglais et de français. La documentation référence (QUEST_SCHEMA.json, QUEST_CREATION_GUIDE.md) définit la terminologie française officielle. L'utilisateur souhaite une interface 100% française.

---

## Éléments à traduire

### 1. Onglets de navigation (IntakeForm.tsx)

| ID | Actuel (anglais) | Traduction |
|----|------------------|------------|
| venue | Venue | **Lieu** |
| fieldwork | Fieldwork | **Terrain** |
| quest | Quest | **Quête** |
| steps | Steps | **Étapes** |
| rules | Rules | **Règles** |
| outputs | Outputs | **Exports** |

Le bouton header "Outputs" devient aussi "Exports".

### 2. Presets (questPresets.ts)

| Actuel | Français |
|--------|----------|
| Hotel Indoor QR | **QR Intérieur Hôtel** |
| Outdoor GPS | **GPS Extérieur** |
| Family Friendly | **Familles** |

### 3. Textes dans les composants

#### StepsBuilderStep.tsx
- "Configuration des Étapes" ✓ (déjà FR)
- "Fieldwork" dans message → "Terrain"

#### SelectiveApplyPanel.tsx  
- "Scoring" → **Points**
- Labels déjà en français ✓

#### FieldworkStep.tsx
- "Étapes / Points d'Intérêt" ✓ (déjà FR)
- Tous les textes sont déjà en français ✓

#### QuestConfigStep.tsx
- "Configuration Quest" → **Configuration de la quête**
- Autres textes déjà en français ✓

#### RulesStep.tsx
- "Scoring par défaut" → **Points par défaut**
- Textes déjà en français ✓

#### OutputsStep.tsx
- Textes déjà en français ✓

---

## Fichiers modifiés

### 1. src/pages/IntakeForm.tsx
**Lignes 15-22** : Labels des onglets STEPS
**Ligne 72** : Bouton "Outputs" → "Exports"

```text
STEPS = [
  { id: 'venue',     label: 'Lieu' },
  { id: 'fieldwork', label: 'Terrain' },
  { id: 'quest',     label: 'Quête' },
  { id: 'steps',     label: 'Étapes' },
  { id: 'rules',     label: 'Règles' },
  { id: 'outputs',   label: 'Exports' },
]
```

### 2. src/lib/questPresets.ts
**Lignes 22, 42, 72** : Propriété `name` des 3 presets

```text
hotelIndoorQR.name = "QR Intérieur Hôtel"
outdoorGPS.name = "GPS Extérieur"  
familyFriendly.name = "Familles"
```

### 3. src/components/intake/StepsBuilderStep.tsx
**Ligne 142** : "Fieldwork" → "Terrain"

```text
"Ajoutez des étapes dans l'onglet Terrain"
```

### 4. src/components/intake/SelectiveApplyPanel.tsx
**Ligne 101** : "Scoring" → "Points"

```text
Label: "Points" au lieu de "Scoring"
```

### 5. src/components/intake/QuestConfigStep.tsx
**Ligne 64** : "Configuration Quest" → "Configuration de la quête"

### 6. src/components/intake/RulesStep.tsx
**Ligne 49** : "Scoring par défaut" → "Points par défaut"

---

## Détails techniques

Aucun changement de logique métier. Seuls les labels UI sont modifiés.

Les valeurs internes (IDs, enums, clés JSON) restent en anglais/snake_case pour la compatibilité avec l'export QUEST_EXPORT_JSON.

---

## Vérification après implémentation

1. Ouvrir le formulaire intake sur un projet existant
2. Vérifier les 6 onglets : Lieu, Terrain, Quête, Étapes, Règles, Exports
3. Vérifier les 3 boutons presets : QR Intérieur Hôtel, GPS Extérieur, Familles
4. Dans Étapes sans POIs : vérifier "Ajoutez des étapes dans l'onglet Terrain"
5. Panel "Appliquer défauts" : vérifier label "Points" au lieu de "Scoring"
6. Onglet Quête : vérifier "Configuration de la quête"
7. Onglet Règles : vérifier "Points par défaut"
