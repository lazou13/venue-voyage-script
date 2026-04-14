

## Plan: Ajouter une route `sync` a l'API v2 pour Quest Rides PRO

### Probleme

Quest Rides PRO veut importer les POIs enrichis depuis HPP. L'approche actuelle (appeler `?route=poi&id=X` pour chacun des ~1000 POIs) ferait ~1000 requetes individuelles — lent et fragile. De plus, le detail POI actuel ne renvoie pas tous les champs necessaires (riddles, crowd_level, accessibility_notes, photo_tip, is_photo_spot, must_try, must_see_details, must_visit_nearby, enrichment_status, poi_quality_score, name_fr).

### Solution

Ajouter une route `?route=sync` a `api-v2` qui renvoie en bulk tous les champs enrichis necessaires, pagines par 200.

### Ce qui change dans `api-v2/index.ts`

1. **Nouvelle route `sync`** — renvoie les POIs actifs avec TOUS les champs d'enrichissement, pagines (limit max 200, offset)
2. **Champs retournes** : id, name, name_fr, name_en, name_ar, lat, lng, zone, category, history_context, description_short, local_anecdote, local_anecdote_fr, local_anecdote_en, fun_fact_fr, fun_fact_en, riddle_easy, riddle_medium, riddle_hard, crowd_level, accessibility_notes, photo_tip, is_photo_spot, instagram_spot, must_try, must_see_details, must_visit_nearby, poi_quality_score, enrichment_status
3. **Filtre optionnel** : `?enriched_only=true` pour ne renvoyer que les POIs ayant au moins un champ enrichi (local_anecdote_fr, history_context, ou fun_fact_fr non null)

```text
GET ?route=sync&limit=200&offset=0&enriched_only=true
→ { pois: [...], total, limit, offset, has_more }
```

### Fichier modifie

- `supabase/functions/api-v2/index.ts` — ajout de `handleSyncPois()` + route `sync`

### Ce que PRO doit faire de son cote

PRO appellera `?route=sync&limit=200&offset=0&enriched_only=true` en boucle, match par nom+GPS, et update sa table locale. Pas besoin de faire 1000 appels individuels.

### Resultat attendu

- PRO peut importer en ~5 requetes au lieu de ~1000
- Tous les champs enrichis sont exposes
- L'API key + rate limit existants protegent l'endpoint

