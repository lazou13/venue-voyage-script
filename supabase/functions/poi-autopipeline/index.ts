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

const BATCH_SIZE = 5;

const GEO = { lat_min: 31.60, lat_max: 31.67, lng_min: -8.02, lng_max: -7.97 };

const CATEGORIES = [
  "artisan","restaurant","cafe","monument","riad","hotel","boutique",
  "souvenir_shop","spa","gallery","viewpoint","historic_site","mosquee",
  "fontaine","jardin","musee","souk","place","porte",
];

const ENRICH_SYSTEM = `Tu es un expert encyclopédique de la médina de Marrakech et un concepteur de jeux de piste touristiques.
Pour chaque POI, fournis un JSON structuré avec TOUS ces champs:
- category_ai, subcategory, poi_quality_score (1-10), tourist_interest
- district, description_short (2-3 phrases), history_context, local_anecdote
- instagram_spot (boolean)
- riddle_easy: énigme facile (indices visuels)
- riddle_medium: énigme moyenne (culture/histoire)
- riddle_hard: énigme difficile nécessitant investigation poussée ou connaissances approfondies
- challenge: défi terrain (photo, interaction, observation)`;

// ─── CLASSIFY a single POI ───
async function classifyPOI(poi: any) {
  const googleTypes = poi.category_google ?? (poi.google_raw?.nearby?.types ?? []).join(", ");
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: "Tu es un expert de la médina de Marrakech. Classifie chaque POI." },
        { role: "user", content: `Classifie ce POI:\nNom: "${poi.name}"\nTypes Google: ${googleTypes}\nAdresse: ${poi.address ?? "médina"}\nRating: ${poi.rating ?? "N/A"}/5 (${poi.reviews_count ?? 0} avis)\nCoordonnées: ${poi.lat}, ${poi.lng}` },
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
              subcategory: { type: "string" },
              poi_quality_score: { type: "number", minimum: 1, maximum: 10 },
            },
            required: ["category_ai", "subcategory", "poi_quality_score"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "classify_poi" } },
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${(await res.text()).substring(0, 200)}`);
  const data = await res.json();
  const tc = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc) throw new Error("No tool call");
  return JSON.parse(tc.function.arguments);
}

// ─── ENRICH a single POI ───
async function enrichPOI(poi: any) {
  const googleTypes = (poi.google_raw?.nearby?.types ?? []).join(", ");
  const googleReviews = (poi.google_raw?.details?.reviews ?? []).slice(0, 3).map((r: any) => r.text).join(" | ");

  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: ENRICH_SYSTEM },
        { role: "user", content: `POI: "${poi.name}"\nCatégorie: ${poi.category_ai ?? poi.category_google ?? "unknown"}\nTypes Google: ${googleTypes}\nAdresse: ${poi.address ?? "médina"}\nRating: ${poi.rating ?? "N/A"}/5 (${poi.reviews_count ?? 0} avis)\nAvis: ${googleReviews || "aucun"}\nCoordonnées: ${poi.lat}, ${poi.lng}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "enrich_poi",
          description: "Enrichir un POI avec contenu touristique et énigmes",
          parameters: {
            type: "object",
            properties: {
              category_ai: { type: "string", enum: CATEGORIES },
              subcategory: { type: "string" },
              poi_quality_score: { type: "number", minimum: 1, maximum: 10 },
              tourist_interest: { type: "string" },
              district: { type: "string" },
              description_short: { type: "string" },
              history_context: { type: "string" },
              local_anecdote: { type: "string" },
              instagram_spot: { type: "boolean" },
              riddle_easy: { type: "string", description: "Énigme facile avec indices visuels observables sur place" },
              riddle_medium: { type: "string", description: "Énigme moyenne nécessitant culture/histoire" },
              riddle_hard: { type: "string", description: "Énigme difficile nécessitant investigation poussée ou connaissances approfondies de la médina" },
              challenge: { type: "string", description: "Défi terrain: photo, interaction ou observation" },
            },
            required: ["category_ai","subcategory","poi_quality_score","tourist_interest","district","description_short","history_context","local_anecdote","instagram_spot","riddle_easy","riddle_medium","riddle_hard","challenge"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "enrich_poi" } },
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${(await res.text()).substring(0, 200)}`);
  const data = await res.json();
  const tc = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc) throw new Error("No tool call");
  return JSON.parse(tc.function.arguments);
}

// ─── PROXIMITY for a batch of POIs ───
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const logs: string[] = [];

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const geoBase = () => supabase
      .from("medina_pois")
      .select("*", { count: "exact", head: true })
      .neq("status", "filtered").neq("status", "merged")
      .gte("lat", GEO.lat_min).lte("lat", GEO.lat_max)
      .gte("lng", GEO.lng_min).lte("lng", GEO.lng_max);

    // ── PHASE 1: CLASSIFY ──
    const { count: unclassified } = await geoBase().is("category_ai", null);
    logs.push(`📊 Unclassified: ${unclassified ?? 0}`);

    if ((unclassified ?? 0) > 0) {
      const { data: batch } = await supabase
        .from("medina_pois")
        .select("id,name,category_google,google_raw,address,rating,reviews_count,lat,lng")
        .is("category_ai", null)
        .neq("status", "filtered").neq("status", "merged")
        .gte("lat", GEO.lat_min).lte("lat", GEO.lat_max)
        .gte("lng", GEO.lng_min).lte("lng", GEO.lng_max)
        .order("reviews_count", { ascending: false, nullsFirst: false })
        .limit(BATCH_SIZE);

      let classified = 0;
      for (const poi of batch ?? []) {
        try {
          const r = await classifyPOI(poi);
          await supabase.from("medina_pois").update({
            category_ai: r.category_ai,
            subcategory: r.subcategory,
            poi_quality_score: r.poi_quality_score,
            status: "classified",
          }).eq("id", poi.id);
          classified++;
          logs.push(`✓ classified ${poi.name} → ${r.category_ai}`);
        } catch (e) {
          logs.push(`✗ classify ${poi.name}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      logs.push(`🏷️ Classified: ${classified}/${batch?.length ?? 0}`);
      return respond(logs, { phase: "classify", classified }, startTime);
    }

    // ── PHASE 2: ENRICH ──
    const { count: rawCount } = await geoBase().eq("enrichment_status", "raw");
    logs.push(`📊 Raw (to enrich): ${rawCount ?? 0}`);

    if ((rawCount ?? 0) > 0) {
      const { data: batch } = await supabase
        .from("medina_pois")
        .select("*")
        .eq("enrichment_status", "raw")
        .neq("status", "filtered").neq("status", "merged")
        .gte("lat", GEO.lat_min).lte("lat", GEO.lat_max)
        .gte("lng", GEO.lng_min).lte("lng", GEO.lng_max)
        .order("reviews_count", { ascending: false, nullsFirst: false })
        .limit(BATCH_SIZE);

      let enriched = 0;
      for (const poi of batch ?? []) {
        try {
          const r = await enrichPOI(poi);

          // Fallback for riddle_hard
          const riddleHard = r.riddle_hard || `Quel secret se cache derrière les murs de ${poi.name} ? Cherchez un indice architectural unique qui révèle son histoire cachée.`;

          await supabase.from("medina_pois").update({
            category_ai: r.category_ai ?? poi.category_ai,
            subcategory: r.subcategory ?? poi.subcategory,
            poi_quality_score: r.poi_quality_score ?? poi.poi_quality_score,
            tourist_interest: r.tourist_interest,
            district: r.district,
            description_short: r.description_short,
            history_context: r.history_context,
            local_anecdote: r.local_anecdote,
            instagram_spot: r.instagram_spot ?? false,
            riddle_easy: r.riddle_easy,
            riddle_medium: r.riddle_medium,
            riddle_hard: riddleHard,
            challenge: r.challenge,
            enrichment_status: "enriched",
            status: "enriched",
          }).eq("id", poi.id);
          enriched++;
          logs.push(`✓ enriched ${poi.name} (hard: ${riddleHard ? "yes" : "FALLBACK"})`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          logs.push(`✗ enrich ${poi.name}: ${msg}`);
          await supabase.from("medina_pois").update({ enrichment_status: "error" }).eq("id", poi.id);
          if (msg.includes("429")) {
            logs.push("⏳ Rate limited, stopping batch");
            break;
          }
        }
      }
      logs.push(`🧠 Enriched: ${enriched}/${batch?.length ?? 0}`);
      return respond(logs, { phase: "enrich", enriched }, startTime);
    }

    // ── PHASE 3: CLEAN + MERGE ──
    logs.push("🧹 Running clean + merge...");
    const { data: cleanResult } = await supabase.rpc("clean_low_quality_pois");
    const { data: mergeResult } = await supabase.rpc("merge_duplicate_pois");
    logs.push(`Clean: ${(cleanResult as any)?.filtered ?? 0} | Merge: ${(mergeResult as any)?.merged ?? 0}`);

    // ── PHASE 4: PROXIMITY ──
    // Fix: check for empty array [], not just NULL
    const { count: noProximity } = await supabase
      .from("medina_pois")
      .select("*", { count: "exact", head: true })
      .neq("status", "filtered").neq("status", "merged")
      .gte("lat", GEO.lat_min).lte("lat", GEO.lat_max)
      .gte("lng", GEO.lng_min).lte("lng", GEO.lng_max)
      .or("nearby_pois_data.is.null,nearby_pois_data.eq.[]");

    logs.push(`📊 Without proximity: ${noProximity ?? 0}`);

    if ((noProximity ?? 0) > 0) {
      // Fetch ALL active POIs for distance calculation
      const { data: allPois } = await supabase
        .from("medina_pois")
        .select("id,name,lat,lng,category,category_ai,category_google")
        .not("lat", "is", null).not("lng", "is", null)
        .neq("status", "filtered").neq("status", "merged")
        .gte("lat", GEO.lat_min).lte("lat", GEO.lat_max)
        .gte("lng", GEO.lng_min).lte("lng", GEO.lng_max);

      // Process only POIs missing proximity, in batches of 10
      const { data: batch } = await supabase
        .from("medina_pois")
        .select("id,name,lat,lng,category,category_ai,category_google")
        .neq("status", "filtered").neq("status", "merged")
        .gte("lat", GEO.lat_min).lte("lat", GEO.lat_max)
        .gte("lng", GEO.lng_min).lte("lng", GEO.lng_max)
        .or("nearby_pois_data.is.null,nearby_pois_data.eq.[]")
        .limit(10);

      const restaurantCats = ["restaurant", "cafe"];
      let proxUpdated = 0;

      for (const poi of batch ?? []) {
        if (!poi.lat || !poi.lng) continue;
        const distances = (allPois ?? [])
          .filter(p => p.id !== poi.id && p.lat && p.lng)
          .map(p => ({
            id: p.id, name: p.name,
            category: p.category_ai ?? p.category,
            distance_m: Math.round(haversineM(poi.lat!, poi.lng!, p.lat!, p.lng!)),
          }))
          .filter(d => d.distance_m <= 200)
          .sort((a, b) => a.distance_m - b.distance_m);

        const nearbyRestaurants = distances.filter(d => restaurantCats.includes(d.category)).slice(0, 5);
        const nearbyPois = distances.filter(d => !restaurantCats.includes(d.category)).slice(0, 8);

        await supabase.from("medina_pois").update({
          nearby_restaurants: nearbyRestaurants,
          nearby_pois_data: nearbyPois,
        }).eq("id", poi.id);
        proxUpdated++;
      }
      logs.push(`📍 Proximity updated: ${proxUpdated}`);
      return respond(logs, { phase: "proximity", updated: proxUpdated }, startTime);
    }

    // ── ALL DONE ──
    const { count: totalActive } = await geoBase();
    const { count: cls } = await geoBase().not("category_ai", "is", null);
    const { count: enr } = await geoBase().eq("enrichment_status", "enriched");
    const { count: hrd } = await geoBase().not("riddle_hard", "is", null);

    logs.push(`🎉 PIPELINE COMPLETE: ${cls}/${totalActive} classified, ${enr}/${totalActive} enriched, ${hrd} with riddle_hard`);

    return respond(logs, { phase: "idle", classified: cls, enriched: enr, riddle_hard: hrd, total: totalActive }, startTime);
  } catch (e) {
    console.error("poi-autopipeline error:", e);
    logs.push(`❌ Fatal: ${e instanceof Error ? e.message : String(e)}`);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown", logs }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function respond(logs: string[], results: Record<string, any>, startTime: number) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  logs.push(`⏱ ${elapsed}s`);
  return new Response(JSON.stringify({ success: true, elapsed_seconds: parseFloat(elapsed), results, logs }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
