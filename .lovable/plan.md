

# Plan : LLM intelligent + mise à jour automatique de la fiche

## Problèmes identifiés

1. **Le bouton "Réanalyser la fiche"** est conditionné à `{analysis && ...}` (ligne 508) → invisible sans analyse initiale
2. **Le chat ne met jamais à jour la fiche** : quand l'utilisateur dit "mets à jour", l'IA répond en texte libre mais la note ne change pas
3. **Modèle trop léger** : le chat utilise `gemini-2.5-flash` en premier → upgrader à `gemini-2.5-pro` pour des réponses plus intelligentes et complètes
4. **Dar Bellarj absent** du prompt encyclopédique → l'IA invente "caravansérail" au lieu de "ancien hôpital pour cigognes"

## Corrections

### 1. `MarkerDetailSheet.tsx`

- **Bouton "🔄 Réanalyser la fiche"** : retirer la condition `analysis &&` (ligne 508) → toujours visible
- **Nouveau bouton prominent "📝 Mettre à jour la fiche"** : un vrai bouton (pas un chip) placé après les quick actions, qui déclenche `handleAnalyze()` avec tout le chat_history
- **Auto-détection** : après chaque réponse IA en mode chat, si le message utilisateur contient "mets à jour", "met a jour", "actualise", "corrige la fiche", "update" → afficher un message assistant avec un bouton inline "Appliquer ces corrections à la fiche" qui déclenche `handleAnalyze()`

### 2. `analyze-marker/index.ts`

- **Modèle chat upgradé** : `gemini-2.5-pro` en premier (au lieu de flash), fallback sur flash puis gpt-5-mini
- **Ajouter Dar Bellarj** au system prompt (section Monuments) :
  - `Fondation Dar Bellarj (~31.632°N, 7.986°W) : "Maison des Cigognes". Ancien hôpital pour cigognes fondé au XVIIe siècle dans un fondouk. Restauré en 1999 par Suzanne Biedermann comme centre culturel et artistique. Les cigognes nichent encore sur le toit. Site : darbellarj.com`
- **Instruction chat améliorée** : ajouter "Quand l'utilisateur te demande de mettre à jour ou corriger la fiche, rappelle-lui de cliquer sur 'Mettre à jour la fiche' pour appliquer les corrections au contenu du marqueur."

## Fichiers impactés
- `src/components/intake/MarkerDetailSheet.tsx`
- `supabase/functions/analyze-marker/index.ts`

