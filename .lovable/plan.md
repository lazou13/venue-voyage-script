

# État actuel et plan : Preuves externes

## Constat

L'endpoint `client-feedback` est déployé et fonctionne (HP, projet `dtwqmrmtzfhczvjggmct`). Les tables `quest_photos` et `client_poi_recommendations` sont vides (0 entrées).

**Limitation actuelle** : l'endpoint exige un `access_token` lié à une `quest_instances` de HP. Or QR Pro a ses propres sessions — ses preuves (`proofs`) n'ont pas de token HP. Le pont ne fonctionne pas pour les preuves externes.

## Plan : Support des preuves externes

### 1. Ajouter un mode `source: "external"` à `client-feedback`
- **Fichier** : `supabase/functions/client-feedback/index.ts`
- Accepter un champ `source_project` (ex: `"questrides-pro"`) comme alternative à `access_token`
- Valider via un secret partagé `EXTERNAL_FEEDBACK_KEY` (clé API simple)
- Si `source_project` + clé valide → insérer directement sans résolution d'instance
- Ajouter un champ `source_project` aux inserts (`quest_photos`, `client_poi_recommendations`)

### 2. Migration : ajouter colonne `source_project`
- `ALTER TABLE quest_photos ADD COLUMN source_project text DEFAULT NULL`
- `ALTER TABLE client_poi_recommendations ADD COLUMN source_project text DEFAULT NULL`
- Permet de distinguer les feedbacks internes (HP) des externes (QR Pro, Questride)

### 3. Configurer le secret partagé
- Ajouter un secret `EXTERNAL_FEEDBACK_KEY` via l'outil secrets
- QR Pro enverra ce secret dans un header `x-feedback-key`

### 4. Mettre à jour la page admin
- **Fichier** : `src/pages/admin/AdminClientFeedback.tsx`
- Afficher la source (interne/QR Pro) dans les cartes photos et recommandations
- Filtrer par source

### Fichiers impactés

| Fichier | Action |
|---------|--------|
| `supabase/functions/client-feedback/index.ts` | Ajouter auth par clé API pour sources externes |
| Migration SQL | Ajouter `source_project` aux 2 tables |
| `src/pages/admin/AdminClientFeedback.tsx` | Afficher/filtrer par source |

