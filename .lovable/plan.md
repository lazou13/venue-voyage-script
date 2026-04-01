

# Intégrer Perplexity pour l'enrichissement des POIs

## Pourquoi c'est mieux

Gemini génère du contenu **sans sources** — risque d'hallucinations sur les faits historiques, dates, anecdotes. Perplexity (`sonar`) fait une **recherche web en temps réel** et retourne des **citations vérifiables**. Pour des descriptions de monuments et lieux culturels de la médina, c'est nettement plus fiable.

## Étapes

### 1. Connecter Perplexity au projet
Lier le connecteur Perplexity via l'outil de connexion (le user sera invité à sélectionner/créer une connexion).

### 2. Modifier `anecdote-enricher` pour utiliser Perplexity
- Remplacer l'appel Lovable AI Gateway (Gemini Flash) par un appel direct à l'API Perplexity (`https://api.perplexity.ai/chat/completions`)
- Utiliser le modèle `sonar` pour des réponses factuelles avec citations
- Adapter le prompt pour exploiter la recherche web : "Recherche des informations historiques vérifiées sur [nom du POI] à Marrakech"
- Stocker les citations retournées (optionnel : nouveau champ `sources` dans `medina_pois`)

### 3. Modifier `poi-auto-agent` Phase 1
- Pour les champs descriptifs (description_short, accessibility_notes, instagram_tips), garder Gemini Flash — c'est du tagging, pas besoin de recherche
- Pour `history_context` et `local_anecdote` dans le pipeline d'enrichissement, utiliser Perplexity via `anecdote-enricher`

### 4. Conserver Gemini pour le reste
- Phase 1 (audience_tags, route_tags, instagram_score) → Gemini Flash (tagging rapide)
- Phase 2 (sélection/ordonnancement des visites) → Gemini Pro (raisonnement créatif)
- Descriptions/anecdotes → **Perplexity sonar** (faits vérifiés)

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `supabase/functions/anecdote-enricher/index.ts` | Remplacer Lovable AI par Perplexity API, adapter prompt pour recherche web, gérer citations |

## Prérequis
- Connexion Perplexity à établir avant implémentation
- Le secret `PERPLEXITY_API_KEY` sera disponible automatiquement après connexion

