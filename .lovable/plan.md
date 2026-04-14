

## Plan : Supprimer les noms arabes des POIs

### Approche

Créer un script SQL + Edge Function en deux temps :

### Étape 1 — Noms mixtes (Latin + Arabe) : nettoyage SQL direct

Pour les POIs dont le `name` contient à la fois des caractères latins et arabes (ex: "Shawarma Bab Alhara شاورما باب الحارة"), une migration SQL supprimera la partie arabe et conservera la partie latine :

```sql
UPDATE medina_pois 
SET name_ar = name,  -- sauvegarder l'original en name_ar
    name = regexp_replace(name, '[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]+', '', 'g'),
    name = trim(regexp_replace(name, '\s+', ' ', 'g'))
WHERE name ~ '[\u0600-\u06FF]' 
  AND name ~ '[a-zA-ZÀ-ÿ]';
```

### Étape 2 — Noms 100% arabes : traduction IA puis remplacement

Pour les ~30-40 POIs dont le nom est entièrement en arabe, ajouter un bouton "Traduire noms arabes" dans le pipeline (ou exécuter via un script one-shot) qui :
1. Sélectionne les POIs où `name ~ '[\u0600-\u06FF]'` (ceux qui restent après l'étape 1)
2. Sauvegarde le nom actuel dans `name_ar`
3. Appelle la fonction `translate` existante (from: `ar`, to: `fr`) pour obtenir un nom français
4. Met à jour `name` avec la traduction et `name_fr` avec la même valeur

### Étape 3 — Sécurité future dans le pipeline d'extraction

Dans `poi-extract` ou le code d'import, ajouter un filtre post-import qui applique automatiquement la même logique (strip arabe des mixtes, flag les purs arabes pour traduction).

### Fichiers modifiés

1. **Migration SQL** — Nettoyage des noms mixtes + sauvegarde en `name_ar`
2. **`src/pages/admin/AdminPOIPipeline.tsx`** — Ajout d'une étape "Nettoyer noms arabes" qui traduit les noms purement arabes restants via l'Edge Function `translate`

### Résultat attendu

- 0 nom en arabe dans la colonne `name`
- Les noms arabes originaux préservés dans `name_ar`
- Les noms traduits en français dans `name` et `name_fr`

