

# Backfill ciblé des nouveaux champs POI

## Problème
438 POIs sont déjà en statut `enriched` mais ont `price_info`, `must_try`, `must_see_details`, etc. tous à NULL. Le pipeline les ignore car ils ne sont plus `raw`.

## Solution

### 1. Nouvelle edge function `poi-backfill-details`
- Requête les POIs où `enrichment_status = 'enriched'` ET `price_info IS NULL`
- Appel IA (Gemini 2.5 Flash) avec un prompt ciblé demandant UNIQUEMENT les champs pratiques : `price_info`, `opening_hours`, `must_see_details`, `must_try`, `must_visit_nearby`, `is_photo_spot`, `photo_tip`, `ruelle_etroite`
- PATCH direct via REST API (même pattern que `poi-enrich`)
- Batch de 10, délai 1.5s entre appels
- Ne touche PAS aux champs existants (`history_context`, `riddle_*`, etc.)

### 2. Bouton dans le dashboard pipeline
Ajouter un bouton "Backfill détails" dans `AdminPOIPipeline.tsx` qui appelle cette nouvelle function.

### 3. Compteur dans les stats
Ajouter le compteur `with_price_info` dans les progress bars pour suivre l'avancement.

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `supabase/functions/poi-backfill-details/index.ts` | Nouvelle edge function |
| `src/pages/admin/AdminPOIPipeline.tsx` | Bouton + compteur backfill |

