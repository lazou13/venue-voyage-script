// wiki-name-enricher — Hunt Planer Pro
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LANDMARK_CATEGORIES = ['mosque','garden','museum','tomb','hammam','fountain','gate_bab','mausoleum','madrasa','palace','ruin','monument'];

function cleanName(name: any): string {
  const s = typeof name === 'object' ? (name?.fr ?? name?.en ?? Object.values(name as any)[0] ?? '') : String(name ?? '');
  return s.replace(/[\u0600-\u06FF]+/g, '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^(Le |La |Les |L'|Al |El )/i, '').trim();
}

async function fetchWikiSummary(name: string, lang = 'fr'): Promise<{ summary: string; description: string } | null> {
  try {
    const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name + ' Marrakech')}&srlimit=1&format=json&origin=*`;
    const searchResp = await fetch(searchUrl, { signal: AbortSignal.timeout(8000) });
    if (!searchResp.ok) return null;
    const results = (await searchResp.json())?.query?.search;
    if (!results?.length) return null;
    const summaryResp = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(results[0].title)}`, { signal: AbortSignal.timeout(8000) });
    if (!summaryResp.ok) return null;
    const summaryData = await summaryResp.json();
    const extract = summaryData?.extract;
    if (!extract || extract.length < 50) return null;
    const lower = extract.toLowerCase();
    if (!lower.includes('marrakech') && !lower.includes('maroc') && !lower.includes('morocco')) return null;
    return { summary: extract.substring(0, 500), description: (summaryData?.description ?? '').substring(0, 200) };
  } catch { return null; }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const batchSize = body.batch_size ?? 30;
    const category  = body.category ?? null;
    let query = supabase
      .from('pois')
      .select('id, name, category, zone')
      .is('wikidata_id', null)
      .is('wikipedia_summary', null)
      .not('enrichment_status', 'eq', 'name_enriched')
      .in('category', LANDMARK_CATEGORIES)
      .order('poi_score', { ascending: false })
      .limit(batchSize);
    if (category) query = query.eq('category', category);
    const { data: pois, error } = await query;
    if (error) throw error;
    if (!pois || pois.length === 0) {
      return new Response(JSON.stringify({ message: 'Aucun POI à enrichir', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    let enriched = 0;
    for (const poi of pois) {
      const cleaned = cleanName(poi.name);
      if (!cleaned || cleaned.length < 3) { await supabase.from('pois').update({ enrichment_status: 'name_enriched' }).eq('id', poi.id); continue; }
      let result = await fetchWikiSummary(cleaned, 'fr');
      if (!result) result = await fetchWikiSummary(cleaned, 'en');
      if (result) {
        await supabase.from('pois').update({ wikipedia_summary: result.summary, description_short: result.description || null, enrichment_status: 'name_enriched' }).eq('id', poi.id);
        enriched++;
      } else {
        await supabase.from('pois').update({ enrichment_status: 'name_enriched' }).eq('id', poi.id);
      }
      await new Promise(r => setTimeout(r, 200));
    }
    return new Response(JSON.stringify({ processed: pois.length, enriched }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
