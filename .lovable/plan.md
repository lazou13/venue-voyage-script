

## Plan : Bouton "Nouveau départ" pour créer plusieurs parcours par projet

### Problème
Quand on stop puis relance REC, ça crée une nouvelle trace mais le badge "Départ marqué" s'affiche automatiquement (car des traces existent). L'utilisateur ne peut pas marquer un nouveau point de départ pour un nouveau parcours dans le même projet.

### Solution
Ajouter un bouton **"Nouveau départ"** à côté du badge "Départ marqué" quand l'enregistrement est en cours et que le départ est déjà marqué (auto ou manuel). Ce bouton :
1. Crée un marqueur "Point de départ" à la position GPS actuelle sur la trace en cours
2. Signale visuellement qu'un nouveau parcours démarre

### Modification : `src/components/intake/RouteReconStep.tsx`

**Zone ligne ~748-753** — Remplacer le badge statique "Départ marqué" par un groupe contenant :
- Le badge "Départ marqué" (inchangé)
- Un bouton **"Nouveau départ"** (icône Flag + texte) qui appelle `addMarkerAtLastCoord('Nouveau point de départ')` pour poser un marqueur de départ sur la trace en cours, sans interrompre l'enregistrement

Cela permet de marquer visuellement le début d'un nouveau segment/parcours dans la même session d'enregistrement, tout en conservant une seule trace continue.

