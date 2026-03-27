

## Plan: Extract SMIT Metrics JSON

### Approach
Run a Python script that queries both databases and generates a downloadable JSON file at `/mnt/documents/questrides_metrics_smit_2026.json`.

### Data sources
- **Hunt Planner Pro** (projects, pois, avatars, route_traces, etc.): Queried via `psql` against the Lovable Cloud DB
- **PMS Partenaires** (qr_codes, partners, scans, conversions, etc.): Queried via HTTP REST API against the external project (`xaccaoedtbwywjotqhih`) using the anon key

### Script logic
1. **Section 1 - Global DB**: Query `information_schema` and `pg_stat_user_tables` for table counts, sizes, enums, FK counts, indexes, RLS policies
2. **Section 2 - Hunt Planner**: Query `projects`, `pois`, `wifi_zones`, `forbidden_zones`, `avatars`, `route_traces`, `route_markers` with all the aggregations (by city, difficulty, interaction type, play mode, etc.)
3. **Section 3 - PMS**: HTTP GET to the external Supabase REST API for `qr_codes`, `partners`, `scans`, `conversions`, `commercials`, `alerts`, `audit_logs`, `commissions`, `reapprovisionnements`, `document_sends`, `whatsapp_templates`. Each query wrapped in try/except - if a table doesn't exist, that section shows `null` with an error note
4. **Section 4 - Technical**: Edge functions count (from filesystem), JSONB columns count, indexes count
5. Assemble everything into the JSON structure matching the user's template
6. Write to `/mnt/documents/questrides_metrics_smit_2026.json`

### Error handling
- Missing PMS tables will be logged and their sections set to `{"error": "table not found"}`
- All queries wrapped in try/except so partial data is still exported

### Output
Single file: `questrides_metrics_smit_2026.json` ready for download

### Files changed
None - this is a script-only data extraction task

