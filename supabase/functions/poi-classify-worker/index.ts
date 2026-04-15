import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const BATCH_SIZE = 20;
const MAX_RUNTIME_MS = 110_000;

const CATEGORIES = [
  "monument","historic_site","museum","mosque","artisan","souk",
  "restaurant","cafe","riad","hotel","spa","gallery","viewpoint",
  "garden","boutique","souvenir_shop","fontaine","place","porte",
];

async function classifyPOI(poi: any): Promise<{ category_ai: string; subcategory: string; poi_quality_score: number }> {
  const googleTypes = poi.category_google ?? (poi.google_raw?.nearby?.types ?? []).join(", ");

  const userPrompt = `Classifie ce POI de la médina de Marrakech:
Nom: "${poi.name}"
Types Google: ${googleTypes}
Adresse: ${poi.address ?? "médina de Marrakech"}
Rating: ${poi.rating ?? "N/A"}/5 (${poi.reviews_count ?? 0} avis)
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
        { role: "system", content: `Tu es LYRA-MEDINA-GRAPH, un moteur d'intelligence urbaine spécialisé dans la médina de Marrakech. Tu raisonnes comme un guide local expert, un cartographe et un game designer. La médina est dense, labyrinthique, structurée par souks et axes historiques. Chaque POI est un nœud d'un graphe urbain. Classifie avec précision. Ne jamais inventer de lieux inexistants.

RUBRIQUE DE SCORING poi_quality_score (intérêt touristique, PAS le rating Google) :
- 9-10 : Monument iconique, incontournable mondial (Koutoubia, Palais Bahia, Medersa Ben Youssef, Tombeaux Saadiens, Jardin Majorelle)
- 7-8 : Lieu très intéressant, forte valeur culturelle, historique ou expérience unique (musées reconnus, riads historiques célèbres, souks principaux)
- 5-6 : Lieu agréable, bon complément d'itinéraire, artisan de qualité ou restaurant réputé localement
- 3-4 : Lieu ordinaire, peu distinctif ou principalement commercial sans intérêt culturel
- 1-2 : Peu d'intérêt touristique, générique, sans valeur culturelle ou historique

RÈGLES CRITIQUES :
- Le score NE DOIT PAS copier le rating Google. Un restaurant 5★ avec 3 avis = score 3-4. Un monument 3.9★ avec 14000 avis = score 8-9.
- reviews_count est un indicateur de notoriété : 1000+ avis = lieu très connu, 100-999 = connu, <100 = peu connu
- Les monuments historiques et lieux culturels majeurs doivent TOUJOURS avoir un score ≥ 7
- Les restaurants/cafés ordinaires ne dépassent PAS 5 sauf s'ils sont emblématiques (ex: Café de France, Nomad)
- Les RIADS sont du patrimoine architectural vivant de la médina (architecture mauresque, zellige, patios). Score MINIMUM 6. Si bien noté (≥4★) ou connu (≥100 avis) → score 7-8. Un riad n'est PAS un simple hôtel.
- Les HÔTELS de charme et maisons d'hôtes traditionnelles suivent la même règle que les riads` },
        { role: "user", content: userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "classify_poi",
          description: "Classifier un POI touristique",
          parameters: {
            type: "object",
            properties: {
              category_ai: { type: "string", enum: CATEGORIES },
              subcategory: { type: "string", description: "Sous-catégorie libre (ex: poterie, tapis, pâtisserie orientale, palais, médersa)" },
              poi_quality_score: { type: "number", minimum: 1, maximum: 10, description: "Score d'intérêt touristique basé sur notoriété, rating, avis" },
            },
            required: ["category_ai", "subcategory", "poi_quality_score"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "classify_poi" } },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI ${response.status}: ${text.substring(0, 200)}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No tool call in response");
  return JSON.parse(toolCall.function.arguments);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const logs: string[] = [];
  let totalClassified = 0;
  let totalErrors = 0;
  let batchNum = 0;

  try {
    while (true) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        logs.push(`⏱ Timeout after ${batchNum} batches`);
        break;
      }

      batchNum++;

      // Fetch POIs where category_ai IS NULL — geo-fenced to Marrakech medina
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/medina_pois?category_ai=is.null&status=neq.filtered&status=neq.merged&lat=gte.31.60&lat=lte.31.67&lng=gte.-8.02&lng=lte.-7.97&select=id,name,category_google,google_raw,address,rating,reviews_count,lat,lng&limit=${BATCH_SIZE}&order=reviews_count.desc.nullslast`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
        }
      );
      const batch = await res.json();

      if (!batch?.length) {
        logs.push(`✅ Tous les POI sont classifiés !`);
        break;
      }

      logs.push(`[batch ${batchNum}] ${batch.length} POI à classifier`);

      for (const poi of batch) {
        if (Date.now() - startTime > MAX_RUNTIME_MS) {
          logs.push(`⏱ Timeout mid-batch`);
          break;
        }

        try {
          const result = await classifyPOI(poi);

          await fetch(`${SUPABASE_URL}/rest/v1/medina_pois?id=eq.${poi.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_SERVICE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              category_ai: result.category_ai,
              subcategory: result.subcategory,
              poi_quality_score: result.poi_quality_score,
            }),
          });

          totalClassified++;
          logs.push(`✓ ${poi.name} → ${result.category_ai}/${result.subcategory} (${result.poi_quality_score}/10)`);

          // Rate limit
          await new Promise(r => setTimeout(r, 500));
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          logs.push(`✗ ${poi.name}: ${msg}`);
          totalErrors++;

          if (msg.includes("429")) {
            logs.push("⏳ Rate limited, waiting 10s...");
            await new Promise(r => setTimeout(r, 10000));
          }
        }
      }

      // Count remaining
      const countRes = await fetch(
        `${SUPABASE_URL}/rest/v1/medina_pois?category_ai=is.null&status=neq.filtered&status=neq.merged&lat=gte.31.60&lat=lte.31.67&lng=gte.-8.02&lng=lte.-7.97&select=id&head=true`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            Prefer: "count=exact",
          },
        }
      );
      const remaining = countRes.headers.get("content-range")?.split("/")?.[1] ?? "?";
      logs.push(`[batch ${batchNum}] classified=${totalClassified} errors=${totalErrors} remaining=${remaining}`);

      await new Promise(r => setTimeout(r, 1000));
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logs.push(`--- CLASSIFY DONE: ${totalClassified} classified, ${totalErrors} errors in ${elapsed}s ---`);

    return new Response(JSON.stringify({
      success: true,
      classified: totalClassified,
      errors: totalErrors,
      batches: batchNum,
      elapsed_seconds: parseFloat(elapsed),
      logs,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("poi-classify-worker error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "Unknown error",
      logs,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
