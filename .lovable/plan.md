
## Constat

Sur le stop **Souk Semmarine** (visite `d22ce8d0-…`), la section **"Histoire du lieu"** côté QRP affiche le texte court (`description_short` : "Artère principale des souks…") au lieu de l'histoire longue présente dans `medina_pois.history_context` (1319 caractères, audio FR déjà généré).

Cause racine vérifiée en base : le stop ne contient ni `story`, ni `history_context`, ni `audio_url_fr`. Le hydrater actuel (`_shared/hydrateStops.ts`) ajoute bien l'anecdote et les audios, mais **ne hydrate pas l'histoire longue ni son audio histoire**. L'UI player tombe donc sur le fallback court.

## Périmètre

Corriger **à la source** + **safety net read** pour que toutes les visites (anciennes via GET, nouvelles via INSERT) exposent l'histoire longue inline.

## Fix

### 1. `supabase/functions/_shared/hydrateStops.ts`

Étendre le SELECT et la complétion additive avec :
- `story` ← `medina_pois.history_context` (si vide côté stop)
- `story_en` ← `medina_pois.history_context_en` (si vide côté stop)
- `history_context` ← `medina_pois.history_context` (alias, si certains clients le lisent directement)
- `history_context_en` ← `medina_pois.history_context_en`

Règles inchangées :
- Jamais d'écrasement (`isBlank` gate)
- Aucun touch sur `mini_challenge`, `description`, `riddle`, `order`, `poi_id`, `name`, `lat`, `lng`, `photo_url`, etc.
- Une seule requête `medina_pois` (déjà en place), on ajoute juste les colonnes au SELECT

L'audio histoire (`audio_url_fr` / `audio_url_en`) est **déjà** hydraté par le helper — pas de changement nécessaire côté audio.

### 2. `supabase/functions/poi-auto-agent/index.ts` (l. 620)

Le builder pose déjà `story: history_context || local_anecdote`. Ajouter de façon symétrique :
- `story_en: original?.history_context_en || original?.local_anecdote_en || undefined`
- `history_context: original?.history_context || undefined`
- `history_context_en: original?.history_context_en || undefined`

Et ajouter `history_context_en, local_anecdote_en` au SELECT ligne 466 (FR `history_context, local_anecdote` déjà présents).

### 3. Déploiement

Redeploy `api-v2` et `poi-auto-agent`.

## Validation

- `GET /api-v2?route=tour&id=d22ce8d0-…` → vérifier que le stop Souk Semmarine expose désormais `story` ≈ 1319 chars + `audio_url_fr` (déjà OK depuis fix précédent).
- 4 autres stops inchangés (mini_challenge, order, description identiques).
- Aucun `updated_at` modifié en DB (read-only).
- QRP GHXGGN : "Histoire du lieu" affiche le texte long et le bouton play déclenche l'audio histoire FR.

## Hors-scope (confirmé)

- ❌ Aucune génération TTS, aucun ElevenLabs
- ❌ Aucune migration SQL, aucun UPDATE sur `quest_library` ni `medina_pois`
- ❌ Aucun QRP, quest-proxy, player, mission, ordre modifié
- ❌ Aucun placeholder, secret, portail, prix/crédit, Vapi
- ❌ Aucune autre visite/POI touché·e
