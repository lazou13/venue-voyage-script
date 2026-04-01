

# Fix: Pipeline anecdote-enricher returns "undefined" error

## Diagnostic

The `enrichment-pipeline` orchestrator calls sub-functions via `fetch()` **without an Authorization header** (line 14-18). When it calls `anecdote-enricher`, the gateway rejects the unauthenticated request, returning an error. Since the error body doesn't contain a `.error` field, the log shows `⚠ undefined`.

Direct calls (via curl or the Supabase client SDK) work fine because they include the anon key automatically.

## Fix

Add the `Authorization` and `apikey` headers to the `callFn` function in `enrichment-pipeline/index.ts`, using `SUPABASE_ANON_KEY` (same pattern as `poi-pipeline/index.ts`).

### Changes in `supabase/functions/enrichment-pipeline/index.ts`

1. Add `SUPABASE_ANON_KEY` env variable at the top
2. Update `callFn` to include auth headers:
```ts
headers: {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
}
```

| Fichier | Changement |
|---------|-----------|
| `supabase/functions/enrichment-pipeline/index.ts` | Ajouter Authorization header dans `callFn` |

