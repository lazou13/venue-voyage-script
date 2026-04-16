

# Plan : Synchronisation automatique HPP → QRP

## Diagnostic

QRP possède sa **propre copie** de la table `medina_pois` (alimentée initialement par `osm-extractor`). Cette copie n'est **jamais mise à jour** depuis HPP. Quand on fusionne Koutoubia, génère des audios, ou renomme un POI dans HPP, QRP ne le voit pas.

QRP a deux sources de données POI :
- `medina-library` → lit sa propre DB locale (données périmées)
- `hunt-planer-proxy` → appelle HPP `public-project-data?mode=library` (données fraîches mais pas utilisées pour les tours locaux)

## Solution

Créer une **Edge Function de sync** dans HPP qui expose un endpoint dédié, puis côté QRP, une Edge Function qui consomme cet endpoint et met à jour sa `medina_pois` locale.

### Étape 1 — Enrichir l'API sync de HPP (ce projet)

L'API v2 (`api-v2?route=sync`) existe déjà. Vérifier qu'elle expose bien :
- `audio_url_fr`, `audio_url_en`, `anecdote_audio_url_fr`, `anecdote_audio_url_en`
- `name`, `name_fr`, `name_en`, `category`, `is_active`, `status`
- `is_start_hub`, `hub_theme`

Si des champs audio manquent, les ajouter au SELECT de la route sync.

### Étape 2 — Créer une Edge Function `sync-from-hpp` dans QRP

Une Edge Function dans QRP qui :
1. Appelle HPP `public-project-data?mode=library` (ou `api-v2?route=sync`)
2. Pour chaque POI retourné, fait un `UPSERT` dans sa propre `medina_pois` sur la colonne `id` (même UUID)
3. Désactive les POIs locaux qui n'apparaissent plus côté HPP (`is_active = false`)
4. Log le résultat (nombre de POIs créés/mis à jour/désactivés)

### Étape 3 — Faire tourner manuellement ou en cron

Ajouter un bouton dans l'admin QRP ou un cron job pour déclencher la sync.

### Action immédiate (sans attendre la sync automatique)

En attendant l'implémentation complète dans QRP, on peut **corriger manuellement les 5 POIs** dans la DB de QRP via le `hunt-planer-proxy` existant ou en demandant directement à QRP de faire les corrections SQL.

## Fichiers à modifier

| Projet | Fichier | Action |
|--------|---------|--------|
| HPP | `supabase/functions/api-v2/index.ts` | Vérifier que la route sync inclut les champs audio |
| HPP | `supabase/functions/public-project-data/index.ts` | Vérifier que mode=library expose les audio_url |
| QRP | Nouveau `supabase/functions/sync-from-hpp/index.ts` | Edge Function de sync |
| QRP | `supabase/functions/medina-library/index.ts` | Ajouter les champs audio au SELECT |

## Détails techniques

- Le `public-project-data?mode=library` expose déjà les champs `audio_url_fr/en` et `anecdote_audio_url_fr/en` (vérifié dans le code).
- L'upsert dans QRP utilisera `ON CONFLICT (id)` pour mettre à jour les POIs existants.
- Les champs à synchroniser : `name`, `name_fr`, `name_en`, `category`, `is_active`, `status`, `audio_url_fr`, `audio_url_en`, `anecdote_audio_url_fr`, `anecdote_audio_url_en`, `history_context`, `history_context_en`, `local_anecdote`, `local_anecdote_en`, `is_start_hub`.

