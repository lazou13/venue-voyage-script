

## Plan : Ajouter les colonnes EN pour les champs "Guided Tour"

### Problème
9 champs enrichis pour les visites guidées n'ont pas de version anglaise dans `medina_pois`. Les tours EN affichent donc du contenu français ou rien pour ces sections.

### Colonnes à ajouter

| Champ FR existant | Colonne EN à créer |
|---|---|
| `must_see_details` | `must_see_details_en` |
| `must_try` | `must_try_en` |
| `must_visit_nearby` | `must_visit_nearby_en` |
| `photo_tip` | `photo_tip_en` |
| `tourist_tips` | `tourist_tips_en` |
| `price_info` | `price_info_en` |
| `accessibility_notes` | `accessibility_notes_en` |
| `best_time_visit` | `best_time_visit_en` |
| `street_food_details` | `street_food_details_en` |

### Étapes

1. **Migration SQL** — `ALTER TABLE medina_pois ADD COLUMN ... text DEFAULT NULL` pour les 9 colonnes
2. **Pipeline de traduction** — Mettre à jour l'Edge Function `translate` (ou `poi-auto-agent` phase traduction) pour inclure ces 9 champs dans le batch FR→EN
3. **Sync API** — Ajouter ces champs au mapping de `api-v2/sync-route` pour que QUEST RIDES PRO reçoive le contenu EN
4. **UI QuestResult / Player** — Dans `QuestResult.tsx` (GuidedContent), utiliser les champs `_en` quand la langue est EN

### Détails techniques

- La migration est simple (9 `ADD COLUMN`, toutes nullable text)
- Le pipeline `translate` utilise déjà un pattern de batch avec Gemini Flash — il suffit d'ajouter les clés au tableau de champs à traduire
- Environ 800-900 POIs ont du contenu dans ces champs FR → le pipeline devra les traiter en lots de 20

### Impact
Les tours EN afficheront du vrai contenu traduit pour "À voir", "À tester", "À visiter à proximité", "Spot photo", "Conseils", etc.

