# Reconstruction Bibliothèque de Visites

## Objectif

Vider entièrement `quest_library` et la régénérer avec **9 visites** :
- **3 hubs** : Koutoubia, Jemaa el-Fna, Place des Ferblantiers (Mellah)
- **3 visites par hub**, thèmes : `complete`, `hidden_gems`, `photography`
- **Aucune visite food / culinaire**
- POIs utilisés uniquement s'ils sont **enrichis ET ont un audio FR** (`audio_url_fr` non nul)

## État constaté

- `quest_library` contient 17 entrées actuelles (mix complete/food/photo/hidden_gems sur Koutoubia, Jemaa, Mellah + autres) → toutes supprimées.
- POIs validés avec audio FR dans un rayon de 800 m :
  - Koutoubia : 18
  - Jemaa el-Fna : 23
  - Ferblantiers/Mellah : 9
  → assez pour 6–10 stops par visite.

## Implémentation

### 1. Nouvelle edge function `quest-library-rebuild` (one-shot, admin only)

Logique :

1. `DELETE FROM quest_library` (purge totale).
2. Charger les POIs candidats en une requête :
   - `status='validated'`, `is_active=true`
   - `audio_url_fr IS NOT NULL AND audio_url_fr <> ''`
   - `history_context` non vide (enrichi)
   - `category_ai` non nulle, exclusion catégories non culturelles existantes (`EXCLUDED_CATEGORIES`)
   - Exclusion explicite des catégories food (`restaurant`, `cafe`, `street_food`, `market` alimentaire) pour respecter "pas de parcours culinaire"
   - Bbox médina (déjà utilisé)
3. Pour chacun des 3 hubs (coords figées identiques à la mémoire `start-hubs`) :
   - Filtrer POIs à ≤ 1500 m du hub
   - Pour chacun des 3 thèmes (`complete`, `hidden_gems`, `photography`) :
     - Appel IA Gemini 2.5 Pro (tool calling) avec le même schéma `create_visit` que `poi-auto-agent` Phase 2, prompt adapté :
       - 6–10 stops, durée cible ~150 min
       - Audience implicite par thème (pas de `foodies`)
       - Diversité de catégories, parcours géographiquement logique
       - Privilégier qualité + audio déjà disponible
     - Hydrater stops via `hydrateStopsFromPois` (anecdote + audios FR/EN inline)
     - Attacher missions V2 via `attachMissionsV2` (mêmes règles que pipeline existant)
     - INSERT dans `quest_library` avec `agent_version='v3.1-rebuild'`, `mode='guided_tour'`, `theme` = thème courant

### 2. Déclenchement

- Bouton "Reconstruire la bibliothèque" dans `src/pages/admin/AdminQuestLibrary.tsx`, visible admin uniquement, confirmation dialog (action destructive).
- Appel `supabase.functions.invoke('quest-library-rebuild')`, toast progressif, refresh de la liste à la fin.

### 3. Hors-scope (confirmation)

- Aucune migration DB
- Aucun changement de schéma sur `quest_library` ou `medina_pois`
- Aucun changement au pipeline `poi-auto-agent` (la génération auto continue côté Phase 2 existante — on n'y touche pas)
- Aucun changement au player / QRP / quest-proxy
- Aucun changement à la génération de quêtes publiques
- Aucun secret, aucun prix, aucun Vapi

## QA dry-run après exécution

Vérifier en base :

```sql
SELECT start_hub, theme, stops_count, duration_min, title_fr
FROM quest_library ORDER BY start_hub, theme;
```

Attendu : 9 lignes, 3 par hub (`koutoubia`, `jemaa_el_fna`, `mellah`), thèmes ∈ {complete, hidden_gems, photography}, aucun `theme='food'`, chaque visite ≥ 6 stops, tous les `poi_id` des stops ont un `audio_url_fr` non nul.
