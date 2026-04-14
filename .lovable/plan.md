

## Plan : Ajouter les colonnes EN manquantes à SYNC_COLS dans api-v2

### Problème

`SYNC_COLS` dans `api-v2/index.ts` (ligne 139) n'expose pas les champs EN traduits par Phase 2.5 : `history_context_en`, `riddle_easy_en`, `wikipedia_summary_en`, `story_fr`, `story_en`.

QRP ne peut donc pas les importer lors de la synchronisation.

### Modification

**Fichier** : `supabase/functions/api-v2/index.ts` (ligne 139)

Ajouter à la fin de `SYNC_COLS` :
- `history_context_en`
- `riddle_easy_en`
- `wikipedia_summary_en`
- `story_fr`
- `story_en`

Résultat :
```
const SYNC_COLS = `id, name, name_fr, name_en, name_ar, ..., enrichment_status, history_context_en, riddle_easy_en, wikipedia_summary_en, story_fr, story_en`;
```

Puis redéployer la fonction `api-v2`.

### Côté QRP

Le plan QRP est correct — il devra ajouter ces mêmes champs dans `SYNC_FIELDS` de son côté. Mais ça se fait dans le projet QRP, pas ici.

