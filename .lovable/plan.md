

# Plan : Agréger toutes les traces dans le rapport de l'onglet Exports

## Problème

`OutputsStep.tsx` récupère uniquement la première trace valide et ses marqueurs (lignes 52-94). Il affiche donc "3 points • 3 marqueurs" au lieu des 14 marqueurs répartis sur toutes les traces du projet.

C'est le même problème que celui corrigé dans `RouteReconStep.tsx` mais dans un composant différent.

## Solution dans `src/components/intake/OutputsStep.tsx`

1. **Fetch all traces + all markers** (lignes 52-94) : Au lieu de chercher une seule trace, récupérer toutes les traces valides du projet. Puis récupérer les marqueurs de **toutes** les traces (via `.in('trace_id', allTraceIds)`) au lieu d'une seule.

2. **Construire une trace fusionnée** : Concaténer les coordonnées de toutes les traces en un seul `LineString`, additionner les distances, et prendre les timestamps min/max. Stocker ce `mergedTrace` dans `reportTrace`.

3. **Stocker tous les marqueurs** : `setReportMarkers(allTypedMarkers)` avec les marqueurs de toutes les traces.

4. **Résultat** : L'affichage montrera le total correct (ex: "42 points • 14 marqueurs") et le rapport interactif contiendra toutes les données.

### Fichier impacté
- `src/components/intake/OutputsStep.tsx`

