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
  "history_context": "OBLIGATOIRE : 200 à 250 mots en français. Pas moins de 200 mots — c'est une contrainte dure. Structure : époque/origine (2-3 phrases) → personnage historique avec nom précis et dates (2-3 phrases) → détails architecturaux ou culturels avec chiffres (2-3 phrases) → anecdote de détail inattendue (2 phrases) → lien avec ce que le visiteur voit aujourd'hui (1-2 phrases). Exemple de longueur attendue : 'La Koutoubia est l emblème de Marrakech, visible à des kilomètres à la ronde. Son minaret de 77 mètres, achevé en 1158 sous le sultan almohade Yacoub el-Mansour, est un chef-d œuvre de l architecture islamique qui a inspiré la Giralda de Séville et la Tour Hassan de Rabat. Son nom vient des koutoubiyine, les libraires qui tenaient boutique à ses pieds au Moyen Âge...' — ce niveau de détail et cette densité sont le minimum attendu.",
  "local_anecdote_fr": "OBLIGATOIRE : 100 à 130 mots en français. Pas moins de 100 mots — contrainte dure. Structure : situation initiale (2 phrases) → élément perturbateur ou révélation (2-3 phrases) → résolution surprenante (2 phrases) → phrase finale qui donne de la valeur au lieu (1 phrase). Exemple de niveau attendu : 'En réalité, il existe DEUX Koutoubia côte à côte ! La première mosquée, construite en 1147, fut détruite car son mihrab n était pas parfaitement orienté vers La Mecque – une erreur impardonnable. Le sultan ordonna sa reconstruction quelques mètres plus loin...' — cette densité narrative est le minimum.",
  "local_anecdote_en": "OBLIGATOIRE : 100 à 130 mots en English. Same narrative density as local_anecdote_fr. Natural English — not a word-for-word translation.",
  "fun_fact_fr": "1 seule phrase percutante, 20 à 35 mots maximum. Un chiffre ou fait totalement inattendu.",
  "fun_fact_en": "Same fun fact in English, 20 to 35 words.",
  "crowd_level": "low ou medium ou high uniquement.",
  "accessibility_notes": "1 phrase, 15 à 30 mots."
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

        const updateData: Record<string, unknown> = {};
        if (result.history_context && (force || !poi.history_context)) {
          updateData.history_context = result.history_context;
        }
        if (result.local_anecdote_fr) {
          updateData.local_anecdote = result.local_anecdote_fr;
          updateData.local_anecdote_fr = result.local_anecdote_fr;
        }
        if (result.local_anecdote_en) {
          updateData.local_anecdote_en = result.local_anecdote_en;
        }
        if (result.fun_fact_fr) {
          updateData.fun_fact_fr = result.fun_fact_fr;
        }
        if (result.fun_fact_en) {
          updateData.fun_fact_en = result.fun_fact_en;
        }
        if (result.crowd_level) {
          updateData.crowd_level = result.crowd_level;
        }
        if (result.accessibility_notes) {
          updateData.accessibility_notes = result.accessibility_notes;
        }

        if (Object.keys(updateData).length > 0) {
          const { error: updErr } = await supabase.from('medina_pois').update(updateData).eq('id', poi.id);
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
