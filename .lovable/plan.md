

## Plan : Login inline dans l'admin (stop les redirections /auth)

### Contexte
- Vous êtes bloqué sur `/auth` à chaque refresh ou expiration
- `ProtectedRoute` ligne 21 fait `Navigate to="/auth"` dès que `user` est null
- `AuthContext` appelle `getSession()` avant `onAuthStateChange()` (race condition)
- Bonne nouvelle : les traductions EN sont quasi-complètes (1008/1008 name_en, 1000/1008 history_context_en)

### Corrections (3 fichiers)

**1. `src/contexts/AuthContext.tsx`**
- Inverser l'ordre : `onAuthStateChange` d'abord, `getSession()` ensuite (recommandation Supabase officielle)
- Empêche les faux états "déconnecté" au refresh

**2. `src/components/ProtectedRoute.tsx`**
- Remplacer `<Navigate to="/auth">` par un formulaire de connexion inline compact
- Email + mot de passe directement dans la page admin courante
- Après connexion réussie, l'utilisateur reste sur sa route (`/admin/poi-pipeline`, etc.)
- Plus jamais de perte de contexte

**3. `src/pages/admin/AdminLayout.tsx`**
- Bouton déconnexion redirige vers `/` au lieu de `/auth`

### Résultat
- Zéro redirection vers `/auth` depuis l'admin
- Session restaurée correctement au refresh
- Si session expire : formulaire de reconnexion sur place
- Sécurité backend (RLS) inchangée

