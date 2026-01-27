

# Corriger l'affichage du bouton "Marquer départ"

## Problème identifié

Le bouton "Marquer départ" ne s'affiche pas car il dépend de `lastPosition` qui est `null` (aucun point GPS capturé).

La condition actuelle (ligne 410) :
```typescript
{isRecording && !departureMarked && lastPosition && (
```

Cette condition cache le bouton tant qu'aucun point GPS n'est disponible, ce qui est contre-productif puisque le but était de permettre le marquage même avec un GPS de mauvaise qualité.

## Solution

### Option A : Afficher le bouton dès le début avec gestion d'erreur

Modifier la condition pour afficher le bouton dès que l'enregistrement démarre, puis afficher un message d'erreur si on clique sans position GPS :

```typescript
{isRecording && !departureMarked && (
  <Button
    onClick={async () => {
      if (!lastPosition) {
        toast({
          title: "Position GPS indisponible",
          description: "Attendez que le GPS soit prêt...",
          variant: "destructive"
        });
        return;
      }
      await addMarkerAtLastCoord('Point de départ');
      setDepartureMarked(true);
    }}
    variant="outline"
    className="gap-2 border-green-500 text-green-600 hover:bg-green-50"
    disabled={!lastPosition}
  >
    <Flag className="w-4 h-4" />
    {lastPosition ? "Marquer départ" : "GPS en attente..."}
  </Button>
)}
```

### Option B (recommandée) : Toujours afficher, mais désactivé si pas de GPS

Le bouton s'affiche toujours pendant l'enregistrement, mais est désactivé et montre un état visuel différent quand le GPS n'est pas prêt.

## Modifications techniques

| Fichier | Changement |
|---------|------------|
| `src/components/intake/RouteReconStep.tsx` | Modifier condition ligne 410 : `lastPosition &&` devient optionnel, ajouter `disabled={!lastPosition}` et texte dynamique |

## Code modifié

```typescript
{isRecording && !departureMarked && (
  <Button
    onClick={async () => {
      await addMarkerAtLastCoord('Point de départ');
      setDepartureMarked(true);
    }}
    variant="outline"
    className={cn(
      "gap-2",
      lastPosition 
        ? "border-green-500 text-green-600 hover:bg-green-50" 
        : "border-muted text-muted-foreground"
    )}
    disabled={!lastPosition}
  >
    <Flag className="w-4 h-4" />
    {lastPosition ? "Marquer départ" : "GPS en attente..."}
  </Button>
)}
```

## Résultat attendu

1. Le bouton "Marquer départ" s'affiche immédiatement dès que l'enregistrement commence
2. Si le GPS n'est pas prêt : bouton désactivé, grisé, avec texte "GPS en attente..."
3. Dès qu'un point GPS est reçu : bouton actif, vert, avec texte "Marquer départ"
4. Le message "Recherche GPS en cours..." reste visible en dessous pour contexte

## Test

1. Démarrer l'enregistrement
2. Vérifier que le bouton "GPS en attente..." apparaît immédiatement (grisé)
3. Attendre que le GPS soit capturé
4. Vérifier que le bouton devient "Marquer départ" (vert, actif)
5. Cliquer pour marquer le départ

