

# Plan : Support des preuves externes dans `client-feedback`

## Résumé

La migration `source_project` est déjà faite. Il reste 3 actions :

1. **Ajouter le secret `EXTERNAL_FEEDBACK_KEY`** — clé API partagée entre HP et QR Pro
2. **Modifier `client-feedback/index.ts`** — accepter le header `x-feedback-key` + body `source_project` comme alternative au `access_token`
3. **Modifier `AdminClientFeedback.tsx`** — afficher la source et permettre le filtrage

## Détail technique

### 1. Secret `EXTERNAL_FEEDBACK_KEY`
Vous devrez entrer une clé secrète (chaîne aléatoire, ~32 caractères). QR Pro utilisera cette même clé dans son header `x-feedback-key`.

### 2. Edge Function `client-feedback` — double auth

Logique modifiée :
- Si `body.access_token` présent → mode interne (existant, résolution instance)
- Si header `x-feedback-key` présent + `body.source_project` → mode externe :
  - Valider la clé contre `EXTERNAL_FEEDBACK_KEY`
  - Pas de résolution d'instance
  - Insérer avec `source_project` rempli, `quest_instance_id = null`
- CORS : ajouter `x-feedback-key` dans `Access-Control-Allow-Headers`

### 3. Admin — source visible
- Afficher badge "QR Pro" / "Interne" sur chaque photo et recommandation
- Ajouter un filtre par source (tous / interne / externe)

### Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| Secret `EXTERNAL_FEEDBACK_KEY` | Créer |
| `supabase/functions/client-feedback/index.ts` | Double auth (token OU clé API) |
| `src/pages/admin/AdminClientFeedback.tsx` | Badge source + filtre |

