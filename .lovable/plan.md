

## Compréhension

Tu veux créer une **section dédiée "POIs Principaux"** (ou "POIs Visite") séparée de la liste générale dans `/admin/medina-pois`. Cette section regroupe les lieux clés visitables (Jemaa el-Fna, Koutoubia, musées, jardins, médersas, palais, etc.) et devient **la seule source de vérité** consommée par Quest Rides PRO pour générer les visites.

## Plan

### 1. Marquer les POIs "principaux" en base
Ajouter une colonne `is_main_visit boolean default false` sur `medina_pois`.
Backfill : tous les POIs avec `is_start_hub = true` + catégories `monument, museum, mosque, medersa, palace, historic_site, garden, fountain, gate_bab` et `poi_quality_score >= 6` → `is_main_visit = true`.

### 2. UI — Onglets dans `/admin/medina-pois`
Réorganiser la page avec deux onglets :
- **Tous les POIs** (vue actuelle inchangée)
- **POIs Principaux** ⭐ (filtrés `is_main_visit = true`, mis en avant visuellement)

Dans chaque ligne de la liste générale, ajouter un toggle "⭐ Principal" pour promouvoir/dépromouvoir.

### 3. Fiche POI Principal — éditeur enrichi
Pour les POIs principaux, l'éditeur affiche les sections existantes **+** un bloc dédié **"Contenu narratif bilingue"** avec, pour chaque champ narratif (`history_context`, `local_anecdote_fr`, `fun_fact_fr`, `must_see_details`, `must_try`, `must_visit_nearby`, `photo_tip`, `price_info`, `best_time_visit`, `accessibility_notes`, `wikipedia_summary`) :

```
[Label]
┌─────────────── FR ───────────────┐  ┌──── EN ────┐
│ Texte français (textarea)        │  │ (vide)     │  [Traduire →]
└──────────────────────────────────┘  └────────────┘
```

- Bouton **"Traduire en anglais"** par champ → appelle l'edge function `translate` existante → remplit le champ `_en` correspondant → sauvegarde auto.
- Bouton global **"Tout traduire"** en haut de la section → boucle sur tous les champs FR remplis dont `_en` est vide.

### 4. Audios FR + EN
Sous chaque POI principal, bloc **"Guides audio"** :
- **FR** : si `audio_url_fr` existe → lecteur `<audio>` + lien + bouton "Régénérer". Sinon → bouton **"Générer FR"** (appel `generate-poi-audio` avec `text = history_context + local_anecdote_fr`, chemin versionné `fr_v{ts}.mp3`).
- **EN** : idem avec `audio_url_en` (texte source = `history_context_en + local_anecdote_en`, blocage si EN vide → toast "Traduisez d'abord en anglais").
- Indicateur de génération en cours (loader, ~30s).

### 5. Source de vérité pour Quest Rides PRO
Exposer ces POIs principaux via l'API v2 existante :
- Nouvelle route `api-v2?route=main-visits` qui renvoie uniquement `is_main_visit = true AND status = 'validated'`, avec **tous les champs FR/EN, audios FR/EN, médias, opening_hours, must_see/try/nearby**.
- Mémoire à enregistrer : "Quest Rides PRO doit piocher exclusivement dans `main-visits` pour générer les visites guidées (KJTOUR, etc.)".

### 6. Sauvegarde + feedback
- Autosave `onBlur` sur tous les champs (déjà en place).
- Indicateur "✓ Enregistré il y a Xs" en haut de la fiche.
- Toast d'erreur uniquement si échec.

## Fichiers touchés

**Frontend :**
- `src/pages/admin/AdminMedinaPOIs.tsx` — onglets + éditeur enrichi avec sections collapsibles
- `src/hooks/useMedinaPOIs.ts` — élargir le `select(*)` pour récupérer toutes les colonnes
- Nouveaux composants :
  - `src/components/admin/medina/BilingualNarrativeBlock.tsx` (FR + EN + bouton Traduire par champ)
  - `src/components/admin/medina/AudioGuideBlock.tsx` (lecteur + Générer/Régénérer FR/EN)
  - `src/components/admin/medina/SaveStatusBadge.tsx`

**Backend :**
- Migration SQL : ajout `is_main_visit` + index + backfill
- `supabase/functions/api-v2/index.ts` — ajout du handler `route=main-visits`
- Réutilise sans modification : `translate`, `generate-poi-audio`

**Mémoire :**
- Nouvelle entrée `mem://features/poi-library/main-visits-source-of-truth` documentant que `is_main_visit = true` est la seule source pour PRO.

Aucune modification côté projet PRO dans cette étape — il consommera la nouvelle route quand il sera prêt.

