

# Plan : Inclure tous les marqueurs (toutes les traces) dans le rapport

## Problème

Le rapport reçoit uniquement `markers` (marqueurs de la trace sélectionnée). Avec 5 traces et 14 marqueurs au total, seuls les 8 marqueurs de la trace active apparaissent.

## Solution

Modifier le passage de données au `InteractiveReportViewer` dans `RouteReconStep.tsx` pour envoyer `allMarkers` au lieu de `markers`, et fusionner les coordonnées de toutes les traces pour la carte.

### Modifications dans `src/components/intake/RouteReconStep.tsx`

1. **Ligne ~2379** : Remplacer `markers={markers}` par `markers={allMarkers}` pour passer les 14 marqueurs.

2. **Ligne ~2378** : Construire une trace fusionnée qui combine les coordonnées de toutes les traces (pas seulement la sélectionnée). On crée un objet `mergedTrace` avec les coordonnées concaténées de toutes les traces, le nom du projet, et les timestamps min/max.

3. **Ligne ~2383** : Mettre à jour `poisCount={allMarkers.length}`.

4. **Condition d'activation du bouton Rapport** (ligne ~1605) : Assouplir la condition pour qu'il soit activé dès qu'il y a au moins une trace avec des coordonnées (pas besoin de `selectedTraceId`).

### Fichier impacté
- `src/components/intake/RouteReconStep.tsx`

