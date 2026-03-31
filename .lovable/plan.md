

# Fix: Extraction POI timeout — pagination par batch de types

## Probleme
La function `poi-extract` tente ~280 points × 26 types = ~7280 requetes Google en un seul appel. Timeout garanti.

## Solution
Ajouter une pagination par types dans la function: accepter `type_offset` et `types_per_batch` (defaut: 3). Cote client, ajouter un mode auto-loop qui enchaine les appels automatiquement.

### 1. `supabase/functions/poi-extract/index.ts`
- Lire `type_offset` (defaut 0) et `types_per_batch` (defaut 3) depuis le body
- Ne traiter que `TYPES.slice(type_offset, type_offset + types_per_batch)`
- Retourner `next_offset` dans la reponse si il reste des types a traiter
- ~280 points × 3 types = ~840 requetes par batch (~2-3 min, dans les limites)

### 2. `src/pages/admin/AdminPOIPipeline.tsx`
- Modifier le bouton "Extraire" pour boucler automatiquement:
  - Appeler `poi-extract` avec `type_offset: 0, types_per_batch: 3`
  - Si la reponse contient `next_offset`, relancer avec le nouvel offset
  - Afficher la progression dans les logs (ex: "Types 1-3/26...")
  - Ajouter un state `extractionProgress` pour la barre de progression

## Fichiers modifies

| Fichier | Changement |
|---------|-----------|
| `supabase/functions/poi-extract/index.ts` | Pagination par `type_offset` + `types_per_batch` |
| `src/pages/admin/AdminPOIPipeline.tsx` | Auto-loop extraction avec progression |

