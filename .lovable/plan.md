

# Agent Autonome + Bibliothèque de Visites Pre-generees

## Reponse a ta question: Gemini 2.5 Flash suffit-il ?

**Oui, pour 90% des taches.** Gemini 2.5 Flash est excellent pour la classification, les tags audience, le street food, et les scores instagram. Cependant, pour la **generation de parcours narratifs complets** (titre, teaser, explication detaillee de pourquoi cette visite), je recommande d'utiliser **Gemini 2.5 Pro** uniquement pour cette etape (generation de visites). Le reste du pipeline reste sur Flash pour le cout et la vitesse.

## Architecture

```text
pg_cron (toutes les heures)
    │
    ▼
poi-auto-agent (orchestrateur)
    │
    ├─ Phase 1: Enrichissement POI (Flash)
    │   ├─ Photos manquantes → poi-fetch-photos
    │   ├─ Tags audience/accessibilite/street food/instagram → IA
    │   ├─ Wikipedia summaries → wiki-name-enricher
    │   └─ Re-enrichir POIs faibles → poi-enrich
    │
    └─ Phase 2: Generation de visites (Pro)
        ├─ Depart Koutoubia → 4 visites (famille, jeunes, PMR, food, photo)
        ├─ Depart Jemaa el-Fna → 4 visites
        ├─ Depart Mellah → 4 visites
        └─ Stockage dans quest_library
```

## Nouvelle table: `quest_library`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid | PK |
| `start_hub` | text | "koutoubia", "jemaa_el_fna", "mellah" |
| `start_lat/lng` | float | Coordonnees depart |
| `audience` | text | "family", "young_adults", "accessible", "foodies", "instagrammers" |
| `mode` | text | "guided_tour" ou "treasure_hunt" |
| `theme` | text | "food", "photography", "history", etc. |
| `difficulty` | text | "easy", "medium", "hard" |
| `title_fr/en` | text | Titre de la visite |
| `description_fr/en` | text | Explication detaillee: pourquoi, pour qui, quoi voir |
| `duration_min` | int | Duree estimee |
| `distance_m` | int | Distance totale |
| `stops_count` | int | Nombre d'arrets |
| `stops_data` | jsonb | Liste ordonnee des stops (meme format que generated_quests) |
| `highlights` | text[] | Points forts ("Street food authentique", "Spots photo", etc.) |
| `best_time` | text | "matin", "apres-midi", "golden hour" |
| `agent_version` | text | Version de l'agent qui a genere |
| `generated_at` | timestamptz | Date de generation |
| `quality_score` | numeric | Auto-evaluation par l'IA |

## Nouvelles colonnes sur `medina_pois` (enrichissement agent)

`audience_tags text[]`, `accessibility_notes text`, `street_food_spot boolean`, `street_food_details text`, `instagram_score integer`, `instagram_tips text`, `route_tags text[]`, `best_time_visit text`, `agent_enriched_at timestamptz`

## Edge Function: `poi-auto-agent`

A chaque appel horaire, l'agent:

1. **Detecte la priorite** — quel enrichissement a le plus de POIs non traites
2. **Phase enrichissement** (Gemini 2.5 Flash, batch de 15):
   - Genere en un appel: `audience_tags`, `accessibility_notes`, `street_food_spot/details`, `instagram_score/tips`, `route_tags`, `best_time_visit`
3. **Phase visites** (Gemini 2.5 Pro, 1 visite par appel):
   - Utilise le QuestEngine existant pour generer l'itineraire
   - Appelle l'IA pour generer titre, description, highlights, explication "pourquoi cette visite"
   - 3 departs x 5 audiences x 2 modes = ~30 visites a generer (puis idle)

## Points de depart fixes

| Hub | Lat | Lng |
|-----|-----|-----|
| Koutoubia | 31.6237 | -7.9934 |
| Jemaa el-Fna | 31.6295 | -7.9811 |
| Mellah | 31.6220 | -7.9770 |

## Monitoring UI (AdminPOIPipeline.tsx)

Ajouter une card "Agent Autonome" avec:
- Derniere execution, nombre de POIs enrichis, nombre de visites generees
- Bouton "Forcer une execution maintenant"
- Liste des visites generees dans la bibliotheque

## Fichiers

| Fichier | Action |
|---------|--------|
| Migration SQL | Creer `quest_library` + 9 colonnes sur `medina_pois` + pg_cron job |
| `supabase/functions/poi-auto-agent/index.ts` | Orchestrateur principal |
| `src/pages/admin/AdminPOIPipeline.tsx` | Card monitoring agent + visites |

