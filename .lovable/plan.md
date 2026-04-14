

## Plan : Ajouter "Générer anecdotes" et "Traduire EN" au Pipeline POI

### Approche

Ajouter deux nouvelles actions dans la section "Actions manuelles" de `AdminPOIPipeline.tsx`. Chaque action appellera `n8n-proxy` via `supabase.functions.invoke` (qui injecte automatiquement l'anon key), avec un auto-loop client-side par batch de 5 jusqu'à épuisement.

### Modifications

**Fichier : `src/pages/admin/AdminPOIPipeline.tsx`**

1. Ajouter `"fun-facts"` et `"translate-en"` au type `StepKey`
2. Ajouter deux cas dans `runStep()` :
   - `fun-facts` : boucle appelant `n8n-proxy` avec `{"action": "generate_fun_facts", "batch_size": 5}`, compteur via `data.processed` ou `data.updated`, arrêt quand 0
   - `translate-en` : boucle appelant `n8n-proxy` avec `{"action": "translate_pois", "batch_size": 5}`, même logique
3. Ajouter deux boutons dans la grille d'actions manuelles avec icônes appropriées (Sparkles pour anecdotes, Languages pour traductions)
4. Toast de succès avec total traité, toast d'erreur en cas d'échec

### Détails techniques

- Utilisation de `supabase.functions.invoke("n8n-proxy", { body })` — pas besoin de gérer manuellement l'API key, le SDK injecte l'anon key
- **Correction** : `n8n-proxy` utilise `x-api-key` (pas le Bearer token). Il faudra passer par `fetch` directement avec le header `apikey` ET vérifier si le proxy accepte aussi l'anon key comme auth alternative, OU ajouter un fallback dans le proxy pour accepter l'auth Supabase standard
- Auto-loop avec délai de 2s entre batches pour éviter le rate limiting
- Logs en temps réel dans le panneau existant

