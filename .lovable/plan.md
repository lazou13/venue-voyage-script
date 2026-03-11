

## Plan : Liens web/Instagram dans l'analyse IA + futur bouton Guide

### Objectif
Enrichir la sortie de `analyze-marker` pour que chaque restaurant et point d'intérêt inclue des liens (site web, Google Maps, Instagram) et des exemples de photos Instagram. Plus tard, un bouton "Guide" dans la chasse au trésor permettra au joueur de consulter ces infos.

### 1. Enrichir le schéma JSON de `analyze-marker`

**Fichier** : `supabase/functions/analyze-marker/index.ts`

**`nearby_restaurants`** — ajouter les champs :
- `website_url` (string, optionnel) : site web ou page TripAdvisor
- `instagram_handle` (string, optionnel) : compte Instagram (ex: `@nomadmarrakech`)
- `google_maps_query` (string) : requête de recherche Google Maps (ex: "Nomad Marrakech")

**Nouveau champ `nearby_pois`** — points d'intérêt proches (musées, monuments, jardins) :
```json
{
  "nearby_pois": [{
    "name": "Musée Dar Si Said",
    "type": "musée",
    "description_fr": "Arts marocains, bijoux berbères...",
    "website_url": "https://...",
    "instagram_handle": "@...",
    "google_maps_query": "Musée Dar Si Said Marrakech",
    "instagram_examples": ["url1", "url2"]
  }]
}
```

**`instagram_spot`** — ajouter :
- `instagram_examples` : tableau de descriptions/URLs d'exemples de posts Instagram populaires pour ce lieu

**Prompt système** — ajouter dans les instructions :
> "16. **Liens et références** : pour chaque restaurant et point d'intérêt, fournis les liens web, comptes Instagram et une requête Google Maps. Pour les lieux Instagram, donne des exemples de posts populaires."

Enrichir aussi la section gastronomie avec les comptes Instagram connus (ex: `@nomadmarrakech`, `@cafedespicesmarrakech`, `@lejardinmarrakech`).

### 2. Afficher les liens dans le panel d'analyse

**Fichier** : `src/components/intake/RouteReconStep.tsx`

Dans le panel d'analyse (lignes 1670-1678 pour restaurants), afficher les liens cliquables :
- Nom du restaurant cliquable vers Google Maps
- Icône Instagram cliquable vers le profil
- Section `nearby_pois` avec les mêmes liens

Dans la section Instagram (lignes 1680-1688), afficher les exemples de posts.

### 3. Bouton Guide (phase suivante, pas dans ce message)
Plus tard, dans le mode jeu (`QuestPlay`), un bouton "📖 Guide" ouvrira un panel avec les infos enrichies du POI (restaurants, musées, liens Instagram) pour que le joueur puisse explorer les alentours.

### Fichiers modifiés
1. `supabase/functions/analyze-marker/index.ts` — schéma + prompt
2. `src/components/intake/RouteReconStep.tsx` — affichage des liens

