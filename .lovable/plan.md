
# Patch Minimal : OutputsStep.tsx

## Objectif
Corriger les dépendances useEffect instables et optimiser la query traces.

## Modifications (3 changements)

### 1. Ajouter clé stable (après L36)
```typescript
// Après ligne 36:
const isRouteRecon = projectType === 'route_recon';

// Ajouter:
const projectLoadedId = project?.id ?? null;
```

### 2. Ajouter .limit(20) à la query (L54)
```typescript
// Ligne 54 actuelle:
.order('created_at', { ascending: false });

// Devient:
.order('created_at', { ascending: false })
.limit(20);
```

### 3. Modifier dépendances useEffect (L124)
```typescript
// Ligne 124 actuelle:
}, [projectId, isRouteRecon, project]);

// Devient:
}, [projectId, isRouteRecon, projectLoadedId]);
```

## Justification

| Changement | Raison |
|------------|--------|
| `projectLoadedId` | Clé stable (string ou null) au lieu de référence objet. L'effet se déclenche uniquement quand project.id change (null → chargé). |
| `.limit(20)` | Évite de charger des centaines de traces. On cherche la plus récente valide, 20 suffit. |
| Deps array | Élimine les re-renders inutiles causés par nouvelles références `project`. |

## Comportement après patch

1. **Refresh direct** : project = null → projectLoadedId = null → effect skip
2. **Project charge** : projectLoadedId passe de null à "b06ba6b7-..." → effect run
3. **Re-render sans changement** : projectLoadedId stable → effect skip (pas de boucle)

## Tests à exécuter

1. `/intake/b06ba6b7-0b2c-45c2-b955-3783c1611df1` → Exports → Rapport → vérifie trace chargée
2. Cliquer "Ouvrir le Rapport Interactif" → carte Leaflet visible
3. Projet sans traces → empty state
4. Projet establishment → pas d'onglet Rapport
5. Network tab: 1 seul fetch traces (pas de boucle)
