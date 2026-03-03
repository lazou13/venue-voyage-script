

## Plan : Documentation complete de l'application

Reecrire entierement le contenu de `src/pages/admin/AdminDocs.tsx` avec une documentation exhaustive couvrant toutes les fonctionnalites actuelles de l'application, organisee en 4 onglets au lieu de 3.

### Structure proposee

**4 onglets** : Guide utilisateur | Guide admin | Rapport interactif | FAQ

---

### Onglet 1 : Guide utilisateur (refonte complete)

Sections accordion :

1. **Dashboard** — Creation de projet (nom du lieu, ville), ouverture, statut, suppression
2. **Formulaire Intake — Vue d'ensemble** — Explication des 7 onglets dynamiques (Core + onglet contextuel selon type + Terrain + Etapes + Regles + Exports), barre de navigation, sauvegarde automatique, bandeau de synchronisation croisee
3. **Onglet Core** — Type de projet (3 types avec icones), type de quete (5 types : exploration, sequentiel, course chrono, collaboratif, competition equipes), public cible (7 options multi-select), duree (manuelle/auto-calculee), difficulte (1-5), langues (FR obligatoire + EN/AR/ES/ARY), contenu multilingue (titre + histoire i18n), objectifs business, contraintes generales, mode de jeu (solo/equipes/1v1/multi-solo), mode transport (a pied/velo/bus/voiture/bateau/mixte), storytelling/narrateur/avatar, decisions validees client (checklist 10 items)
4. **Onglet Lieu — Etablissement** — Espaces, zones privees, operations staff, notes Wi-Fi
5. **Onglet Lieu — Site Touristique** — Points depart/arrivee, zones a eviter, creneaux horaires, landmarks
6. **Onglet Parcours — Reconnaissance GPS** — Enregistrement trace GPS, modes (marche/conduite), marqueurs avec notes/photos/voix, conversion marqueurs vers POIs, export GeoJSON/CSV/ZIP, guidage temps reel, rapport interactif
7. **Onglet Terrain** — POIs (nom, zone, photo, interaction, risque, temps), zones Wi-Fi, zones interdites, multi-select types d'etapes et modes de validation integres aux cartes POI
8. **Onglet Etapes** — Configuration detaillee de chaque POI : types d'etapes (14 types : narration, information, QCM, enigme, code secret, pendu, memory, photo, terrain, defi, transition, QR code, info QR, compte a rebours), modes de validation (6 modes : QR code, photo, code, manuel, libre, chaine de validation), scoring (points, penalites, bonus temps), indices, branchement conditionnel, validation photo (libre/reference/QR), contenu i18n, presets applicables
9. **Onglet Regles** — Scoring global (points par defaut, penalite indice, penalite echec), temps limite, bonus temps, indices (max, auto-reveal), branchement (on success/failure, score above/below), team vs solo
10. **Onglet Exports** — 4 types de documents : Checklist terrain, PRD, Prompt IA, Rapport interactif HTML. Pour route_recon : rapport interactif et road book cartographique
11. **Synchronisation croisee** — Explication du bandeau CrossTabSummary : badges cliquables, alertes de coherence dans Core, auto-calcul duree, donnees partagees entre onglets
12. **Types d'etapes** — Tableau recapitulatif des 14 types avec description de chacun
13. **Modes de validation** — Tableau recapitulatif des 6 modes avec description

### Onglet 2 : Guide admin (mise a jour)

Sections existantes conservees et enrichies :

1. **Enums** — Ajouter mention des nouveaux types (transition, qr_code, info_qr, countdown, validation_chain, transport_mode)
2. **Prereglages** — Inchange
3. **Champs** — Inchange
4. **Regles** — Inchange
5. **Labels** — Inchange
6. **Workflow brouillon/publication** — Inchange
7. **Dossier technique Escrow** — Description du ZIP genere (architecture, types, schema BDD, hooks)

### Onglet 3 : Rapport interactif (NOUVEAU)

Sections :

1. **Presentation** — Fichier HTML autonome pour projets route_recon, 3 sections principales (Fiche Projet, Infos Parcours, Tableau POI)
2. **Fiche Projet** — Identite, infos publiques, parametres, options — tous editables
3. **Infos Parcours** — Trace metadata, transport, vitesse, temps trajet/arrets editables avec override et reset
4. **Tableau POI** — 12 colonnes editables, types disponibles, ajout/suppression de lignes
5. **Carte interactive** — Marqueurs numerotes, couleurs (vert depart, rose fin, violet intermediaires)
6. **Persistance** — localStorage par trace ID, restauration automatique
7. **Exports depuis le rapport** — PDF, JSON, Word, HTML (avec etat actuel integre)

### Onglet 4 : FAQ (enrichie)

Ajouter les questions :

- Comment fonctionne la synchronisation entre onglets ?
- Comment utiliser le mode transport ?
- Quels sont les nouveaux types d'etapes disponibles ?
- Comment fonctionne le rapport interactif ?
- Comment exporter le rapport HTML avec mes modifications ?
- Comment fonctionne l'enregistrement vocal des marqueurs ?

### Fichier modifie

| Fichier | Changement |
|---------|------------|
| `src/pages/admin/AdminDocs.tsx` | Reecriture complete avec documentation exhaustive, 4 onglets, toutes les fonctionnalites documentees |

