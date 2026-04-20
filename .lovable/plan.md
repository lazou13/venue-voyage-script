

## Diagnostic confirmé

Le problème n’est pas dans `AudioGuideBlock` : ce composant lit bien les bonnes colonnes (`audio_url_fr`, `audio_url_en`, `anecdote_audio_url_fr`, `anecdote_audio_url_en`).

Le vrai problème est double :

1. **Données dupliquées dans `medina_pois`**
   - `Mosquée Koutoubia` existe en **14 lignes**, dont **7 encore actives**.
   - La fiche canonique `eec26470-5202-4d52-a349-679843dae33b` a bien **4/4 audios**.
   - D’autres doublons actifs du même nom n’ont aucun audio.
   - Même problème sur d’autres lieux : `Place Jemaa el-Fna`, `Palais Bahia`, `Tombeaux Saadiens`, `Place des Épices`, `Le Jardin Secret`, `Mosquée Ben Salah`, `Foundouk Essarsar`, etc.

2. **Panneau admin localement “stale”**
   - Dans `AdminMedinaPOIs.tsx`, le `POIEditorPanel` fait `useEffect(() => setForm(poi), [poi.id])`.
   - Donc si les données du même POI changent en base sans changer d’ID, le formulaire **ne se resynchronise pas**.
   - Résultat : même quand l’audio existe ou vient d’être généré, l’UI peut continuer à afficher un état ancien.

## Correction définitive

### 1. Dédupliquer la bibliothèque avant toute IA
Appliquer un nettoyage data ciblé sur les doublons actifs de `medina_pois`.

#### Règle de sélection du “gagnant”
Pour chaque groupe de doublons (`lower(coalesce(name_fr, name))` + proximité GPS), garder la ligne la plus riche selon cet ordre :
1. 4/4 audios présents
2. longueur `history_context`
3. longueur `local_anecdote_fr`
4. `poi_quality_score`
5. `status='validated'`
6. `last_enriched_at` le plus récent

#### Actions par groupe
- **Conserver** le POI gagnant
- **Fusionner** vers lui les champs non nuls manquants des perdants
- **Migrer** les `poi_media` vers le gagnant
- **Désactiver** les doublons perdants :
  - `is_active = false`
  - `is_main_visit = false`
  - `status = 'merged'`
  - `metadata.merged_into = winner_id`

#### Cas prioritaire
- `Mosquée Koutoubia` : conserver `eec26470-5202-4d52-a349-679843dae33b`

### 2. Corriger la resynchronisation du panneau admin
Dans `src/pages/admin/AdminMedinaPOIs.tsx` :
- remplacer la logique de sync locale du formulaire pour qu’elle se recalque sur **tout l’objet `poi`**, pas seulement `poi.id`
- objectif : si l’audio, les textes ou les métadonnées changent en base, le panneau affiche immédiatement l’état réel

Correction attendue :
- `AudioGuideBlock` reflète bien les URLs déjà présentes
- après génération audio ou enrichissement, l’UI se met à jour sans rechargement manuel

### 3. Ajouter un garde-fou anti-régénération payante
Dans `src/components/admin/medina/MainPOIEnrichmentBlock.tsx` :
- afficher un **pré-audit de complétude** avant de lancer l’agent :
  - textes FR remplis / vides
  - traductions EN remplies / vides
  - fun facts présents / absents
  - vidéos présentes / absentes
  - 4 slots audio présents / absents
- distinguer clairement :
  - **Compléter** = écrit uniquement les champs vides
  - **Régénérer** = peut écraser l’existant
- ajouter une confirmation explicite avant tout mode destructif

### 4. Bloquer côté edge function les appels inutiles
Dans `supabase/functions/poi-enrich-single/index.ts` :
- avant d’appeler Perplexity, calculer les champs réellement manquants selon `mode` + `include`
- si `mode = fill_empty` et qu’il n’y a rien à remplir :
  - retourner `{ skipped: true, reason: "nothing_to_fill" }`
  - **ne pas appeler Perplexity**
- ajouter dans la réponse une synthèse exploitable par l’UI :
  - `missing_text_fields`
  - `missing_en_fields`
  - `has_fun_facts`
  - `has_videos`
  - `has_audio_slots`

### 5. Empêcher le retour du problème sur les POIs principaux
Ajouter un garde-fou structurel pour les **POIs principaux actifs** :
- migration de schéma pour un index unique partiel sur le nom normalisé des principaux actifs
- portée limitée aux POIs principaux pour éviter de casser les cas non critiques de la bibliothèque générale

Exemple de règle :
- un seul `is_main_visit = true AND is_active = true` par nom normalisé

### 6. Rendre les doublons visibles dans l’admin
Dans `AdminMedinaPOIs.tsx` :
- badge d’alerte si un POI a des doublons actifs détectés
- filtre rapide “Doublons”
- sur la fiche, afficher :
  - nombre de doublons détectés
  - ID canonique si la ligne a été fusionnée
- désactiver le bouton d’enrichissement si la fiche est marquée comme doublon non canonique

## Fichiers et données à toucher

### Données
- `medina_pois` : fusion/désactivation des doublons actifs
- `poi_media` : migration vers les POIs gagnants

### Code
- `src/pages/admin/AdminMedinaPOIs.tsx`
  - resync du formulaire
  - alertes doublons
  - filtre doublons
- `src/components/admin/medina/MainPOIEnrichmentBlock.tsx`
  - pré-audit
  - confirmation destructive
  - blocage si doublon non canonique
- `supabase/functions/poi-enrich-single/index.ts`
  - early exit sans appel IA
  - réponse enrichie de diagnostic

### Mémoire
- `mem://features/poi-library/main-visits-source-of-truth.md`
  - règle canonique anti-doublon
  - interdiction d’enrichir une fiche non canonique
- `mem://features/poi-library/naming-policy-latin-only.md`
  - préciser que le nom FR canonique doit pointer vers une seule fiche active principale

## Résultat attendu

Après implémentation :
- Koutoubia n’apparaît plus comme plusieurs fiches actives ambiguës
- la fiche canonique affiche bien ses 4 audios existants
- l’admin reflète l’état réel de la base sans faux “Aucun audio”
- l’agent n’est plus lancé sur une mauvaise fiche
- `fill_empty` n’appelle plus Perplexity quand rien ne manque
- les doublons critiques des POIs principaux ne peuvent plus réapparaître

