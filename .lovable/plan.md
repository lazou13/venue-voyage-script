

## Plan : Corriger le declenchement premature de "Parcours termine"

### Probleme

Le guidage affiche immediatement "Parcours termine" parce que la logique de completion se base uniquement sur le pourcentage de progression le long de la polyline (>= 95%). Quand l'utilisateur est loin du parcours (test depuis un bureau par exemple), sa position GPS est projetee sur le point le plus proche de la polyline, qui peut etre la fin du trace. Resultat : 95%+ de suite, et le message de felicitation apparait.

### Solution

Ajouter des conditions supplementaires pour la completion :

1. **L'utilisateur doit etre sur le trace** (pas "hors trace", c'est-a-dire a moins de 30m de la polyline)
2. **L'utilisateur doit avoir progresse depuis le debut** : suivre une variable `maxProgressReached` qui ne s'incremente que quand l'utilisateur est on-track. Cela empeche un seul point GPS lointain de declencher la completion
3. **Un delai minimum** de quelques secondes apres l'ouverture du guidage pour eviter les faux positifs au demarrage

### Fichier a modifier

**`src/components/intake/RouteGuidanceView.tsx`**

Dans le composant `RouteGuidanceView` :

- Ajouter un `useRef` pour tracker le timestamp d'ouverture (`mountTimeRef`)
- Ajouter un `useState` pour le progres maximal valide (`validMaxProgress`)
- Modifier le `useEffect` qui met a jour `validMaxProgress` : ne l'incrementer que si l'utilisateur est on-track (distance < 30m)
- Modifier le calcul de `completionPercent` pour utiliser `validMaxProgress` au lieu du snap brut
- Modifier la condition de completion (ligne ~362) pour exiger :
  - `completionPercent >= 95`
  - `!isOffTrack` (l'utilisateur est bien sur le trace)
  - Au moins 10 secondes ecoulees depuis l'ouverture
  - `validMaxProgress > totalDistance * 0.5` (l'utilisateur a parcouru au moins 50% du trace de maniere validee)

### Impact

- Le "Parcours termine" ne s'affichera que si l'utilisateur a reellement parcouru le trace
- Aucun impact sur l'affichage de la carte ou les autres fonctionnalites
- La barre de progression continue de fonctionner normalement

