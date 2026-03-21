// riddle-generator — Hunt Planer Pro (Lovable AI)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function resolveName(name: any): string {
  if (typeof name === 'object' && name !== null) return name.fr ?? name.en ?? Object.values(name)[0] ?? 'POI';
  return String(name ?? 'POI');
}

async function generateRiddles(pois: any[], apiKey: string): Promise<Record<string, any>> {
  const poiList = pois.map((p) => {
    const info = [
      `Nom: ${resolveName(p.name)}`,
      `Catégorie: ${p.category ?? ''}`,
      p.zone ? `Zone: ${p.zone}` : null,
      p.description_short ? `Description: ${p.description_short}` : null,
      p.history_context ? `Histoire: ${p.history_context.substring(0, 300)}` : null,
      p.wikipedia_summary ? `Wikipedia: ${p.wikipedia_summary.substring(0, 200)}` : null,
    ].filter(Boolean).join('\n');
    return `=== POI (ID: ${p.id}) ===\n${info}`;
  }).join('\n\n');

  const prompt = `Tu es un créateur expert de chasses au trésor pour la médina de Marrakech.

Pour chaque POI, génère 3 énigmes en français:
- riddle_easy: Pour familles avec enfants. Descriptive, directe. Max 2 phrases.
- riddle_medium: Pour adultes. Indirecte, métaphores simples. 2-3 phrases.
- riddle_hard: Pour experts. Poétique, références culturelles/historiques marocaines. 2-3 phrases.

RÈGLES:
- N'UTILISE JAMAIS le nom exact du lieu dans l'énigme
- Guide vers le lieu sans le nommer
- Utilise des détails visuels, historiques, sensoriels

JSON UNIQUEMENT:
{
  "ID_POI_1": { "easy": "...", "medium": "...", "hard": "..." },
  "ID_POI_2": { "easy": "...", "medium": "...", "hard": "..." }
}

POIs:
${poiList}`;

  const resp = await fetch(AI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (resp.status === 429) throw new Error('Rate limited — réessayez dans quelques secondes');
  if (resp.status === 402) throw new Error('Crédits Lovable AI épuisés — rechargez dans Settings > Workspace > Usage');
  if (!resp.ok) throw new Error(`AI gateway error ${resp.status}: ${await resp.text()}`);

  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content ?? '';
  const jsonMatch = text.match(/\{[\s\S]+\}/);
  if (!jsonMatch) throw new Error('Pas de JSON dans la réponse AI');
  return JSON.parse(jsonMatch[0]);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY non configurée.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const batchSize = Math.min(body.batch_size ?? 40, 40);
    const minScore  = body.min_score ?? 1.5;
    const category  = body.category ?? null;
    const CHUNK     = 20;
    let query = supabase
      .from('pois')
      .select('id, name, category, zone, description_short, history_context, wikipedia_summary')
      .is('riddle_easy', null)
      .gte('poi_score', minScore)
      .order('poi_score', { ascending: false })
      .limit(batchSize);
    if (category) query = query.eq('category', category);
    const { data: pois, error } = await query;
    if (error) throw error;
    if (!pois || pois.length === 0) {
      return new Response(JSON.stringify({ message: 'Tous les POIs ont des énigmes', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    let totalUpdated = 0;
    for (let i = 0; i < pois.length; i += CHUNK) {
      const chunk = pois.slice(i, i + CHUNK);
      const riddles = await generateRiddles(chunk, LOVABLE_API_KEY);
      for (const poi of chunk) {
        const r = riddles[poi.id];
        if (!r) continue;
        const { error: updErr } = await supabase.from('pois').update({
          riddle_easy:   r.easy   ?? null,
          riddle_medium: r.medium ?? null,
          riddle_hard:   r.hard   ?? null,
        }).eq('id', poi.id);
        if (!updErr) totalUpdated++;
      }
      if (i + CHUNK < pois.length) await new Promise(r => setTimeout(r, 1500));
    }
    return new Response(JSON.stringify({ processed: pois.length, updated: totalUpdated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
