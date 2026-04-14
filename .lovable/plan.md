

## Plan : Ligne complète de couverture d'enrichissement EN

### Objectif

Ajouter une deuxième ligne "English" sous la ligne "Français" dans la section "Couverture d'enrichissement", avec les mêmes 6 catégories cliquables.

### Colonnes manquantes dans la base

La table `medina_pois` possède déjà `local_anecdote_en`, `fun_fact_en` et `story_en`, mais il manque :

| Colonne à créer | Équivalent FR |
|---|---|
| `history_context_en` | `history_context` |
| `riddle_easy_en` | `riddle_easy` |
| `wikipedia_summary_en` | `wikipedia_summary` |

### Modifications

#### 1. Migration — 3 nouvelles colonnes

```sql
ALTER TABLE medina_pois ADD COLUMN history_context_en text;
ALTER TABLE medina_pois ADD COLUMN riddle_easy_en text;
ALTER TABLE medina_pois ADD COLUMN wikipedia_summary_en text;
```

#### 2. `src/pages/admin/AdminDashboard.tsx`

- **`DbField`** : ajouter `'history_context_en' | 'riddle_easy_en' | 'wikipedia_summary_en'`
- **`fetchStats()`** : ajouter les 3 champs dans le `select`, calculer `withHistoryEn`, `withRiddleEn`, `withWikipediaEn`
- **Interface `Stats`** : ajouter ces 3 compteurs + garder `withAnecdoteEn`, `withFunFactEn`
- **Séparer en 2 tableaux** :
  - `enrichmentCoverageFr` : Histoires, Anecdotes FR, Fun Facts FR, Énigmes, Wikipedia, Photos (6 items)
  - `enrichmentCoverageEn` : Histoires EN, Anecdotes EN, Fun Facts EN, Énigmes EN, Wikipedia EN, Photos (6 items — Photos pointe vers la même media-library)
- **JSX** : 2 grilles avec sous-titres "🇫🇷 Français" et "🇬🇧 English"

#### 3. `src/components/admin/EnrichmentDrilldown.tsx`

- **`DbField`** : ajouter `'history_context_en' | 'riddle_easy_en' | 'wikipedia_summary_en'`
- Le reste fonctionne déjà de manière générique

### Résultat

Deux lignes identiques dans la couverture d'enrichissement :
```text
🇫🇷 Français :  Histoires | Anecdotes FR | Fun Facts FR | Énigmes | Wikipedia | Photos
🇬🇧 English  :  Histoires EN | Anecdotes EN | Fun Facts EN | Énigmes EN | Wikipedia EN | Photos
```

Chaque métrique est cliquable avec drill-down pour voir/éditer les POIs manquants ou remplis.

