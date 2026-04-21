

# Diagnostic — /admin ne se charge pas

## Cause probable

**Backend Lovable Cloud temporairement indisponible.** La récupération metadata a échoué côté plateforme avec :
> `request failed with status 544: Connection terminated due to connection timeout`

Conséquence côté UI :
- `AuthContext` appelle `supabase.rpc('has_role', ...)` au montage.
- L'appel **n'aboutit jamais** (timeout réseau / instance backend qui ne répond pas).
- `isAdminLoading` reste `true` indéfiniment.
- `ProtectedRoute` affiche le spinner en boucle → **page admin jamais rendue**.

Confirmation indirecte :
- Console : aucune erreur applicative bloquante (juste warnings React Router + forwardRef).
- Session replay : navigation `/` → `/admin` → spinner visible, aucune interaction possible.
- Edge functions (api-v2, n8n-proxy, poi-auto-agent) : uniquement des cycles boot/shutdown normaux, pas d'erreur d'exécution récente.

## Action immédiate (sans patch)

1. **Vérifier l'état du backend Cloud** via `cloud_status` pour confirmer si l'instance est en `COMING_UP`, `RESTARTING`, `ACTIVE_UNHEALTHY` ou autre état non-`ACTIVE_HEALTHY`.
2. **Si non-healthy** : attendre le retour à `ACTIVE_HEALTHY` (quelques minutes typiquement). Recharger la page `/admin` ensuite. Aucun changement de code requis.
3. **Si `ACTIVE_HEALTHY`** : le timeout est ponctuel. Hard-refresh navigateur (Cmd+Shift+R) pour relancer `has_role`.

## Robustesse à ajouter (patch léger, optionnel)

Pour éviter qu'un timeout backend bloque toute la page admin à l'avenir :

**Fichier** : `src/contexts/AuthContext.tsx`

Ajouter un **timeout de garde** sur l'appel `has_role` (5s) :
- Si la RPC ne répond pas en 5s → `setIsAdmin(false)` + `setIsAdminLoading(false)` + log console.
- L'utilisateur voit alors la page « Accès refusé » au lieu d'un spinner infini, ce qui rend le problème diagnosticable et permet de retenter manuellement.

Optionnellement : ajouter un bouton « Réessayer » dans `ProtectedRoute` quand `isAdminLoading` dure plus de 5s, pour relancer la vérification sans recharger toute la page.

## Périmètre

- **N'affecte pas LOT 1B / batch 1** en cours.
- **N'affecte pas LOT 1C** en préparation.
- Patch optionnel : ~10 lignes dans `AuthContext.tsx` + `ProtectedRoute.tsx`. À approuver explicitement si vous voulez le filet de sécurité.

## Prochaine étape

Confirmer si vous voulez :
- **A** : juste attendre le retour à la normale du backend (rien à faire côté code) ;
- **B** : appliquer le patch timeout pour éviter le spinner infini à l'avenir ;
- **C** : les deux (attendre + appliquer le patch dès que /admin redevient accessible).

