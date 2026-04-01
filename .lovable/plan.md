

# Fix: Toutes les visites sont identiques

## Diagnostic

Le problème est dans la logique de sélection des POIs (Phase 2 de l'agent). Actuellement :

1. On prend **tous les POIs culturels** (67 après exclusion des restos/riads/hôtels)
2. On filtre par audience — mais quand il y a moins de 5 résultats, **on retombe sur la liste complète**
3. On trie par **distance du hub** et on prend les **8 plus proches**

Résultat : les 8 plus proches de Koutoubia sont toujours les mêmes (Koutoubia Museum, Bahri Palace, Park Arsat, etc.), quel que soit l'audience.

## Solution

### Déléguer la sélection des POIs à l'IA

Au lieu du tri naïf par distance, **envoyer la liste complète des POIs culturels à Gemini Pro** et lui demander de choisir les 6-8 meilleurs pour chaque combinaison hub/audience, en tenant compte de :
- La **cohérence thématique** (foodies → souks alimentaires + artisans + places animées)
- La **diversité** des catégories (pas 3 musées d'affilée)
- L'**ordre de visite logique** (proximité géographique pour un parcours fluide)
- Les **tags d'audience** enrichis en Phase 1

### Changements dans `poi-auto-agent/index.ts` — Phase 2

1. **Supprimer** le tri par distance + `slice(0, 8)` 
2. **Envoyer tous les POIs culturels** (jusqu'à 67) au prompt Gemini Pro avec leurs coordonnées, catégories, audience_tags, route_tags, instagram_score
3. **Demander à l'IA** de sélectionner 6-8 POIs et de les ordonner en parcours cohérent via tool calling (retourner les `poi_id` choisis dans l'ordre)
4. **Fusionner** les deux appels IA (sélection + titre/description) en un seul appel pour gagner du temps
5. **Ajouter une contrainte** : les POIs déjà utilisés dans une visite du même hub sont dépréciés (pas exclus, mais signalés à l'IA pour favoriser la diversité)

### Purger les visites existantes

Exécuter `DELETE FROM quest_library` pour repartir de zéro avec la nouvelle logique.

### Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `supabase/functions/poi-auto-agent/index.ts` | Phase 2 : sélection IA des stops + fusion appels |
| Migration SQL | `DELETE FROM quest_library` |

