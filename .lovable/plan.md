

## Plan: Add enrichment pipeline launcher to AdminPOIPipeline

The enrichment pipeline button and progress UI will be added directly to the existing `AdminPOIPipeline.tsx` page (already at `/admin/poi-pipeline`), since that's the natural home for this functionality.

### What will be built

1. **"Lancer l'enrichissement" button** in the AdminPOIPipeline page that calls `supabase.functions.invoke('enrichment-pipeline', { body: { steps: [...] } })`

2. **Step-by-step progress display** showing all 6 steps with status indicators:
   - Pending (gray), Running (blue spinner), Success (green check), Error (orange warning)
   - A progress bar showing overall completion (0% → 100% as steps complete)

3. **Final summary card** after completion showing per-step results (counts enriched, errors) and overall stats

### Technical approach

Since the edge function runs synchronously and returns all results at once (it's not streaming), the UI will:
- Show all 6 steps as "pending" when launched
- Animate them to "running" state sequentially (estimated timing based on typical durations)
- On response, mark each step as success/error based on the `results` object
- Display errors in orange, successes in green
- Show the `log` array and `results` summary

### Changes

**`src/pages/admin/AdminPOIPipeline.tsx`**:
- Add a new `EnrichmentPipelineCard` section at the top of the page
- New state: `enrichmentRunning`, `enrichmentSteps` (array of step statuses), `enrichmentResults`
- The 6 steps: `wikidata`, `poi_enricher`, `photo`, `wiki_name`, `anecdote`, `riddle` with French labels
- On click: invoke the function, simulate step progression with timers, then reconcile with actual results
- Display errors per step in orange (`text-orange-500`), continue showing remaining steps
- Show final summary with counts from `results` object

No database changes needed. No new files needed.

