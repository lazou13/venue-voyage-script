// enrichment-pipeline — Hunt Planer Pro (orchestrateur)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

async function callFn(name: string, body: Record<string, unknown>) {
  try {
    const resp = await fetch(`${BASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
        'apikey': ANON_KEY,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(55000),
    });
    const data = await resp.json();
    return { ok: resp.ok, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'timeout', data: {} };
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const steps = body.steps ?? ['wikidata', 'poi_enricher', 'photo', 'wiki_name', 'anecdote', 'riddle'];
  const log: string[] = [];
  const results: Record<string, unknown> = {};
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  if (steps.includes('wikidata')) {
    log.push('▶ wikidata-finder...');
    const cats = ['monument','mosque','garden','museum','tomb','hammam','fountain','gate_bab','madrasa','place','souk'];
    let total = 0;
    for (const cat of cats) { const r = await callFn('wikidata-finder', { batch_size: 30, category: cat }); if (r.ok) total += (r.data as any)?.found ?? 0; await sleep(500); }
    results.wikidata_finder = { found: total };
    log.push(`  ✓ ${total} IDs Wikidata trouvés`);
  }

  if (steps.includes('poi_enricher')) {
    log.push('▶ poi-enricher...');
    let total = 0;
    for (let i = 0; i < 8; i++) { const r = await callFn('poi-enricher', { batch_size: 50 }); const c = (r.data as any)?.enriched ?? 0; total += c; if (c === 0) break; await sleep(1000); }
    results.poi_enricher = { enriched: total };
    log.push(`  ✓ ${total} POIs enrichis via Wikidata`);
  }

  if (steps.includes('photo')) {
    log.push('▶ photo-fetcher...');
    let total = 0;
    for (let i = 0; i < 6; i++) { const r = await callFn('photo-fetcher', { batch_size: 30, min_score: 0 }); const c = (r.data as any)?.found ?? 0; total += c; if (c === 0) break; await sleep(500); }
    results.photo_fetcher = { photos: total };
    log.push(`  ✓ ${total} photos trouvées`);
  }

  if (steps.includes('wiki_name')) {
    log.push('▶ wiki-name-enricher...');
    let total = 0;
    for (let i = 0; i < 5; i++) { const r = await callFn('wiki-name-enricher', { batch_size: 30 }); const c = (r.data as any)?.enriched ?? 0; total += c; if (c === 0) break; await sleep(500); }
    results.wiki_name = { enriched: total };
    log.push(`  ✓ ${total} POIs enrichis via Wikipedia`);
  }

  if (steps.includes('anecdote')) {
    log.push('▶ anecdote-enricher...');
    let total = 0;
    for (let i = 0; i < 10; i++) { const r = await callFn('anecdote-enricher', { batch_size: 20, min_score: 0 }); if (!r.ok) { log.push(`  ⚠ ${(r.data as any)?.error}`); break; } const c = (r.data as any)?.updated ?? 0; total += c; if (c === 0) break; await sleep(1500); }
    results.anecdote_enricher = { updated: total };
    log.push(`  ✓ ${total} anecdotes générées`);
  }

  if (steps.includes('riddle')) {
    log.push('▶ riddle-generator...');
    let total = 0;
    for (let i = 0; i < 15; i++) { const r = await callFn('riddle-generator', { batch_size: 40, min_score: 0 }); if (!r.ok) { log.push(`  ⚠ ${(r.data as any)?.error}`); break; } const c = (r.data as any)?.updated ?? 0; total += c; if (c === 0) break; await sleep(1500); }
    results.riddle_generator = { updated: total };
    log.push(`  ✓ ${total} énigmes générées`);
  }

  let stats = null;
  try {
    const { data } = await supabase.rpc('get_poi_enrichment_stats');
    stats = data;
  } catch (_) { /* ignore */ }
  return new Response(JSON.stringify({ success: true, log, results, stats }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
