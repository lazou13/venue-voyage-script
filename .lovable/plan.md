

# Ajouter un ecran d'authentification et proteger les routes admin

## Contexte

Le fichier `src/pages/Auth.tsx` existe deja avec login, signup (code admin), et mot de passe oublie. Mais il n'est pas route dans `App.tsx` et les routes `/admin/*` ne sont pas protegees.

## Plan

### 1. Ajouter la route `/auth` dans App.tsx

Importer Auth.tsx en lazy et ajouter `<Route path="/auth" element={<Auth />} />`.

### 2. Creer un composant ProtectedRoute

Composant wrapper qui verifie `useAuth()` :
- Si loading : spinner
- Si pas de user : redirect vers `/auth`
- Si user : affiche children

### 3. Proteger les routes admin

Wrapper la route `/admin` avec `<ProtectedRoute>` dans App.tsx. Optionnellement proteger `/dashboard` et `/intake/:projectId` aussi.

### 4. Ajouter un bouton deconnexion dans AdminLayout

Ajouter un bouton dans le header admin qui appelle `signOut()` et redirige vers `/auth`.

## Fichiers modifies

| Fichier | Action |
|---------|--------|
| `src/App.tsx` | Ajouter route `/auth` + wrapper ProtectedRoute sur admin |
| `src/components/ProtectedRoute.tsx` | Nouveau — guard auth avec redirect |
| `src/pages/admin/AdminLayout.tsx` | Ajouter bouton deconnexion |

