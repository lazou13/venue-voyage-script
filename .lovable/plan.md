

# Fix: Page admin blanche (erreur 503)

## Diagnostic

Le serveur de développement retourne une erreur **503** sur `main.tsx`, ce qui empêche tout chargement de l'application. Après inspection du code :

- `EnrichmentPipelineCard.tsx` : syntaxe OK, pas d'erreur
- `enrichment-pipeline/index.ts` : syntaxe OK
- `AdminPOIPipeline.tsx` : imports OK
- `App.tsx`, `main.tsx` : pas de changement, syntaxe OK

Le 503 n'est **pas causé par les modifications récentes**. C'est un crash/redémarrage du serveur de développement Vite.

## Solution

Forcer un redémarrage propre du dev server en faisant une modification mineure dans un fichier source (par exemple, ajouter/retirer un commentaire ou un espace dans `src/main.tsx`), ce qui déclenchera un rebuild complet.

Si le problème persiste après ça, on supprimera l'import inutilisé `useCallback` dans `EnrichmentPipelineCard.tsx` (ligne 1) pour éliminer toute cause possible.

| Fichier | Changement |
|---------|-----------|
| `src/main.tsx` | Ajout d'un commentaire pour forcer un rebuild |
| `src/components/admin/EnrichmentPipelineCard.tsx` | Retirer `useCallback` de l'import (inutilisé) |

