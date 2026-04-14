

## Mise à jour des app_id + stratégie hybride API v2 / Sync

### 1. Corriger les app_id des clés API (HPP)

Migration SQL pour mettre à jour les références :
- `Questride B2C/B2B` : app_id `cflyexnquulsjpzbbayh` → `brhckhyrbpjfnieexggq`
- `QUEST RIDES PRO` : app_id `xaccaoedtbwywjotqhih` → `zdzycbqwypriveenxnsh`

### 2. Stratégie recommandée : hybride

```text
┌─────────────────────────────────────────────────┐
│              Hunt Planner Pro (HPP)              │
│         Source de vérité des POIs enrichis       │
├─────────────┬───────────────────────────────────┤
│  API v2     │  sync-pois-export                 │
│  (temps réel)│  (batch périodique)               │
└──────┬──────┴──────────┬────────────────────────┘
       │                 │
       ▼                 ▼
┌──────────────┐  ┌──────────────────┐
│  Questride   │  │  Quest Rides PRO │
│  B2C/B2B     │  │  Player          │
│              │  │                  │
│  API v2 pour │  │  API v2 pour     │
│  - catalogue │  │  - détails POI   │
│  - recherche │  │  - fun facts     │
│              │  │                  │
│  Sync pour   │  │  Sync pour       │
│  - tours     │  │  - tours miroir  │
│    existants │  │    existants     │
└──────────────┘  └──────────────────┘
```

### 3. Ajouter action `sync_projects` dans n8n-proxy (HPP)

Action qui appelle `sync-pois-import` sur les deux projets externes (plan précédent, inchangé).

### 4. Créer `sync-pois-import` sur Quest Rides PRO

Nouvelle Edge Function dans le projet `treasure-trail-tribe` qui importe les POIs enrichis depuis HPP (matching par nom + GPS).

### Fichiers modifiés
- **HPP** : migration SQL pour corriger les `app_id`
- **HPP** : `supabase/functions/n8n-proxy/index.ts` — ajout action `sync_projects`
- **Quest Rides PRO** : `supabase/functions/sync-pois-import/index.ts` — nouveau fichier

