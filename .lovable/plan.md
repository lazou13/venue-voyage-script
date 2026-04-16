

# Plan : Nettoyage des doublons Jemaa el-Fna

## Constat

- **Koutoubia** : fusion terminée, aucune action nécessaire. POI principal `eec26470`, 3 doublons désactivés.
- **Jemaa el-Fna** : le POI principal hub est `11ad43a7` ("Djemaa el Fna", `is_start_hub: true`, `validated`), mais **5 doublons de la place elle-même** sont encore actifs.

## Doublons à désactiver

| UUID | Nom actuel | Status | Action |
|------|-----------|--------|--------|
| `71e3f93d` | Jemaa el-Fnaa | validated | `is_active = false` |
| `41581ee5` | Place jamaa lefna | filtered | `is_active = false` |
| `698cb526` | Jamaa lafna | filtered | `is_active = false` |
| `6d7f3e3f` | jem3 elfna | validated | `is_active = false` |
| `660a0d82` | Marrakesch: Jemaa El Fna | filtered | `is_active = false` |

Les autres entrées qui contiennent "Jemaa/Fna" sont des **commerces distincts** (restaurants, stands, hôtels, musée) et restent actifs.

## Étape unique

Exécuter un UPDATE SQL pour désactiver les 5 doublons :

```sql
UPDATE medina_pois
SET is_active = false, updated_at = now()
WHERE id IN (
  '71e3f93d-601e-49cd-8388-edd86efd5b08',
  '41581ee5-5ad4-4c21-9c25-2195f5cd5458',
  '698cb526-af1b-4907-af09-a2e9fc901a07',
  '6d7f3e3f-9dfe-4877-9682-8e544068ea3f',
  '660a0d82-2b90-4339-bcf0-717e99e46171'
);
```

## Vérification post-fusion

Confirmer que `11ad43a7` ("Djemaa el Fna") possède bien les audios et enrichissements nécessaires, sinon migrer les meilleures données des doublons avant désactivation (ex: `rating`, `reviews_count` le plus élevé).

## Fichiers modifiés

Aucun fichier source — uniquement une migration SQL.

