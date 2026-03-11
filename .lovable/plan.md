
# Plan: Expert IA Médina — analyze-marker

## Status: ✅ Implémenté

## Ce qui a été créé

### Edge Function `analyze-marker`
- Modèle : `google/gemini-2.5-pro` via Lovable AI Gateway
- Prompt système ~6000 tokens de connaissances encyclopédiques sur la médina de Marrakech
- Tool calling pour sortie JSON structurée avec 15 champs d'analyse
- Gestion erreurs 429/402

### Capacités (15 fonctions)
1. ✅ Identification lieu + catégorie + tags
2. ✅ Restaurants proches (nom, spécialité, prix, avis)
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
13. ✅ **Potentiel Instagram** (score 1-5, angle, heure, hashtags)
14. ✅ **Contexte terrain** (marqueurs proches avec notes humaines injectés comme vérité terrain)

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
