
Objectif: le blocage ne vient probablement plus du code administrateur temporaire. Le vrai problème semble être un échec réseau avant même que la fonction compare le code.

Constat
- Le navigateur envoie bien un POST vers `admin-signup`, mais le résultat observé est `Failed to fetch`.
- La fonction `admin-signup` n’autorise actuellement que ces headers CORS: `authorization, x-client-info, apikey, content-type`.
- Or la requête réelle envoie aussi `x-supabase-client-platform: Windows` (et le client peut envoyer d’autres headers `x-supabase-client-*`).
- D’autres fonctions du projet autorisent déjà cette liste étendue de headers, ce qui confirme le pattern attendu.
- `verify_jwt = false` est déjà configuré pour `admin-signup`, donc ce n’est pas un problème d’authentification backend.
- Conclusion: changer le code admin temporaire ne peut pas résoudre ce cas, car la requête est probablement bloquée par le navigateur avant d’atteindre la logique `adminCode !== ADMIN_CODE`.

Plan de correction
1. Corriger le CORS de `admin-signup`
- Mettre à jour `supabase/functions/admin-signup/index.ts`
- Étendre `Access-Control-Allow-Headers` pour inclure les headers `x-supabase-client-*` comme dans les autres fonctions du projet.
- Ajouter explicitement `Access-Control-Allow-Methods: POST, OPTIONS` pour rendre le préflight plus robuste.

2. Garder le bon affichage des erreurs métier
- Conserver dans `src/pages/Auth.tsx` la logique qui priorise `res.data?.error`.
- Ajouter un fallback plus clair si l’échec est purement réseau, par exemple un message du type “Service d’inscription momentanément inaccessible” au lieu d’un message technique brut.

3. Revalider le flux complet
- Tester `/auth?mode=signup` avec un mauvais code: l’UI doit afficher `Code admin invalide`.
- Tester avec le code temporaire correct: le compte doit être créé puis connecté automatiquement.
- Tester avec un email déjà existant: l’UI doit afficher `Cet email est déjà enregistré`.

4. Prévoir un contournement si c’est urgent
- Si vous avez besoin d’entrer tout de suite dans l’admin sans attendre la correction, prévoir la création/mise à jour du compte côté backend comme solution temporaire.
- Ensuite revenir au flux normal via l’interface une fois le CORS corrigé.

Fichiers à mettre à jour
- `supabase/functions/admin-signup/index.ts`
- éventuellement `src/pages/Auth.tsx` pour améliorer le message de fallback réseau

Détails techniques
```text
Requête navigateur
  -> envoie x-supabase-client-platform
  -> preflight CORS
  -> header non autorisé par admin-signup
  -> navigateur bloque la requête
  -> UI reçoit "Failed to fetch" / "Failed to send a request..."
```

Résultat attendu après correction
- Vous n’aurez plus à “deviner” si le code admin est bon.
- Si le code est faux, le message exact s’affichera.
- Si le code temporaire est correct, l’inscription fonctionnera enfin normalement.
