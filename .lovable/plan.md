

# Fix: Agent "Failed to send a request to the Edge Function"

## Diagnostic

L'erreur "Failed to send a request to the Edge Function" est causée par un **timeout**. En mode turbo, l'agent fait :
1. Phase 1 : appel Gemini Flash pour 50 POIs (~15s)
2. Phase 2 : appel Gemini Pro pour 1 visite (~30s)
3. Répète 3 fois (turbo)

Total : ~2-3 minutes, ce qui dépasse le timeout par défaut des edge functions (60s pour Supabase). De plus, le calcul `totalVisitsPossible` affiche encore `3 × 5 × 2 = 30` au lieu de `3 × 5 × 1 = 15`.

## Solution

### 1. Supprimer le mode turbo côté edge function

Le turbo cause des timeouts. A la place, **boucler côté client** — le bouton "Forcer une exécution" appellera l'agent 3 fois séquentiellement avec des logs progressifs.

Dans `poi-auto-agent/index.ts` :
- Retirer la boucle turbo (`MAX_LOOPS`)
- Chaque appel = 1 cycle (Phase 1 + Phase 2), ~30-45s max

### 2. Boucler côté client dans `AgentMonitoringCard.tsx`

```
runAgent():
  for 3 loops:
    invoke("poi-auto-agent")
    append logs
    if no work done → break
```

### 3. Corriger `totalVisitsPossible`

`3 * 5 * 1 = 15` (plus `* 2` puisqu'on ne fait que `guided_tour`)

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `supabase/functions/poi-auto-agent/index.ts` | Supprimer boucle turbo, 1 cycle par appel |
| `src/components/admin/AgentMonitoringCard.tsx` | Boucle 3x côté client, fix total visites = 15 |

