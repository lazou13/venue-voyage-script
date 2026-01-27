

# Corriger le bouton "Marqueur rapide" grise et ajouter marqueur de depart

## Diagnostic

Le bouton est grise car aucune coordonnee GPS n'a ete captee. Les logs montrent:

```text
GPS filtered: accuracy 323.0m > 40m
```

Le seuil de precision actuel (40m) rejette tous les points GPS quand:
- L'appareil est en interieur
- Le GPS n'a pas eu le temps de se calibrer
- Le signal GPS est faible

**Resultat**: `lastPosition = null` donc le bouton reste desactive.

## Solution proposee

### 1. Accepter le premier point meme avec mauvaise precision

Modifier le hook `useRouteRecorder.ts` pour:
- Toujours accepter le premier point GPS (meme avec precision > 40m) pour permettre de marquer le depart
- Continuer a filtrer les points suivants selon les criteres de qualite
- Stocker la precision dans le state pour l'afficher a l'utilisateur

### 2. Ajouter indicateur de qualite GPS en temps reel

Dans `RouteReconStep.tsx`, afficher:
- Indicateur visuel de la qualite du signal (vert/orange/rouge)
- Precision actuelle en metres
- Message d'aide si precision insuffisante

### 3. Bouton "Marquer depart" dedie

Ajouter un bouton specifique "Point de depart" qui:
- S'affiche des le debut de l'enregistrement
- Ajoute automatiquement une note "Point de depart"
- Disparait apres utilisation (un seul point de depart)

## Modifications techniques

| Fichier | Changement |
|---------|------------|
| `src/hooks/useRouteRecorder.ts` | Accepter premier point meme si precision > 40m; exposer `lastRawPosition` dans le state |
| `src/components/intake/RouteReconStep.tsx` | Ajouter indicateur GPS + bouton "Point de depart" |

## Details d'implementation

### useRouteRecorder.ts (lignes ~305-330)

**Avant:**
```typescript
// Filter 1: Reject poor accuracy
if (accuracy > MAX_ACCURACY_METERS) {
  console.log(`GPS filtered: accuracy ...`);
  return;  // Rejette TOUT
}
```

**Apres:**
```typescript
// Filter 1: For first point, accept even with poor accuracy (for departure marker)
// For subsequent points, reject poor accuracy
const isFirstPoint = lastKeptPointRef.current === null;

if (!isFirstPoint && accuracy > MAX_ACCURACY_METERS) {
  console.log(`GPS filtered: accuracy ...`);
  // Update raw position for UI feedback even when filtered
  setState(prev => ({ ...prev, lastRawPosition: newCoord }));
  return;
}

// Warn if first point has poor accuracy
if (isFirstPoint && accuracy > MAX_ACCURACY_METERS) {
  console.warn(`First GPS point accepted despite poor accuracy: ${accuracy.toFixed(1)}m`);
}
```

### RouteReconStep.tsx - Indicateur GPS

Ajouter apres les boutons REC/STOP:
```typescript
{isRecording && lastPosition && (
  <div className="flex items-center gap-2 text-sm">
    <div className={cn(
      "w-2 h-2 rounded-full",
      (lastPosition.accuracy || 0) <= 20 ? "bg-green-500" :
      (lastPosition.accuracy || 0) <= 40 ? "bg-yellow-500" : "bg-red-500"
    )} />
    <span className="text-muted-foreground">
      GPS: {lastPosition.accuracy?.toFixed(0) || '?'}m
    </span>
  </div>
)}

{isRecording && !lastPosition && (
  <div className="flex items-center gap-2 text-sm text-amber-600">
    <AlertTriangle className="w-4 h-4" />
    Recherche GPS en cours...
  </div>
)}
```

### RouteReconStep.tsx - Bouton Point de depart

Ajouter un state local + bouton:
```typescript
const [departureMarked, setDepartureMarked] = useState(false);

// Reset on new recording
useEffect(() => {
  if (!isRecording) setDepartureMarked(false);
}, [isRecording]);

// Dans les boutons de controle:
{isRecording && !departureMarked && lastPosition && (
  <Button
    onClick={async () => {
      await addMarkerAtLastCoord('Point de depart');
      setDepartureMarked(true);
    }}
    variant="outline"
    className="gap-2 border-green-500 text-green-600 hover:bg-green-50"
  >
    <MapPin className="w-4 h-4" />
    Marquer depart
  </Button>
)}
```

## Resultat attendu

1. Le premier point GPS sera toujours accepte (meme en interieur)
2. Le bouton "Marqueur rapide" deviendra actif des la premiere position
3. Un bouton "Marquer depart" dedié sera disponible
4. Un indicateur visuel montrera la qualite du signal GPS
5. Si le GPS cherche encore, un message "Recherche GPS en cours..." s'affichera

## Tests

1. Demarrer l'enregistrement en interieur
2. Verifier que le premier point est capture meme avec precision > 40m
3. Verifier que le bouton "Marquer depart" apparait et fonctionne
4. Verifier que l'indicateur GPS affiche la precision en temps reel

