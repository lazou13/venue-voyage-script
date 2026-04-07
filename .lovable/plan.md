

# Plan : Filtrage géographique automatique (bounding box Marrakech)

## Constat

La base contient des POIs de Fès (Dar Batha, Foundouk Nejjarine, etc.) qui passent toutes les validations car :
- `clean_low_quality_pois()` ne vérifie que le nombre d'avis et la note — pas les coordonnées GPS
- `poi-auto-agent` Phase 0 vérifie que lat/lng ne sont pas null, mais jamais qu'ils sont dans Marrakech
- Le watchdog détecte les doublons GPS mais pas les POIs hors zone

Les coordonnées de la Médina de Marrakech : lat [31.60, 31.67], lng [-8.02, -7.97] (déjà utilisées dans `poi-classify-worker` et `poi-worker`).

## Corrections

### 1. Ajouter le filtre bounding box à l'auto-validation (`poi-auto-agent`)

Dans Phase 0, ajouter `.gte("lat", 31.60).lte("lat", 31.67).gte("lng", -8.02).lte("lng", -7.97)` pour ne valider que les POIs géolocalisés dans la Médina.

### 2. Marquer automatiquement les POIs hors zone comme "filtered"

Ajouter une Phase -1 dans `poi-auto-agent` (avant Phase 0) qui :
- Sélectionne tous les POIs actifs avec GPS hors bounding box
- Les passe en `status = 'filtered'` avec `is_active = false`
- Log le nombre de POIs filtrés

### 3. Ajouter un check bounding box dans le watchdog

Dans `poi-watchdog`, ajouter une alerte "out_of_bounds" pour les POIs actifs dont les coordonnées sont hors Marrakech.

### 4. Bouton supprimer dans EnrichmentDrilldown

Ajouter un bouton poubelle (icône `Trash2`) dans chaque ligne du tableau pour suppression manuelle avec confirmation, comme demandé précédemment.

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `supabase/functions/poi-auto-agent/index.ts` | Phase -1 filtrage hors zone + bounding box sur Phase 0 |
| `supabase/functions/poi-watchdog/index.ts` | Alerte "out_of_bounds" |
| `src/components/admin/EnrichmentDrilldown.tsx` | Bouton supprimer avec confirmation |

