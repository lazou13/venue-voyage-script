

## Diagnostic : 0 POIs traduits

### Cause
Le code client dans `AdminPOIPipeline.tsx` (ligne 292) lit le champ `processed` ou `updated` dans la réponse, mais la fonction `n8n-proxy` retourne le champ **`translated`** :

```text
Client:   data?.processed ?? data?.updated ?? 0    → toujours 0
Serveur:  { ok: true, translated: 1, total: 1 }    → le bon champ est "translated"
```

La traduction fonctionne réellement (je viens de tester : 1 POI traduit avec succès), mais le compteur affiche toujours 0, et le `if (processed === 0) break;` arrête la boucle immédiatement après le premier batch.

### Correction

**Fichier : `src/pages/admin/AdminPOIPipeline.tsx`, ligne 292**

Ajouter `data?.translated` dans la lecture du compteur :

```typescript
// Avant
const processed = data?.processed ?? data?.updated ?? 0;

// Après
const processed = data?.translated ?? data?.processed ?? data?.updated ?? 0;
```

Changement d'une seule ligne. Les 998 POIs en attente de traduction seront ensuite traités correctement par la boucle auto-loop.

