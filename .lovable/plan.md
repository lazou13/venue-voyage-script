

# Régénérer toutes les anecdotes et histoires via Perplexity

## Situation actuelle

860 POIs ont déjà `history_context` et `local_anecdote` remplis. L'enricher actuel ne cible que les POIs où `local_anecdote IS NULL` et ne remplace pas `history_context` existant (ligne 106 : `if (!poi.history_context)`).

## Plan

### 1. Migration SQL — Remettre à zéro les champs
```sql
UPDATE medina_pois 
SET history_context = NULL, local_anecdote = NULL 
WHERE status NOT IN ('filtered', 'merged');
```

### 2. Modifier `anecdote-enricher/index.ts`
- Ajouter un paramètre `force: true` qui **écrase** les valeurs existantes
- Retirer la condition `if (!poi.history_context)` quand force est actif
- Augmenter le `batch_size` max à 20 (au lieu de 10) pour aller plus vite
- Toujours écrire `history_context` + `local_anecdote` sans vérifier l'existant en mode force

### 3. Lancer l'enrichissement
Après le reset, le pipeline existant (bouton dans `/admin/poi-pipeline`) ou des appels manuels successifs régénéreront les 860 POIs par lots de 10-20 via Perplexity sonar.

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| Migration SQL | `UPDATE medina_pois SET history_context = NULL, local_anecdote = NULL` |
| `supabase/functions/anecdote-enricher/index.ts` | Param `force`, retrait conditions de skip, batch max 20 |

