

## Plan : Corriger l'Autopipeline

### Problèmes identifiés

1. **Noms de fonctions incorrects** dans `AdminPOIPipeline.tsx` (ligne 457-460) :
   - `enrich` appelle `poi-enrich` → devrait être `poi-enricher`
   - `clean` et `merge` appellent `poi-pipeline` → cette fonction n'existe pas. La logique clean/merge est dans `admin-run-cleanup` (SQL functions)
   
2. **Auth cassée dans `enrichment-pipeline`** : utilise encore `ANON_KEY` pour appeler d'autres fonctions (même bug que `poi-auto-agent`)

3. **`extract` échoue** probablement à cause d'un timeout ou d'une erreur réseau (à vérifier après correction des noms)

### Corrections

**Fichier : `src/pages/admin/AdminPOIPipeline.tsx`**

1. Corriger le mapping des noms de fonctions (lignes 457-460) :
   - `enrich` → `poi-enricher`
   - `clean` → appeler `admin-run-cleanup` avec `{ action: "clean" }` (ou exécuter directement la SQL function `clean_low_quality_pois` via RPC)
   - `merge` → appeler `admin-run-cleanup` avec `{ action: "merge" }` (ou RPC `merge_duplicate_pois`)

2. Ajouter `invokeWithRetry` pour les étapes extract, enrich, clean, merge (comme déjà fait pour anecdotes/fun-facts) afin de gérer les erreurs réseau transitoires

**Fichier : `supabase/functions/enrichment-pipeline/index.ts`**

3. Remplacer `ANON_KEY` par `SERVICE_ROLE_KEY` dans les appels internes (lignes 11, 19) — même correction que pour `poi-auto-agent`

### Vérification des étapes clean/merge

Il faut vérifier si `admin-run-cleanup` gère les actions clean et merge, ou si ce sont des RPC SQL directes. Si ce sont des fonctions SQL (`clean_low_quality_pois`, `merge_duplicate_pois`), les étapes clean/merge doivent appeler `supabase.rpc()` directement côté client au lieu d'invoquer une Edge Function.

### Résultat attendu

L'autopipeline exécutera les 11 étapes sans erreur 404 ni "Failed to send".

