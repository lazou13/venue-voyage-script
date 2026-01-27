
# Correction : Redirection des routes Admin

## Problème identifié

La route `/admin/config` (ligne 27 dans App.tsx) pointe toujours vers l'ancien éditeur JSON `AdminConfig.tsx`. Quand vous naviguez vers `/admin/config`, vous voyez l'ancien éditeur, pas le nouveau panneau admin.

Les nouvelles routes (`/admin/enums`, `/admin/publish`) fonctionnent, mais vous êtes actuellement sur `/admin/config` qui affiche l'ancien composant.

## Solution

### 1. Supprimer la route `/admin/config` et rediriger vers le nouveau panneau

**Fichier : `src/App.tsx`**

Remplacer :
```typescript
<Route path="/admin/config" element={<AdminConfig />} />
```

Par une redirection vers le nouveau panneau :
```typescript
<Route path="/admin/config" element={<Navigate to="/admin/enums" replace />} />
```

### 2. Supprimer l'import inutile

Retirer :
```typescript
import AdminConfig from "./pages/AdminConfig";
```

### 3. (Optionnel) Supprimer l'ancien fichier

Après validation, supprimer `src/pages/AdminConfig.tsx` qui n'est plus utilisé.

## Résultat attendu

| URL actuelle | Comportement après fix |
|--------------|------------------------|
| `/admin/config` | Redirige vers `/admin/enums` |
| `/admin` | Redirige vers `/admin/enums` |
| `/admin/enums` | Affiche le nouveau panneau Enums avec sidebar |
| `/admin/publish` | Affiche le nouveau panneau Publish avec sidebar |

## Fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| `src/App.tsx` | Remplacer la route `/admin/config` par une redirection, supprimer l'import `AdminConfig` |
| `src/pages/AdminConfig.tsx` | Supprimer (optionnel, après validation) |

## Test

1. Aller sur `/admin/config` → devrait rediriger vers `/admin/enums`
2. Voir le nouveau panneau avec la sidebar à gauche (Enums, Publier)
3. Cliquer sur "Publier" dans la sidebar → affiche `/admin/publish`
