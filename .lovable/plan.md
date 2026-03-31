

# Fix POI Enrichment Data for Quest Rides Pro

## Problem

Quest Rides Pro fetches enrichment data from this project's `medina_pois` table via REST API. The query requests these columns: `price_info`, `opening_hours`, `must_see_details`, `must_try`, `must_visit_nearby`, `is_photo_spot`, `photo_tip`, `ruelle_etroite`, `wikipedia_summary`, `website_url`.

**But these columns don't exist in `medina_pois`.** The table only has `history_context`, `local_anecdote`, `website` (not `website_url`), and `instagram_spot` (not `is_photo_spot`). The REST API query fails silently, returning no enrichment data, so every POI shows the same generic fallback text.

## Solution (2 parts)

### Part 1: Add missing columns to `medina_pois` (this project)

Database migration to add:
- `price_info` (text) — pricing info
- `opening_hours` (jsonb) — structured hours
- `must_see_details` (text) — what to see
- `must_try` (text) — what to try
- `must_visit_nearby` (text) — nearby recommendations
- `is_photo_spot` (boolean, default false) — photo spot flag
- `photo_tip` (text) — photo advice
- `ruelle_etroite` (boolean, default false) — narrow alley warning
- `wikipedia_summary` (text) — Wikipedia extract
- `website_url` (text) — website URL (alias for existing `website`)

### Part 2: Populate the new columns via AI enrichment

Update the `poi-enrich` edge function to also generate `price_info`, `opening_hours`, `must_see_details`, `must_try`, `must_visit_nearby`, `is_photo_spot`, `photo_tip`, `ruelle_etroite` fields. The existing `history_context` data (370 POIs already enriched) will continue to work.

Also update `poi-autopipeline` to include these fields.

### Part 3: Backfill `website_url` from `website`

A simple migration: `UPDATE medina_pois SET website_url = website WHERE website IS NOT NULL AND website_url IS NULL`.

## Files changed

| File | Change |
|------|--------|
| Migration SQL | Add 10 columns to `medina_pois` + backfill `website_url` |
| `supabase/functions/poi-enrich/index.ts` | Add new fields to AI tool schema and update payload |
| `supabase/functions/poi-autopipeline/index.ts` | Same: add new fields to AI tool schema |
| `supabase/functions/anecdote-enricher/index.ts` | Optionally generate `must_try`, `must_see_details` |

## Impact

Once columns exist and are populated, Quest Rides Pro's `enrichStepsFromPOIs()` will successfully fetch personalized data per POI. "Histoire du lieu" will show real `history_context` (already populated for 370 POIs), and "Infos pratiques" will show real `price_info` and `opening_hours` instead of generic fallbacks.

