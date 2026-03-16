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

const SYSTEM_PROMPT = `Tu es un expert encyclopédique de la médina de Marrakech et un concepteur de jeux de piste touristiques.

Pour chaque POI, tu dois fournir un JSON structuré avec TOUS ces champs:

CLASSIFICATION:
- category_ai: une parmi (artisan, restaurant, cafe, monument, riad, hotel, boutique, souvenir_shop, spa, gallery, viewpoint, historic_site, mosquee, fontaine, jardin, musee, souk, place, porte)
- subcategory: sous-catégorie libre (ex: "poterie", "tapis", "pâtisserie orientale", "palais", "médersa")
- poi_quality_score: score de 1 à 10 basé sur l'intérêt touristique, la notoriété, le rating Google et le nombre d'avis
- tourist_interest: phrase courte décrivant l'intérêt touristique principal

CONTENU:
- district: quartier de la médina (ex: "Mouassine", "Bab Doukkala", "Mellah", "Kasbah", "Ben Youssef", "Jemaa el-Fna", "Riad Zitoun")
- description_short: 2-3 phrases de description touristique vivante en français
- history_context: contexte historique en 2-3 phrases (si pertinent, sinon "")
- local_anecdote: anecdote locale authentique et mémorable
- instagram_spot: true/false — ce lieu est-il photogénique ?

JEUX DE PISTE:
- riddle_easy: énigme facile pour chasse au trésor (indices visuels, observable sur place)
- riddle_medium: énigme de difficulté moyenne (indices culturels/historiques, nécessite réflexion)
- challenge: défi terrain à réaliser sur place (photo, interaction, observation)

Réponds UNIQUEMENT avec le JSON, sans markdown ni commentaire.`;

async function enrichPOI(poi: any): Promise<Record<string, unknown>> {
  const reviews = (poi.google_raw?.nearby?.types ?? []).join(", ");
  const googleReviews = (poi.google_raw?.details?.reviews ?? []).slice(0, 3).map((r: any) => r.text).join(" | ");

  const userPrompt = `POI: "${poi.name}"
Catégorie Google: ${poi.category_google ?? "unknown"}
Types Google: ${reviews}
Adresse: ${poi.address ?? "médina de Marrakech"}
Rating: ${poi.rating ?? "N/A"}/5 (${poi.reviews_count ?? 0} avis)
Avis Google: ${googleReviews || "aucun"}
Coordonnées: ${poi.lat}, ${poi.lng}
Zone: ${poi.zone ?? "medina"}`;

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
          description: "Enrichir un POI avec classification, contenu touristique et énigmes",
          parameters: {
            type: "object",
            properties: {
              category_ai: { type: "string", enum: ["artisan","restaurant","cafe","monument","riad","hotel","boutique","souvenir_shop","spa","gallery","viewpoint","historic_site","mosquee","fontaine","jardin","musee","souk","place","porte"] },
              subcategory: { type: "string" },
              poi_quality_score: { type: "number", minimum: 1, maximum: 10 },
              tourist_interest: { type: "string" },
              district: { type: "string" },
              description_short: { type: "string" },
              history_context: { type: "string" },
              local_anecdote: { type: "string" },
              instagram_spot: { type: "boolean" },
              riddle_easy: { type: "string" },
              riddle_medium: { type: "string" },
              challenge: { type: "string" },
            },
            required: ["category_ai","subcategory","poi_quality_score","tourist_interest","district","description_short","history_context","local_anecdote","instagram_spot","riddle_easy","riddle_medium","challenge"],
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

  const parsed = JSON.parse(toolCall.function.arguments);
  console.log("AI enrichment result keys:", Object.keys(parsed), "score:", parsed.poi_quality_score, "sub:", parsed.subcategory);
  return parsed;
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
      .order("reviews_count", { ascending: false })
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
        const e = await enrichPOI(poi);
        logs.push(`✓ ${poi.name} → ${e.category_ai}/${e.subcategory} (${e.district}) score=${e.poi_quality_score} keys=${Object.keys(e).join(",")}`);
        logs.push(`  RAW: ${JSON.stringify(e).substring(0, 300)}`);

        // Use raw object to avoid typed client stripping unknown columns
        const updateData: Record<string, unknown> = {
          category_ai: e.category_ai ?? null,
          subcategory: e.subcategory ?? null,
          poi_quality_score: e.poi_quality_score ?? null,
          tourist_interest: e.tourist_interest ?? null,
          district: e.district ?? null,
          description_short: e.description_short ?? null,
          history_context: e.history_context ?? null,
          local_anecdote: e.local_anecdote ?? null,
          instagram_spot: e.instagram_spot ?? false,
          riddle_easy: e.riddle_easy ?? null,
          riddle_medium: e.riddle_medium ?? null,
          challenge: e.challenge ?? null,
          enrichment_status: "enriched",
        };

        // Use direct REST API to bypass typed client column filtering
        const updateRes = await fetch(
          `${SUPABASE_URL}/rest/v1/medina_pois?id=eq.${poi.id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_SERVICE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
              Prefer: "return=minimal",
            },
            body: JSON.stringify(updateData),
          }
        );
        const updateErr = updateRes.ok ? null : { message: await updateRes.text() };

        if (updateErr) {
          logs.push(`✗ update ${poi.name}: ${updateErr.message}`);
          errors++;
        } else {
          enriched++;
        }

        // Rate limit: 1.5s between AI calls
        await new Promise(r => setTimeout(r, 1500));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logs.push(`✗ ${poi.name}: ${msg}`);
        // Mark as error but with retry capability
        await supabase.from("medina_pois").update({ enrichment_status: "error" }).eq("id", poi.id);
        errors++;

        // If rate limited, wait longer
        if (msg.includes("429")) {
          logs.push("⏳ Rate limited, waiting 10s...");
          await new Promise(r => setTimeout(r, 10000));
        }
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
