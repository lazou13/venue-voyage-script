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

const SYSTEM_PROMPT = `Tu es LYRA-MEDINA-GRAPH, un moteur d'intelligence urbaine spécialisé dans la médina de Marrakech.

RÔLE : analyser les points d'intérêt, comprendre leur contexte géographique, identifier leurs connexions logiques, générer des parcours cohérents, construire des chasses au trésor jouables.
Tu raisonnes comme : un guide local expert, un cartographe, un game designer, un architecte de parcours piéton, un narrateur culturel.

MÉDINA : dense, labyrinthique, structurée par souks et axes historiques, organisée autour de places et monuments.
Les déplacements suivent des ruelles plausibles et des flux touristiques logiques.

GRAPHE URBAIN : Chaque POI est un nœud. Tu analyses : distance, cohérence culturelle, diversité, progression narrative.

CATÉGORIES : monument, souk, artisan, restaurant, café, boutique, riad, spa, musée, spot photo, attraction culturelle, historic_site, mosquee, fontaine, jardin, gallery, viewpoint, souvenir_shop, place, porte.

ÉVALUATION par POI :
- Intérêt touristique (1=faible, 5=incontournable)
- Potentiel visuel (1=peu intéressant, 5=très photogénique)
- Potentiel d'énigme (1=faible, 5=excellent pour jeu)

ÉNIGMES — Pour chaque POI :
- riddle_easy : observation simple, indices visuels observables sur place
- riddle_medium : détail architectural ou culturel, nécessite réflexion
- riddle_hard : histoire profonde ou symbole caché, investigation poussée ou connaissances approfondies
- challenge : défi terrain (photo, interaction, observation)

NARRATION : immersive, concise, informative. Mini explication culturelle + anecdote + mise en contexte.

CONTRAINTES ABSOLUES :
- Ne JAMAIS inventer de lieux, restaurants ou anecdotes historiques inexistants
- Quand tu n'es pas sûr, indiquer "à vérifier"
- Tu DOIS fournir riddle_hard`;

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
              riddle_hard: { type: "string" },
              challenge: { type: "string" },
              price_info: { type: "string", description: "Infos tarifaires: prix d'entrée, fourchette de prix, gratuit, etc." },
              opening_hours: { type: "object", description: "Horaires d'ouverture structurés par jour, ex: {lundi: '9h-18h', mardi: '9h-18h'}" },
              must_see_details: { type: "string", description: "Ce qu'il faut absolument voir à cet endroit (détails architecturaux, œuvres, etc.)" },
              must_try: { type: "string", description: "Ce qu'il faut essayer (plat, activité, expérience)" },
              must_visit_nearby: { type: "string", description: "Lieux proches à ne pas manquer en complément" },
              is_photo_spot: { type: "boolean", description: "Est-ce un spot photo remarquable ?" },
              photo_tip: { type: "string", description: "Conseil photo: meilleur angle, heure, cadrage" },
              ruelle_etroite: { type: "boolean", description: "Le POI est-il dans une ruelle étroite difficile d'accès ?" },
            },
            required: ["category_ai","subcategory","poi_quality_score","tourist_interest","district","description_short","history_context","local_anecdote","instagram_spot","riddle_easy","riddle_medium","riddle_hard","challenge","price_info","must_see_details","must_try","is_photo_spot"],
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
          riddle_hard: e.riddle_hard ?? null,
          challenge: e.challenge ?? null,
          price_info: e.price_info ?? null,
          opening_hours: e.opening_hours ?? null,
          must_see_details: e.must_see_details ?? null,
          must_try: e.must_try ?? null,
          must_visit_nearby: e.must_visit_nearby ?? null,
          is_photo_spot: e.is_photo_spot ?? false,
          photo_tip: e.photo_tip ?? null,
          ruelle_etroite: e.ruelle_etroite ?? false,
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
