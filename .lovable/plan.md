

## Plan : Corriger le guidage qui ne s'affiche pas en plein ecran

### Probleme identifie

Le bouton "Lancer le Guidage" fonctionne (les donnees se chargent, la carte s'affiche), mais la vue de guidage ne couvre pas tout l'ecran. Le header et les onglets restent visibles au-dessus de la carte.

**Cause technique** : La vue de guidage (`RouteGuidanceView`) utilise `position: fixed` pour occuper tout l'ecran. Mais elle est rendue a l'interieur d'un `TabsContent` qui a une animation CSS `animate-fade-in`. Cette animation utilise `transform: translateY(...)`, ce qui cree un nouveau contexte de positionnement en CSS. Resultat : le `fixed` ne se positionne plus par rapport a la fenetre, mais par rapport au conteneur anime.

### Solution

Utiliser un **React Portal** pour rendre la vue de guidage directement dans `document.body`, en dehors de l'arborescence DOM du composant. Cela permet au `position: fixed` de fonctionner correctement, quelle que soit l'animation du parent.

### Fichier a modifier

**`src/components/intake/RouteReconStep.tsx`**
- Importer `createPortal` depuis `react-dom`
- Envelopper le bloc `{guidanceTrace && <GuidanceErrorBoundary>...<RouteGuidanceView>...</GuidanceErrorBoundary>}` dans un `createPortal(..., document.body)`
- Le reste du composant ne change pas

### Impact

- Aucun changement visuel ni fonctionnel (memes boutons, memes donnees)
- La carte de guidage s'affichera correctement en plein ecran
- Le bouton X pour fermer continuera de fonctionner normalement

