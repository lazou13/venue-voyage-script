

## Plan : Fix QuestEngine — remplir max_stops et réduire food_break guided

### Fichier unique à modifier
`supabase/functions/generate-quest/QuestEngine.ts`

### Correction 1 — Réduire visit_time food_break en guided_tour
Dans `VISIT_TIME_GUIDED`, baisser :
- `restaurant`: 30 → **15**
- `cafe`: 20 → **12**

Un food_break en guided_tour n'est pas un dîner gastronomique — 15 min suffisent pour une pause.

### Correction 2 — trimToFitDuration trop agressif
Actuellement l'algo trie les POIs par score, calcule le temps total, et retire des POIs par le bas jusqu'à rentrer dans le budget. Le problème : il ne tente pas de garder `max_stops` POIs.

Modifier la logique de `trimToFitDuration` :
1. Après le trim actuel, si le nombre de POIs restants < `maxStops` et qu'il reste de la marge temps, **ne pas retirer** le POI suivant
2. Ajouter un paramètre `maxStops: number` à `trimToFitDuration`
3. Dans la boucle de trim : ne retirer un POI que si `pois.length > maxStops` OU si `totalMin > maxDurationMin - 5`
4. Après la boucle : si on est sous le budget mais sous `maxStops`, essayer de réinjecter des POIs retirés (les moins scorés) tant que le budget le permet

### Correction 3 — Limiter les doublons de catégorie food
Dans la sélection des POIs (avant le tri), si `include_food_break` est true, ne garder qu'**un seul** POI de catégorie restaurant/cafe. Actuellement le scoring peut sélectionner 2 restaurants, gaspillant le budget.

### Résultat attendu
- treasure_hunt 90min : 6 stops, ≤ 85 min
- guided_tour 90min : 5-6 stops, ≤ 85 min
- Un seul food_break max par parcours

### Vérification
- Recompiler TypeScript (0 erreurs)
- Relancer les deux curls pour valider

