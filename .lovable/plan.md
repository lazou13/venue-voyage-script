
Objectif

Faire en sorte que les visites B2B affichent réellement les histoires et anecdotes enrichies, y compris pour les projets déjà créés.

Diagnostic

- L’enrichissement est bien stocké dans `medina_pois`.
- Les visites B2B lisent surtout `pois` via `start-instance`.
- `start-instance` ne renvoie aujourd’hui que `id, sort_order, name, step_config, zone, interaction`.
- Le player B2B (`QuestPlay` / `POIDetail`) affiche surtout `story_i18n` / `contentI18n` du `step_config`.
- Lors de l’import depuis la bibliothèque, les champs narratifs enrichis ne sont pas copiés dans `pois`.

Résultat : on enrichit la bibliothèque admin, mais le player B2B ne consomme pas ces champs, donc histoire/anecdote n’apparaissent pas.

Plan

1. Corriger la source de données du player B2B
- Étendre `start-instance` pour renvoyer aussi :
  `library_poi_id`, `history_context`, `local_anecdote_fr`, `local_anecdote_en`, `fun_fact_fr`, `fun_fact_en`, `price_info`, `opening_hours`, `must_see_details`, `must_try`, `must_visit_nearby`.
- Ajouter un fallback backend : si ces champs sont vides dans `pois`, les récupérer depuis `medina_pois` via `library_poi_id`.
- Effet immédiat : les projets B2B existants profitent des enrichissements déjà saisis aujourd’hui.

2. Corriger l’affichage dans la visite B2B
- Mettre à jour `usePlayInstance` pour transporter ces champs.
- Mettre à jour `QuestPlay` / `POIDetail` pour afficher de vrais blocs :
  - Histoire du lieu
  - Anecdote
  - Le saviez-vous ?
  - Infos pratiques
  - À proximité
- Garder un ordre de fallback propre :
  1. contenu spécifique projet (`story_i18n` / `contentI18n`)
  2. données snapshot dans `pois`
  3. fallback bibliothèque injecté par `start-instance`

3. Corriger l’import pour les futurs projets
- Dans `src/hooks/usePOIs.ts`, quand un POI est importé depuis `medina_pois`, copier aussi les champs enrichis dans `pois`.
- Faire la même chose dans `supabase/functions/public-generate-quest/index.ts` pour les projets générés automatiquement.
- Effet : les nouveaux projets embarquent directement leur contenu enrichi.

4. Gérer correctement la langue
- Utiliser `instance.locale` pour choisir FR / EN pour anecdote et fun fact.
- Garder FR en fallback si la traduction demandée est absente.

5. Vérification
- Tester un projet B2B existant avec un POI enrichi aujourd’hui.
- Tester un nouveau projet créé après import depuis la bibliothèque.
- Vérifier qu’aucun bloc vide n’est affiché et que les textes changent bien selon la langue.

Fichiers ciblés

- `supabase/functions/start-instance/index.ts`
- `src/hooks/usePlayInstance.ts`
- `src/pages/QuestPlay.tsx`
- `src/hooks/usePOIs.ts`
- `supabase/functions/public-generate-quest/index.ts`

Détail technique

- Pas de migration nécessaire : les colonnes existent déjà dans `pois`.
- Le bug n’est pas dans l’enrichissement lui-même ; il est dans la propagation des données vers `pois` et dans le rendu du player B2B.
