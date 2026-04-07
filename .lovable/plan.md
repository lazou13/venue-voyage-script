

# Plan : Corriger l'affichage des enrichissements dans les visites

## Diagnostic racine

Après investigation approfondie, **trois problèmes distincts** empêchent l'enrichissement d'apparaître :

### Problème 1 : `start-instance` n'a jamais été redéployé
Les modifications ajoutées (fallback library via `library_poi_id`) ne sont pas actives en production. La fonction doit être redéployée.

### Problème 2 : "Place des Ferblantiers" n'existe pas dans `medina_pois`
Ce POI n'a pas d'entrée dans la bibliothèque, donc même le fallback `library_poi_id` ne peut rien récupérer. Il semble que certains POIs sélectionnés pour les quêtes n'ont pas de correspondance dans la bibliothèque.

### Problème 3 : Le contenu générique vient du `step_config`
Quand un POI n'a ni enrichissement propre, ni correspondance library, le player affiche le texte `story_i18n` du `step_config` — qui contient des phrases génériques comme "Ce lieu fait partie du riche patrimoine de la médina de Marrakech..."

## Corrections

### 1. Redéployer `start-instance`
Déployer la edge function pour activer le fallback library déjà codé.

### 2. Améliorer le fallback dans `start-instance` : recherche par nom
Pour les POIs **sans** `library_poi_id`, ajouter un fallback par **nom approximatif** :
```
Si library_poi_id est null → chercher dans medina_pois par nom ILIKE
```
Cela permet de rattraper les POIs créés manuellement qui correspondent à un POI de la bibliothèque.

### 3. Ne pas afficher le bloc "Histoire du lieu" avec du contenu générique
Dans `QuestPlay.tsx`, ajouter un filtre pour ne pas afficher `historyContext` s'il contient des phrases génériques connues (< 100 caractères ou contient "Ce lieu fait partie du riche patrimoine"). Mieux : ne montrer les blocs narratifs que si le contenu provient effectivement de la bibliothèque (pas du step_config).

### 4. Ajouter "Place des Ferblantiers" et POIs manquants à la bibliothèque
Optionnel mais recommandé : vérifier quels POIs utilisés dans les quêtes n'ont pas de correspondance dans `medina_pois` et les créer.

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `supabase/functions/start-instance/index.ts` | Fallback par nom si `library_poi_id` est null ; redéployer |
| `src/pages/QuestPlay.tsx` | Filtrer le contenu générique des blocs narratifs |

## Impact
- Les visites B2B existantes avec `library_poi_id` bénéficieront immédiatement des enrichissements après redéploiement
- Les POIs sans `library_poi_id` auront un rattrapage par nom
- Plus de texte générique affiché comme "histoire du lieu"

