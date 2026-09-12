import JSZip from 'jszip';

const ECOSYSTEM_MD = `# Écosystème Produit — Hunt Planner Pro (HPP)

## Les trois applications

| Application | Rôle |
|---|---|
| **Hunt Planner Pro (HPP)** | Back-office "source de vérité" : bibliothèque de POI médina, enrichissements IA, audios, configurateur de chasses au trésor B2B, catalogue et commandes |
| **QUEST RIDES PRO (QRP)** | Assemblage et restitution des visites/séries finales à partir des contenus produits par HPP |
| **Questride (B2C/B2B)** | Diffusion et vente des expériences aux clients finaux |

## Frontière fonctionnelle

- HPP **ne fabrique pas** les visites finales. Il produit et qualifie des contenus sources (POI, textes, audios, couches narratives).
- QRP consomme ces contenus via des endpoints publics en lecture seule (\`api-v2\`, \`public-project-data\`).
- Le flux \`/intake/:projectId\` de HPP est strictement réservé aux chasses au trésor / quêtes sur mesure B2B. Il ne contient aucune logique de série narrative.

## Deux sources de données

| Source | Usage |
|---|---|
| Backend interne (Lovable Cloud / PostgreSQL) | Projets B2B, POI médina, enrichissements, quêtes générées, commandes |
| Backend externe Supabase (PMS partenaires) | Données publiques partenaires / PMS, consommées en lecture |

## Périmètre géographique

Bibliothèque POI strictement bornée à la médina de Marrakech :
latitude 31.60 → 31.67, longitude -8.02 → -7.97. Tout POI hors bornes est rejeté par le watchdog.

## Politique éditoriale

- Contenu natif en français, parité anglaise obligatoire (\`history_context_en\`, etc.).
- Noms de POI en alphabet latin uniquement (l'original arabe est conservé dans \`name_ar\`).
- Anti-hallucination stricte : en l'absence de fait vérifiable, le contenu généré indique explicitement "Données insuffisantes".
`;

const ARCHITECTURE_MD = `# Architecture Technique — Hunt Planner Pro

## Stack Technologique

| Couche | Technologie |
|---|---|
| Frontend | React 18 + TypeScript |
| Build | Vite 5 |
| Styling | Tailwind CSS + shadcn/ui |
| Routing | React Router DOM v6 |
| State serveur | TanStack React Query |
| Backend | Lovable Cloud (PostgreSQL managé) |
| Auth | Auth email/password + rôles applicatifs |
| Edge Functions | Deno (~48 fonctions) |
| Cartes | Leaflet + React-Leaflet |
| Géospatial | PostGIS (\`geometry_columns\`, \`streets\`, \`street_nodes\`) |
| IA | Passerelle IA (Gemini Pro/Flash, GPT-4o-mini), Perplexity (sonar), ElevenLabs (TTS) |
| ZIP client | JSZip |
| Graphiques | Recharts |

## Structure des Dossiers

\`\`\`
src/
├── assets/              # Images et fichiers statiques importés
├── components/
│   ├── admin/           # Composants du back-office
│   ├── docs/            # Onglets de documentation interne
│   ├── intake/          # Configurateur B2B (onglets + sous-composants)
│   │   └── shared/      # I18nInput, EnumSelect, OptionMatrix, etc.
│   ├── medina/          # Bibliothèque POI médina, fiches, enrichissement
│   ├── play/            # Interface de jeu / lecteur
│   └── ui/              # Composants shadcn/ui
├── contexts/            # AppConfigContext
├── hooks/               # Hooks métier (voir HOOKS_AND_CONTEXT.md)
├── integrations/        # Client backend auto-généré + types
├── lib/                 # Utilitaires et générateurs (exports, road book, escrow)
├── pages/
│   ├── admin/           # 16 pages back-office
│   └── *.tsx            # HomePage, Dashboard, IntakeForm, QuestPlay, Auth…
├── test/                # Configuration Vitest
└── types/               # Types TypeScript (intake.ts)

supabase/
├── config.toml          # Configuration des fonctions (verify_jwt)
├── functions/           # ~48 Edge Functions Deno
└── migrations/          # Migrations SQL
\`\`\`

## Routes de l'application

| Route | Écran |
|---|---|
| \`/\` | HomePage (vitrine / démo) |
| \`/dashboard\` | Liste et création de projets B2B |
| \`/intake/:projectId\` | Configurateur chasse au trésor / quête sur mesure |
| \`/play\` | Lecteur de quête (test terrain) |
| \`/auth\`, \`/reset-password\` | Authentification |
| \`/admin/dashboard\` | Pilotage global (métriques FR/EN) |
| \`/admin/medina-pois\` | Bibliothèque POI médina |
| \`/admin/poi-pipeline\` | Pipeline d'extraction/enrichissement |
| \`/admin/watchdog\` | Audit qualité et intégrité géographique |
| \`/admin/media-library\` | Médias et audios |
| \`/admin/quest-library\` | Bibliothèque de quêtes culturelles |
| \`/admin/client-feedback\` | Modération des retours joueurs |
| \`/admin/orders\`, \`/admin/catalog\` | Commandes et catalogue commercial |
| \`/admin/health\` | Santé technique de la plateforme |
| \`/admin/experience-page\` | Configuration de l'expérience publique |
| \`/admin/agent-chat\` | Agent IA expert médina |
| \`/admin/api-keys\` | Clés API partenaires (API v2) |
| \`/admin/enums\`, \`/admin/docs\` | Configuration et documentation |

## Flux de Données Principaux

### 1. Pipeline POI médina (cœur de HPP)
Extraction géographique (grille 100 m, rayon 150 m) → hygiène des données (dédoublonnage 15 m, filtrage) → classification IA et scoring → enrichissement narratif (7 champs) → traduction anglaise → génération audio TTS → auto-validation (score ≥ 3) → exposition API.

### 2. Configurateur B2B
Dashboard → \`/intake/:projectId\` (validation mode de jeu, carte, zones interdites, types d'étapes) → exports client : checklist, PRD, prompt IA, road book éditable, rapport interactif HTML.

### 3. Couche narrative (story_layer)
\`story-architect\` enrichit un POI médina et écrit \`medina_pois.metadata.story_layer\`. HPP ne produit **pas** la série finale ; QRP l'assemble à partir de ce champ exposé en top-level par les API publiques.

## Architecture Admin (Back-office)

- \`AppConfigContext\` encapsule un hook \`useAppConfig\` unique.
- Toutes les sous-pages admin lisent et écrivent dans ce contexte partagé.
- Workflow brouillon / publication avec versioning dans \`app_configs\`.
- Les tâches longues (pipeline, enrichissement) utilisent un auto-bouclage par lots côté client avec persistance d'état en base, pour résister aux délais d'exécution des fonctions serveur.
`;

const HOOKS_AND_CONTEXT_MD = `# Hooks et Contextes — Hunt Planner Pro

## Hooks Projet B2B

### \`useProject(projectId)\` — \`src/hooks/useProject.ts\`
CRUD d'un projet unique. Retourne \`project\`, \`isLoading\`, \`updateProject()\`, \`refetch()\`.

### \`usePOIs(projectId)\` — \`src/hooks/usePOIs.ts\`
Étapes du jeu d'un projet B2B (table \`pois\`). \`addPOI\`, \`updatePOI\`, \`deletePOI\`, \`reorderPOIs\`.

### \`useZones(projectId)\` — zones Wi-Fi et zones interdites.

### \`useAvatars(projectId?)\` — avatars/narrateurs (projet ou globaux).

## Hooks Bibliothèque médina

### \`useMedinaPOIs()\` — \`src/hooks/useMedinaPOIs.ts\`
Lecture, filtrage et mise à jour des POI de la bibliothèque médina (table \`medina_pois\`, 131 colonnes). Gère les statuts d'enrichissement, les scores qualité, les familles de visite.

### \`usePOIMedia()\` — médias associés à un POI (\`poi_media\`), photos et audios.

## Hooks Jeu & terrain

### \`useQuestEngine()\` — moteur de déroulé d'une quête (étapes, validation, scoring).
### \`useQuestInstances()\` — instances de parties (\`quest_instances\`).
### \`usePlayInstance()\` — état d'une session de jeu en cours.
### \`useQuestPhoto()\` — capture et validation photo d'étape.
### \`useRouteRecorder(projectId)\` — enregistrement GPS (filtrage du bruit, échantillonnage, autosauvegarde 15 s, marqueurs manuels ou géolocalisés).
### \`useVoiceRecorder()\` — notes vocales terrain.
### \`useWakeLock()\` — maintien de l'écran allumé pendant le terrain.

## Hooks Commerce & configuration

### \`useOrders()\` — commandes clients (\`orders\`).
### \`useAppConfig(key)\` — configuration admin avec workflow brouillon/publication.
### \`useCapabilities()\` — lecture de la config publiée (visibilité/obligation des champs Intake).
### \`useCrossTabStats()\` — métriques agrégées du tableau de bord.

## Hooks transverses

\`useAuth()\` (session), \`useAdminRole()\` (rôle via \`user_roles\`), \`useFileUpload()\`, \`useDebounce()\`, \`use-mobile\`, \`use-toast\`.

## Contextes

### \`AppConfigContext\` — \`src/contexts/AppConfigContext.tsx\`
Source unique de vérité pour l'état admin. Permet aux boutons globaux Sauvegarder/Publier du header de réagir aux modifications faites dans n'importe quel sous-module.
`;

const TYPES_REFERENCE_MD = `# Référence des Types — Hunt Planner Pro

Types principaux dans \`src/types/intake.ts\`.

## Enums

| Type | Valeurs |
|---|---|
| \`ProjectType\` | \`establishment\`, \`tourist_spot\`, \`route_recon\`, \`library\` |
| \`QuestType\` | \`exploration\`, \`sequential\`, \`timed_race\`, \`collaborative\`, \`team_competition\` |
| \`PlayMode\` | \`solo\`, \`team\`, \`one_vs_one\`, \`multi_solo\` |
| \`StepType\` | \`story\`, \`information\`, \`mcq\`, \`enigme\`, \`code\`, \`hangman\`, \`memory\`, \`photo\`, \`terrain\`, \`defi\`, \`transition\`, \`qr_code\`, \`info_qr\`, \`countdown\` |
| \`ValidationMode\` | \`qr_code\`, \`photo\`, \`code\`, \`manual\`, \`free\`, \`validation_chain\` |
| \`InteractionType\` | \`puzzle\`, \`qr_scan\`, \`photo\`, \`hidden_object\`, \`npc\`, \`audio\`, \`storytelling\`, \`video\` |
| \`TransportMode\` | \`walking\`, \`cycling\`, \`bus\`, \`car\`, \`boat\`, \`mixed\` |
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

### \`Project\` (table \`projects\`)

| Champ | Type | Description |
|---|---|---|
| \`id\` | UUID | Identifiant |
| \`hotel_name\` | string | Nom du lieu |
| \`city\` | string | Ville |
| \`floors\` | number | Nombre d'étages |
| \`quest_config\` | QuestConfig | Configuration complète (JSONB) |
| \`title_i18n\` / \`story_i18n\` | I18nText | Titre et histoire multilingues |
| \`difficulty\` | DifficultyLevel | Difficulté globale |
| \`theme\` | string | Thème narratif |
| \`is_complete\` | boolean | Projet complet |
| \`visit_date\` | string | Date de visite terrain |
| \`map_url\` | string | Plan uploadé |

### \`QuestConfig\` (\`projects.quest_config\`)
\`project_type\`, \`play_mode\`, \`questType\`, \`core\` (langues, audience, durée, transport), \`establishment_details\`, \`tourist_spot_details\`, \`route_recon_details\`, \`teamConfig\`, \`multiSoloConfig\`, \`scoring\`, \`storytelling\`, \`gps\`, \`decisions_validated\`.

### \`POI\` (table \`pois\`) — étape de quête B2B
\`id\`, \`project_id\`, \`name\`, \`zone\`, \`sort_order\`, \`interaction\`, \`risk\`, \`photo_url\`, \`minutes_from_prev\`, \`notes\`, \`step_config\` (JSONB).

### \`StepConfig\` (\`pois.step_config\`)
\`possible_step_types\`, \`possible_validation_modes\`, \`final_step_type\`, \`final_validation_mode\`, \`scoring\`, \`hints\`, \`branching\`, \`contentI18n\`, \`photoValidation\`, \`media\` (liste blanche \`media_ids\` pour le contrôle d'accès).

### \`BranchingLogic\`
\`onSuccess\` (UUID | \`next\` | \`intermediate\` | \`end\`), \`onFailure\` (UUID | \`retry\` | \`end\`), \`scoreAbove\`, \`scoreAboveTarget\`, \`scoreBelowTarget\`.

## Modèle \`story_layer\` (couche narrative POI médina)

Stocké dans \`medina_pois.metadata.story_layer\`, généré par \`story-architect\`, consommé par QRP.

\`\`\`json
{
  "version": "1.0",
  "hook": "accroche courte",
  "scene": ["éléments de scène observables"],
  "secret": "détail peu connu et vérifiable",
  "mission": {
    "instruction": "mission terrain 3-5 min",
    "respect_rules": ["règles de respect et sécurité"]
  },
  "audio": { "url_fr": null, "url_en": null }
}
\`\`\`

HPP ne produit aucune notion d'épisode, de numéro d'épisode ni de transition entre POI : l'assemblage en série relève exclusivement de QRP.
`;

const DATABASE_SCHEMA_MD = `# Schéma de Base de Données — Hunt Planner Pro

Base PostgreSQL managée (Lovable Cloud), extension PostGIS activée.
Row Level Security activée sur toutes les tables applicatives, avec GRANT explicites par rôle.

## Bibliothèque médina (cœur métier)

### \`medina_pois\` (131 colonnes)
Table de référence des points d'intérêt de la médina de Marrakech.

| Groupe de colonnes | Contenu |
|---|---|
| Identité | \`id\`, \`name\`, \`name_ar\`, \`slug\`, \`category\`, \`subcategory\` |
| Géographie | \`lat\`, \`lng\`, \`geom\` (PostGIS), \`district\`, \`address\` |
| Enrichissement FR | \`history_context\`, \`local_anecdote\`, \`practical_info\`, \`sensory_description\`, … |
| Enrichissement EN | \`history_context_en\`, \`local_anecdote_en\`, … (parité obligatoire) |
| Qualité | \`poi_quality_score\`, \`enrichment_status\`, \`validation_status\`, \`is_main_visit\` |
| Média | \`cover_image_url\`, \`audio_url_fr\`, \`audio_url_en\` |
| Divers | \`metadata\` (JSONB : \`visit_families\`, \`tier_by_family\`, \`story_layer\`, clés de reclassement) |

\`is_main_visit = true\` identifie la source unique des visites guidées exposées à QRP.

### \`poi_media\`, \`poi_quality_reports\`, \`watchdog_reports\`
Médias attachés aux POI, rapports de qualité et audits quotidiens (champs manquants, GPS, bornes géographiques).

### \`street_nodes\`, \`streets\`, \`streets_walking_cost\`
Graphe piéton de la médina pour le calcul d'itinéraires et de distances réelles.

## Projets B2B et jeu

| Table | Rôle |
|---|---|
| \`projects\` | Projets de chasse au trésor / quête sur mesure |
| \`pois\` | Étapes d'un projet B2B (37 colonnes, \`step_config\` JSONB) |
| \`wifi_zones\`, \`forbidden_zones\` | Contraintes terrain d'un projet |
| \`avatars\` | Narrateurs/personnages |
| \`route_traces\`, \`route_markers\` | Traces GPS et marqueurs de reconnaissance terrain |
| \`quest_library\` | Bibliothèque de quêtes culturelles prêtes à l'emploi |
| \`generated_quests\` | Quêtes générées par IA |
| \`quest_narratives_cache\` | Cache de narration (clé SHA-256) |
| \`quest_instances\`, \`quest_instance_devices\`, \`quest_photos\` | Parties jouées, appareils autorisés, photos joueurs |
| \`visit_types\` | Typologies de visites proposées |

## Commerce, retours et exploitation

| Table | Rôle |
|---|---|
| \`orders\` | Commandes clients |
| \`client_photos\`, \`client_recommendations\`, \`client_poi_recommendations\` | Retours joueurs et modération |
| \`api_keys\`, \`api_usage\` | Clés partenaires API v2 et quotas |
| \`app_configs\` | Configuration admin versionnée (draft/published) |
| \`pipeline_runs\`, \`import_batches\` | Suivi d'exécution du pipeline POI |
| \`audio_inventory_snapshot\`, \`audio_irrecoverable\` | Inventaire et anomalies audio |
| \`email_send_log\`, \`email_send_state\`, \`email_unsubscribe_tokens\`, \`suppressed_emails\` | Système de notifications e-mail |
| \`suspicious_devices\` | Détection d'abus côté lecteur |
| \`user_roles\` | Rôles applicatifs (RBAC) |

## Vues

| Vue | Rôle |
|---|---|
| \`v_poi_qrp_readiness\` | POI prêts pour consommation QRP |
| \`v_top_pois\` | Classement qualité des POI |

## Sécurité

### \`has_role(_user_id uuid, _role app_role)\`
Fonction \`SECURITY DEFINER\` utilisée dans les politiques RLS pour éviter la récursion.
Les rôles sont stockés exclusivement dans \`user_roles\` (jamais sur un profil utilisateur).

Autres garde-fous : liste blanche CORS sur les endpoints publics, limitation de débit, contrôle d'accès média par \`media_ids\`, suivi des appareils autorisés par instance de jeu.
`;

const API_AND_EDGE_FUNCTIONS_MD = `# API et Edge Functions — Hunt Planner Pro

Environ 48 Edge Functions Deno, regroupées par domaine.

## API publiques consommées par QRP / Questride

### \`api-v2\`
API partenaire authentifiée par en-tête \`X-API-Key\`, quotas journaliers (5 000–10 000 appels).

| Route | Contenu |
|---|---|
| \`?route=pois\` | Liste de POI (colonnes publiques) |
| \`?route=poi&id=\` | Fiche POI détaillée |
| \`?route=main-visits\` | POI \`is_main_visit = true\` — source des visites guidées, inclut \`story_layer\` en top-level |
| \`?route=sync\` | Synchronisation en masse (max 200), champs traduits, \`visit_families\`, \`tier_by_family\`, \`story_layer\` ; \`metadata\` non exposée |

### \`public-project-data\`
Endpoint public en lecture seule (cache HTTP \`max-age=300\`).
Modes : \`health\`, \`list\`, \`project\`, \`library\`, \`tours\`.
Le mode \`library\` expose \`story_layer\` en champ top-level (\`null\` si le POI n'est pas enrichi).

### Autres endpoints publics
\`public-generate-quest\` (génération paramétrée avec hubs de départ), \`public-buy-catalog\`, \`public-zones\`, \`submit-recommendation\`, \`collect-client-media\`, \`client-feedback\`, \`get-media-urls\`, \`start-instance\`.

## Pipeline POI et enrichissement

| Fonction | Rôle |
|---|---|
| \`poi-extract\` | Extraction par grille géographique (100 m / rayon 150 m) |
| \`poi-worker\`, \`poi-auto-agent\` | Traitement par lots auto-bouclés |
| \`poi-classify-worker\` | Classification et scoring IA |
| \`poi-enricher\`, \`poi-enrich-single\`, \`anecdote-enricher\` | Enrichissement narratif (structure 80–100 mots : fait, contexte, conclusion) |
| \`poi-backfill-details\`, \`poi-proximity\` | Complétion et calculs de proximité |
| \`poi-quality-agent\`, \`poi-watchdog\` | Correction d'anomalies et audit quotidien |
| \`poi-wikidata\`, \`wikidata-finder\`, \`wiki-name-enricher\` | Rapprochement Wikidata / Wikimedia |
| \`photo-fetcher\`, \`poi-fetch-photos\` | Récupération de photos (lots de 20) |
| \`translate\` | Traduction FR → EN |
| \`enrichment-pipeline\` | Orchestrateur du pipeline |
| \`story-architect\` | Génération de \`metadata.story_layer\` par POI (mode \`dry_run\`, cache, régénération explicite) |

## Audio

\`generate-poi-audio\` (TTS ElevenLabs : voix \`JdwJ7jL68CWmQZuo7KgG\`, vitesse 0,75 ; texte source brut, jamais réécrit), \`audio-inventory-scan\`, \`regen-irrecoverable-audios\`, \`import-audio-to-hpp\`, \`pull-audio-from-questride\`.

## Quêtes

\`generate-quest\`, \`quest-library-rebuild\`, \`quest-library-enrich-missions\`, \`riddle-generator\`, \`analyze-marker\`, \`promote-marker-to-library\`, \`sync-pois-export\`.

## Administration et plateforme

\`admin-signup\`, \`create-first-admin\`, \`admin-run-cleanup\`, \`agent-chat\` (agent IA expert médina, mode conversationnel et vision), \`n8n-proxy\` (actions asynchrones centralisées, validation JWT / X-API-Key), \`process-email-queue\`.

## Authentification

1. \`/auth\` → connexion e-mail/mot de passe
2. Session JWT gérée par le backend
3. \`useAuth()\` expose l'état de session
4. \`useAdminRole()\` vérifie le rôle via \`user_roles\`
5. Les pages \`/admin/*\` sont protégées par \`ProtectedRoute requireAdmin\`

## Politique d'accès des fonctions

Certaines fonctions de pipeline sont déclarées \`verify_jwt = false\` et protégées par clé API applicative, afin de permettre l'exécution par des orchestrateurs externes et des tâches planifiées (cron d'enrichissement autonome toutes les 15 minutes).

## Accès aux données côté client

Client backend auto-généré dans \`src/integrations/supabase/client.ts\`, types auto-générés dans \`src/integrations/supabase/types.ts\`. Ces deux fichiers ne sont jamais édités manuellement.
`;

const DEPLOYMENT_MD = `# Déploiement — Hunt Planner Pro

## Environnement

| Variable | Description |
|---|---|
| \`VITE_SUPABASE_URL\` | URL du backend |
| \`VITE_SUPABASE_PUBLISHABLE_KEY\` | Clé publique |
| \`VITE_SUPABASE_PROJECT_ID\` | Identifiant du projet |

Ces variables sont gérées automatiquement par Lovable Cloud.
Les secrets serveur (clés IA, ElevenLabs, Perplexity, clés partenaires, service role) sont stockés côté fonctions et ne sont jamais exposés au client.

## Workflow de Déploiement

1. **Développement** : modifications appliquées en temps réel.
2. **Preview** : URL de prévisualisation par version.
3. **Publication** : déploiement en production, domaine personnalisé pris en charge.
4. **Base de données** : migrations SQL versionnées.
5. **Edge Functions** : déployées automatiquement à chaque modification.

## Build

- **Outil :** Vite
- **Commande :** \`bun run build\` (ou \`npm run build\`)
- **Sortie :** \`dist/\`
- **Tests :** \`vitest\` (\`vitest.config.ts\`)

## Configuration Admin

Le back-office \`/admin\` utilise un workflow brouillon/publication :

1. Modifications locales (state React via \`AppConfigContext\`)
2. "Sauvegarder" → brouillon dans \`app_configs\` (\`status='draft'\`)
3. "Publier" → nouvelle version active (\`status='published'\`, \`version\` incrémentée)
4. Le configurateur Intake lit toujours la dernière version publiée

## Exploitation courante

- Pipeline POI piloté depuis \`/admin/poi-pipeline\`, état persisté en base pour reprise après interruption.
- Agent d'enrichissement autonome planifié (toutes les 15 min, lots de traduction 20×10).
- Watchdog quotidien : champs manquants, GPS absent, POI hors bornes médina.
- Supervision technique via \`/admin/health\`.
- Notifications e-mail transactionnelles via domaine dédié.
`;

// Code source embarqué en texte brut au build (Vite raw imports).
// Frontend + backend Deno + configuration, hors binaires et secrets (.env jamais globés).
const sourceFiles = import.meta.glob(
  [
    '/src/**/*.{ts,tsx,css}',
    '/supabase/functions/**/*.ts',
    '/supabase/config.toml',
    '/supabase/migrations/*.sql',
    '/package.json',
    '/index.html',
    '/vite.config.ts',
    '/tailwind.config.ts',
    '/tsconfig.json',
    '/tsconfig.app.json',
    '/tsconfig.node.json',
    '/components.json',
    '/vitest.config.ts',
    '/postcss.config.js',
    '/eslint.config.js',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

export async function generateEscrowZip(): Promise<void> {
  const zip = new JSZip();

  const folder = zip.folder('HuntPlannerPro_Technical_Documentation');
  if (!folder) throw new Error('Failed to create ZIP folder');

  const srcFolder = folder.folder('SOURCE_CODE');
  if (!srcFolder) throw new Error('Failed to create ZIP source folder');

  let sourceCount = 0;
  for (const [path, content] of Object.entries(sourceFiles)) {
    // path absolu type "/src/..." → chemin relatif dans le ZIP
    const relative = path.replace(/^\//, '');
    srcFolder.file(relative, content);
    sourceCount++;
  }

  folder.file('ECOSYSTEM.md', ECOSYSTEM_MD);
  folder.file('ARCHITECTURE.md', ARCHITECTURE_MD);
  folder.file('HOOKS_AND_CONTEXT.md', HOOKS_AND_CONTEXT_MD);
  folder.file('TYPES_REFERENCE.md', TYPES_REFERENCE_MD);
  folder.file('DATABASE_SCHEMA.md', DATABASE_SCHEMA_MD);
  folder.file('API_AND_EDGE_FUNCTIONS.md', API_AND_EDGE_FUNCTIONS_MD);
  folder.file('DEPLOYMENT.md', DEPLOYMENT_MD);
  folder.file('README.md', `# Hunt Planner Pro — Dossier Technique Escrow

Documentation technique descriptive de l'application Hunt Planner Pro (HPP).

## Contenu

| Fichier | Description |
|---|---|
| \`ECOSYSTEM.md\` | Rôles respectifs de HPP, QUEST RIDES PRO et Questride, frontières produit |
| \`ARCHITECTURE.md\` | Stack technique, structure des dossiers, routes, flux de données |
| \`HOOKS_AND_CONTEXT.md\` | Hooks React métier et contextes partagés |
| \`TYPES_REFERENCE.md\` | Types TypeScript et modèle \`story_layer\` |
| \`DATABASE_SCHEMA.md\` | Tables, vues, relations, sécurité RLS |
| \`API_AND_EDGE_FUNCTIONS.md\` | Edge Functions, API publiques, authentification |
| \`DEPLOYMENT.md\` | Environnement, build, workflow d'exploitation |

## Note

Ce dossier est fourni à titre de documentation descriptive dans le cadre d'un processus d'escrow.
Il ne contient aucun fichier source (.ts, .tsx, .css, etc.).
Le code source complet sera transmis à la finalisation de la transaction.

---
Généré le ${new Date().toLocaleDateString('fr-FR')} par Hunt Planner Pro Admin.
`);

  const blob = await zip.generateAsync({ type: 'blob' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'HuntPlannerPro_Technical_Escrow.zip';
  a.click();
  URL.revokeObjectURL(url);
}
