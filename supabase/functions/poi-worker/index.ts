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

const BATCH_SIZE = 20;
const MAX_RUNTIME_MS = 110_000; // 110s safety margin (edge fn limit ~150s)

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
- riddle_hard: énigme difficile nécessitant des connaissances approfondies ou une investigation poussée
- challenge: défi terrain à réaliser sur place (photo, interaction, observation)

Réponds UNIQUEMENT avec le JSON, sans markdown ni commentaire.`;

async function enrichPOI(poi: any): Promise<Record<string, unknown>> {
  const googleTypes = (poi.google_raw?.nearby?.types ?? []).join(", ");
  const googleReviews = (poi.google_raw?.details?.reviews ?? [])
    .slice(0, 3)
    .map((r: any) => r.text)
    .join(" | ");

  const userPrompt = `POI: "${poi.name}"
Catégorie Google: ${poi.category_google ?? "unknown"}
Types Google: ${googleTypes}
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
              riddle_hard: { type: "string" },
              challenge: { type: "string" },
            },
            required: ["category_ai","subcategory","poi_quality_score","tourist_interest","district","description_short","history_context","local_anecdote","instagram_spot","riddle_easy","riddle_medium","riddle_hard","challenge"],
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

  const startTime = Date.now();

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const logs: string[] = [];
    let totalProcessed = 0;
    let totalErrors = 0;
    let batchNum = 0;

    while (true) {
      // Safety: stop before edge function timeout
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        logs.push(`⏱ Timeout safety reached after ${batchNum} batches`);
        break;
      }

      batchNum++;

      // 1. Fetch batch of raw POIs — geo-fenced to Marrakech medina
      const { data: batch, error: fetchErr } = await supabase
        .from("medina_pois")
        .select("*")
        .eq("enrichment_status", "raw")
        .neq("status", "filtered")
        .neq("status", "merged")
        .gte("lat", 31.60)
        .lte("lat", 31.67)
        .gte("lng", -8.02)
        .lte("lng", -7.97)
        .order("reviews_count", { ascending: false })
        .limit(BATCH_SIZE);

      if (fetchErr) throw fetchErr;
      if (!batch?.length) {
        logs.push(`✅ No more raw POIs — all done!`);
        break;
      }

      const batchIds = batch.map((p: any) => p.id);

      // 2. Mark as processing
      await fetch(`${SUPABASE_URL}/rest/v1/medina_pois?id=in.(${batchIds.join(",")})`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ enrichment_status: "processing" }),
      });

      logs.push(`[batch ${batchNum}] ${batch.length} POIs → processing`);

      let batchEnriched = 0;
      let batchErrors = 0;

      // 3. Enrich each POI
      for (const poi of batch) {
        // Check timeout mid-batch
        if (Date.now() - startTime > MAX_RUNTIME_MS) {
          logs.push(`⏱ Timeout mid-batch ${batchNum}, reverting remaining to raw`);
          // Revert unprocessed POIs back to raw
          const remaining = batch.slice(batch.indexOf(poi)).map((p: any) => p.id);
          await fetch(`${SUPABASE_URL}/rest/v1/medina_pois?id=in.(${remaining.join(",")})`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_SERVICE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
              Prefer: "return=minimal",
            },
            body: JSON.stringify({ enrichment_status: "raw" }),
          });
          break;
        }

        try {
          const enrichment = await enrichPOI(poi);

          const updateData: Record<string, unknown> = {
            category_ai: enrichment.category_ai ?? null,
            subcategory: enrichment.subcategory ?? null,
            poi_quality_score: enrichment.poi_quality_score ?? null,
            tourist_interest: enrichment.tourist_interest ?? null,
            district: enrichment.district ?? null,
            description_short: enrichment.description_short ?? null,
            history_context: enrichment.history_context ?? null,
            local_anecdote: enrichment.local_anecdote ?? null,
            instagram_spot: enrichment.instagram_spot ?? false,
            riddle_easy: enrichment.riddle_easy ?? null,
            riddle_medium: enrichment.riddle_medium ?? null,
            riddle_hard: enrichment.riddle_hard ?? null,
            challenge: enrichment.challenge ?? null,
            enrichment_status: "enriched",
          };

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

          if (!updateRes.ok) {
            const errText = await updateRes.text();
            logs.push(`✗ update ${poi.name}: ${errText}`);
            batchErrors++;
          } else {
            batchEnriched++;
          }

          // Rate limit: 1s between AI calls
          await new Promise(r => setTimeout(r, 1000));
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          logs.push(`✗ ${poi.name}: ${msg}`);

          // Mark as error so it's not retried immediately
          await fetch(`${SUPABASE_URL}/rest/v1/medina_pois?id=eq.${poi.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_SERVICE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
              Prefer: "return=minimal",
            },
            body: JSON.stringify({ enrichment_status: "error" }),
          });
          batchErrors++;

          // Rate limit backoff
          if (msg.includes("429")) {
            logs.push("⏳ Rate limited, waiting 10s...");
            await new Promise(r => setTimeout(r, 10000));
          }
        }
      }

      totalProcessed += batchEnriched;
      totalErrors += batchErrors;

      // Count remaining
      const { count } = await supabase
        .from("medina_pois")
        .select("*", { count: "exact", head: true })
        .eq("enrichment_status", "raw");

      logs.push(`[batch ${batchNum}] enriched=${batchEnriched} errors=${batchErrors} remaining_raw=${count ?? "?"}`);

      // Brief pause between batches
      await new Promise(r => setTimeout(r, 2000));
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logs.push(`--- WORKER DONE: ${totalProcessed} enriched, ${totalErrors} errors in ${elapsed}s ---`);

    // Final count
    const { count: remaining } = await supabase
      .from("medina_pois")
      .select("*", { count: "exact", head: true })
      .eq("enrichment_status", "raw");

    return new Response(JSON.stringify({
      success: true,
      processed: totalProcessed,
      errors: totalErrors,
      remaining: remaining ?? 0,
      batches: batchNum,
      elapsed_seconds: parseFloat(elapsed),
      logs,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("poi-worker error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
