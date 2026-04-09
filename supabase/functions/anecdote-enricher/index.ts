// anecdote-enricher — Hunt Planer Pro (Perplexity sonar) — v2 anti-hallucination
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

const SYSTEM_PROMPT = `Tu es un historien-journaliste expert de Marrakech.
Tu travailles pour un guide premium vendu à 50€.
Tes textes doivent être vérifiables, précis, et évocateurs.

RÈGLES ABSOLUES :
- INTERDITS : 'les habitants chuchotent', 'les anciens murmurent', 'la légende dit', 'on raconte que', 'selon la tradition'. Ces formules sont des clichés vides — elles signalent une hallucination.
- OBLIGATOIRE : citer des faits datés, des noms propres réels, des chiffres vérifiables, des événements historiques documentés.
- Si tu n'as pas d'information vérifiable sur ce lieu, dis-le explicitement dans local_anecdote_fr avec 'Données insuffisantes' — ne pas inventer.
- Ton direct, comme un article de magazine, pas une encyclopédie.

Tu réponds uniquement en JSON valide sans markdown.`;

function buildUserPrompt(poi: any): string {
  const name = resolveName(poi);
  const category = poi.category_ai ?? poi.category ?? '';
  const zone = poi.zone || '';
  const existingContext = poi.history_context ? poi.history_context.substring(0, 100) : '';

  return `Lieu : ${name}
Catégorie : ${category}
Zone : ${zone}
Contexte existant : ${existingContext}

STRUCTURE OBLIGATOIRE pour chaque champ :

history_context (200-250 mots) :
  Paragraphe 1 : Quand et par qui ce lieu a-t-il été créé/construit ?
    Citer l'année exacte et le nom du fondateur si connu.
  Paragraphe 2 : Quel événement historique précis s'y est passé ?
    Nommer les personnes impliquées, les dates, les conséquences.
  Paragraphe 3 : Qu'est-ce que le visiteur voit aujourd'hui
    et pourquoi c'est remarquable ?

local_anecdote_fr (80-100 mots MAXIMUM) :
  RÈGLE ABSOLUE : 1 seul fait surprenant ou inattendu.
  STRUCTURE OBLIGATOIRE :
  - Phrase 1 : LE FAIT BRUT, direct, sans introduction.
    Ex: 'En 1926, le protectorat français tenta de transformer Jemaa el-Fna en parking municipal.'
  - Phrases 2-3 : Ce qui s'est passé concrètement.
  - Phrase finale : Pourquoi c'est inattendu ou ce que ça révèle sur le lieu aujourd'hui.
  INTERDITS ABSOLUS :
  - Commencer par 'Imaginez', 'Saviez-vous', 'Il était une fois'
  - Faire plus de 100 mots
  - Répéter des informations déjà dans history_context
  - Formules vagues : 'ce lieu fascinant', 'incontournable'
  Si aucun fait vérifiable disponible :
  Écrire 'Données insuffisantes — ${name}'
  Ne JAMAIS inventer.

local_anecdote_en (100-130 mots) :
  Traduction naturelle de local_anecdote_fr.
  Adapter pour lecteur anglophone — pas mot à mot.

fun_fact_fr (20-35 mots) :
  1 chiffre ou fait totalement inattendu, vérifiable.
  Ex: 'La Koutoubia a deux mosquées superposées — la première fut détruite car son mihrab était mal orienté de quelques degrés.'

fun_fact_en (20-35 mots) :
  Traduction naturelle du fun_fact_fr.

crowd_level : 'low' | 'medium' | 'high'
  Basé sur la réalité terrain, pas sur l'attractivité théorique.

accessibility_notes (15-30 mots) :
  Accès physique réel : largeur des ruelles, marches, restrictions.

Réponds UNIQUEMENT en JSON valide sans markdown.`;
}

async function enrichWithPerplexity(poi: any, apiKey: string): Promise<Record<string, any> | null> {
  const resp = await fetch(PERPLEXITY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(poi) },
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
    const force = body.force === true;

    let query = supabase
      .from('medina_pois')
      .select('id, name, name_fr, name_en, category, category_ai, zone, description_short, history_context');

    if (!force) {
      query = query.is('local_anecdote_en', null);
    }

    query = query
      .in('enrichment_quality', ['suspect', 'unknown', 'low_value'])
      .gte('poi_quality_score', 4)
      .not('status', 'in', '("filtered","merged")')
      .order('enrichment_quality', { ascending: true })
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
          // Évaluer la qualité du contenu produit
          const hasRealFact = !result.local_anecdote_fr?.includes('chuchotent')
            && !result.local_anecdote_fr?.includes('murmurent')
            && !result.local_anecdote_fr?.includes('Données insuffisantes');

          const histLen = result.history_context?.length ?? poi.history_context?.length ?? 0;
          const quality = hasRealFact
            && result.local_anecdote_en
            && result.fun_fact_fr
            && histLen > 400
            ? 'good'
            : hasRealFact ? 'average' : 'suspect';

          const { error: updErr } = await supabase.from('medina_pois').update({
            ...updateData,
            enrichment_quality: quality,
            last_enriched_at: new Date().toISOString(),
          }).eq('id', poi.id);
          if (!updErr) totalUpdated++;
        }
        // Delay between requests to avoid rate limiting
        await new Promise(r => setTimeout(r, 1500));
      } catch (e) {
        console.error(`Error enriching POI ${poi.id}:`, e);
        if (e instanceof Error && (e.message.includes('Rate limited') || e.message.includes('épuisés'))) throw e;
      }
    }

    return new Response(JSON.stringify({ processed: pois.length, updated: totalUpdated, source: 'perplexity-sonar-v2' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('anecdote-enricher error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
