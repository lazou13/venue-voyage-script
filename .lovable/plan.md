

## Plan : Bouton "Approuver + Envoyer en bibliothèque"

### Objectif
Fusionner les deux actions (approuver l'analyse IA + promouvoir vers `medina_pois`) en un seul bouton dans le panel de compte-rendu.

### Modification : `src/components/intake/RouteReconStep.tsx`

**1. Nouvelle fonction `handleApproveAndPromote(markerId)`**
- Appelle d'abord la logique d'approbation existante (enrichir la note via `updateMarker`)
- Puis appelle `supabase.functions.invoke('promote-marker-to-library', { body: { marker_id } })`
- Affiche un toast combiné ("Approuvé + envoyé en bibliothèque")
- Ferme le panel d'analyse
- Rafraîchit les marqueurs (`markersQuery.refetch()`)

**2. Remplacer le bouton "Approuver" par deux boutons**
Dans le panel d'analyse (lignes 1766-1789), remplacer les actions par :
- **"✅ Approuver"** (garde le comportement actuel — enrichit la note seulement)
- **"✅ Approuver + Bibliothèque"** (nouveau — enrichit la note ET promeut vers `medina_pois`)
- **"✏️ Corriger"** (inchangé)

Le bouton "Approuver + Bibliothèque" sera désactivé si le marqueur est déjà `promoted: true`.

