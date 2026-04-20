

## Compréhension

Sur la fiche POI Principal, il faut :
1. **FR comme langue de base** : tous les champs narratifs en français en base, EN généré uniquement par traduction.
2. **Compléter les "POIs Principaux"** avec les souks majeurs manquants (Souk Semmarine, Souk des Teinturiers/Sebbaghine, Souk des Babouches/Smata, Souk Haddadine/forgerons, Souk Cherratine/cuir, Souk Attarine/épices…).
3. **Champs supplémentaires bilingues** : `fun_facts` (liste), `must_see` (à voir), `must_try` (à tester), `visitor_tips` — déjà en partie en colonnes, à exposer dans l'éditeur en FR + EN avec bouton Traduire.
4. **Agent d'enrichissement par fiche** : un bouton "Enrichir avec l'IA" sur chaque POI principal qui appelle Perplexity (`sonar-pro` avec citations) pour compléter en une passe : history_context, local_anecdote, fun_fact, must_see, must_try, photo_tip, best_time, accessibility, crowd_level, photos suggérées (URLs Wikimedia/Commons).
5. **Médias enrichis** : photos + vidéos. Photos déjà gérées via `poi-fetch-photos`. Pour les vidéos : ajouter un champ `video_urls[]` (YouTube embeds) que l'agent propose et que l'admin valide.

## Plan

### 1. Backfill — souks et lieux manquants
INSERT tool : `UPDATE medina_pois SET is_main_visit = true` pour :
- Tous les POIs `category IN ('souk', 'fondouk')` avec `is_active = true` ET coordonnées valides ET `poi_quality_score >= 4`.
- Whitelist nommée souks : Semmarine, Attarine, Smata/Babouches, Cherratine, Sebbaghine/Teinturiers, Haddadine/Forgerons, Chouari/Menuisiers, Kimakhine, Zrabi/Tapis, Kchachbia.
- Vérification : `SELECT count(*) FROM medina_pois WHERE is_main_visit = true GROUP BY category;` pour confirmer 40-60 POIs principaux répartis.

### 2. Politique linguistique FR-first
Règle : tous les champs narratifs sont écrits en FR par l'admin (ou l'agent). EN est strictement une traduction du FR via le bouton "Traduire". Aucun champ EN n'est édité en source.
- Si `local_anecdote_fr` est vide → champ EN désactivé.
- Bouton "Tout retraduire en EN" : régénère tous les `_en` à partir des `_fr` (utile après refonte d'un POI).

### 3. Nouveau bloc éditeur — `MainPOIEnrichmentBlock`
Au-dessus de `BilingualNarrativeBlock`, ajouter un panneau dédié :

```
┌───────────────────────────────────────────────────┐
│ 🤖 Agent d'enrichissement (Perplexity)            │
│                                                   │
│ Cible : ce POI uniquement                         │
│ Mode  : ◉ Compléter (champs vides)               │
│         ○ Régénérer tout                          │
│ Inclure : ☑ Texte  ☑ Photos suggestions          │
│           ☑ Vidéos YouTube  ☑ Fun facts (3-5)    │
│                                                   │
│ [ Lancer l'enrichissement ] (≈30s)                │
│                                                   │
│ Dernière exécution : il y a 2h                    │
│ Sources : 4 citations Wikipedia + Commons         │
└───────────────────────────────────────────────────┘
```

Étendre les champs visibles dans `BilingualNarrativeBlock` avec :
- **Fun facts** (liste de 3-5 puces FR + EN, stockés JSONB `fun_facts: [{fr, en}]`).
- **À voir** (`must_see_details` + `_en`).
- **À tester / goûter** (`must_try` + `_en`).
- **À voir à proximité** (`must_visit_nearby` + `_en`).

### 4. Nouvel edge function — `poi-enrich-single`
Spécifique aux POIs principaux. Reçoit `{ poi_id, mode: 'fill_empty'|'regenerate', include: {text, photos, videos, fun_facts} }`.

Logique :
1. Charge le POI (name, name_fr, category, zone, address, contexte existant).
2. Construit un prompt Perplexity `sonar-pro` exigeant un JSON strict avec :
   - `history_context` (200-250 mots, FR, dates précises, anti-cliché — réutilise les règles mémorisées de `anecdote-enricher`)
   - `local_anecdote_fr` (80-100 mots, 1 fait surprenant vérifiable)
   - `fun_facts` : 3-5 items courts, chaque item = un chiffre/fait ponctuel
   - `must_see_details` (3-4 phrases)
   - `must_try` (1-2 phrases, spécifique souk/marché si applicable)
   - `photo_tip`, `best_time_visit`, `accessibility_notes`, `crowd_level`
   - `suggested_photo_urls` : 3-5 URLs Wikimedia Commons / Unsplash vérifiées
   - `suggested_youtube_videos` : 1-3 IDs YouTube de vidéos pertinentes (recherche via Perplexity)
3. Si `mode = fill_empty` : n'écrit que les colonnes vides. Si `regenerate` : écrase + versionne (sauvegarde précédent dans `metadata.previous_versions[]`).
4. Appelle `translate` en chaîne pour générer tous les `_en` correspondants automatiquement.
5. Pour les photos suggérées : insère dans `poi_media` avec `role_tags=['ai_suggested']` et `is_cover=false` — l'admin valide manuellement avant publication.
6. Pour les vidéos : nouvelle colonne `video_urls JSONB[]` (à créer en migration), chaque entrée = `{youtube_id, title, source}`.
7. Met à jour `last_enriched_at`, `enrichment_quality`, `data_sources += ['perplexity_single_v1']`.

### 5. Migration légère
- Nouvelle colonne `medina_pois.video_urls JSONB DEFAULT '[]'`.
- Nouvelle colonne `medina_pois.fun_facts_bilingual JSONB DEFAULT '[]'` (structure `[{fr, en}]`) — distinct de l'ancienne `fun_facts` libre, ou réutilise `fun_facts` en standardisant le format.

### 6. Bloc média enrichi
Étendre la section Médias :
- Onglet **Photos** (existant) + indicateur "X suggestions IA en attente de validation".
- Onglet **Vidéos** : liste des `video_urls`, prévisualisation iframe YouTube, suppression, ajout manuel d'une URL YouTube.

### 7. API v2 — exposer fun_facts + vidéos
Mettre à jour `route=main-visits` pour inclure `fun_facts_bilingual`, `video_urls`, `must_see_details_en`, `must_try_en`, `must_visit_nearby_en`.

### 8. Mémoire
Mettre à jour `mem://features/poi-library/main-visits-source-of-truth` avec :
- Politique FR-first stricte
- Souks inclus dans le périmètre principal
- Champs additionnels : fun_facts bilingues, must_see/try/nearby bilingues, vidéos
- Existence de l'agent `poi-enrich-single` (Perplexity sonar-pro) déclenché par fiche

## Fichiers touchés

**Backend :**
- Migration : ajout `video_urls`, `fun_facts_bilingual`
- INSERT (data) : backfill souks `is_main_visit`
- Nouveau : `supabase/functions/poi-enrich-single/index.ts`
- `supabase/functions/api-v2/index.ts` : payload élargi

**Frontend :**
- Nouveau : `src/components/admin/medina/MainPOIEnrichmentBlock.tsx` (panneau agent + bouton)
- Nouveau : `src/components/admin/medina/VideosBlock.tsx` (onglet vidéos)
- `src/components/admin/medina/BilingualNarrativeBlock.tsx` : ajouter fun_facts liste, must_see, must_try, must_visit_nearby
- `src/pages/admin/AdminMedinaPOIs.tsx` : intégrer les nouveaux blocs dans le panneau "Principal"
- `src/hooks/useMedinaPOIs.ts` : ajouter `video_urls`, `fun_facts_bilingual` à l'interface

**Mémoire :**
- `mem://features/poi-library/main-visits-source-of-truth.md`

**Secret requis :** `PERPLEXITY_API_KEY` (déjà configurée — utilisée par `anecdote-enricher`).

