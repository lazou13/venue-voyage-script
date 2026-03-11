

## Problème

L'input `<input type="file" accept="image/*" capture="environment">` devrait ouvrir la caméra sur mobile, mais sur desktop/tablette il ouvre le sélecteur de fichiers. L'attribut `capture="environment"` ne fonctionne que sur mobile (iOS/Android). Sur desktop, le navigateur ignore `capture` et ouvre toujours le sélecteur de fichiers.

Il y a **deux endroits** avec ce pattern :
1. `src/components/intake/RouteReconStep.tsx` (ligne ~805) — le bouton "Photo (auto-save)" du marqueur rapide
2. `src/components/intake/shared/PhotoReferenceBlock.tsx` (ligne ~165) — le bouton de photo de référence

## Solution proposée

Offrir **deux boutons distincts** pour chaque endroit :

1. **📷 Prendre une photo** — input avec `capture="environment"` qui force la caméra
2. **📁 Depuis mes fichiers** — input sans `capture` qui ouvre le sélecteur de fichiers

Cela donne un contrôle explicite à l'utilisateur selon son besoin.

### Modifications

**`src/components/intake/RouteReconStep.tsx`**
- Ajouter un second `<input type="file">` sans `capture` + une seconde ref
- Remplacer le bouton unique par deux boutons côte à côte :
  - "📷 Photo" (avec `capture="environment"`)
  - "📁 Fichier" (sans `capture`, ouvre le sélecteur)
- Les deux déclenchent le même handler `handleQuickMarkerPhotoUpload`

**`src/components/intake/shared/PhotoReferenceBlock.tsx`**
- Même approche : deux inputs, deux boutons (Caméra / Fichier)
- Le handler `handleFileChange` reste identique pour les deux

