

# Doubler les POIs — Couverture 100% médina (même bbox)

## Situation actuelle
- **Bbox** : `lat [31.6245–31.638]`, `lng [-7.995–-7.975]`
- **Grille** : pas de 200m (`0.0018° lat`, `0.0025° lng`) → ~72 points
- **Rayon** : 300m
- **Types** : 18
- **Résultat** : ~448 POIs

## Stratégie (même zone, plus de découvertes)

### 1. Densifier la grille : 200m → 100m
Réduire le pas à `0.0009° lat` / `0.0012° lng` (~100m). Passe de ~72 à ~280 points de scan. Les ruelles et derbs cachés de la médina ont des POIs que la grille actuelle ne capte pas.

### 2. Réduire le rayon : 300m → 150m
Avec une grille 2× plus dense, un rayon plus petit donne des résultats plus ciblés et évite les doublons massifs.

### 3. Ajouter 8 types Google manquants
```
"park", "place_of_worship", "pharmacy", "market",
"point_of_interest", "landmark", "travel_agency", "shopping_mall"
```
Total : 18 → 26 types. Beaucoup de fondouks, zaouïas et hammams sont classés `place_of_worship` ou `point_of_interest` chez Google.

### 4. Ajouter 15 key points supplémentaires
Couvrir les angles et zones denses non captées : Derb Dabachi, Riad Zitoun, Bab Debbagh, Dar el Bacha, Mouassine, etc.

## Fichier modifié

| Fichier | Changement |
|---------|-----------|
| `supabase/functions/poi-extract/index.ts` | Grille 100m, rayon 150m, 8 types ajoutés, 15 key points |

## Impact
- ~280 points × 26 types = ~7280 requêtes Google (vs ~1300 avant)
- L'extraction prendra plus de temps (~20-30 min)
- Les 448 POIs existants ne seront pas dupliqués (upsert sur `place_id`)
- Objectif réaliste : **800-1000 POIs** sur la même emprise médina

