

## Plan : Corriger l'authentification agent → n8n-proxy et lancer la traduction

### Problème identifié

L'agent `poi-auto-agent` appelle `n8n-proxy` avec le `ANON_KEY` en Bearer token. Or `n8n-proxy` n'accepte que :
1. Un header `x-api-key` correspondant à `N8N_API_KEY`
2. Un JWT d'un utilisateur admin Supabase

Le `ANON_KEY` n'est ni l'un ni l'autre → **401 Unauthorized** → `translated: 0` → l'agent s'arrête immédiatement.

**Preuve** : l'appel direct via curl (avec auth admin) fonctionne et traduit 2 POIs correctement.

### Correction

**Fichier** : `supabase/functions/poi-auto-agent/index.ts` (lignes 262-275)

Remplacer `ANON_KEY` par `SERVICE_ROLE_KEY` pour l'appel interne à `n8n-proxy`. C'est le même pattern que `n8n-proxy` utilise déjà pour appeler `poi-auto-agent` (ligne 66).

```typescript
// Avant (ligne 263)
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Après
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
```

Et dans le fetch (ligne 273-274) :
```typescript
'Authorization': `Bearer ${SERVICE_KEY}`,
'apikey': SERVICE_KEY,
```

**Mais** cela ne suffira pas car `n8n-proxy` vérifie un JWT utilisateur admin, pas un service_role key. Il faut aussi ajouter une 3ème méthode d'auth dans `n8n-proxy` :

**Fichier** : `supabase/functions/n8n-proxy/index.ts` (après ligne 44)

Ajouter la reconnaissance du service_role :
```typescript
// Method 3: Service role key (for internal edge-function-to-edge-function calls)
if (!isAuthed && authHeader?.startsWith("Bearer ")) {
  const token = authHeader.replace("Bearer ", "");
  if (token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    isAuthed = true;
  }
}
```

### Après correction

Redéployer les deux fonctions et lancer l'agent. Les 803+ POIs manquant de `name_en` et autres champs EN seront traduits automatiquement par le cron toutes les 15 minutes (~200 POIs/cycle).

### État actuel des traductions (827 POIs actifs)

| Champ | Rempli | Manquant |
|-------|--------|----------|
| name_en | 24 | **803** |
| history_context_en | 367 | 460 |
| local_anecdote_en | 572 | 255 |
| fun_fact_en | 599 | 228 |
| riddle_easy_en | 299 | 528 |
| wikipedia_summary_en | 1 | 826 |
| story_en | 1 | 826 |

