

# Fix: Afficher tous les POIs sur la carte (pas limité à 500)

## Problème
La requête dans `HomePage.tsx` a un `.limit(500)` en dur. Or la base contient **1064 POIs actifs** avec coordonnées. Le compteur affiche "500 lieux" au lieu de "1064 lieux".

## Solution

**Fichier : `src/pages/HomePage.tsx`**

1. Augmenter la limite de `500` à `2000` (marge pour la croissance future)
2. Le compteur `{pois.length} lieux` (ligne 208) est déjà dynamique — il s'ajustera automatiquement

| Ligne | Avant | Après |
|-------|-------|-------|
| 70 | `.limit(500)` | `.limit(2000)` |

Un seul caractère à changer. Le compteur reflètera immédiatement les 1064 POIs.

