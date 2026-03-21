// photo-fetcher — Hunt Planer Pro
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function cleanName(name: any): string {
  const s = typeof name === 'object' ? (name?.fr ?? name?.en ?? Object.values(name as any)[0] ?? '') : String(name ?? '');
  return s.replace(/[\u0600-\u06FF]+/g, '').replace(/\s+/g, ' ').trim();
}

async function searchWikimediaCommons(terms: string[]): Promise<string | null> {
  for (const term of terms) {
    if (!term || term.length < 3) continue;
    try {
      const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(term)}&gsrlimit=5&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=800&format=json&origin=*`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!resp.ok) continue;
      const data = await resp.json();
      const pages = data?.query?.pages;
      if (!pages) continue;
      const images: Array<{ url: string; size: number }> = [];
      for (const page of Object.values(pages) as any[]) {
        const info = page?.imageinfo?.[0];
        if (!info) continue;
        const mime = info.mime ?? '';
        if (!mime.startsWith('image/jpeg') && !mime.startsWith('image/png')) continue;
        if ((info.size ?? 0) < 50000) continue;
        images.push({ url: info.thumburl ?? info.url, size: info.size ?? 0 });
      }
      if (images.length > 0) { images.sort((a, b) => b.size - a.size); return images[0].url; }
    } catch { continue; }
  }
  return null;
}

async function fetchWikidataPhoto(wikidataId: string): Promise<string | null> {
  try {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wikidataId}&props=claims&format=json&origin=*`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    const data = await resp.json();
    const p18 = data?.entities?.[wikidataId]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (!p18 || typeof p18 !== 'string') return null;
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(p18.replace(/ /g, '_'))}?width=800`;
  } catch { return null; }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const batchSize = Math.min(body.batch_size ?? 30, 50);
    const minScore  = body.min_score ?? 0;
    const { data: pois, error } = await supabase
      .from('pois')
      .select('id, name, name_fr, name_en, category, wikidata_id')
      .is('photo_url', null)
      .gte('poi_score', minScore)
      .order('poi_score', { ascending: false })
      .limit(batchSize);
    if (error) throw error;
    if (!pois || pois.length === 0) {
      return new Response(JSON.stringify({ message: 'Tous les POIs ont une photo', processed: 0, found: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    let found = 0;
    for (const poi of pois) {
      let photoUrl: string | null = null;
      if (poi.wikidata_id) photoUrl = await fetchWikidataPhoto(poi.wikidata_id);
      if (!photoUrl) {
        const name = cleanName(poi.name_fr ?? poi.name_en ?? poi.name);
        photoUrl = await searchWikimediaCommons([`${name} Marrakech`, `${name} medina`, name]);
      }
      if (photoUrl) {
        await supabase.from('pois').update({ photo_url: photoUrl, wikimedia_photo_url: photoUrl }).eq('id', poi.id);
        found++;
      }
      await new Promise(r => setTimeout(r, 200));
    }
    return new Response(JSON.stringify({ processed: pois.length, found }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
