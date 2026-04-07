
Objectif: oui, l’interface `/auth` est bien prévue pour créer un compte administrateur, mais dans son état actuel je ne vous recommanderais pas de dépendre du clic sur l’onglet “Inscription” tant que le bug “page blanche” n’est pas corrigé.

Plan de correction

1. Stabiliser l’état d’authentification
- Remplacer les appels isolés à `useAuth()` par un état d’auth partagé (provider ou hook “auth ready” unique).
- Attendre explicitement que la session soit restaurée avant toute redirection.
- Éviter les courses entre `Auth`, `ProtectedRoute` et `AdminLayout`, qui recréent aujourd’hui chacun leur propre écouteur.

2. Rendre l’écran d’auth plus robuste
- Remplacer le changement d’onglet purement local par un mode piloté par l’URL, par exemple `/auth?mode=signup`, pour pouvoir ouvrir directement l’inscription sans dépendre du composant Tabs.
- Garder les 3 vues `login / signup / forgot`, mais avec une navigation explicite et plus simple.
- Ajouter un fallback visuel local sur la page d’auth pour éviter une page blanche complète si un sous-composant plante.

3. Corriger les routes manquantes/incomplètes
- Ajouter la route publique `/reset-password`, car la page existe déjà mais n’est pas branchée dans `App.tsx`.
- Vérifier que la redirection après connexion et après reset revient vers un écran valide.

4. Sécuriser réellement l’accès admin
- Le guard actuel vérifie seulement qu’un utilisateur est connecté.
- Ajouter la vérification du rôle admin avant d’ouvrir `/admin/*`, sinon tout utilisateur authentifié pourrait entrer dans le back-office.
- Prévoir un écran clair “accès refusé” ou un retour vers `/auth`.

5. Prévoir un contournement immédiat
- Si vous avez besoin de l’accès sans attendre la correction UI, garder la possibilité de créer le compte admin côté backend comme solution de secours.
- Une fois le bug corrigé, revenir au flux normal via `/auth`.

Fichiers à mettre à jour
- `src/hooks/useAuth.ts`
- `src/App.tsx`
- `src/pages/Auth.tsx`
- `src/components/ProtectedRoute.tsx`
- éventuellement un nouveau provider d’auth partagé
- éventuellement une petite error boundary dédiée à l’auth

Détails techniques
- Le symptôme ne ressemble pas à une erreur métier de l’inscription elle-même, mais plutôt à un problème de rendu/redirect non protégé: la page n’a actuellement aucune barrière contre un crash React local.
- Le code montre aussi une auth incomplète: `ResetPassword.tsx` existe, mais aucune route `/reset-password` n’est déclarée.
- Le point sécurité est indépendant du bug blanc mais doit être corrigé en même temps: `/admin` ne doit pas être protégé uniquement par “user connecté”.

Validation à faire après implémentation
- Ouvrir directement `/auth?mode=signup`
- Basculer entre connexion / inscription / mot de passe oublié
- Créer un compte admin avec le code
- Vérifier la connexion automatique après création
- Recharger la page après connexion
- Tester la déconnexion
- Tester le reset password
- Vérifier le flux sur le domaine publié, pas seulement en preview
