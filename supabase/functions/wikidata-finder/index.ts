// wikidata-finder — Hunt Planer Pro
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LANDMARK_CATEGORIES = [
  'monument','mosque','garden','museum','tomb','hammam',
  'fountain','gate_bab','madrasa','place','souk','palace','mausoleum','ruin'
];

function cleanSearchName(name: string): string {
  return name
    .replace(/[\u0600-\u06FF]+/g, '')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(Le |La |Les |L'|Al-|Al |El |El-)/i, '')
    .trim();
}

function resolveName(name: any): string {
  if (typeof name === 'object' && name !== null) {
    return name.fr ?? name.en ?? Object.values(name)[0] ?? '';
  }
  return String(name ?? '');
}

async function searchWikidata(name: string): Promise<{ id: string; label: string } | null> {
  try {
    const query = `${name} Marrakech`;
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=fr&limit=3&format=json&origin=*`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    const data = await resp.json();
    const results = data?.search;
    if (!results || results.length === 0) return null;
    for (const r of results) {
      const desc = (r.description ?? '').toLowerCase();
      if (desc.includes('marrakech') || desc.includes('maroc') || desc.includes('morocco')) {
        return { id: r.id, label: r.label };
      }
    }
    const desc0 = (results[0]?.description ?? '').toLowerCase();
    const monumentWords = ['mosquée','hammam','fontaine','medersa','palais','porte','jardin','musée','tombeau','mausolée','souk'];
    if (monumentWords.some(w => desc0.includes(w))) {
      return { id: results[0].id, label: results[0].label };
    }
    return null;
  } catch { return null; }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const batchSize = Math.min(body.batch_size ?? 30, 50);
    const category  = body.category ?? null;
    let query = supabase
      .from('pois')
      .select('id, name, category, zone')
      .is('wikidata_id', null)
      .not('enrichment_status', 'eq', 'wikidata_done')
      .in('category', LANDMARK_CATEGORIES)
      .order('poi_score', { ascending: false })
      .limit(batchSize);
    if (category) query = query.eq('category', category);
    const { data: pois, error } = await query;
    if (error) throw error;
    if (!pois || pois.length === 0) {
      return new Response(JSON.stringify({ message: 'Tous les POIs ont un wikidata_id', processed: 0, found: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    let found = 0, notFound = 0;
    for (const poi of pois) {
      const cleanName = cleanSearchName(resolveName(poi.name));
      if (!cleanName || cleanName.length < 3) { notFound++; continue; }
      const result = await searchWikidata(cleanName);
      if (result) { await supabase.from('pois').update({ wikidata_id: result.id }).eq('id', poi.id); found++; }
      else notFound++;
      await new Promise(r => setTimeout(r, 300));
    }
    return new Response(JSON.stringify({ processed: pois.length, found, not_found: notFound }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
