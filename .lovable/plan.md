

## Plan : Remonter les audio Questride → HPP, puis exposer via sync

### Diagnostic
- `medina_pois` dans HPP n'a **aucune colonne audio** (`audio_url_fr`, `audio_url_en`, `audio_url_ar`, `anecdote_audio_url_fr`, `anecdote_audio_url_en`)
- Les audios sont physiquement stockés dans Questride (`brhckhyrbpjfnieexggq`, bucket `guides-audio`)
- HPP expose les données via `api-v2?route=sync` et `sync-pois-export` — aucun ne contient d'audio
- Le sync pousse HPP → Questride/PRO via `n8n-proxy` action `sync_projects`, mais n'a jamais eu d'audio à pousser

### Étapes

**1. Migration SQL — Ajouter 5 colonnes audio à `medina_pois`**

```sql
ALTER TABLE public.medina_pois
  ADD COLUMN IF NOT EXISTS audio_url_fr text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS audio_url_en text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS audio_url_ar text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS anecdote_audio_url_fr text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS anecdote_audio_url_en text DEFAULT NULL;
```

**2. Edge Function — Créer `pull-audio-from-questride`**

Nouvelle Edge Function qui :
- Fait un fetch REST vers Questride (`brhckhyrbpjfnieexggq`) pour récupérer les POIs ayant des audio (`audio_url_fr`, `audio_url_en`, etc.)
- Matche par `name_fr` / `name_en` (fuzzy) ou coordonnées GPS (50m) avec les POIs HPP
- Met à jour les colonnes `audio_url_*` dans HPP `medina_pois`
- Retourne un rapport (matched, updated, skipped)

Clé anon Questride nécessaire — elle est déjà connue du projet (utilisée dans `externalSupabase.ts` pour le projet `xaccaoedtbwywjotqhih`). Il faudra la clé anon de `brhckhyrbpjfnieexggq` spécifiquement.

**3. Exposer les audio dans les routes sync**

- **`api-v2/index.ts`** : Ajouter `audio_url_fr, audio_url_en, audio_url_ar, anecdote_audio_url_fr, anecdote_audio_url_en` à `SYNC_COLS` et `POI_DETAIL_COLS`
- **`sync-pois-export/index.ts`** : Ajouter les 5 champs audio au tableau `fields`

**4. Ajouter l'action au pipeline admin**

Ajouter `pull_audio` comme action dans `n8n-proxy` pour pouvoir le déclencher depuis le Pipeline POI admin.

### Prérequis
- La **clé anon de Questride** (`brhckhyrbpjfnieexggq`) — à fournir pour que l'Edge Function puisse lire les POIs Questride
- Confirmation que Questride a bien les colonnes `audio_url_fr`, `audio_url_en`, etc. dans sa table `medina_pois`

### Résultat
- HPP devient la source de vérité y compris pour les audio
- Les projets consommateurs (TTT, PRO) récupèrent les audio via le sync standard
- Le flux est : Questride → HPP (pull) → TTT/PRO (push via sync)

