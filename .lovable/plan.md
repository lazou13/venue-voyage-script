
Objectif: corriger le cas “rien ne s’ouvre” sur **Approuver + Bibliothèque**.

Constat confirmé (runtime + code)
- Côté réseau, il n’y a **aucun appel** à la fonction backend de promotion au moment du clic.
- Côté code (`RouteReconStep.tsx`), la fonction `handleApproveAndPromote` fait un retour silencieux:
  - `if (!analysis || !marker) return;`
- Résultat: après refresh (ou si l’analyse n’est pas en mémoire), le clic ne lance rien visiblement.

Plan d’implémentation
1) Rendre la promotion possible même sans analyse en mémoire  
- Fichier: `src/components/intake/RouteReconStep.tsx`
- Modifier `handleApproveAndPromote`:
  - Ne bloquer que si `marker` est absent.
  - Si `analysis` existe: garder l’enrichissement de note actuel.
  - Si `analysis` n’existe pas: ne pas enrichir, mais appeler quand même la promotion avec `marker_id` seul.
- Ajouter un toast explicite en fallback (ex: “Promotion effectuée sans enrichissement IA”).

2) Éviter les fermetures silencieuses du panneau détail  
- Fichier: `src/components/intake/RouteReconStep.tsx`
- Faire retourner un booléen de succès par `handleApproveAndPromote`.
- Dans le callback `onApproveAndPromote` du `MarkerDetailSheet`, fermer la sheet **uniquement en cas de succès**.

3) Fiabiliser la séquence Save → Promote dans la sheet  
- Fichier: `src/components/intake/MarkerDetailSheet.tsx`
- Faire retourner un booléen à `handleSave` (succès/échec).
- Dans `handleApprove`, arrêter le flux si `handleSave` échoue.
- Ajouter un état de chargement dédié à “Approuver + Bibliothèque” pour éviter les doubles clics.

4) Améliorer le feedback utilisateur  
- Toujours afficher un message clair pour les cas:
  - analyse absente,
  - promotion réussie,
  - promotion échouée (avec message backend).

Vérification prévue (end-to-end)
1. Cas avec analyse disponible: clic → note enrichie + promotion + `promoted=true`.  
2. Cas sans analyse (après refresh): clic → promotion quand même, sans no-op.  
3. Cas erreur save (coordonnées invalides): pas de promotion, message d’erreur visible.  
4. Vérifier qu’un enregistrement `medina_pois` est créé avec `metadata.source_marker_id`.

Détail technique (résumé)
```text
Avant:
click -> handleApproveAndPromote -> if !analysis return (silencieux)

Après:
click -> save (si OK) -> promote (avec ou sans analysis) -> toast clair -> fermer sheet si succès
```
