

## Plan : Retirer l'authentification (temporaire)

### Problème
Toutes les tables sont protégées par des politiques RLS qui exigent le rôle `admin`. Sans authentification, aucune opération CRUD ne fonctionne (création de projet, etc.).

### Modifications prévues

**1. `src/App.tsx` — Supprimer les routes auth**
- Retirer les routes `/auth` et `/reset-password`
- Retirer les imports `Auth` et `ResetPassword`

**2. Migration SQL — Ouvrir toutes les tables**

Exécuter une migration qui, pour chaque table concernée, supprime les politiques restrictives et les remplace par une politique ouverte :

```sql
-- Pour chaque table : projects, pois, route_traces, route_markers,
-- wifi_zones, forbidden_zones, avatars, medina_pois, poi_media,
-- orders, quest_instances, quest_instance_devices, quest_narratives_cache,
-- app_configs, user_roles

ALTER TABLE public.<table> DISABLE ROW LEVEL SECURITY;
```

Désactiver RLS entièrement est plus propre que de créer des politiques "allow all" — ça évite toute ambiguïté.

**3. Fichiers conservés sans modification**
- `src/hooks/useAuth.ts`, `src/pages/Auth.tsx`, `src/pages/ResetPassword.tsx` — restent dans le code mais ne sont plus accessibles via le routeur. Pas de risque de casse d'imports.

### Impact
- Accès anonyme complet en lecture/écriture sur toutes les tables
- La création de projet et toutes les opérations admin fonctionneront immédiatement
- Réversible : une future migration pourra réactiver RLS + politiques

