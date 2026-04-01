import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HUBS = [
  { id: "koutoubia", name: "Koutoubia", lat: 31.6237, lng: -7.9934 },
  { id: "jemaa_el_fna", name: "Jemaa el-Fna", lat: 31.6295, lng: -7.9811 },
  { id: "mellah", name: "Mellah", lat: 31.6220, lng: -7.9770 },
];

const AUDIENCES = ["family", "young_adults", "accessible", "foodies", "instagrammers"];
const MODES = ["guided_tour", "treasure_hunt"];

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface AgentResult {
  phase: string;
  action: string;
  count: number;
  logs: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const logs: string[] = [];
  const results: AgentResult[] = [];

  try {
    // ━━━━━━━━━━ PHASE 1: POI ENRICHMENT (audience/accessibility/food/instagram) ━━━━━━━━━━
    const { data: unenrichedPois, error: fetchErr } = await supabase
      .from("medina_pois")
      .select("id, name, name_fr, category_ai, category_google, description_short, address, district, rating, reviews_count, ruelle_etroite, photo_tip, lat, lng")
      .not("status", "in", '("filtered","merged")')
      .is("agent_enriched_at", null)
      .not("category_ai", "is", null)
      .limit(50);

    if (fetchErr) throw fetchErr;

    if (unenrichedPois && unenrichedPois.length > 0 && LOVABLE_API_KEY) {
      logs.push(`🧠 Phase 1: Enrichissement de ${unenrichedPois.length} POIs...`);

      const poisText = unenrichedPois.map((p: any, i: number) =>
        `${i + 1}. "${p.name}" (${p.name_fr || ''}) — catégorie: ${p.category_ai || p.category_google || 'inconnue'}, ` +
        `description: ${(p.description_short || '').slice(0, 100)}, ` +
        `adresse: ${p.address || 'inconnue'}, quartier: ${p.district || 'inconnu'}, ` +
        `note: ${p.rating || '?'}/5 (${p.reviews_count || 0} avis), ` +
        `ruelle étroite: ${p.ruelle_etroite ? 'oui' : 'non'}, ` +
        `photo tip: ${(p.photo_tip || '').slice(0, 80)}`
      ).join("\n");

      const systemPrompt = `Tu es un expert de la médina de Marrakech. Analyse chaque POI et génère un JSON array.
Pour chaque POI, retourne:
- audience_tags: array parmi ["family","young_adults","couples","seniors","accessible","solo"] — qui apprécierait ce lieu
- accessibility_notes: string — accès PMR, escaliers, largeur passages, terrain (en français)
- street_food_spot: boolean — est-ce un lieu de street food ou à proximité immédiate
- street_food_details: string ou null — spécialités, prix typiques, ce qu'il faut goûter
- instagram_score: integer 1-10 — photogénicité du lieu
- instagram_tips: string — meilleur angle, heure, hashtags populaires
- route_tags: array parmi ["food_tour","photo_walk","family_friendly","accessible_route","hidden_gems","history_walk","artisan_tour","romantic","adventure"] — dans quel type de parcours ce POI s'intègre
- best_time_visit: string — "matin tôt", "fin de matinée", "après-midi", "golden hour", "soir"

IMPORTANT: Sois précis et contextuel. Une ruelle étroite = pas accessible PMR. Un souk = family_friendly mais pas accessible. Un monument = photo_walk + history_walk.`;

      const response = await fetch(AI_GATEWAY, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Analyse ces ${unenrichedPois.length} POIs de la médina de Marrakech et retourne un JSON array:\n\n${poisText}` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "enrich_pois",
              description: "Enrich POIs with audience, accessibility, food, and instagram data",
              parameters: {
                type: "object",
                properties: {
                  pois: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        index: { type: "integer" },
                        audience_tags: { type: "array", items: { type: "string" } },
                        accessibility_notes: { type: "string" },
                        street_food_spot: { type: "boolean" },
                        street_food_details: { type: "string" },
                        instagram_score: { type: "integer" },
                        instagram_tips: { type: "string" },
                        route_tags: { type: "array", items: { type: "string" } },
                        best_time_visit: { type: "string" },
                      },
                      required: ["index", "audience_tags", "accessibility_notes", "street_food_spot", "instagram_score", "route_tags", "best_time_visit"],
                    },
                  },
                },
                required: ["pois"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "enrich_pois" } },
        }),
      });

      if (response.ok) {
        const aiData = await response.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
          const parsed = JSON.parse(toolCall.function.arguments);
          let updated = 0;

          for (const enriched of parsed.pois || []) {
            const poi = unenrichedPois[enriched.index - 1];
            if (!poi) continue;

            const { error: updateErr } = await supabase
              .from("medina_pois")
              .update({
                audience_tags: enriched.audience_tags || [],
                accessibility_notes: enriched.accessibility_notes || null,
                street_food_spot: enriched.street_food_spot || false,
                street_food_details: enriched.street_food_details || null,
                instagram_score: enriched.instagram_score || null,
                instagram_tips: enriched.instagram_tips || null,
                route_tags: enriched.route_tags || [],
                best_time_visit: enriched.best_time_visit || null,
                agent_enriched_at: new Date().toISOString(),
              })
              .eq("id", poi.id);

            if (!updateErr) updated++;
          }

          logs.push(`✅ ${updated}/${unenrichedPois.length} POIs enrichis par l'agent`);
          results.push({ phase: "enrichment", action: "audience_tags", count: updated, logs: [] });
        }
      } else {
        const errText = await response.text();
        logs.push(`❌ Erreur IA enrichissement: ${response.status} — ${errText.slice(0, 200)}`);
      }
    } else if (!unenrichedPois || unenrichedPois.length === 0) {
      logs.push("✅ Phase 1: Tous les POIs sont déjà enrichis par l'agent");
    }

    // ━━━━━━━━━━ PHASE 2: GENERATE LIBRARY VISITS (Gemini 2.5 Pro) ━━━━━━━━━━
    // Check what visits are missing
    const { data: existingVisits } = await supabase
      .from("quest_library")
      .select("start_hub, audience, mode");

    const existingKeys = new Set(
      (existingVisits || []).map((v: any) => `${v.start_hub}__${v.audience}__${v.mode}`)
    );

    // Find next visit to generate
    let generated = false;
    for (const hub of HUBS) {
      if (generated) break;
      for (const audience of AUDIENCES) {
        if (generated) break;
        for (const mode of MODES) {
          const key = `${hub.id}__${audience}__${mode}`;
          if (existingKeys.has(key)) continue;

          logs.push(`🗺️ Phase 2: Génération visite ${hub.name} / ${audience} / ${mode}...`);

          // Get nearby POIs for this hub
          const { data: nearbyPois } = await supabase
            .from("medina_pois")
            .select("id, name, name_fr, lat, lng, category_ai, description_short, audience_tags, route_tags, instagram_score, street_food_spot, accessibility_notes, riddle_easy, history_context, local_anecdote, photo_tip, rating, poi_quality_score")
            .not("status", "in", '("filtered","merged")')
            .not("category_ai", "is", null)
            .gte("poi_quality_score", 3)
            .limit(100);

          if (!nearbyPois || nearbyPois.length < 3) {
            logs.push("⚠️ Pas assez de POIs qualifiés pour générer une visite");
            break;
          }

          // Filter POIs by audience relevance
          const relevant = nearbyPois.filter((p: any) => {
            if (audience === "foodies") return p.street_food_spot || (p.category_ai || "").includes("restaurant") || (p.category_ai || "").includes("café");
            if (audience === "instagrammers") return (p.instagram_score || 0) >= 6;
            if (audience === "accessible") return !(p.accessibility_notes || "").toLowerCase().includes("escalier") && !(p.accessibility_notes || "").toLowerCase().includes("étroit");
            if (audience === "family") return (p.audience_tags || []).includes("family");
            return true;
          });

          // Sort by distance from hub, take closest
          const withDist = (relevant.length >= 5 ? relevant : nearbyPois).map((p: any) => ({
            ...p,
            dist: Math.sqrt(Math.pow((p.lat - hub.lat) * 111320, 2) + Math.pow((p.lng - hub.lng) * 111320 * Math.cos(hub.lat * Math.PI / 180), 2)),
          })).sort((a: any, b: any) => a.dist - b.dist).slice(0, 8);

          // Determine theme based on audience
          const themeMap: Record<string, string> = {
            foodies: "food",
            instagrammers: "photography",
            family: "complete",
            accessible: "complete",
            young_adults: "hidden_gems",
          };
          const theme = themeMap[audience] || "complete";

          // Calculate route stats
          let totalDist = 0;
          for (let i = 1; i < withDist.length; i++) {
            totalDist += withDist[i].dist;
          }
          const walkTime = Math.round(totalDist / 50); // ~3km/h
          const visitTime = withDist.length * (mode === "guided_tour" ? 12 : 8);
          const totalTime = walkTime + visitTime;

          // Build stops data
          const stopsData = withDist.map((p: any, i: number) => ({
            order: i + 1,
            poi_id: p.id,
            name: p.name_fr || p.name,
            lat: p.lat,
            lng: p.lng,
            category: p.category_ai || "generic",
            distance_from_prev_m: i === 0 ? 0 : Math.round(p.dist),
            walk_time_min: i === 0 ? 0 : Math.round(p.dist / 50),
            visit_time_min: mode === "guided_tour" ? 12 : 8,
            riddle: mode === "treasure_hunt" ? p.riddle_easy : undefined,
            story: p.history_context || p.local_anecdote || undefined,
            description: p.description_short || undefined,
            photo_tip: p.photo_tip || undefined,
          }));

          // Use AI to generate title, description, highlights
          if (LOVABLE_API_KEY) {
            const poisSummary = withDist.map((p: any, i: number) =>
              `${i + 1}. ${p.name_fr || p.name} — ${p.category_ai}, score: ${p.poi_quality_score}/10, instagram: ${p.instagram_score || '?'}/10`
            ).join("\n");

            const visitPrompt = `Génère le titre et la description d'une visite de la médina de Marrakech.

DÉPART: ${hub.name} (${hub.id})
AUDIENCE: ${audience}
MODE: ${mode === "guided_tour" ? "Visite guidée" : "Chasse au trésor"}
THÈME: ${theme}
DURÉE: ~${totalTime} min
ÉTAPES: ${withDist.length}
DISTANCE: ~${Math.round(totalDist)}m

POIs du parcours:
${poisSummary}

Génère:
- title_fr: titre accrocheur en français (max 60 car)
- title_en: titre en anglais
- description_fr: 2-3 phrases expliquant POURQUOI cette visite, POUR QUI, et CE QU'ON VA VOIR (en français)
- description_en: même chose en anglais
- highlights: 3-5 points forts courts (en français)
- best_time: meilleur moment de la journée
- quality_score: auto-évaluation 1-10 de la qualité du parcours`;

            const visitResponse = await fetch(AI_GATEWAY, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-pro",
                messages: [
                  { role: "system", content: "Tu es un expert du tourisme à Marrakech. Génère des descriptions de visites captivantes et précises." },
                  { role: "user", content: visitPrompt },
                ],
                tools: [{
                  type: "function",
                  function: {
                    name: "create_visit",
                    description: "Create a library visit entry",
                    parameters: {
                      type: "object",
                      properties: {
                        title_fr: { type: "string" },
                        title_en: { type: "string" },
                        description_fr: { type: "string" },
                        description_en: { type: "string" },
                        highlights: { type: "array", items: { type: "string" } },
                        best_time: { type: "string" },
                        quality_score: { type: "number" },
                      },
                      required: ["title_fr", "title_en", "description_fr", "description_en", "highlights", "best_time", "quality_score"],
                    },
                  },
                }],
                tool_choice: { type: "function", function: { name: "create_visit" } },
              }),
            });

            if (visitResponse.ok) {
              const visitData = await visitResponse.json();
              const visitTool = visitData.choices?.[0]?.message?.tool_calls?.[0];
              if (visitTool?.function?.arguments) {
                const visit = JSON.parse(visitTool.function.arguments);

                const { error: insertErr } = await supabase
                  .from("quest_library")
                  .insert({
                    start_hub: hub.id,
                    start_lat: hub.lat,
                    start_lng: hub.lng,
                    audience,
                    mode,
                    theme,
                    difficulty: audience === "family" || audience === "accessible" ? "easy" : "medium",
                    title_fr: visit.title_fr,
                    title_en: visit.title_en,
                    description_fr: visit.description_fr,
                    description_en: visit.description_en,
                    duration_min: totalTime,
                    distance_m: Math.round(totalDist),
                    stops_count: withDist.length,
                    stops_data: stopsData,
                    highlights: visit.highlights || [],
                    best_time: visit.best_time,
                    quality_score: visit.quality_score,
                    agent_version: "v1.0",
                  });

                if (insertErr) {
                  logs.push(`❌ Erreur insertion visite: ${insertErr.message}`);
                } else {
                  logs.push(`✅ Visite créée: "${visit.title_fr}" (${hub.name}/${audience}/${mode})`);
                  results.push({ phase: "library", action: "visit_created", count: 1, logs: [] });
                }
              }
            } else {
              const errText = await visitResponse.text();
              logs.push(`❌ Erreur IA visite: ${visitResponse.status} — ${errText.slice(0, 200)}`);
            }
          }

          generated = true; // Only generate 1 visit per cron run
        }
      }
    }

    if (!generated) {
      // Count total possible visits
      const totalPossible = HUBS.length * AUDIENCES.length * MODES.length;
      if (existingKeys.size >= totalPossible) {
        logs.push("✅ Phase 2: Toutes les visites de la bibliothèque sont déjà générées");
      }
    }

    return new Response(JSON.stringify({ ok: true, logs, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    logs.push(`❌ Erreur agent: ${msg}`);
    return new Response(JSON.stringify({ ok: false, error: msg, logs }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
