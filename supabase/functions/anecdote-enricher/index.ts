// anecdote-enricher — Hunt Planer Pro (Perplexity sonar)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions";

function resolveName(row: any): string {
  return row.name_fr ?? row.name_en ?? row.name ?? 'POI';
}

async function enrichWithPerplexity(poi: any, apiKey: string): Promise<Record<string, any> | null> {
  const name = resolveName(poi);
  const category = poi.category_ai ?? poi.category ?? '';
  const zone = poi.zone || '';
  const existing = poi.description_short || '';

  const prompt = `Recherche approfondie sur "${name}" à Marrakech, Maroc.
Catégorie : ${category}. Zone : ${zone}.
${existing ? `Contexte existant : ${existing}` : ''}

Cherche dans des sources secondaires, archives, récits de voyageurs historiques, traditions orales documentées — pas seulement Wikipedia.

Réponds UNIQUEMENT en JSON valide sans markdown :
{
  "history_context": "Contexte historique narratif 150-200 mots en français. Structure obligatoire : époque/origine → personnage historique lié → fait architectural ou culturel précis avec chiffre ou mesure → lien avec ce que le visiteur voit aujourd'hui. Ton direct, jamais encyclopédique.",
  "local_anecdote_fr": "Anecdote locale 80-120 mots en français. Structure : situation initiale → élément perturbateur → résolution surprenante. Fait peu connu, contradiction historique, ou moment où l'histoire a failli basculer autrement. Finir par une phrase qui donne de la valeur au lieu.",
  "local_anecdote_en": "Même anecdote traduite en anglais naturel — pas mot à mot, adapter pour un lecteur anglophone.",
  "fun_fact_fr": "1 seule phrase en français. Un chiffre ou fait totalement inattendu qu'on peut dire en 10 secondes.",
  "fun_fact_en": "Même fun fact en anglais.",
  "crowd_level": "low ou medium ou high — fréquentation habituelle",
  "accessibility_notes": "1 phrase sur l'accessibilité physique : escaliers, sol irrégulier, largeur du passage, restrictions d'accès."
}`;

  const resp = await fetch(PERPLEXITY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        { role: 'system', content: 'Tu es un journaliste-historien spécialisé dans la médina de Marrakech. Tu écris pour des voyageurs curieux qui veulent comprendre la vraie vie d\'un lieu, pas lire un guide touristique. Tu cites des faits précis, des noms propres réels, des chiffres vérifiables. Tes anecdotes ont toujours une chute — un retournement, une ironie, une révélation. Tu parles directement au lecteur. Tu réponds uniquement en JSON valide.' },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (resp.status === 429) throw new Error('Rate limited — réessayez dans quelques secondes');
  if (resp.status === 402) throw new Error('Crédits Perplexity épuisés');
  if (!resp.ok) throw new Error(`Perplexity API error ${resp.status}: ${await resp.text()}`);

  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content ?? '';
  const citations = data.citations ?? [];
  
  const jsonMatch = text.match(/\{[\s\S]+\}/);
  if (!jsonMatch) return null;
  
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return { ...parsed, citations };
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  
  const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
  if (!PERPLEXITY_API_KEY) {
    return new Response(JSON.stringify({ error: 'PERPLEXITY_API_KEY non configurée.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  
  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const batchSize = Math.min(body.batch_size ?? 10, 20);
    const minScore = body.min_score ?? 2.0;
    const force = body.force === true;

    let query = supabase
      .from('medina_pois')
      .select('id, name, name_fr, name_en, category, category_ai, zone, description_short, history_context');
    
    if (!force) {
      query = query.is('local_anecdote_en', null);
    }
    
    query = query
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
    for (const poi of pois) {
      try {
        const result = await enrichWithPerplexity(poi, PERPLEXITY_API_KEY);
        if (!result) continue;

        const update: Record<string, any> = {};
        if (result.history_context && (force || !poi.history_context)) update.history_context = result.history_context;
        if (result.local_anecdote) update.local_anecdote = result.local_anecdote;

        if (Object.keys(update).length > 0) {
          const { error: updErr } = await supabase.from('medina_pois').update(update).eq('id', poi.id);
          if (!updErr) totalUpdated++;
        }
        // Delay between requests to avoid rate limiting
        await new Promise(r => setTimeout(r, 1500));
      } catch (e) {
        console.error(`Error enriching POI ${poi.id}:`, e);
        if (e instanceof Error && (e.message.includes('Rate limited') || e.message.includes('épuisés'))) throw e;
      }
    }

    return new Response(JSON.stringify({ processed: pois.length, updated: totalUpdated, source: 'perplexity-sonar' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('anecdote-enricher error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
