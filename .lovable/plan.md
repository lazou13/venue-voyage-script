
# Correction du Guidage - "render2 is not a function"

## Diagnostic

L'erreur `TypeError: render2 is not a function` dans `updateContextConsumer` se produit quand vous cliquez sur "Lancer le Guidage". C'est un problème de compatibilité entre **react-leaflet v5** et le contexte React.

**Cause identifiée** : Les composants `FitBounds` et `CenterOnUser` utilisent `useMap()` qui nécessite d'être à l'intérieur d'un `MapContainer` déjà initialisé. Dans certaines conditions de rendu (notamment quand le composant est monté de façon asynchrone), le contexte de la carte n'est pas encore disponible.

## Solution technique

### Fichier à modifier
`src/components/intake/RouteGuidanceView.tsx`

### Corrections à appliquer

1. **Utiliser le pattern `whenCreated` ou `ref`** pour s'assurer que la carte est prête avant d'utiliser `useMap()`

2. **Déplacer les hooks `useMap` dans des composants conditionnels** qui ne sont rendus que quand la carte est disponible

3. **Ajouter une vérification de l'état de montage** pour éviter les erreurs de rendu

### Code corrigé

```typescript
// Option 1: Utiliser ref pour accéder à la carte
const mapRef = useRef<L.Map | null>(null);

<MapContainer
  ref={mapRef}
  center={defaultCenter}
  zoom={16}
  className="h-full w-full"
  zoomControl={false}
>
  {/* Les composants FitBounds et CenterOnUser 
      doivent être rendus APRÈS l'initialisation de la carte */}
  <MapController 
    coords={polylineCoords} 
    userPosition={userPosition} 
    followUser={followUser} 
  />
  ...
</MapContainer>

// Nouveau composant qui encapsule la logique
function MapController({ coords, userPosition, followUser }) {
  const map = useMap();
  
  // FitBounds logic
  useEffect(() => {
    if (coords.length > 0 && map) {
      const latLngs = coords.map(c => [c[1], c[0]] as [number, number]);
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, coords]);
  
  // CenterOnUser logic
  useEffect(() => {
    if (userPosition && followUser && map) {
      map.setView([userPosition.lat, userPosition.lng], map.getZoom());
    }
  }, [map, userPosition, followUser]);
  
  return null;
}
```

4. **Ajouter un guard de sécurité** pour éviter le crash si le contexte n'est pas prêt :

```typescript
function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  
  useEffect(() => {
    if (!map || coords.length === 0) return; // Guard
    
    try {
      const latLngs = coords.map(c => [c[1], c[0]] as [number, number]);
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [50, 50] });
    } catch (err) {
      console.warn('FitBounds error:', err);
    }
  }, [map, coords]);
  
  return null;
}
```

## Résumé des changements

| Action | Détail |
|--------|--------|
| Fusion des composants | Combiner `FitBounds` et `CenterOnUser` en un seul `MapController` |
| Guards de sécurité | Ajouter des vérifications `if (!map) return` |
| Try/catch | Entourer les appels Leaflet d'un try/catch |
| État de chargement | Afficher un indicateur pendant l'initialisation de la carte |

## Résultat attendu

- Le bouton "Lancer le Guidage" ouvrira la carte sans erreur
- La carte se centrera automatiquement sur le parcours
- La position GPS sera suivie en temps réel
