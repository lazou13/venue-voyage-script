// anecdote-enricher — Hunt Planer Pro (Lovable AI)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function resolveName(row: any): string {
  return row.name_fr ?? row.name_en ?? row.name ?? 'POI';
}

async function generateAnecdotes(pois: any[], apiKey: string): Promise<Record<string, any>> {
  const poiList = pois.map((p) => {
    const info = [
      `Nom: ${resolveName(p)}`,
      `Catégorie: ${p.category_ai ?? p.category ?? ''}`,
      p.zone ? `Zone: ${p.zone}` : null,
      p.description_short ? `Description: ${p.description_short}` : null,
      p.history_context ? `Histoire: ${p.history_context.substring(0, 300)}` : null,
    ].filter(Boolean).join('\n');
    return `=== POI (ID: ${p.id}) ===\n${info}`;
  }).join('\n\n');

  const prompt = `Tu es un expert historien et conteur spécialisé dans la médina de Marrakech.

Pour chaque POI, génère en JSON:
- history_context: Contexte historique riche (150-250 mots français).
- local_anecdote: Anecdote locale authentique en français (80-120 mots).
- fun_fact_fr: Fait surprenant (30-50 mots). Format: "Le saviez-vous ? ..."

JSON UNIQUEMENT:
{
  "ID_POI": {
    "history_context":"...",
    "local_anecdote":"...",
    "fun_fact_fr":"..."
  }
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
  if (resp.status === 402) throw new Error('Crédits Lovable AI épuisés');
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
    const batchSize = Math.min(body.batch_size ?? 20, 20);
    const minScore  = body.min_score ?? 2.0;
    const CHUNK     = 10;

    let query = supabase
      .from('medina_pois')
      .select('id, name, name_fr, name_en, category, category_ai, zone, description_short, history_context')
      .is('local_anecdote', null)
      .gte('poi_quality_score', minScore)
      .not('status', 'in', '("filtered","merged")')
      .order('poi_quality_score', { ascending: false })
      .limit(batchSize);

    const { data: pois, error } = await query;
    if (error) throw error;
    if (!pois || pois.length === 0) {
      return new Response(JSON.stringify({ message: 'Tous les POIs ont des anecdotes', updated: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalUpdated = 0;
    for (let i = 0; i < pois.length; i += CHUNK) {
      const chunk = pois.slice(i, i + CHUNK);
      const anecdotes = await generateAnecdotes(chunk, LOVABLE_API_KEY);
      for (const poi of chunk) {
        const a = anecdotes[poi.id];
        if (!a) continue;
        const update: Record<string, any> = {};
        if (a.history_context && !poi.history_context) update.history_context = a.history_context;
        if (a.local_anecdote) update.local_anecdote = a.local_anecdote;
        if (Object.keys(update).length > 0) {
          const { error: updErr } = await supabase.from('medina_pois').update(update).eq('id', poi.id);
          if (!updErr) totalUpdated++;
        }
      }
      if (i + CHUNK < pois.length) await new Promise(r => setTimeout(r, 1500));
    }
    return new Response(JSON.stringify({ processed: pois.length, updated: totalUpdated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('anecdote-enricher error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});