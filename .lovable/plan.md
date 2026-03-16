

## Plan : Ajouter l'onglet "Parcours" aux projets Site Touristique

### Problème
`TYPE_STEPS` est un `Record<ProjectType, single_step>` — chaque type de projet n'a qu'un seul onglet spécifique. Les projets `tourist_spot` n'ont que "Site Touristique", pas "Parcours".

### Solution
Modifier `TYPE_STEPS` pour accepter un **tableau** de steps par type de projet au lieu d'un seul step.

**Fichier : `src/pages/IntakeForm.tsx`**

1. Changer `TYPE_STEPS` de `Record<ProjectType, single_step>` en `Record<ProjectType, single_step[]>`
2. Pour `tourist_spot`, inclure les deux tabs : `[TouristSpotStep, RouteReconStep]`
3. Pour `establishment`, garder `[EstablishmentStep]`
4. Pour `route_recon`, garder `[RouteReconStep]`
5. Ajuster le `useMemo` (ligne 83-90) pour faire un spread du tableau au lieu d'insérer un seul step

Changement minimal (~10 lignes modifiées), aucun autre fichier impacté.

