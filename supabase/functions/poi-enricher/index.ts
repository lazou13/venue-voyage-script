// poi-enricher — Hunt Planer Pro
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchWikidataEntities(ids: string[]): Promise<Record<string, any>> {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join("|")}&languages=fr|en|ar&props=labels|descriptions|sitelinks|claims&format=json&origin=*`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!resp.ok) return {};
  const data = await resp.json();
  return data?.entities ?? {};
}

async function fetchWikipediaSummary(lang: string, title: string): Promise<string | null> {
  try {
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    const data = await resp.json();
    const extract = data?.extract;
    return extract && extract.length > 50 ? extract.substring(0, 500) : null;
  } catch { return null; }
}

function getP18ImageUrl(entity: any): string | null {
  const p18 = entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  if (!p18 || typeof p18 !== 'string') return null;
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(p18.replace(/ /g, '_'))}?width=800`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const batchSize = body.batch_size ?? 50;
    const forceRedo = body.force_redo ?? false;
    let query = supabase
      .from('pois')
      .select('id, wikidata_id, name')
      .not('wikidata_id', 'is', null)
      .order('poi_score', { ascending: false })
      .limit(batchSize);
    if (!forceRedo) query = query.not('enrichment_status', 'eq', 'done');
    const { data: pois, error } = await query;
    if (error) throw error;
    if (!pois || pois.length === 0) {
      return new Response(JSON.stringify({ message: 'Aucun POI à enrichir', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    let enriched = 0;
    const CHUNK = 50;
    for (let i = 0; i < pois.length; i += CHUNK) {
      const chunk = pois.slice(i, i + CHUNK);
      const wikidataIds = chunk.map((p: any) => p.wikidata_id).filter(Boolean);
      const entities = await fetchWikidataEntities(wikidataIds);
      for (const poi of chunk) {
        const entity = entities[poi.wikidata_id];
        if (!entity) { await supabase.from('pois').update({ enrichment_status: 'done' }).eq('id', poi.id); continue; }
        const nameFr  = entity.labels?.fr?.value  ?? null;
        const nameEn  = entity.labels?.en?.value  ?? null;
        const nameAr  = entity.labels?.ar?.value  ?? null;
        const descFr  = entity.descriptions?.fr?.value ?? null;
        const descEn  = entity.descriptions?.en?.value ?? null;
        const photoUrl = getP18ImageUrl(entity);
        let wikiSummary: string | null = null;
        const frTitle = entity.sitelinks?.frwiki?.title;
        const enTitle = entity.sitelinks?.enwiki?.title;
        if (frTitle) wikiSummary = await fetchWikipediaSummary('fr', frTitle);
        if (!wikiSummary && enTitle) wikiSummary = await fetchWikipediaSummary('en', enTitle);
        const update: Record<string, any> = { enrichment_status: 'done', enriched_at: new Date().toISOString() };
        if (nameFr) update.name_fr = nameFr;
        if (nameEn) update.name_en = nameEn;
        if (nameAr) update.name_ar = nameAr;
        if (descFr || descEn) update.description_short = (descFr ?? descEn ?? '').substring(0, 200);
        if (photoUrl) { update.wikimedia_photo_url = photoUrl; update.photo_url = photoUrl; }
        if (wikiSummary) update.wikipedia_summary = wikiSummary;
        const { error: updErr } = await supabase.from('pois').update(update).eq('id', poi.id);
        if (!updErr) enriched++;
      }
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
