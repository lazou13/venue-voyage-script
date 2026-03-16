

## Plan : Ajouter le type de projet "Bibliothèque"

### Objectif
Nouveau type de projet dédié uniquement à l'enrichissement de la bibliothèque de POIs. Il n'affiche que l'onglet **Parcours** (RouteReconStep) — pas de Core, pas de Terrain, pas d'Étapes, pas de Règles, pas d'Exports.

### Modifications

**1. `src/types/intake.ts`**
- Ajouter `'library'` au type `ProjectType`
- Ajouter l'entrée dans `PROJECT_TYPE_LABELS` : `library: 'Bibliothèque'`

**2. `src/pages/IntakeForm.tsx`**
- Ajouter `library` dans `TYPE_STEPS` : `library: [{ id: 'route_recon', label: 'Parcours', component: RouteReconStep }]`
- Conditionner l'affichage : pour le type `library`, ne pas afficher `CORE_STEPS` ni `COMMON_STEPS` — seulement l'onglet Parcours
- Ajuster le `useMemo` pour que `steps` soit uniquement `TYPE_STEPS[projectType]` quand `projectType === 'library'`, sinon la logique actuelle
- Définir `activeTab` par défaut à `'route_recon'` quand le type est `library`

**3. `src/components/CreateProjectDialog.tsx`**
- Ajouter l'icône `Library` (lucide-react) pour le type `library` dans `TYPE_ICONS`

**4. Base de données (app_configs)**
- Ajouter `{ id: 'library', label: 'Bibliothèque', name_label: 'Nom de la bibliothèque' }` dans `enums.project_types` du payload capabilities publié

