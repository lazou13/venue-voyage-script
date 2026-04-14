

## Plan : Persistance de l'Autopipeline + Agent de complétude EN

### Problème 1 : L'autopipeline perd son état quand on navigue

L'autopipeline utilise uniquement `useState` — tout est perdu dès qu'on quitte la page `/admin/poi-pipeline`. Impossible de savoir si elle tourne encore.

**Solution** : Persister l'état du pipeline dans la base de données via une table `pipeline_runs`, et afficher un bandeau de statut permanent.

### Problème 2 : Pas d'agent qui vérifie la complétude EN

Le `poi-auto-agent` ne vérifie pas du tout si les champs EN sont remplis. Il faudrait ajouter une phase qui détecte les POIs avec du contenu FR mais sans EN, et lance la traduction automatiquement.

---

### Modifications techniques

#### 1. Migration — table `pipeline_runs`

```sql
CREATE TABLE pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'running', -- running, completed, failed
  current_step text,
  completed_steps text[] DEFAULT '{}',
  total_steps integer DEFAULT 0,
  logs text[] DEFAULT '{}',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  error_message text
);
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
-- Admin-only policy
```

#### 2. `src/pages/admin/AdminPOIPipeline.tsx`

- Au montage, vérifier si un `pipeline_runs` avec `status = 'running'` existe → afficher un bandeau "Autopipeline en cours (étape X/11)"
- Quand l'autopipeline démarre : insérer une ligne dans `pipeline_runs`
- À chaque étape terminée : mettre à jour `current_step` et `completed_steps`
- En fin : marquer `status = 'completed'` ou `'failed'`
- Ajouter un polling (5s) sur le run actif pour mettre à jour l'UI même après navigation

#### 3. `supabase/functions/poi-auto-agent/index.ts` — Phase 2.5 : Complétude EN

Ajouter une nouvelle phase après le taggage audience :

```
Phase 2.5 : Complétude traductions EN
- Sélectionner les POIs validés ayant history_context mais pas history_context_en
  (ou local_anecdote_fr sans local_anecdote_en, riddle_easy sans riddle_easy_en, etc.)
- Appeler la fonction n8n-proxy action=translate_pois en batch
- Logger le nombre de POIs traduits
```

Cela garantit que le cron horaire rattrape automatiquement tout contenu FR non traduit.

#### 4. Bandeau de statut persistant

Dans `AdminPOIPipeline.tsx`, en haut de page, afficher un bandeau conditionnel :
- 🟢 "Autopipeline terminé il y a X min" si dernière run complétée récemment
- 🔵 "Autopipeline en cours — étape Anecdotes (8/11)" si un run est actif
- Bouton "Voir les logs" qui ouvre les logs du dernier run

### Résultat

1. Naviguer ailleurs et revenir montre toujours l'état réel de l'autopipeline
2. L'agent autonome (cron) traduit automatiquement tout contenu FR manquant en EN
3. Le dashboard EN se remplit progressivement sans intervention manuelle

