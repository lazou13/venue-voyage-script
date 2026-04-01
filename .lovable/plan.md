

# Reset bibliothèque + Filtres medina + Visites uniquement

## Ce qui va etre fait

### 1. Purger la table `quest_library`
- `DELETE FROM quest_library` via l'outil insert pour vider toutes les visites polluees

### 2. Modifier `poi-auto-agent` — Phase 2

**Supprimer le mode `treasure_hunt`** de la generation automatique. Ne garder que `guided_tour` pour l'instant.

```
const MODES = ["guided_tour"];
```

**Ajouter un bounding box medina** sur la requete POI (lignes 198-204):
- `lat` entre 31.615 et 31.645
- `lng` entre -8.01 et -7.97

**Exclure les categories non culturelles** apres la requete:
```
restaurant, café, hotel, riad, tour_agency, travel_agency,
car_rental, pharmacy, bank, supermarket, gym, spa, generic,
equestrian, horseback
```

**Filtrer par distance max 1200m du hub** pour rester dans le quartier.

**Augmenter le score minimum** de 3 a 5 pour ne garder que les POIs de qualite.

### 3. Fichiers modifies

| Fichier | Changement |
|---------|-----------|
| Migration SQL (insert tool) | `DELETE FROM quest_library` |
| `supabase/functions/poi-auto-agent/index.ts` | Bounding box, exclusion categories, distance max 1.2km, mode guided_tour uniquement |

