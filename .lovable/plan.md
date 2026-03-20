

## Plan : Export schéma + données vers le projet Supabase externe

### Objectif
Générer deux fichiers SQL que vous pourrez exécuter dans le SQL Editor du dashboard Supabase du projet `xaccaoedtbwywjotqhih` :
1. **Schema complet** — toutes les tables, types, fonctions, triggers, RLS, vues, index, storage buckets
2. **Données** — export CSV/SQL des tables peuplées (medina_pois, app_configs, poi_media, etc.)

### Étapes

**1. Générer `schema_export.sql`** (fichier unique consolidé)
- Concaténer les 38 migrations dans l'ordre chronologique en un seul fichier SQL idempotent
- Retirer les instructions spécifiques à Lovable Cloud qui pourraient poser problème (ex: `pg_cron`, `pg_net` qui doivent être activés manuellement)
- Ajouter des commentaires de section pour la lisibilité
- Écrire dans `/mnt/documents/schema_export.sql`

**2. Exporter les données via `psql`**
- Tables à exporter (celles contenant des données) :
  - `medina_pois` (~421 POIs)
  - `app_configs` (capabilities, pricing, experience_page_config)
  - `poi_media` (références médias)
  - `projects`, `pois`, `avatars`, `orders`, `quest_instances`
  - `import_batches`, `route_traces`, `route_markers`
- Format : CSV par table dans `/mnt/documents/data_export/`
- Générer aussi un fichier `data_import.sql` avec les `COPY` ou `INSERT` statements

**3. Livrer les fichiers**
- `/mnt/documents/schema_export.sql` — à exécuter en premier dans le SQL Editor
- `/mnt/documents/data_export/` — CSVs + script d'import

### Notes techniques
- Les extensions `postgis`, `pgrouting`, `uuid-ossp` doivent être activées manuellement dans le projet cible (Dashboard > Database > Extensions)
- `pg_cron` et `pg_net` ne sont pas disponibles sur tous les plans Supabase — le script les rendra optionnels
- Le storage bucket `poi-media` et `fieldwork` devront être créés manuellement dans le dashboard Storage du projet cible
- Les edge functions ne sont pas transférables automatiquement — elles restent liées à Lovable Cloud

