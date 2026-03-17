

# Plan : Ajouter des lignes intermédiaires + aligner les dropdowns TYPE/ACTION sur les types canoniques

## Problème

1. Le rapport interactif ne permet pas d'**insérer des lignes entre les POIs** (pour des transitions, pauses, etc.)
2. Les dropdowns **TYPE** (`functionType`) et **ACTION** utilisent des valeurs legacy (Passage, Pause thé, Briefing, etc.) au lieu des 14 types d'étapes canoniques du moteur de quêtes (Narration, QCM, Énigme, Code secret, etc.)

## Modifications dans `src/lib/interactiveReportGenerator.ts`

### 1. Remplacer le dropdown TYPE (lignes 1246-1257)
Remplacer les 10 options legacy par les 14 `STEP_TYPE_LABELS` canoniques :
- story → Narration, information → Information, mcq → QCM, enigme → Énigme, code → Code secret, hangman → Pendu, memory → Memory, photo → Photo, terrain → Terrain, defi → Défi, transition → Transition, qr_code → QR Code, info_qr → Info QR, countdown → Compte à rebours

### 2. Remplacer le dropdown ACTION (lignes 1260-1268)
Utiliser les mêmes 14 types d'étapes (+ option vide "—") pour l'ACTION, car c'est la même taxonomie demandée.

### 3. Mettre à jour le type TypeScript `ReportPOI` (lignes 25-26)
- `functionType` : accepter les valeurs `StepType` au lieu de la liste legacy
- `action` : accepter les valeurs `StepType | ''`

### 4. Ajouter un bouton "+" entre chaque ligne du tableau (lignes 1239-1312)
- Insérer un `<tr>` cliquable entre chaque POI avec un bouton "+" discret
- Au clic, créer une nouvelle ligne (POI virtuel) avec `functionType: 'transition'` par défaut, sans coordonnées GPS
- Ajouter la logique JS dans le bloc `<script>` (après ligne 1420) : fonction `insertRowAfter(poiId)` qui :
  - Crée un nouvel objet POI dans `STATE.pois` à la bonne position
  - Re-numérote les `order`
  - Re-render le tableau
  - Sauvegarde dans localStorage

### 5. Mettre à jour le STATE JS (lignes 1391-1406)
Adapter les valeurs par défaut pour refléter les nouveaux types canoniques.

### Fichier impacté
- `src/lib/interactiveReportGenerator.ts`

