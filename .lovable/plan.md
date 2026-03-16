

# Plan : Intégration du Prompt LYRA V3 dans les Edge Functions

## Contexte

Le prompt LYRA V3 est un prompt unifié qui couvre la classification, l'enrichissement, la génération d'énigmes et la construction de parcours. Il doit remplacer les prompts existants dans **4 Edge Functions** qui utilisent l'IA.

## Fonctions impactées

| Fonction | Rôle actuel | Prompt actuel | Action |
|---|---|---|---|
| `poi-autopipeline` | Classify + Enrich inline | Prompt court classify + `ENRICH_SYSTEM` | Remplacer les deux prompts |
| `poi-worker` | Enrichissement batch | `SYSTEM_PROMPT` (~40 lignes) | Remplacer |
| `poi-enrich` | Enrichissement legacy | `SYSTEM_PROMPT` (~40 lignes) | Remplacer |
| `analyze-marker` | Analyse terrain temps réel | `SYSTEM_PROMPT` (~5000 tokens, encyclopédique) | **Fusionner** LYRA V3 + connaissances géographiques existantes |
| `public-generate-quest` | Narration de quête | Prompt narratif séparé | Ajouter le cadre LYRA V3 comme contexte système |
| `generate-medina-quest` | Sélection algorithmique | Aucun LLM | Pas de changement |

## Modifications prévues

### 1. Créer un prompt partagé LYRA V3

Créer une constante `LYRA_SYSTEM_PROMPT` réutilisable dans chaque fonction. Le prompt reprend les 13 blocs fournis, adapté au format technique (tool calling). Le prompt sera copié dans chaque fonction (pas d'import possible entre Edge Functions).

### 2. `poi-autopipeline/index.ts`

- Remplacer le prompt classify inline (`"Tu es un expert de la médina..."`) par une version condensée de LYRA V3 focalisée sur la classification
- Remplacer `ENRICH_SYSTEM` par LYRA V3 complet (blocs 1-9) pour l'enrichissement
- Conserver les tool schemas existants (ils correspondent déjà à la structure de sortie LYRA bloc 10)

### 3. `poi-worker/index.ts`

- Remplacer `SYSTEM_PROMPT` par LYRA V3 (blocs 1-9)
- Conserver le tool calling et le mapping de champs

### 4. `poi-enrich/index.ts`

- Remplacer `SYSTEM_PROMPT` par LYRA V3 (blocs 1-9)
- Conserver le tool calling existant

### 5. `analyze-marker/index.ts`

- **Fusionner** : garder les connaissances géographiques détaillées (souks, coordonnées GPS, monuments) qui sont absentes de LYRA V3
- Préfixer avec les blocs 1-3 de LYRA V3 (rôle + compréhension médina + graphe urbain)
- Conserver les sections encyclopédiques existantes (coordonnées GPS des souks, monuments, restaurants)
- Ajouter les blocs 8-9 (énigmes + narration) et le bloc 12 (contraintes)

### 6. `public-generate-quest/index.ts`

- Enrichir le `systemPrompt` de la fonction `generateQuestNarrative` avec les blocs 6-7-9-11 de LYRA V3 (logique de parcours, structure chasse au trésor, narration, cohérence)
- Conserver le style adaptatif existant (court/moyen/long)

## Points techniques

- Les tool schemas restent identiques (les champs demandés par LYRA V3 correspondent déjà aux propriétés existantes)
- La catégorie `hammam` mentionnée dans LYRA V3 bloc 4 sera mappée vers `spa` (catégorie existante dans `CATEGORIES`)
- Le bloc 12 (contraintes : ne jamais inventer) sera ajouté dans tous les prompts d'enrichissement
- Aucune migration SQL nécessaire

## Estimation

5 fichiers modifiés, ~200 lignes de prompt réécrites par fonction.

