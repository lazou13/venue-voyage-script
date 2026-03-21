

## Plan: Connect to external backend + New homepage with map and quest launcher

### Context

This project runs on Lovable Cloud (which provides its own backend). Since we cannot modify the auto-generated `.env` or `client.ts` files, we'll create a **secondary client** for the external project using the public anon key (safe to store in code since it's a publishable key).

### Architecture

```text
src/integrations/supabase/client.ts   ← Lovable Cloud (unchanged, auto-generated)
src/lib/externalSupabase.ts           ← NEW: external project client
```

### Changes

#### 1. Create external Supabase client (`src/lib/externalSupabase.ts`)
- Creates a standalone Supabase client pointing to `xaccaoedtbwywjotqhih.supabase.co` with the provided anon key
- Used by the new homepage and quest features

#### 2. Replace homepage route (`/`) with a new `HomePage` component
- **Map**: Full-screen Leaflet map centered on Marrakech medina (31.6295, -7.9811)
- **POI markers**: Fetches enriched POIs from `pois` table on the external backend (name, photo_url, lat/lng, description_short)
- Each marker shows a popup with name + photo thumbnail
- **"Demarrer une quete" button**: Fixed at bottom of screen
  - Requests browser geolocation
  - Calls `quest-ai-assistant` edge function on the external project with `{ start_lat, start_lng }`
  - Displays the generated quest steps in a bottom sheet/panel with step-by-step navigation

#### 3. Update `App.tsx` routing
- Change `/` route from `<Dashboard />` to `<HomePage />`
- Keep all admin routes intact (they continue using the Lovable Cloud client)

### Files to create/modify
- **Create** `src/lib/externalSupabase.ts` — external client
- **Create** `src/pages/HomePage.tsx` — map + POIs + quest launcher
- **Modify** `src/App.tsx` — swap root route

### Technical notes
- The external anon key is a publishable key, safe to include in client code
- POI queries use the external client; admin features continue using the Lovable Cloud client
- The quest-ai-assistant edge function is called via `externalSupabase.functions.invoke('quest-ai-assistant', { body: { start_lat, start_lng } })`
- Leaflet is already a dependency (used in QuestMap), so no new packages needed

