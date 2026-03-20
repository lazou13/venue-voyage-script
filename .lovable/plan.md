

## Import du schéma et données dans le projet externe

### Contrainte technique
Je n'ai accès qu'à la base Lovable Cloud (`dtwqmrmtzfhczvjggmct`). Je **ne peux pas** écrire directement dans le projet externe `xaccaoedtbwywjotqhih` — il n'est pas connecté à cet environnement.

### Ce que je peux faire

**Option A — Vous guider étape par étape** (recommandé)

Les fichiers sont déjà prêts dans `/mnt/documents/` :
1. Ouvrir le SQL Editor du dashboard Supabase de `xaccaoedtbwywjotqhih`
2. Activer les extensions : `postgis`, `pgrouting`, `uuid-ossp` (Database > Extensions)
3. Copier-coller le contenu de `schema_export.sql` dans le SQL Editor → Run
4. Pour les données, exécuter depuis un terminal local :
   ```
   psql "postgresql://postgres:MOT_DE_PASSE@db.xaccaoedtbwywjotqhih.supabase.co:5432/postgres" -f data_import.sql
   ```

**Option B — Script d'import via edge function**

Je peux créer une edge function dans Lovable Cloud qui :
1. Lit les données depuis la base Lovable Cloud
2. Les envoie via l'API REST du projet externe (nécessite la `service_role_key` du projet cible)

Cela nécessiterait que vous me fournissiez la clé `service_role_key` du projet `xaccaoedtbwywjotqhih`.

### Recommandation

L'Option A est la plus simple et sécurisée. Les fichiers sont déjà générés — il suffit de les exécuter dans le dashboard Supabase externe.

