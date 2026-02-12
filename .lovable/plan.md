

## Correction : Les modifications admin ne se sauvegardent pas

### Cause racine

Le hook `useAppConfig()` est instancie **deux fois separement** :
- Dans `AdminLayout.tsx` (boutons Sauvegarder / Publier)
- Dans `AdminEnums.tsx` (edition des valeurs)

Chaque instance a son propre etat local. Quand on modifie un enum dans `AdminEnums`, l'instance de `AdminLayout` ne le detecte pas. Le bouton "Sauvegarder" reste desactive car `hasUnsavedChanges` est toujours `false` cote layout.

### Solution : React Context partage

Creer un **AppConfigContext** qui encapsule une seule instance du hook et la partage entre le layout et toutes les sous-pages admin.

### Fichiers modifies

**1. Nouveau : `src/contexts/AppConfigContext.tsx`**
- Creer un React Context + Provider qui appelle `useAppConfig()` une seule fois
- Exporter un hook `useAppConfigContext()` pour consommer le contexte

**2. Modifier : `src/pages/admin/AdminLayout.tsx`**
- Encapsuler le `<Outlet>` dans le `<AppConfigProvider>`
- Remplacer l'appel direct `useAppConfig()` par `useAppConfigContext()`

**3. Modifier : `src/pages/admin/AdminEnums.tsx`**
- Remplacer `useAppConfig()` par `useAppConfigContext()`

**4. Modifier les autres pages admin** (`AdminPresets.tsx`, `AdminFields.tsx`, `AdminRules.tsx`, `AdminLabels.tsx`, `AdminPublish.tsx`)
- Si elles utilisent `useAppConfig()`, les migrer vers `useAppConfigContext()` pour coherence

### Schema de la solution

```text
AdminLayout
  |-- AppConfigProvider  (une seule instance de useAppConfig)
  |     |
  |     |-- Header (boutons Save/Publish via useAppConfigContext)
  |     |-- Outlet
  |           |-- AdminEnums (lecture/ecriture via useAppConfigContext)
  |           |-- AdminFields (lecture/ecriture via useAppConfigContext)
  |           |-- etc.
```

### Resultat attendu
- Les modifications dans n'importe quelle sous-page admin sont immediatement visibles par le header (badge "Modifications non sauvegardees" + bouton Sauvegarder actif)
- Le bouton Sauvegarder fonctionne et persiste les changements en base
- Le bouton Publier est accessible apres une sauvegarde reussie

