

# Plan : Remplacer le dropdown "Interaction" par les types d'étapes complets

## Problème

Le dropdown "Interaction" dans l'éditeur de POI utilise `INTERACTION_LABELS` (8 options legacy : Puzzle, QR Scan, Photo, Objet caché, NPC, Audio, Storytelling, Vidéo). Or, le système de quêtes utilise `STEP_TYPE_LABELS` avec 14 types (Narration, Information, QCM, Énigme, Code secret, Pendu, Memory, Photo, Terrain, Défi, Transition, QR Code, Info QR, Compte à rebours). L'utilisateur veut la même liste que dans le builder d'étapes.

## Modifications dans `src/components/intake/FieldworkStep.tsx`

1. **Dropdown "Interaction"** (lignes 425-440) : remplacer `INTERACTION_LABELS` / `InteractionType` par `STEP_TYPE_LABELS` / `StepType`. Le champ `poi.interaction` sera mappé vers `poi.step_config.possible_step_types[0]` ou un nouveau champ `step_config.final_step_type`.

2. **Badge résumé** (ligne 553) : remplacer `INTERACTION_LABELS[poi.interaction]` par le label du step type sélectionné.

3. **Approche recommandée** : plutôt que de changer le champ DB `interaction`, le dropdown met à jour `step_config.final_step_type` et affiche `STEP_TYPE_LABELS`. Le champ legacy `interaction` reste pour la compatibilité mais le dropdown montre les vrais types d'étapes.

## Fichier impacté
- `src/components/intake/FieldworkStep.tsx`

