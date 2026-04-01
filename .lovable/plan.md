

# Fix: Pipeline anecdote-enricher timeout + "undefined" error

## Deux bugs identifiés

### Bug 1 — Timeout
Le pipeline appelle `anecdote-enricher` avec `batch_size: 20`. Chaque POI prend ~3-4s (1.5s délai + appel Perplexity). 20 POIs = 60-80s, ce qui dépasse le timeout de 55s dans `callFn`.

### Bug 2 — Message d'erreur "undefined"
Quand `callFn` catch un timeout, il retourne `{ ok: false, error: "timeout", data: {} }`. Mais ligne 78, le pipeline lit `(r.data as any)?.error` — qui est `undefined` car l'erreur est dans `r.error`, pas `r.data.error`.

## Fix dans `supabase/functions/enrichment-pipeline/index.ts`

1. **Réduire le batch_size** pour anecdote-enricher de 20 à **5** (5 × 3s = 15s, bien sous les 55s)
2. **Corriger le message d'erreur** : lire `r.error || (r.data as any)?.error || 'unknown'` au lieu de `(r.data as any)?.error`
3. **Même fix pour riddle-generator** (même pattern de code)
4. **Augmenter les itérations** de 10 à 40 pour compenser le batch plus petit (5 × 40 = 200 POIs max par run)

### Code modifié (ligne 78)

```ts
// Avant
const r = await callFn('anecdote-enricher', { batch_size: 20, min_score: 0 });
if (!r.ok) { log.push(`  ⚠ ${(r.data as any)?.error}`); break; }

// Après  
const r = await callFn('anecdote-enricher', { batch_size: 5, min_score: 0 });
if (!r.ok) { log.push(`  ⚠ ${(r as any).error || (r.data as any)?.error || 'unknown'}`); break; }
```

| Fichier | Changement |
|---------|-----------|
| `supabase/functions/enrichment-pipeline/index.ts` | batch_size 20→5 pour anecdotes, fix error logging, augmenter itérations |

