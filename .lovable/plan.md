
# Plan : Corriger les clics sur les langues et rendre l'écriture fluide

## Problemes identifiés

### 1. Checkboxes des langues ne cliquent pas bien
Le composant `EnumCheckboxGroup` a été corrigé pour le conteneur (`<div role="button">`), mais la checkbox Radix elle-même a `onCheckedChange={() => {}}` - elle ne fait rien quand on clique directement dessus.

### 2. L'écriture n'est pas fluide
Chaque frappe dans un champ texte (titre, histoire, notes, objectifs, contraintes) déclenche immédiatement :
- `updateProject.mutate()` ou `updateCoreDetails()`
- Un appel réseau vers Supabase
- Un toast "Sauvegardé"

Resultat : lag, curseur qui saute, perte de caractères lors de la frappe rapide.

### 3. Race conditions sur les mutations
Les mutations `updateProject` (useProject.ts) et `updatePOI` (usePOIs.ts) n'ont pas de mise a jour optimiste. Entre deux clics rapides, l'UI n'a pas encore recu la nouvelle valeur du backend, donc le 2e clic ecrase le 1er.

## Solution proposée

### A. Corriger le clic direct sur les checkboxes

**Fichier : `src/components/intake/shared/EnumCheckboxGroup.tsx`**

Changer :
```tsx
onCheckedChange={() => {}}
```
Par :
```tsx
onCheckedChange={() => handleToggle(typedKey)}
```

Ainsi cliquer sur la petite case OU sur le chip fonctionne. Le `stopPropagation` empeche le double-toggle.

### B. Ajouter du debounce sur les champs texte

**Nouveau fichier : `src/hooks/useDebounce.ts`**

Hook simple pour debouncer les valeurs :
```tsx
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

**Fichier : `src/components/intake/CoreStep.tsx`**

Modifier les champs texte pour utiliser un etat local + debounce :
- Titre i18n : etat local qui se synchronise apres 500ms
- Histoire i18n : idem
- Objectifs business : idem
- Contraintes : idem
- Duree/Difficulte : idem

Architecture :
```text
[Input local] --frappe--> [localValue] --500ms--> [updateProject.mutate()]
```

**Fichier : `src/components/intake/shared/I18nInput.tsx`**

Modifier pour accepter un mode "controlled with debounce" :
- Ajouter un etat local pour la valeur en cours de frappe
- Synchroniser avec la prop `value` quand elle change depuis l'exterieur
- Appeler `onChange` seulement apres 500ms d'inactivite

### C. Ajouter des mises a jour optimistes

**Fichier : `src/hooks/useProject.ts`**

Ajouter sur `updateProject` mutation :
```tsx
onMutate: async (updates) => {
  await queryClient.cancelQueries({ queryKey: ['project', projectId] });
  const previousProject = queryClient.getQueryData(['project', projectId]);
  
  queryClient.setQueryData(['project', projectId], (old: Project | null) => 
    old ? { ...old, ...updates } : old
  );
  
  return { previousProject };
},
onError: (err, updates, context) => {
  if (context?.previousProject) {
    queryClient.setQueryData(['project', projectId], context.previousProject);
  }
},
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: ['project', projectId] });
},
```

**Fichier : `src/hooks/usePOIs.ts`**

Meme pattern pour `updatePOI` :
```tsx
onMutate: async ({ id, ...updates }) => {
  await queryClient.cancelQueries({ queryKey: ['pois', projectId] });
  const previousPois = queryClient.getQueryData(['pois', projectId]);
  
  queryClient.setQueryData(['pois', projectId], (old: POI[] | undefined) => 
    old?.map(poi => poi.id === id ? { ...poi, ...updates } : poi) || []
  );
  
  return { previousPois };
},
onError: (err, updates, context) => {
  if (context?.previousPois) {
    queryClient.setQueryData(['pois', projectId], context.previousPois);
  }
},
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: ['pois', projectId] });
},
```

## Fichiers a modifier

| Fichier | Changement |
|---------|------------|
| `src/components/intake/shared/EnumCheckboxGroup.tsx` | Activer onCheckedChange sur Checkbox |
| `src/hooks/useDebounce.ts` | Nouveau - hook debounce |
| `src/components/intake/shared/I18nInput.tsx` | Ajouter etat local + debounce interne |
| `src/components/intake/CoreStep.tsx` | Utiliser debounce pour les champs texte |
| `src/hooks/useProject.ts` | Ajouter optimistic update sur updateProject |
| `src/hooks/usePOIs.ts` | Ajouter optimistic update sur updatePOI |

## Verification apres implementation

### Test des checkboxes langues
1. Aller sur l'onglet Quete (Core)
2. Dans la section Langues, cliquer sur la case "English"
3. Verifier qu'elle se coche instantanement
4. Cliquer rapidement sur "Espanol" puis "Darija"
5. Les 3 doivent rester cochees

### Test de l'ecriture fluide
1. Dans "Titre de la quete", taper rapidement "Mon super titre"
2. Le texte doit s'afficher sans lag ni saut de curseur
3. Attendre 500ms - le toast "Sauvegarde" apparait
4. Recharger la page - le titre est bien sauvegarde

### Test des etapes (Terrain)
1. Ouvrir une etape en mode edition
2. Cliquer rapidement sur 3 types d'etape differents
3. Les 3 doivent rester coches
4. Taper dans le champ Notes rapidement
5. Pas de lag, sauvegarde apres 500ms d'inactivite
