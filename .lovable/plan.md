

# Plan : Synchroniser les données enrichies vers Questride et rafraîchir le tour

## Situation actuelle

- **Hunt Planer Pro** (ce projet) : 1047 POIs enrichis avec `local_anecdote_fr`, `history_context`, etc.
- **Questride** : le code `quest-proxy` est prêt (SELECT + mapping + refresh-tour OK), mais sa base `medina_pois` n'a probablement PAS les données enrichies
- Le tour FLDJJK affiche du texte générique car les colonnes sont NULL dans la base Questride

## Ce qu'il faut faire

### 1. Créer une edge function `sync-pois-export` dans CE projet

Crée un endpoint qui exporte les données enrichies de `medina_pois` au format JSON, pour import dans Questride.

Champs exportés : `name`, `name_fr`, `name_en`, `lat`, `lng`, `local_anecdote_fr`, `local_anecdote_en`, `history_context`, `fun_fact_fr`, `fun_fact_en`

L'endpoint retourne un JSON avec les 1047 POIs enrichis.

### 2. Prompt pour Questride : importer les données + rafraîchir FLDJJK

Générer un prompt à coller dans [Questride](/projects/2ddd67c2-8d34-44b4-8ee5-58859040580b) qui :

1. **Crée une edge function `sync-pois-import`** qui accepte le JSON exporté et fait un UPSERT dans sa propre `medina_pois` (matching par `name` + coordonnées GPS)
2. **Appelle `refresh-tour` avec le code FLDJJK** pour régénérer les données du tour avec les POIs fraîchement importés

### 3. Alternative plus simple : script SQL direct

Exporter les données enrichies en SQL INSERT/UPDATE statements et les exécuter directement via une migration dans Questride. Plus rapide, pas besoin d'edge function.

## Fichiers modifiés

| Fichier | Projet | Changement |
|---|---|---|
| `supabase/functions/sync-pois-export/index.ts` | Hunt Planer Pro | Nouveau endpoint d'export |
| Prompt pour Questride | Questride | Import des données + refresh-tour FLDJJK |

## Résultat attendu

Après sync + refresh-tour :
- "Place des Ferblantiers" affichera l'histoire des ferblantiers juifs du Mellah et la légende du chamelier Si Mohammed
- Les 1047 POIs enrichis seront disponibles pour toutes les futures visites B2B
- Les tours existants pourront être rafraîchis via `refresh-tour`

