import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM_PROMPT = `Tu es un expert encyclopédique de la médina de Marrakech. Pour chaque POI, tu dois fournir un JSON structuré avec ces champs:
- category_ai: une parmi (artisan, restaurant, monument, riad, hotel, boutique, spot_photo, mosquee, fontaine, jardin, musee, souk, place, porte)
- district: quartier de la médina (ex: "Mouassine", "Bab Doukkala", "Mellah", "Kasbah", "Ben Youssef", "Jemaa el-Fna")
- description_short: 2-3 phrases de description touristique vivante en français
- history_context: contexte historique en 2-3 phrases
- local_anecdote: anecdote locale authentique
- instagram_spot: true/false — ce lieu est-il photogénique ?
- riddle_easy: énigme facile pour chasse au trésor (indices visuels)
- riddle_medium: énigme de difficulté moyenne (indices culturels/historiques)
- challenge: défi terrain à réaliser sur place
Réponds UNIQUEMENT avec le JSON, sans markdown ni commentaire.`;

async function enrichPOI(poi: any): Promise<Record<string, unknown>> {
  const reviews = (poi.google_raw?.details?.reviews ?? []).slice(0, 3).map((r: any) => r.text).join(" | ");
  
  const userPrompt = `POI: "${poi.name}"
Catégorie Google: ${poi.category_google ?? "unknown"}
Adresse: ${poi.address ?? "médina de Marrakech"}
Rating: ${poi.rating ?? "N/A"} (${poi.reviews_count ?? 0} avis)
Avis Google extraits: ${reviews || "aucun"}
Coordonnées: ${poi.lat}, ${poi.lng}`;

  const response = await fetch(AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "enrich_poi",
          description: "Enrichir un POI avec des données culturelles et des énigmes",
          parameters: {
            type: "object",
            properties: {
              category_ai: { type: "string", enum: ["artisan","restaurant","monument","riad","hotel","boutique","spot_photo","mosquee","fontaine","jardin","musee","souk","place","porte"] },
              district: { type: "string" },
              description_short: { type: "string" },
              history_context: { type: "string" },
              local_anecdote: { type: "string" },
              instagram_spot: { type: "boolean" },
              riddle_easy: { type: "string" },
              riddle_medium: { type: "string" },
              challenge: { type: "string" },
            },
            required: ["category_ai","district","description_short","history_context","local_anecdote","instagram_spot","riddle_easy","riddle_medium","challenge"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "enrich_poi" } },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No tool call in AI response");

  return JSON.parse(toolCall.function.arguments);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = body.batch_size ?? 5;
    const targetStatus = body.status ?? "raw";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const logs: string[] = [];

    // Fetch POIs to enrich
    const { data: pois, error: fetchErr } = await supabase
      .from("medina_pois")
      .select("*")
      .eq("enrichment_status", targetStatus)
      .limit(batchSize);

    if (fetchErr) throw fetchErr;
    if (!pois?.length) {
      return new Response(JSON.stringify({ success: true, enriched: 0, logs: ["No POIs to enrich"] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logs.push(`Found ${pois.length} POIs with status '${targetStatus}'`);
    let enriched = 0;
    let errors = 0;

    for (const poi of pois) {
      try {
        const enrichment = await enrichPOI(poi);
        logs.push(`✓ ${poi.name} → ${enrichment.category_ai} (${enrichment.district})`);

        const { error: updateErr } = await supabase
          .from("medina_pois")
          .update({
            category_ai: enrichment.category_ai,
            district: enrichment.district,
            description_short: enrichment.description_short,
            history_context: enrichment.history_context,
            local_anecdote: enrichment.local_anecdote,
            instagram_spot: enrichment.instagram_spot,
            riddle_easy: enrichment.riddle_easy,
            riddle_medium: enrichment.riddle_medium,
            challenge: enrichment.challenge,
            enrichment_status: "enriched",
          })
          .eq("id", poi.id);

        if (updateErr) {
          logs.push(`✗ update ${poi.name}: ${updateErr.message}`);
          errors++;
        } else {
          enriched++;
        }

        // Rate limit: 1s between AI calls
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        logs.push(`✗ ${poi.name}: ${e instanceof Error ? e.message : e}`);
        await supabase.from("medina_pois").update({ enrichment_status: "error" }).eq("id", poi.id);
        errors++;
      }
    }

    logs.push(`--- DONE: ${enriched} enriched, ${errors} errors ---`);

    return new Response(JSON.stringify({ success: true, enriched, errors, logs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("poi-enrich error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
