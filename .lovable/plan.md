

## Plan : Auto-fetch des photos Google Places pour les POIs

### Objectif
Créer une edge function qui, pour chaque POI ayant un `photo_reference` dans `google_raw` mais aucune photo dans `poi_media`, télécharge automatiquement la première photo Google Places et la stocke dans le bucket `poi-media`.

### Architecture

```text
AdminPOIPipeline (bouton "Fetch Photos")
  → Edge Function poi-fetch-photos
    → Pour chaque POI sans photo :
      1. Extraire photo_reference de google_raw.details.photos[0] (priorité) ou nearby.photos[0]
      2. GET Google Places Photo API (maxwidth=800)
      3. Upload image dans poi-media bucket : poi-media/{poi_id}/google_cover.jpg
      4. INSERT dans poi_media (media_type=photo, is_cover=true, role_tags=["repere"])
    → Retourner { fetched: N, skipped: N, errors: N }
```

### Fichiers à créer / modifier

**1. `supabase/functions/poi-fetch-photos/index.ts`** (nouveau)
- Edge function batch : traite jusqu'à 20 POIs par appel (éviter timeout)
- Query : `medina_pois` avec `google_raw` non vide, LEFT JOIN `poi_media` pour exclure ceux qui ont déjà une photo
- Pour chaque POI éligible :
  - Extraire `photo_reference` (details > nearby, premier élément)
  - Fetch `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=...&key=...`
  - La réponse est un redirect vers l'image (suivre le redirect, récupérer le blob)
  - Upload dans storage bucket `poi-media` sous `{poi_id}/google_cover.jpg`
  - Insert `poi_media` row avec `is_cover=true`, `media_type='photo'`, `role_tags='["repere"]'`
- Auth : admin only (vérifier JWT + has_role)
- CORS headers standard

**2. `supabase/config.toml`** — ne pas modifier (auto-géré)

**3. `src/pages/admin/AdminPOIPipeline.tsx`** (modification)
- Ajouter un bouton "Fetch Google Photos" dans la section existante du dashboard pipeline
- Appel `supabase.functions.invoke('poi-fetch-photos')` 
- Afficher le résultat (fetched / skipped / errors) dans un toast
- Bouton disabled pendant le loading

### Détails techniques

- **Batch de 20** : la Google Places Photo API a un quota, et l'edge function a un timeout de ~60s. 20 photos avec download + upload ≈ 30-40s.
- **Idempotent** : si un POI a déjà une entrée `poi_media` de type `photo`, il est skip.
- **Pas de migration DB** : on utilise les tables existantes (`medina_pois`, `poi_media`, storage `poi-media`).
- **photo_reference expiration** : les références Google expirent après quelques mois, d'où l'intérêt de télécharger et stocker maintenant.

### Résultat attendu
- Un bouton dans le pipeline dashboard
- En ~5-6 clics (20 POIs par batch), les 360 POIs éligibles ont leur cover photo
- Les photos sont visibles immédiatement dans l'éditeur POI (MediaSection)

