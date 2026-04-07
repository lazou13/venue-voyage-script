

# Audit complet — Hunt Planer Pro

## Etat des lieux (chiffres bruts)

```text
medina_pois: 1064 total
  - enriched: 815 | classified: 24 | draft: 20 | filtered: 205
  - validated: 0   ← AUCUN POI n'est "validated"
  
Enrichissement:
  - avec anecdote FR: 1054/859 actifs ✓
  - avec énigme facile: 1053 ✓ | difficile: manque 18
  - avec prix: 986 | horaires: manque 254
  - avec Wikipedia: 0/859 ← vide
  - agent enrichi (tags audience): 860 ✓

poi_media: 819 photos (toutes covers)
quest_library: 15 visites pré-générées
quest_photos (table clients): N'EXISTE PAS ← jamais créée
```

## Problemes critiques

### 1. AUCUN POI n'est "validated"
Le moteur de quêtes (`generate-quest`) et l'API publique (`public-project-data` mode=library) filtrent sur `status = 'validated'`. Résultat: **la bibliothèque publique est vide**. Les 815 POIs enrichis sont inutilisables par Quest Rides Pro.

### 2. Table `quest_photos` manquante
La mémoire projet mentionne un système de photos clients, mais la table n'existe pas. Aucun code front ne la référence. **Les photos et vidéos des clients ne sont pas capturées.**

### 3. Pas de boucle de feedback clients
Aucun mécanisme pour que les clients recommandent des POIs, ajoutent des commentaires ou des photos de terrain. C'est le coeur de votre vision et ça n'existe pas.

### 4. Wikipedia vide (0/859)
Le champ `wikipedia_summary` est vide pour tous les POIs actifs, alors qu'il est mappé dans les stops de visite.

### 5. 24 POIs bloqués en "classified", 20 en "draft"
44 POIs n'avancent pas dans le pipeline. Pas de visibilité sur pourquoi.

## Ce qui ne sert à rien (dette technique)

| Element | Raison |
|---------|--------|
| `poi-enrich` (Edge Function) | Doublon de `poi-worker` — même rôle, même modèle IA |
| `poi-autopipeline` | Wrapper inutilisé, le cron appelle `poi-auto-agent` |
| `poi-pipeline` (orchestrateur legacy) | Remplacé par `enrichment-pipeline` + client-side loops |
| `generate-custom-quest` | N'est référencé nulle part dans le front |
| `AdminMedinaCustomBuilder` | Page admin sans utilité claire, doublon de `AdminMedinaPOIs` |
| `AdminPresets`, `AdminFields`, `AdminRules`, `AdminLabels` | Pages de config du wizard projet (ancien système hôtelier), pas utilisées pour la médina |
| `AdminPublish` | Publie un projet client, pas pertinent pour la base POI |
| `HomePage` avec externalSupabase | Connecte un projet externe pour afficher une carte, complexité inutile |
| `PublicExperienceBuilder/Wizard/List/Detail` | Système d'expérience publique B2C non connecté à la base POI |

## Ce qui manque

### A. Système de validation/promotion POI
- Workflow pour passer de `enriched` → `validated` avec checklist qualité
- Dashboard de revue par lots avec critères mesurables

### B. Agent de surveillance qualité (Watchdog)
- Détecte POIs mal enrichis (énigmes vides, descriptions trop courtes, scores incohérents)
- Rapport quotidien avec alertes
- Actions correctives automatiques (re-enrichir, flaguer)

### C. Collecte feedback clients
- Table `quest_photos` + `client_recommendations`
- Endpoint pour que Quest Rides Pro envoie les photos/commentaires
- Pipeline d'intégration: photo client → enrichit le POI source

### D. Connexion inter-projets robuste
- L'API `public-project-data` renvoie 0 POIs (aucun validated)
- Pas de webhook ou sync automatique
- Pas de versioning ni de health-check côté consommateur

## Plan d'action (7 chantiers)

### Chantier 1 — Débloquer la bibliothèque (urgent)
- Créer un système de validation par lots dans `AdminMedinaPOIs`
- Règles de validation automatique: score ≥ 5, description ≥ 50 chars, au moins 1 énigme, coordonnées GPS valides
- Bouton "Valider tous les éligibles" + validation manuelle unitaire
- Migration: ajouter une colonne `validated_at` timestamp

### Chantier 2 — Agent Watchdog
- Nouvelle Edge Function `poi-watchdog` (cron quotidien)
- Vérifie: champs vides critiques, scores aberrants, doublons GPS, horaires manquants
- Écrit un rapport dans une table `watchdog_reports`
- Dashboard admin dédié avec alertes visuelles

### Chantier 3 — Photos et feedback clients
- Créer table `quest_photos` (instance_id, poi_id, photo_url, caption, created_at)
- Créer table `client_poi_recommendations` (poi_id, comment, rating, photo_url, source_instance_id)
- Endpoint API pour Quest Rides Pro
- Pipeline: les recommandations flaguent les POIs pour re-enrichissement

### Chantier 4 — Combler les trous d'enrichissement
- Backfill Wikipedia (859 POIs sans summary)
- Compléter les 18 énigmes difficiles manquantes
- Compléter les 254 horaires manquants
- Passer les 44 POIs bloqués (draft/classified) au travers du pipeline

### Chantier 5 — Nettoyage code mort
- Supprimer: `poi-enrich`, `poi-autopipeline`, `poi-pipeline`, `generate-custom-quest`
- Supprimer pages inutiles: `AdminMedinaCustomBuilder`, `AdminPresets`, `AdminFields`, `AdminRules`, `AdminLabels`, `AdminPublish`
- Simplifier le routeur et la sidebar admin

### Chantier 6 — Renforcer l'API inter-projets
- Health-check endpoint (`/mode=health`) qui retourne les stats de la base
- Versioning des données (timestamp dernière mise à jour)
- Cache invalidation via Supabase Realtime ou webhook
- Documentation API claire pour Quest Rides Pro et Questride

### Chantier 7 — Dashboard unifié de pilotage
- Fusionner `AdminHealth` + `AdminPOIPipeline` en un tableau de bord unique
- KPIs en temps réel: taux de validation, couverture enrichissement, alertes watchdog
- Historique des runs pipeline avec succès/échecs
- Vue "POIs problématiques" triable et actionnable

## Priorité d'exécution

```text
1. Chantier 1 (validation)     — débloque tout le système
2. Chantier 4 (enrichissement)  — comble les trous
3. Chantier 2 (watchdog)        — surveille la qualité
4. Chantier 3 (feedback)        — boucle clients
5. Chantier 6 (API)             — connexion fiable
6. Chantier 5 (nettoyage)       — réduit la dette
7. Chantier 7 (dashboard)       — pilotage
```

## Fichiers impactés (estimation)

| Chantier | Fichiers principaux |
|----------|-------------------|
| 1 | `AdminMedinaPOIs.tsx`, migration SQL, `useMedinaPOIs.ts` |
| 2 | Nouvelle EF `poi-watchdog/index.ts`, table `watchdog_reports`, page admin |
| 3 | 2 migrations SQL, nouvelle EF `client-feedback/index.ts`, `public-project-data` |
| 4 | Runs manuels des EF existantes + fix `wiki-name-enricher` |
| 5 | Suppression ~6 EF + ~5 pages, `App.tsx`, `AdminSidebar.tsx` |
| 6 | `public-project-data/index.ts` |
| 7 | Nouvelle page `AdminDashboard.tsx` |

