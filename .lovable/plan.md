

# Plan : Pont feedback clients HP ↔ QR Pro

## Constat

**Côté Quest Rides Pro (QR)** : le système de preuves est complet — table `proofs`, bucket `player-proofs`, composant `CameraScanner`, upload + validation IA, offline sync. Mais il n'y a **aucun mécanisme** pour renvoyer ces données vers Hunt Planer Pro (HP). Pas de table `traveler_recommendations` non plus.

**Côté Hunt Planer Pro (HP)** : les tables `quest_photos` et `client_poi_recommendations` existent, le bucket `quest-photos` aussi, mais **aucun code ne les alimente**. Pas d'endpoint `client-feedback`, pas de bouton capture dans QuestPlay, pas de page admin de modération.

**Le proxy `hunt-planer-proxy`** dans QR ne supporte que `list`, `project`, `library` — pas de POST feedback.

## Plan en 4 parties

### 1. Endpoint API `client-feedback` (HP)
- **Nouveau fichier** : `supabase/functions/client-feedback/index.ts`
- Accepte POST avec `type: "photo"` ou `type: "recommendation"`
- Pour les photos : reçoit un fichier base64, upload dans le bucket `quest-photos`, insère dans `quest_photos`
- Pour les recommandations : insère dans `client_poi_recommendations`
- Authentification via `access_token` de l'instance (pas de compte utilisateur requis)
- Validation des entrées avec Zod
- CORS ouvert (comme les autres endpoints publics)
- Ajout dans `supabase/config.toml` avec `verify_jwt = false`

### 2. Boutons capture dans QuestPlay (HP)
- **Nouveau hook** : `src/hooks/useQuestPhoto.ts`
  - Upload photo/vidéo vers bucket `quest-photos` (path : `{instance_id}/{poi_id}/{timestamp}`)
  - Insert dans `quest_photos` avec GPS auto (navigator.geolocation)
  - Gestion états loading/error
- **Modifier** `src/pages/QuestPlay.tsx` → composant `POIDetail`
  - Bouton 📷 "Prendre une photo" → `<input type="file" accept="image/*,video/*" capture="environment">`
  - Bouton ⭐ "Recommander ce lieu" → formulaire inline (note 1-5, commentaire, photo optionnelle)
  - Insert dans `client_poi_recommendations` via le SDK (RLS public insert déjà OK)
  - Afficher les photos déjà prises par ce client pour ce POI

### 3. Page admin modération (HP)
- **Nouveau fichier** : `src/pages/admin/AdminClientFeedback.tsx`
- Deux onglets :
  - **Photos clients** : grille paginée, filtre par POI/date, preview, bouton "Promouvoir vers poi_media" (copie l'entrée dans `poi_media` avec `media_type` et `storage_path`)
  - **Recommandations** : liste avec statut pending/approved/rejected, note, commentaire, lien vers le POI
- **Modifier** : `AdminSidebar.tsx` (ajout lien "Feedback clients") + `App.tsx` (route)

### 4. Proxy feedback côté QR Pro (à documenter)
- **Modifier** dans QR Pro : `hunt-planer-proxy/index.ts` → ajouter support pour `mode: "feedback"` qui fait un POST vers `client-feedback` de HP
- Ou bien QR Pro appelle directement l'endpoint HP (plus simple, même pattern que `hunt-planer-proxy` actuel)
- **Documentation** : comment QR Pro envoie les `proofs` pertinentes vers HP après une session

## Fichiers impactés (HP uniquement)

| Fichier | Action |
|---------|--------|
| `supabase/functions/client-feedback/index.ts` | **Créer** — endpoint API |
| `supabase/config.toml` | Ajouter config `client-feedback` |
| `src/hooks/useQuestPhoto.ts` | **Créer** — hook upload photo |
| `src/pages/QuestPlay.tsx` | Modifier — boutons capture + recommandation dans POIDetail |
| `src/pages/admin/AdminClientFeedback.tsx` | **Créer** — page modération |
| `src/components/admin/AdminSidebar.tsx` | Ajouter lien sidebar |
| `src/App.tsx` | Ajouter route |

## Hors scope (côté QR Pro, autre projet)
- Modification du proxy `hunt-planer-proxy` pour POST feedback → à faire dans le projet QR Pro séparément
- Boucle automatique "≥3 recommandations positives → flag POI pour validation" → phase 2 après que le flux de données existe

