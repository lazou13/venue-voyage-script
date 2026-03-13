

## Plan : API complète pour Quest Rides Pro — tous les projets et données

### Contexte
Quest Rides Pro a besoin de récupérer **toutes** les données de Hunt Planer Pro, pas seulement la bibliothèque `medina_pois`. Cela inclut les projets (Medina Treasure, Palmeride, M Avenue...), leurs POIs, traces GPS, marqueurs terrain, et la configuration complète.

### Données existantes à exposer

| Table | Contenu | Exemples |
|-------|---------|----------|
| `projects` | Config complète (quest_config, title_i18n, story_i18n) | PALMERIDE (7 POIs, 8 traces), MEDINA TREASURE, M AVENUE |
| `pois` | Étapes de quête liées aux projets | step_config, interaction, zone, photo_url |
| `route_traces` | Traces GPS (GeoJSON LineString) | 22 traces pour QUESTRIDES Familles |
| `route_markers` | Marqueurs terrain (photos, audio, notes) | photo_urls[], audio_url, note |
| `medina_pois` | Bibliothèque de POIs réutilisables | Avec poi_media associés |
| `avatars` | Personnages narrateurs | image_url, persona, style |

### Solution : Edge Function `public-project-data`

Une seule Edge Function avec plusieurs modes d'accès :

**Modes :**
- `mode=list` — Liste tous les projets (id, nom, ville, résumé config)
- `mode=project&id=UUID` — Un projet complet avec ses POIs, traces, marqueurs, avatars
- `mode=library` — Bibliothèque medina_pois (validés + actifs) avec médias

**Sécurité :**
- `verify_jwt = false` (cross-project)
- CORS via `PUBLIC_SITE_ORIGIN`
- Rate limit IP 120 req/h
- Cache 5 min
- Pas de données sensibles (pas de tokens, pas d'orders)

**Réponse `mode=project` :**
```json
{
  "project": {
    "id": "...", "hotel_name": "PALMERIDE", "city": "Marrakech",
    "quest_config": { ... }, "title_i18n": { ... }, "story_i18n": { ... }
  },
  "pois": [ { "id": "...", "name": "...", "step_config": { ... } } ],
  "traces": [ { "id": "...", "geojson": { ... }, "markers": [ ... ] } ],
  "avatars": [ { "id": "...", "name": "...", "image_url": "..." } ]
}
```

**Réponse `mode=library` :**
```json
{
  "pois": [ { "id": "...", "name": "Fontaine Mouassine", "zone": "...", "media": [ ... ] } ]
}
```

### Fichiers créés/modifiés
1. **`supabase/functions/public-project-data/index.ts`** — nouvelle Edge Function
2. **`supabase/config.toml`** — ajout `[functions.public-project-data] verify_jwt = false`

