

## Plan : Marqueur rapide — multi-photos, vocal fiable, IA différée

### 3 problèmes identifiés

1. **Une seule photo** : `handleQuickMarkerPhotoUpload` écrase `quickMarkerPhoto` (string unique) et auto-save immédiatement. Impossible d'ajouter une 2e photo.
2. **Note vocale capricieuse** : `useVoiceRecorder` force `audio/webm` qui n'est pas supporté sur iOS Safari. Pas de fallback.
3. **IA trop lente** : `triggerAiAnalysis` est appelé dans `handleQuickMarkerSave`, bloquant le drawer pendant 10-20s. L'utilisateur veut poser ses marqueurs vite et revoir l'IA après le STOP.

---

### 1. Multi-photos dans le marqueur rapide

**DB** : ajouter une colonne `photo_urls text[]` sur `route_markers` (migration). Garder `photo_url` pour rétrocompat.

**`useRouteRecorder.ts`** : modifier `addMarkerAtLastCoord` pour accepter `photoUrls?: string[]` en plus de `photoUrl`.

**`RouteReconStep.tsx`** :
- Remplacer `quickMarkerPhoto: string` par `quickMarkerPhotos: string[]`
- `handleQuickMarkerPhotoUpload` : ajoute l'URL au tableau au lieu d'écraser + ne fait plus d'auto-save
- Afficher les miniatures en preview avec possibilité de supprimer
- Le bouton "Valider" envoie toutes les photos d'un coup

### 2. Voice recorder fiable (fallback mimeType)

**`useVoiceRecorder.ts`** : détecter le mimeType supporté au lieu de forcer `audio/webm` :
```typescript
const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
  ? 'audio/webm' 
  : MediaRecorder.isTypeSupported('audio/mp4') 
    ? 'audio/mp4' 
    : '';  // laisse le navigateur choisir
```
Adapter aussi le nom de fichier et le type du Blob en conséquence.

### 3. IA différée — analyser après le STOP

**`RouteReconStep.tsx`** :
- Supprimer l'appel `triggerAiAnalysis` dans `handleQuickMarkerSave`
- Après le save, fermer le drawer immédiatement (toast "Marqueur sauvegardé ✓")
- Dans la liste des marqueurs (visible après STOP), ajouter un bouton "🧠 Analyser" par marqueur (existant : `handleAnalyzeMarker`) et le bouton batch "Analyser tous"
- Le panel d'analyse IA reste dans la liste des marqueurs, pas dans le drawer rapide
- Supprimer tout le bloc AI du drawer rapide (lignes 1080-1172)

### Fichiers modifiés
1. **Migration SQL** : `ALTER TABLE route_markers ADD COLUMN photo_urls text[]`
2. **`src/hooks/useVoiceRecorder.ts`** : fallback mimeType
3. **`src/hooks/useRouteRecorder.ts`** : support `photoUrls[]`
4. **`src/components/intake/RouteReconStep.tsx`** : multi-photos, suppression IA du drawer, fermeture auto après save

