

# Enrichir les POIs en photos — auto-loop pour poi-fetch-photos

## Etat actuel

| Metrique | Valeur |
|----------|--------|
| POIs actifs | 860 |
| Avec photo dans `poi_media` | 43 (5%) |
| Avec référence photo Google disponible | 805 (94%) |
| **A traiter** | **~760** |

La fonction `poi-fetch-photos` existe et fonctionne (batch de 20), mais il faut cliquer ~38 fois manuellement.

## Solution

Ajouter un **auto-loop** pour `poi-fetch-photos` dans `AdminPOIPipeline.tsx`, identique au pattern déjà utilisé pour backfill et classify :

| Fichier | Changement |
|---------|-----------|
| `src/pages/admin/AdminPOIPipeline.tsx` | Ajouter bouton "Photos Google (auto-loop)" qui boucle sur `poi-fetch-photos` jusqu'à `fetched: 0` |

Le loop appellera la fonction par batch de 20, avec pause de 2s entre chaque round, et s'arrêtera quand il n'y a plus de POIs éligibles. La barre de progression existante sera réutilisée.

