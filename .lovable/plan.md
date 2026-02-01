
Objectif : faire fonctionner “Lancer le Guidage” sans crash “Uncaught TypeError: r is not a function”.

## Diagnostic (ce que je sais / ce que ça signifie)
- Le log utilisateur montre `TypeError: r is not a function` avec un stack qui passe par `updateContextConsumer` (React DOM). Ce pattern correspond très souvent à **un problème de React Context “cassé”** (le Consumer reçoit un enfant qui n’est pas une fonction), ce qui arrive en pratique quand on a :
  1) **Deux instances de React** dans le bundle (le plus fréquent), ou
  2) Une lib qui ré-exporte / bundle React de manière inattendue, ou
  3) Un composant (ici react-leaflet) évalué avec un runtime React différent.
- Dans le repo, `react-leaflet` est bien en **4.2.1** (compatible React 18) et `@react-leaflet/core` en **2.1.0** (compatible React 18). Donc le “v5 incompatible React 19” n’est plus la cause.
- Le fichier `vite.config.ts` ne force pas la dé-duplication de React. Or Vite + certaines dépendances peuvent provoquer une **duplication** (notamment via prebundle/optimizeDeps), ce qui est exactement le type d’erreur observée.

## Plan de correction (implémentation)
### 1) Forcer une seule instance de React dans Vite (correctif principal)
**Fichier :** `vite.config.ts`

- Ajouter `resolve.dedupe` pour garantir que **tous** les imports de React pointent vers la même instance :
  - `react`
  - `react-dom`
  - `react/jsx-runtime`

Optionnel (si nécessaire après test) :
- Ajouter aussi une stratégie d’alias “forte” (alias vers `node_modules/react` / `react-dom`) si la dé-duplication ne suffit pas.
- Ajuster `optimizeDeps` si Vite continue de pré-bundler d’une manière qui duplique React.

Pourquoi : si react-leaflet et l’app n’utilisent pas le “même React”, les Context Providers/Consumers ne se comprennent plus → crash “r is not a function”.

### 2) Rendre le guidage résilient (éviter l’écran blanc même en cas de bug)
**Fichiers :** `src/pages/IntakeForm.tsx` ou `src/components/intake/RouteReconStep.tsx`

- Ajouter un **ErrorBoundary** autour de `<RouteGuidanceView />` :
  - En cas d’erreur, afficher un écran propre (“Le guidage a rencontré une erreur”) + bouton “Fermer” qui remet `guidanceTrace` à `null`.
  - Objectif : même si une erreur survient, l’utilisateur ne perd pas toute l’UI.

Pourquoi : votre screenshot montre le toast “L’application a rencontré une erreur” + “Essayez de réparer” (écran de crash). Un ErrorBoundary local évite de casser tout l’écran intake.

### 3) Vérification technique guidée (pour confirmer la cause)
Après (1), refaire le test “Lancer le Guidage” et vérifier :
- Plus aucun `TypeError: r is not a function` dans la console.
- La vue “RouteGuidanceView” s’ouvre (overlay carte plein écran).
- La carte affiche la trace (Polyline), et n’empêche pas le retour/fermeture.

Si l’erreur persiste après dé-duplication :
- Instrumenter en dev (temporaire) :
  - `console.log('React', React.version)` côté app et côté composant guidage (pour confirmer qu’on est bien sur une seule instance / version).
- En dernier recours (solution robuste) :
  - Remplacer la partie “carte” par **Leaflet impératif** (sans react-leaflet) dans `RouteGuidanceView` : `L.map(...)`, `L.tileLayer(...)`, `L.polyline(...)` gérés via `useEffect` + `ref` DOM. Ça élimine complètement les problèmes de Context react-leaflet.

## Fichiers concernés
- Correctif principal :
  - `vite.config.ts` (ajout de `resolve.dedupe`)
- Robustesse UI :
  - `src/components/intake/RouteReconStep.tsx` (wrap `<RouteGuidanceView />` dans ErrorBoundary) ou alternativement plus haut niveau.
- (Optionnel) debug temporaire :
  - `src/components/intake/RouteGuidanceView.tsx` (logs de versions / guards supplémentaires)

## Critères de succès (validation côté utilisateur)
1) Aller sur `/intake/b06ba6b7-0b2c-45c2-b955-3783c1611df1` → onglet “Parcours”.
2) Cliquer “Lancer le Guidage”.
3) Résultat attendu :
   - Pas d’écran de crash.
   - L’overlay carte s’affiche.
   - On peut fermer et revenir à l’onglet.

## Risques & mitigations
- Si le problème venait d’un autre composant qui duplique React (rare), `resolve.dedupe` + alias fort règle quand même la plupart des cas.
- Si l’erreur se produit uniquement sur certains navigateurs, l’ErrorBoundary garantit au minimum une UX récupérable (pas de blocage total).

