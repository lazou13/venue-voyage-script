import JSZip from 'jszip';

const ARCHITECTURE_MD = `# Architecture Technique — QuestRides

## Stack Technologique

| Couche | Technologie |
|---|---|
| Frontend | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS + shadcn/ui |
| Routing | React Router DOM v6 |
| State serveur | TanStack React Query |
| Backend | Lovable Cloud (Supabase) |
| Auth | Supabase Auth (email/password) |
| Base de données | PostgreSQL (hébergé Supabase) |
| Edge Functions | Deno (Supabase Edge Functions) |
| Cartes | Leaflet + React-Leaflet |
| ZIP client | JSZip |
| Graphiques | Recharts |

## Structure des Dossiers

\`\`\`
src/
├── assets/              # Images et fichiers statiques importés
├── components/
│   ├── admin/           # Composants du panneau admin (sidebar, enum editor)
│   ├── intake/          # Composants du formulaire Intake (6 onglets + sous-composants)
│   │   └── shared/      # Composants réutilisables (I18nInput, EnumSelect, OptionMatrix, etc.)
│   └── ui/              # Composants shadcn/ui (button, dialog, tabs, etc.)
├── contexts/            # React Contexts (AppConfigContext)
├── hooks/               # Custom hooks (useProject, usePOIs, useAppConfig, etc.)
├── integrations/
│   └── supabase/        # Client Supabase auto-généré + types
├── lib/                 # Fonctions utilitaires et générateurs
├── pages/
│   ├── admin/           # Pages du panneau admin (Enums, Presets, Fields, Rules, Labels, Publish, Docs)
│   └── *.tsx            # Pages principales (Dashboard, IntakeForm, Auth, etc.)
├── test/                # Configuration et fichiers de test
└── types/               # Types TypeScript (intake.ts)

supabase/
├── config.toml          # Configuration Supabase
├── functions/           # Edge Functions (admin-signup, create-first-admin)
└── migrations/          # Migrations SQL
\`\`\`

## Flux de Données Principal

1. **Dashboard** → L'utilisateur crée ou sélectionne un projet
2. **IntakeForm** → Formulaire à 6 onglets qui persiste les données dans \`projects\`, \`pois\`, \`wifi_zones\`, \`forbidden_zones\`
3. **AppConfigContext** → Fournit la configuration admin (capabilities) à l'ensemble du panneau admin
4. **Exports** → Génération côté client de checklist, PRD, prompt IA, rapport interactif HTML

## Architecture Admin (Back-office)

Le panneau admin utilise un pattern centralisé :
- \`AppConfigContext\` encapsule un hook \`useAppConfig\` unique
- Toutes les sous-pages admin (Enums, Fields, Rules, etc.) lisent et écrivent dans ce contexte partagé
- Les boutons globaux "Sauvegarder" et "Publier" dans le header détectent automatiquement les changements locaux
- Le système utilise un workflow brouillon/publication avec versioning dans la table \`app_configs\`
`;

const HOOKS_AND_CONTEXT_MD = `# Hooks et Contextes — QuestRides

## Hooks Principaux

### \`useProject(projectId: string)\`
**Fichier :** \`src/hooks/useProject.ts\`

Gère le CRUD complet d'un projet unique.

**Retourne :**
- \`project: Project | null\` — Données du projet courant
- \`isLoading: boolean\` — État de chargement
- \`updateProject(updates: Partial<Project>): Promise<void>\` — Met à jour les champs du projet
- \`refetch(): void\` — Recharge les données

**Utilisation :** Page IntakeForm pour lire/écrire les données projet.

---

### \`usePOIs(projectId: string)\`
**Fichier :** \`src/hooks/usePOIs.ts\`

Gère les Points d'Intérêt (étapes du jeu) d'un projet.

**Retourne :**
- \`pois: POI[]\` — Liste triée par \`sort_order\`
- \`isLoading: boolean\`
- \`addPOI(poi: Partial<POI>): Promise<void>\`
- \`updatePOI(id: string, updates: Partial<POI>): Promise<void>\`
- \`deletePOI(id: string): Promise<void>\`
- \`reorderPOIs(ids: string[]): Promise<void>\`

---

### \`useAppConfig(key: string)\`
**Fichier :** \`src/hooks/useAppConfig.ts\`

Gère la configuration admin (capabilities) avec workflow brouillon/publication.

**Retourne :**
- \`config: Json\` — Payload de configuration courante
- \`hasUnsavedChanges: boolean\`
- \`isSaving / isPublishing: boolean\`
- \`publishedVersion: number\`
- \`draftId: string | null\`
- \`updateConfig(path: string, value: any): void\` — Met à jour un champ dans le brouillon local
- \`saveDraft(): Promise<boolean>\` — Persiste le brouillon en base
- \`publish(): Promise<boolean>\` — Publie le brouillon comme version active

---

### \`useCapabilities()\`
**Fichier :** \`src/hooks/useCapabilities.ts\`

Lit la configuration publiée (version active) pour déterminer les capacités disponibles dans l'Intake.

**Retourne :**
- \`capabilities: Record<string, any>\` — Registre des capacités actives
- \`isFieldVisible(section: string, field: string): boolean\`
- \`isFieldRequired(section: string, field: string): boolean\`

---

### \`useRouteRecorder(projectId: string)\`
**Fichier :** \`src/hooks/useRouteRecorder.ts\`

Gère l'enregistrement GPS pour le mode Reconnaissance Parcours.

**Retourne :**
- \`status: 'idle' | 'recording' | 'paused' | 'error'\`
- \`currentPosition: { lat, lng } | null\`
- \`distance: number\` — Distance parcourue en mètres
- \`duration: number\` — Durée en secondes
- \`startRecording(): void\`
- \`stopRecording(): Promise<void>\`
- \`addMarker(note?: string): void\` — Ajoute un marqueur à la position courante

---

### \`useZones(projectId: string)\`
**Fichier :** \`src/hooks/useZones.ts\`

Gère les zones Wi-Fi et zones interdites d'un projet.

---

### \`useAvatars(projectId?: string)\`
**Fichier :** \`src/hooks/useAvatars.ts\`

Gère les avatars/narrateurs disponibles pour un projet.

---

### \`useAuth()\`
**Fichier :** \`src/hooks/useAuth.ts\`

Gère l'authentification utilisateur (login, signup, logout, session).

---

### \`useAdminRole()\`
**Fichier :** \`src/hooks/useAdminRole.ts\`

Vérifie si l'utilisateur connecté a le rôle admin via la table \`user_roles\`.

---

## Contextes

### \`AppConfigContext\`
**Fichier :** \`src/contexts/AppConfigContext.tsx\`

Encapsule \`useAppConfig('capabilities')\` et expose ses valeurs à tout le panneau admin via \`useAppConfigContext()\`.

**Rôle :** Source unique de vérité pour l'état admin. Permet aux boutons globaux Save/Publish du header de réagir aux modifications faites dans n'importe quel sous-module.
`;

const TYPES_REFERENCE_MD = `# Référence des Types — QuestRides

Tous les types sont définis dans \`src/types/intake.ts\`.

## Enums

| Type | Valeurs |
|---|---|
| \`ProjectType\` | \`establishment\`, \`tourist_spot\`, \`route_recon\` |
| \`QuestType\` | \`exploration\`, \`sequential\`, \`timed_race\`, \`collaborative\`, \`team_competition\` |
| \`PlayMode\` | \`solo\`, \`team\`, \`one_vs_one\`, \`multi_solo\` |
| \`StepType\` | \`story\`, \`information\`, \`mcq\`, \`enigme\`, \`code\`, \`hangman\`, \`memory\`, \`photo\`, \`terrain\`, \`defi\` |
| \`ValidationMode\` | \`qr_code\`, \`photo\`, \`code\`, \`manual\`, \`free\` |
| \`InteractionType\` | \`puzzle\`, \`qr_scan\`, \`photo\`, \`hidden_object\`, \`npc\`, \`audio\` |
| \`DifficultyLevel\` | \`easy\`, \`medium\`, \`hard\` |
| \`RiskLevel\` | \`low\`, \`medium\`, \`high\` |
| \`WifiStrength\` | \`ok\`, \`weak\`, \`dead\` |
| \`TargetAudience\` | \`family\`, \`couples\`, \`corporate\`, \`teens\`, \`seniors\`, \`kids\`, \`friends\` |
| \`SupportedLanguage\` | \`fr\`, \`en\`, \`ar\`, \`es\`, \`ary\` |
| \`CompetitionMode\` | \`race\`, \`score\`, \`timed\` |
| \`PhotoValidationType\` | \`free\`, \`reference\`, \`qr_code\` |
| \`AvatarStyle\` | \`cartoon\`, \`realistic\`, \`semi_realistic\`, \`anime\`, \`minimal\` |
| \`AvatarAge\` | \`child\`, \`teen\`, \`adult\`, \`senior\` |
| \`AvatarPersona\` | \`guide_host\`, \`detective\`, \`explorer\`, \`historian\`, \`local_character\`, \`mascot\`, \`ai_assistant\`, \`villain_light\` |
| \`AvatarOutfit\` | \`traditional\`, \`modern\`, \`luxury\`, \`adventure\` |

## Interfaces Principales

### \`Project\`
Représente un projet de quête. Stocké dans la table \`projects\`.

| Champ | Type | Description |
|---|---|---|
| \`id\` | \`string (UUID)\` | Identifiant unique |
| \`hotel_name\` | \`string\` | Nom du lieu |
| \`city\` | \`string\` | Ville |
| \`floors\` | \`number\` | Nombre d'étages |
| \`quest_config\` | \`QuestConfig\` | Configuration complète de la quête (JSONB) |
| \`title_i18n\` | \`I18nText\` | Titre multilingue |
| \`story_i18n\` | \`I18nText\` | Histoire/synopsis multilingue |
| \`difficulty\` | \`DifficultyLevel\` | Difficulté globale |
| \`theme\` | \`string\` | Thème narratif |
| \`is_complete\` | \`boolean\` | Projet marqué comme complet |
| \`visit_date\` | \`string\` | Date de visite terrain |
| \`map_url\` | \`string\` | URL du plan uploadé |

### \`QuestConfig\`
Configuration détaillée d'une quête. Stocké dans \`projects.quest_config\` (JSONB).

| Champ | Type | Description |
|---|---|---|
| \`project_type\` | \`ProjectType\` | Type de projet |
| \`play_mode\` | \`PlayMode\` | Mode de jeu |
| \`questType\` | \`QuestType\` | Type de quête |
| \`core\` | \`CoreDetails\` | Détails communs (langues, audience, durée, etc.) |
| \`establishment_details\` | \`EstablishmentDetails\` | Détails spécifiques établissement |
| \`tourist_spot_details\` | \`TouristSpotDetails\` | Détails spécifiques site touristique |
| \`route_recon_details\` | \`RouteReconDetails\` | Détails spécifiques reconnaissance |
| \`teamConfig\` | \`TeamConfig\` | Config équipes (si play_mode=team) |
| \`multiSoloConfig\` | \`MultiSoloConfig\` | Config multi-solo |
| \`scoring\` | \`ScoringConfig\` | Config scoring globale |
| \`storytelling\` | \`StorytellingConfig\` | Narrateur/avatar |
| \`decisions_validated\` | \`DecisionsValidated\` | Checklist de validation client |

### \`POI\` (Point of Interest)
Représente une étape du jeu. Stocké dans la table \`pois\`.

| Champ | Type | Description |
|---|---|---|
| \`id\` | \`string (UUID)\` | Identifiant unique |
| \`project_id\` | \`string\` | FK vers projects |
| \`name\` | \`string\` | Nom de l'étape |
| \`zone\` | \`string\` | Zone/lieu dans l'établissement |
| \`sort_order\` | \`number\` | Ordre d'affichage |
| \`interaction\` | \`InteractionType\` | Type d'interaction |
| \`risk\` | \`RiskLevel\` | Niveau de risque |
| \`step_config\` | \`StepConfig\` | Configuration détaillée de l'étape (JSONB) |

### \`StepConfig\`
Configuration d'une étape individuelle. Stocké dans \`pois.step_config\` (JSONB).

| Champ | Type | Description |
|---|---|---|
| \`possible_step_types\` | \`StepType[]\` | Types d'étapes possibles (multi-select) |
| \`possible_validation_modes\` | \`ValidationMode[]\` | Modes de validation possibles |
| \`final_step_type\` | \`StepType\` | Type final choisi |
| \`final_validation_mode\` | \`ValidationMode\` | Mode de validation final |
| \`scoring\` | \`ScoringConfig\` | Points, pénalités, bonus temps |
| \`hints\` | \`string[]\` | Indices disponibles |
| \`branching\` | \`BranchingLogic\` | Logique de branchement conditionnel |
| \`contentI18n\` | \`I18nText\` | Contenu multilingue |
| \`photoValidation\` | \`PhotoValidationConfig\` | Config validation photo |

### \`BranchingLogic\`
Logique de branchement entre étapes.

| Champ | Type | Description |
|---|---|---|
| \`onSuccess\` | \`string\` | UUID de l'étape suivante, \`'next'\`, \`'intermediate'\`, ou \`'end'\` |
| \`onFailure\` | \`string\` | UUID, \`'retry'\`, ou \`'end'\` |
| \`scoreAbove\` | \`number\` | Seuil de score pour le branchement conditionnel |
| \`scoreAboveTarget\` | \`string\` | Destination si score > seuil |
| \`scoreBelowTarget\` | \`string\` | Destination si score < seuil |
`;

const DATABASE_SCHEMA_MD = `# Schéma de Base de Données — QuestRides

## Tables

### \`projects\`
Table principale des projets de quête.

| Colonne | Type | Nullable | Défaut | Description |
|---|---|---|---|---|
| \`id\` | UUID | Non | gen_random_uuid() | PK |
| \`hotel_name\` | TEXT | Non | | Nom du lieu |
| \`city\` | TEXT | Non | | Ville |
| \`floors\` | INTEGER | Non | 0 | Nombre d'étages |
| \`visit_date\` | DATE | Oui | | Date de visite |
| \`map_url\` | TEXT | Oui | | URL du plan |
| \`map_uploaded_at\` | TIMESTAMPTZ | Oui | | Date d'upload du plan |
| \`staff_available\` | BOOLEAN | Oui | | Staff disponible |
| \`reset_time_mins\` | INTEGER | Oui | | Temps de reset en minutes |
| \`props_allowed\` | BOOLEAN | Oui | | Accessoires autorisés |
| \`target_duration_mins\` | INTEGER | Oui | | Durée cible en minutes |
| \`difficulty\` | ENUM(difficulty_level) | Oui | | easy/medium/hard |
| \`theme\` | TEXT | Oui | | Thème narratif |
| \`is_complete\` | BOOLEAN | Oui | false | Projet complet |
| \`quest_config\` | JSONB | Non | '{}' | Configuration de quête (voir QuestConfig) |
| \`title_i18n\` | JSONB | Non | '{}' | Titre multilingue |
| \`story_i18n\` | JSONB | Non | '{}' | Histoire multilingue |
| \`created_at\` | TIMESTAMPTZ | Non | now() | |
| \`updated_at\` | TIMESTAMPTZ | Non | now() | |

### \`pois\` (Points of Interest)
Étapes du jeu liées à un projet.

| Colonne | Type | Nullable | Défaut | Description |
|---|---|---|---|---|
| \`id\` | UUID | Non | gen_random_uuid() | PK |
| \`project_id\` | UUID | Non | | FK → projects.id |
| \`name\` | TEXT | Non | | Nom de l'étape |
| \`zone\` | TEXT | Non | | Zone/lieu |
| \`photo_url\` | TEXT | Oui | | Photo du lieu |
| \`interaction\` | ENUM(interaction_type) | Non | 'puzzle' | Type d'interaction |
| \`risk\` | ENUM(risk_level) | Non | 'low' | Niveau de risque |
| \`minutes_from_prev\` | INTEGER | Oui | | Minutes depuis l'étape précédente |
| \`notes\` | TEXT | Oui | | Notes libres |
| \`sort_order\` | INTEGER | Non | 0 | Ordre de tri |
| \`step_config\` | JSONB | Non | '{}' | Configuration d'étape (voir StepConfig) |
| \`created_at\` | TIMESTAMPTZ | Non | now() | |

### \`wifi_zones\`
Couverture Wi-Fi par zone.

| Colonne | Type | Description |
|---|---|---|
| \`id\` | UUID | PK |
| \`project_id\` | UUID | FK → projects.id |
| \`zone\` | TEXT | Nom de la zone |
| \`strength\` | ENUM(wifi_strength) | ok / weak / dead |

### \`forbidden_zones\`
Zones interdites avec raison.

| Colonne | Type | Description |
|---|---|---|
| \`id\` | UUID | PK |
| \`project_id\` | UUID | FK → projects.id |
| \`zone\` | TEXT | Nom de la zone |
| \`reason\` | TEXT | Raison de l'interdiction |

### \`app_configs\`
Registre de configuration admin avec versioning.

| Colonne | Type | Description |
|---|---|---|
| \`id\` | UUID | PK |
| \`key\` | TEXT | Clé de config (ex: 'capabilities') |
| \`payload\` | JSONB | Données de configuration |
| \`status\` | TEXT | 'draft' ou 'published' |
| \`version\` | INTEGER | Numéro de version |
| \`created_at\` | TIMESTAMPTZ | |
| \`updated_at\` | TIMESTAMPTZ | |

### \`avatars\`
Avatars/narrateurs disponibles.

| Colonne | Type | Description |
|---|---|---|
| \`id\` | UUID | PK |
| \`project_id\` | UUID | FK → projects.id (nullable = avatar global) |
| \`name\` | TEXT | Nom du personnage |
| \`style\` | TEXT | Style visuel (cartoon, realistic, etc.) |
| \`age\` | TEXT | Tranche d'âge |
| \`persona\` | TEXT | Rôle narratif |
| \`outfit\` | TEXT | Tenue vestimentaire |
| \`image_url\` | TEXT | URL de l'image |

### \`route_traces\`
Traces GPS enregistrées en mode reconnaissance.

| Colonne | Type | Description |
|---|---|---|
| \`id\` | UUID | PK |
| \`project_id\` | UUID | FK → projects.id |
| \`name\` | TEXT | Nom de la trace |
| \`geojson\` | JSONB | Tracé GeoJSON (LineString) |
| \`distance_meters\` | NUMERIC | Distance totale |
| \`started_at\` | TIMESTAMPTZ | Début d'enregistrement |
| \`ended_at\` | TIMESTAMPTZ | Fin d'enregistrement |

### \`route_markers\`
Marqueurs posés pendant l'enregistrement GPS.

| Colonne | Type | Description |
|---|---|---|
| \`id\` | UUID | PK |
| \`trace_id\` | UUID | FK → route_traces.id |
| \`lat\` | DOUBLE PRECISION | Latitude |
| \`lng\` | DOUBLE PRECISION | Longitude |
| \`note\` | TEXT | Note associée |
| \`photo_url\` | TEXT | Photo du marqueur |

### \`user_roles\`
Rôles utilisateurs (système RBAC).

| Colonne | Type | Description |
|---|---|---|
| \`id\` | UUID | PK |
| \`user_id\` | UUID | Référence auth.users |
| \`role\` | ENUM(app_role) | 'admin' |

## Enums PostgreSQL

| Enum | Valeurs |
|---|---|
| \`difficulty_level\` | easy, medium, hard |
| \`interaction_type\` | puzzle, qr_scan, photo, hidden_object, npc, audio |
| \`risk_level\` | low, medium, high |
| \`wifi_strength\` | ok, weak, dead |
| \`app_role\` | admin |

## Fonctions

### \`has_role(_role app_role, _user_id uuid)\`
Vérifie si un utilisateur possède un rôle donné. Utilisée dans les politiques RLS.

## Relations

- \`pois.project_id\` → \`projects.id\`
- \`wifi_zones.project_id\` → \`projects.id\`
- \`forbidden_zones.project_id\` → \`projects.id\`
- \`avatars.project_id\` → \`projects.id\`
- \`route_traces.project_id\` → \`projects.id\`
- \`route_markers.trace_id\` → \`route_traces.id\`
`;

const API_AND_EDGE_FUNCTIONS_MD = `# API et Edge Functions — QuestRides

## Edge Functions

### \`admin-signup\`
**Chemin :** \`supabase/functions/admin-signup/index.ts\`

Crée un nouvel utilisateur admin. Réservé aux admins existants.

**Méthode :** POST
**Auth :** Requise (admin)
**Body :**
\`\`\`json
{
  "email": "string",
  "password": "string"
}
\`\`\`

### \`create-first-admin\`
**Chemin :** \`supabase/functions/create-first-admin/index.ts\`

Crée le tout premier compte admin (bootstrap). Ne fonctionne que si aucun admin n'existe encore.

**Méthode :** POST
**Auth :** Aucune (première installation uniquement)
**Body :**
\`\`\`json
{
  "email": "string",
  "password": "string"
}
\`\`\`

## Flux d'Authentification

1. L'utilisateur accède à \`/auth\` → formulaire login
2. Supabase Auth gère la session (JWT)
3. Le hook \`useAuth()\` expose l'état de session
4. Le hook \`useAdminRole()\` vérifie le rôle admin via \`user_roles\`
5. Les pages admin vérifient le rôle avant d'afficher le contenu

## Accès aux Données (Client)

Toutes les requêtes passent par le client Supabase auto-généré :
\`\`\`
src/integrations/supabase/client.ts
\`\`\`

Les types sont auto-générés dans :
\`\`\`
src/integrations/supabase/types.ts
\`\`\`

## Sécurité

- Row Level Security (RLS) activé sur toutes les tables
- Les politiques RLS contrôlent l'accès en lecture/écriture
- Les Edge Functions vérifient l'authentification et le rôle admin
- Les clés API sensibles sont stockées comme secrets côté serveur
`;

const DEPLOYMENT_MD = `# Déploiement — QuestRides

## Environnement

| Variable | Description |
|---|---|
| \`VITE_SUPABASE_URL\` | URL du projet Supabase |
| \`VITE_SUPABASE_PUBLISHABLE_KEY\` | Clé publique (anon key) |
| \`VITE_SUPABASE_PROJECT_ID\` | ID du projet |

Ces variables sont gérées automatiquement par Lovable Cloud.

## Workflow de Déploiement

1. **Développement** : Les modifications de code sont appliquées en temps réel via Lovable
2. **Preview** : Chaque modification génère une URL de preview
3. **Publication** : Le bouton "Publish" déploie l'application en production
4. **Base de données** : Les migrations SQL sont gérées via le système de migrations Supabase
5. **Edge Functions** : Déployées automatiquement à chaque modification

## Build

- **Outil :** Vite
- **Commande :** \`npm run build\` (ou \`bun run build\`)
- **Sortie :** \`dist/\`
- **Tests :** \`vitest\` (configuration dans \`vitest.config.ts\`)

## Configuration Admin

Le panneau admin (\`/admin\`) utilise un workflow brouillon/publication :

1. Les modifications sont faites en local (state React)
2. "Sauvegarder" persiste un brouillon dans \`app_configs\` (status='draft')
3. "Publier" crée une nouvelle version publiée (status='published', version incrémentée)
4. L'Intake Form lit toujours la dernière version publiée
`;

export async function generateEscrowZip(): Promise<void> {
  const zip = new JSZip();
  
  const folder = zip.folder('QuestRides_Technical_Documentation');
  if (!folder) throw new Error('Failed to create ZIP folder');
  
  folder.file('ARCHITECTURE.md', ARCHITECTURE_MD);
  folder.file('HOOKS_AND_CONTEXT.md', HOOKS_AND_CONTEXT_MD);
  folder.file('TYPES_REFERENCE.md', TYPES_REFERENCE_MD);
  folder.file('DATABASE_SCHEMA.md', DATABASE_SCHEMA_MD);
  folder.file('API_AND_EDGE_FUNCTIONS.md', API_AND_EDGE_FUNCTIONS_MD);
  folder.file('DEPLOYMENT.md', DEPLOYMENT_MD);
  folder.file('README.md', `# QuestRides — Dossier Technique Escrow

Ce dossier contient la documentation technique complète de l'application QuestRides.

## Contenu

| Fichier | Description |
|---|---|
| \`ARCHITECTURE.md\` | Stack technique, structure des dossiers, flux de données |
| \`HOOKS_AND_CONTEXT.md\` | Documentation des hooks React et contextes partagés |
| \`TYPES_REFERENCE.md\` | Référence complète des types TypeScript |
| \`DATABASE_SCHEMA.md\` | Schéma de base de données, tables, relations, enums |
| \`API_AND_EDGE_FUNCTIONS.md\` | Endpoints, authentification, Edge Functions |
| \`DEPLOYMENT.md\` | Configuration, variables d'environnement, workflow |

## Note

Ce dossier est fourni à titre de documentation descriptive dans le cadre d'un processus d'escrow.
Il ne contient aucun fichier source (.ts, .tsx, .css, etc.).
Le code source complet sera transmis à la finalisation de la transaction.

---
Généré le ${new Date().toLocaleDateString('fr-FR')} par QuestRides Admin.
`);

  const blob = await zip.generateAsync({ type: 'blob' });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'QuestRides_Technical_Escrow.zip';
  a.click();
  URL.revokeObjectURL(url);
}
