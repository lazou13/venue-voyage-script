# Plan: Expert IA Médina — analyze-marker

## Status: ✅ Implémenté

## Ce qui a été créé

### Edge Function `analyze-marker`
- Modèle : `google/gemini-2.5-pro` via Lovable AI Gateway
- Prompt système ~6000 tokens de connaissances encyclopédiques sur la médina de Marrakech
- Tool calling pour sortie JSON structurée avec 17 champs d'analyse
- Gestion erreurs 429/402

### Capacités (17 fonctions)
1. ✅ Identification lieu + catégorie + tags
2. ✅ Restaurants proches (nom, spécialité, prix, avis, **lien carte/menu**, **5 avis Google résumés**)
3. ✅ Anecdote historique
4. ✅ Description guide multilingue (fr/en/ar/es/ary)
5. ✅ Résumé bibliothèque multilingue
6. ✅ Conseils pratiques (horaires, photo, sécurité, accessibilité)
7. ✅ Classification automatique catégorie/sous-catégorie
8. ✅ Estimation difficulté + intérêt par public cible
9. ✅ Suggestions step_config (types, validations)
10. ✅ Génération énigmes (QCM + énigme + défi terrain)
11. ✅ Transcription audio enrichie + données structurées
12. ✅ Détection doublons vs bibliothèque existante
13. ✅ **Potentiel Instagram** (score 1-5, angle, heure, hashtags, **posts Instagram réels avec URLs**)
14. ✅ **Contexte terrain** (marqueurs proches avec notes humaines injectés comme vérité terrain)
15. ✅ **POIs proches avec billets, tarifs et horaires** (musées, monuments)
16. ✅ **Narration contextuelle** (suit le parcours, interdit les introductions génériques)
17. ✅ **Liens web/Instagram/Maps** pour chaque restaurant et POI

### Enrichissement des connaissances
- ✅ **Stratégie A** : Boucle de retour terrain — marqueurs proches (< 200m) envoyés comme contexte
- 🔲 **Stratégie B** : Table `medina_knowledge` — fiches éditables par l'admin
- 🔲 **Stratégie C** : Recherche web temps réel (Perplexity/Firecrawl)

### Intégration Frontend
- Analyse automatique après chaque marqueur rapide sauvegardé
- Panel IA dans le drawer avec résultats structurés
- Bouton "Appliquer à la note" pour enrichir le marqueur
- Bouton "Ignorer" pour fermer sans appliquer
- Marqueurs proches du même projet envoyés comme contexte additionnel
- ✅ **Affichage enrichi** : avis Google, liens carte/menu, billets/tarifs, posts Instagram avec URLs

## Marqueur rapide — Améliorations terrain (✅ Implémenté)

### Multi-photos
- ✅ Colonne `photo_urls text[]` ajoutée à `route_markers`
- ✅ `useRouteRecorder` supporte `photoUrls[]`
- ✅ UI : ajout de photos multiples avec miniatures + suppression individuelle
- ✅ Plus d'auto-save à la première photo — validation manuelle requise

### Notes vocales fiables
- ✅ `useVoiceRecorder` : détection dynamique du mimeType (webm → mp4 → défaut navigateur)
- ✅ Upload avec extension adaptée (.webm ou .mp4)

### IA différée
- ✅ `triggerAiAnalysis` supprimé du `handleQuickMarkerSave`
- ✅ Drawer se ferme immédiatement après sauvegarde (toast "Marqueur sauvegardé ✓")
- ✅ Analyse IA accessible dans la liste des marqueurs après STOP (bouton "Analyser" + "Analyser tous")

## Promotion en bibliothèque (✅ Enrichi)

### Flux "Approuver + Bibliothèque"
- ✅ Note enrichie avec restaurants (carte, avis), POIs (billets, tarifs, horaires)
- ✅ Analyse IA complète stockée dans `medina_pois.metadata.ai_analysis`
- ✅ Photos Instagram de référence extraites dans `metadata.reference_photos`
- ✅ Nom et catégorie du POI déduits de l'analyse IA (au lieu de "POI terrain")

### Narration de guide contextuelle
- ✅ Interdiction des introductions génériques ("Oubliez les souks...")
- ✅ Transitions de parcours obligatoires ("Nous voilà maintenant devant...")
- ✅ Contexte marques/enseignes (pourquoi elles sont là, leur histoire)

## Pipeline POI Google Places (✅ Implémenté)

### Migration SQL
- ✅ 21 colonnes ajoutées à `medina_pois` : `place_id`, `category_google`, `category_ai`, `address`, `rating`, `reviews_count`, `website`, `phone`, `district`, `souks_nearby`, `description_short`, `history_context`, `local_anecdote`, `instagram_spot`, `nearby_restaurants`, `nearby_pois_data`, `riddle_easy`, `riddle_medium`, `challenge`, `google_raw`, `enrichment_status`
- ✅ Index sur `place_id` (unique) et `enrichment_status`

### Edge Functions
- ✅ `poi-extract` : Google Places Nearby Search (8 types, rayon 1500m) + Place Details (website, phone, reviews, photos)
- ✅ `poi-enrich` : Classification IA (Gemini 2.5 Flash via tool calling), enrichissement culturel, génération d'énigmes
- ✅ `poi-proximity` : Calcul Haversine → 5 restaurants + 5 POI proches
- ✅ `poi-pipeline` : Orchestrateur (extract → enrich → proximity)

### Page Admin
- ✅ `/admin/poi-pipeline` avec boutons par étape + pipeline complet
- ✅ Compteurs par statut (pending/raw/enriched/error)
- ✅ Logs en temps réel
- ✅ Lien dans la sidebar admin
