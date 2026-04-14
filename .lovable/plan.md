

## Plan : Accélérer l'agent autonome

### Constat

- **477 POIs** encore sans traduction EN (sur 827 actifs)
- **16/15 visites** générées (bibliothèque complète)
- Agent enrichissement (Phase 1) : terminé
- **Cron actuel** : toutes les **heures** — trop lent pour 477 traductions à 5/batch = ~95 cycles nécessaires

### Goulots d'étranglement identifiés

| Problème | Actuel | Cible |
|----------|--------|-------|
| Fréquence cron | 1x/heure | **toutes les 15 min** |
| Traductions par cycle | 10 batches × 5 = 50 max | **20 batches × 5 = 100 max** |
| Délai entre batches traduction | 2 secondes | **800ms** |
| Visites par cycle | 1 seule (`break` après la 1ère) | Pas de changement (bibliothèque déjà complète) |

### Modifications

#### 1. Edge Function `poi-auto-agent/index.ts`

**Phase 2.5 (traductions)** — lignes 266-288 :
- Augmenter la boucle de `10` à `20` itérations
- Réduire le délai entre batches de `2000ms` à `800ms`
- Augmenter `batch_size` de `5` à `10`

Résultat : jusqu'à **200 POIs traduits par cycle** au lieu de 50.

#### 2. Cron : passer de 1x/heure à toutes les 15 minutes

Mettre à jour le job cron existant (jobid 2) pour le schedule `*/15 * * * *`.

#### 3. Ajout d'un log de synthèse à la fin

Ajouter un résumé clair du travail restant pour le monitoring.

### Résultat attendu

- Les 477 POIs manquants seront traduits en **~3-4 heures** au lieu de ~4 jours
- Le monitoring dans les logs sera plus lisible

