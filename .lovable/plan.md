

## Compréhension

Trois demandes :
1. **Audios catégorisés** : pas un seul "audio FR / EN" globalisé, mais des audios distincts par type narratif (Histoire FR, Anecdote FR, Histoire EN, Anecdote EN…) — la table a déjà `audio_url_fr`, `audio_url_en`, `anecdote_audio_url_fr`, `anecdote_audio_url_en`.
2. **Type d'interaction et thème éditables** sur la fiche POI principal (audio guide, jeu, énigme, photo… + thème : histoire, gastronomie, artisanat, etc.).
3. **Pourquoi seulement 4 POIs principaux** ? Koutoubia, Jemaa el-Fna, Medersa Ben Youssef, Place des Épices, Bahia, Badi, Saadiens, Majorelle, Secret Garden, Dar Si Said… doivent y figurer. → backfill insuffisant.

## Vérifications rapides à faire

- `SELECT count(*), array_agg(name) FROM medina_pois WHERE is_main_visit = true;` pour voir l'état réel.
- Lister les candidats manquants : POIs avec `category IN (monument, museum, mosque, medersa, palace, historic_site, garden, fountain, gate_bab, square)` OU `is_start_hub = true` OU `name ILIKE` (Koutoubia, Jemaa, Medersa, Bahia, Badi, Saadien, Majorelle, Secret Garden, Dar Si Said, Maison de la Photo, Mellah, Souk des épices/Rahba Kedima, Bab Agnaou, Menara, Ménara, Agdal…), peu importe le score.

## Plan

### 1. Backfill élargi `is_main_visit`
Migration de données (INSERT tool) :
- Promouvoir tous les POIs `is_start_hub = true`.
- Promouvoir toutes les catégories visitables (`monument, historic_site, museum, mosque, medersa, palace, garden, fountain, gate_bab, square, hammam` si patrimonial) avec `is_active = true` et coordonnées valides — **sans** filtre `poi_quality_score >= 6` (c'est ce filtre qui exclut les évidents comme Place des Épices).
- Whitelist nommée pour forcer les incontournables même hors taxonomie : Koutoubia, Jemaa el-Fna, Place des Épices / Rahba Kedima, Medersa Ben Youssef, Bahia, El Badi, Tombeaux Saadiens, Jardin Majorelle, Jardin Secret, Dar Si Said, Maison de la Photographie, Musée de Marrakech, Mellah, Bab Agnaou, Ben Salah, Mouassine, Koubba Almoravide, Fondouk el-Amir, Tanneries, Menara, Agdal.
- Affichage : trier les principaux par catégorie pour rendre la liste lisible.

### 2. Audios catégorisés (4 slots)
Refondre `AudioGuideBlock` en grille 2×2 :
| | FR | EN |
|---|---|---|
| **Histoire** | `audio_url_fr` (source : `history_context`) | `audio_url_en` (source : `history_context_en`) |
| **Anecdote** | `anecdote_audio_url_fr` (source : `local_anecdote_fr`) | `anecdote_audio_url_en` (source : `local_anecdote_en`) |

Chaque cellule = lecteur + bouton Générer/Régénérer + état loader. Texte source strictement brut (pas de concaténation, conformément à la règle TTS mémorisée).
`generate-poi-audio` accepte déjà `field` + `storage_path` → 4 chemins versionnés : `history_fr_v{ts}.mp3`, `history_en_v{ts}.mp3`, `anecdote_fr_v{ts}.mp3`, `anecdote_en_v{ts}.mp3`.

### 3. Thème + Type d'interaction éditables
Ajouter dans la fiche POI principal un bloc **"Visite — paramètres"** :
- **Thème** (`hub_theme` — colonne déjà existante) : combobox avec valeurs canoniques (histoire, architecture, artisanat, gastronomie, spiritualité, jardins, vie locale, photographie, panorama) + ajout libre.
- **Type d'interaction par défaut** (stocké dans `step_config.interaction_type` JSONB) : select avec `audio_guide`, `quiz`, `riddle`, `photo_check`, `free_visit` (taxonomie canonique mémorisée).
- **Tags audience** (`audience_tags[]`) et **route_tags** (`route_tags[]`) en multi-input chips.
- Autosave onBlur, badge SaveStatus partagé.

### 4. API v2 — exposer les 4 audios
Mettre à jour `route=main-visits` pour renvoyer aussi `anecdote_audio_url_fr/en`, `hub_theme`, `step_config.interaction_type`, `audience_tags`, `route_tags`.

### 5. Mémoire
Mettre à jour `mem://features/poi-library/main-visits-source-of-truth` pour préciser : 4 slots audio (history/anecdote × FR/EN), thème + interaction éditables, taxonomie de promotion élargie.

## Fichiers touchés

- `src/components/admin/medina/AudioGuideBlock.tsx` — grille 2×2, 4 slots
- `src/pages/admin/AdminMedinaPOIs.tsx` — nouveau bloc "Visite — paramètres" dans le panneau "Principal"
- Nouveaux composants : `VisitSettingsBlock.tsx` (thème + interaction + tags)
- `supabase/functions/api-v2/index.ts` — élargir le payload `main-visits`
- Migration de données (INSERT tool) : backfill élargi `is_main_visit`
- `mem://features/poi-library/main-visits-source-of-truth.md`

Aucune nouvelle colonne nécessaire (toutes existent : `hub_theme`, `audience_tags`, `route_tags`, `step_config`, les 4 colonnes audio).

