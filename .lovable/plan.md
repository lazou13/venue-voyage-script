

# Plan : Corriger le matching des noms FR/EN pour les POIs

## Constat

"Place des Ferblantiers" existe dans `medina_pois` sous le nom anglais "Tinsmiths Square" (id: `5e741c86-...`). Le fallback par nom dans `start-instance` utilise `ILIKE` sur le champ `name`, qui contient le nom Google (anglais). Il ne cherche pas dans `name_fr`.

C'est un problème systémique : beaucoup de POIs ont leur nom Google en anglais, mais les projets B2B utilisent les noms français.

## Corrections

### 1. Mettre à jour le `name_fr` de "Tinsmiths Square"
- `UPDATE medina_pois SET name_fr = 'Place des Ferblantiers' WHERE id = '5e741c86-...'`
- Vérifier et corriger les autres POIs du Mellah qui ont des noms anglais sans `name_fr`.

### 2. Améliorer le fallback dans `start-instance`
Actuellement le fallback cherche uniquement `ILIKE` sur `name`. Modifier pour chercher aussi dans `name_fr` et `name_en` :
```
.or(`name.ilike.%${searchName}%,name_fr.ilike.%${searchName}%,name_en.ilike.%${searchName}%`)
```
Cela résout le problème pour tous les POIs, pas seulement Ferblantiers.

### 3. Batch fix : remplir les `name_fr` manquants
Identifier les POIs validés/enrichis qui ont un `name` anglais mais pas de `name_fr`, et les corriger (au moins les monuments majeurs).

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `supabase/functions/start-instance/index.ts` | Fallback ILIKE étendu à `name_fr` et `name_en` |
| Base de données (insert tool) | `name_fr` de Tinsmiths Square → Place des Ferblantiers + autres POIs clés |

