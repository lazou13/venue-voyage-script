
## Plan : Ajouter la couverture d'enrichissement EN au dashboard

### Ce qui manque

Le dashboard affiche uniquement les métriques FR (Anecdotes FR, Fun Facts FR). Il faut ajouter les équivalents anglais, cliquables avec le même drill-down.

### Modifications

#### 1. `src/pages/admin/AdminDashboard.tsx`

- **Type `DbField`** : étendre avec `'local_anecdote_en' | 'fun_fact_en'`
- **`fetchStats()`** : ajouter `local_anecdote_en` et `fun_fact_en` dans le `select`, calculer `withAnecdoteEn` et `withFunFactEn`
- **Interface `Stats`** : ajouter `withAnecdoteEn`, `withFunFactEn`
- **`enrichmentCoverage`** : ajouter 2 entrées :
  - `{ label: 'Anecdotes EN', value: stats.withAnecdoteEn, total: stats.total, field: 'local_anecdote_en' }`
  - `{ label: 'Fun Facts EN', value: stats.withFunFactEn, total: stats.total, field: 'fun_fact_en' }`
- Passer la grille de `grid-cols-6` à `grid-cols-4 md:grid-cols-8` pour accueillir 8 métriques

#### 2. `src/components/admin/EnrichmentDrilldown.tsx`

- **Type `DbField`** : étendre avec `'local_anecdote_en' | 'fun_fact_en'`
- Le reste fonctionne déjà de manière générique (le champ est passé en prop)

### Résultat

8 métriques cliquables : Histoires, Anecdotes FR, Anecdotes EN, Fun Facts FR, Fun Facts EN, Énigmes, Wikipedia, Photos — toutes avec drill-down interactif.
