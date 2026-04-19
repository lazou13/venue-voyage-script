

## Diagnostic

L'outil `merge_pois` n'est pas cassé techniquement. Le vrai problème est triple :

1. **L'agent hallucine les UUIDs.** Dans les logs : `f8b13926c04f4699ae7067823fb7966f` (sans tirets) et `3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e3e` (id bidon). Ces ids n'existent pas en base — vérification SQL faite : aucun POI Jemaa el-Fna ne porte ces ids.
2. **Le vrai POI canonique** de Djemaa el Fna est `11ad43a7-4776-4c2b-99b0-d7f99e7c5dce` (celui où on a mis les 4 audios), pas `f8b13926...`.
3. **`merge_pois` n'utilise pas `.maybeSingle()` ni ne valide les ids** : si Postgres rejette le format UUID ou si la liste est vide, l'erreur est avalée silencieusement et renvoyée comme texte → l'agent croit que "l'outil est cassé" et le dit à l'utilisateur.

## Plan de correction

### 1. Renforcer `merge_pois` côté edge function
- Valider chaque id avec une regex UUID stricte avant tout appel SQL.
- Vérifier que `canonical_id` existe réellement (`select id from medina_pois where id = ...`). Sinon renvoyer une erreur claire `canonical_id introuvable`.
- Vérifier que tous les `duplicate_ids` existent et sont **différents** de `canonical_id`. Sinon renvoyer la liste des manquants.
- Renvoyer une erreur explicite si Postgres échoue (au lieu d'avaler).
- Idem garde-fou UUID dans `update_poi`, `set_poi_status`, `delete_poi`, `generate_audio`, `enrich_poi`, `translate_poi_fields`, `fetch_photos`.

### 2. Forcer l'agent à utiliser de vrais ids
- Ajouter une règle au system prompt : *"Avant tout merge/delete/update, tu DOIS appeler `find_duplicates({name})` ou `query_pois({name})` pour récupérer les vrais UUIDs. Ne jamais inventer ni reconstruire un UUID. Toujours utiliser le format avec tirets renvoyé par les outils."*
- Ajouter une règle : *"Quand tu présentes une fusion à confirmer, copie-colle les UUIDs exacts retournés par les outils."*

### 3. Lister les vrais doublons de Jemaa el-Fna
Une fois la fonction renforcée, refaire `find_duplicates({name: "jemaa", radius_m: 50})` autour de `11ad43a7` (Djemaa el Fna canonique, lat 31.6259, lng -7.9890), et présenter la vraie liste avant fusion. À première vue, candidats légitimes :
- `71e3f93d-601e-49cd-8388-edd86efd5b08` "Jemaa el-Fnaa" (même GPS exactement)
- `660a0d82-2b90-4339-bcf0-717e99e46171` "Marrakesch: Jemaa El Fna" (10m)
- `fb1b47a5-941c-4838-bf97-c417558065e3` "Stand Place Jemaa El Fna No.75" (à vérifier)

Les autres ("Hotel Cecil", "Calèches", "Centre Commercial", "Chez Lamine", "Riad jemaa") sont des établissements distincts à NE PAS fusionner.

## Fichier impacté

- `supabase/functions/agent-chat/index.ts` (validations UUID + system prompt durci).

Aucun autre fichier touché.

## Résultat attendu

- Plus d'hallucination silencieuse : si l'agent envoie un mauvais id, il reçoit immédiatement une erreur explicite et corrige.
- Les vrais doublons de Djemaa el Fna pourront être fusionnés dans `11ad43a7` après ta confirmation.

