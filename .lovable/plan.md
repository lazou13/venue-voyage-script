

# Fix: Timeout orchestrateur pour anecdotes Perplexity

## Cause racine

L'edge function `enrichment-pipeline` a un wall clock limit de ~60s. Avant, Gemini répondait en ~1s/POI. Maintenant Perplexity prend ~3-4s/POI (recherche web réelle). Les étapes 1-4 consomment déjà ~30s, il ne reste pas assez de temps pour les anecdotes.

L'`anecdote-enricher` fonctionne parfaitement en appel direct (testé : 2/2 POIs OK).

## Solution

Passer les étapes anecdotes et énigmes en **appel client-side direct** (comme le pattern auto-loop déjà utilisé dans d'autres parties du pipeline), au lieu de les exécuter dans l'orchestrateur.

### Changements dans `EnrichmentPipelineCard.tsx`

1. L'orchestrateur ne lance que les 4 premières étapes (wikidata, poi_enricher, photo, wiki_name)
2. Après l'orchestrateur, le composant appelle directement `anecdote-enricher` et `riddle-generator` en boucle côté client via `supabase.functions.invoke()`
3. Chaque batch de 5 anecdotes / 10 riddles est appelé individuellement avec mise à jour du progress en temps réel
4. Le composant continue jusqu'à ce que `updated === 0` (plus de POIs à traiter)

### Changements dans `enrichment-pipeline/index.ts`

Retirer les blocs `anecdote` et `riddle` du pipeline (ils seront gérés côté client).

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `src/components/admin/EnrichmentPipelineCard.tsx` | Appels directs client-side pour anecdotes + riddles après l'orchestrateur |
| `supabase/functions/enrichment-pipeline/index.ts` | Retirer les étapes anecdote et riddle |

## Résultat attendu

- Les 4 premières étapes passent via l'orchestrateur (~30s max)
- Les anecdotes tournent en boucle côté client, batch par batch, sans limite de temps
- Progress en temps réel pour chaque batch traité
- Les 786 POIs restants seront traités progressivement

