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
const MODES = ["guided_tour"];

const EXCLUDED_CATEGORIES = new Set([
  "restaurant", "café", "cafe", "hotel", "riad", "tour_agency", "travel_agency",
  "car_rental", "pharmacy", "bank", "supermarket", "gym", "spa", "generic",
  "equestrian", "horseback", "parking", "gas_station", "atm", "laundry",
]);

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

    // ━━━━━━━━━━ PHASE 0: AUTO-VALIDATION (enriched → validated) ━━━━━━━━━━
    const { data: eligiblePois, error: eligibleErr } = await supabase
      .from("medina_pois")
      .select("id")
      .eq("status", "enriched")
      .eq("is_active", true)
      .gte("poi_quality_score", 3)
      .not("category_ai", "is", null)
      .not("lat", "is", null)
      .not("lng", "is", null)
      .not("name", "is", null)
      .limit(200);

    if (eligibleErr) throw eligibleErr;

    if (eligiblePois && eligiblePois.length > 0) {
      const ids = eligiblePois.map((p: any) => p.id);
      const now = new Date().toISOString();

      const { error: valErr } = await supabase
        .from("medina_pois")
        .update({ status: "validated", validated_at: now })
        .in("id", ids);

      if (valErr) {
        logs.push(`❌ Erreur auto-validation: ${valErr.message}`);
      } else {
        logs.push(`✅ Phase 0: ${ids.length} POIs promus en "validated"`);
        results.push({ phase: "auto_validation", action: "promote_validated", count: ids.length, logs: [] });
      }
    } else {
      logs.push("✅ Phase 0: Aucun POI éligible à valider");
    }

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

    // ━━━━━━━━━━ PHASE 2: GENERATE LIBRARY VISITS (AI-driven POI selection) ━━━━━━━━━━
    const { data: existingVisits } = await supabase
      .from("quest_library")
      .select("start_hub, audience, mode, stops_data");

    const existingKeys = new Set(
      (existingVisits || []).map((v: any) => `${v.start_hub}__${v.audience}__${v.mode}`)
    );

    // Collect POI IDs already used per hub for diversity
    const usedPoisPerHub: Record<string, Set<string>> = {};
    for (const v of existingVisits || []) {
      if (!usedPoisPerHub[v.start_hub]) usedPoisPerHub[v.start_hub] = new Set();
      for (const s of (v.stops_data || []) as any[]) {
        if (s.poi_id) usedPoisPerHub[v.start_hub].add(s.poi_id);
      }
    }

    // Get ALL cultural POIs once
    const { data: allPois } = await supabase
      .from("medina_pois")
      .select("id, name, name_fr, lat, lng, category_ai, description_short, audience_tags, route_tags, instagram_score, street_food_spot, accessibility_notes, riddle_easy, history_context, local_anecdote, photo_tip, rating, poi_quality_score, ruelle_etroite, best_time_visit")
      .not("status", "in", '("filtered","merged")')
      .not("category_ai", "is", null)
      .gte("poi_quality_score", 5)
      .gte("lat", 31.615)
      .lte("lat", 31.645)
      .gte("lng", -8.01)
      .lte("lng", -7.97)
      .limit(200);

    const culturalPois = (allPois || []).filter((p: any) => {
      const cat = (p.category_ai || "").toLowerCase();
      return !EXCLUDED_CATEGORIES.has(cat);
    });

    let generated = false;
    for (const hub of HUBS) {
      if (generated) break;
      for (const audience of AUDIENCES) {
        if (generated) break;
        for (const mode of MODES) {
          const key = `${hub.id}__${audience}__${mode}`;
          if (existingKeys.has(key)) continue;

          if (culturalPois.length < 5) {
            logs.push("⚠️ Pas assez de POIs culturels qualifiés");
            break;
          }

          logs.push(`🗺️ Phase 2: Génération visite ${hub.name} / ${audience} / ${mode}...`);

          // Mark already-used POIs for this hub
          const usedSet = usedPoisPerHub[hub.id] || new Set();

          // Build POI list for AI with distance from hub
          const poisForAI = culturalPois.map((p: any, i: number) => {
            const dist = Math.sqrt(Math.pow((p.lat - hub.lat) * 111320, 2) + Math.pow((p.lng - hub.lng) * 111320 * Math.cos(hub.lat * Math.PI / 180), 2));
            return {
              idx: i,
              id: p.id,
              name: p.name_fr || p.name,
              category: p.category_ai,
              lat: p.lat,
              lng: p.lng,
              dist_m: Math.round(dist),
              score: p.poi_quality_score,
              audience_tags: p.audience_tags || [],
              route_tags: p.route_tags || [],
              instagram_score: p.instagram_score || 0,
              street_food: p.street_food_spot || false,
              accessible: !(p.accessibility_notes || "").toLowerCase().includes("escalier") && !(p.ruelle_etroite),
              already_used: usedSet.has(p.id),
              description: (p.description_short || "").slice(0, 80),
            };
          }).filter((p: any) => p.dist_m <= 2500); // Max 2.5km from hub for 3h visits

          const poisText = poisForAI.map((p: any) =>
            `[${p.idx}] "${p.name}" (${p.category}) — ${p.dist_m}m du départ, score: ${p.score}/10, ` +
            `instagram: ${p.instagram_score}/10, food: ${p.street_food ? 'oui' : 'non'}, ` +
            `accessible: ${p.accessible ? 'oui' : 'non'}, ` +
            `audiences: [${p.audience_tags.join(',')}], routes: [${p.route_tags.join(',')}]` +
            `${p.already_used ? ' ⚠️ DÉJÀ UTILISÉ dans une autre visite de ce hub' : ''}`
          ).join("\n");

          const audienceDesc: Record<string, string> = {
            family: "Familles avec enfants : lieux sûrs, accessibles, ludiques, pas de ruelles trop étroites",
            young_adults: "Jeunes adultes : lieux insolites, hidden gems, street art, ambiance, ruelles secrètes",
            accessible: "Personnes à mobilité réduite : uniquement des lieux accessibles sans escaliers ni passages étroits",
            foodies: "Gourmets et amateurs de street food : souks alimentaires, épiceries, stands de rue, artisans culinaires",
            instagrammers: "Photographes et influenceurs : lieux les plus photogéniques, score instagram élevé, architecture remarquable",
          };

          const selectionPrompt = `Tu es un expert de la médina de Marrakech. Tu dois créer une VISITE GUIDÉE unique et mémorable d'environ 3 HEURES.

POINT DE DÉPART: ${hub.name} (lat: ${hub.lat}, lng: ${hub.lng})
PUBLIC CIBLE: ${audience} — ${audienceDesc[audience] || audience}
NOMBRE D'ÉTAPES: 8 à 12 (pour remplir 3h de visite)
DURÉE CIBLE: 180 minutes (3 heures)

RÈGLES DE SÉLECTION:
1. Choisis des POIs qui correspondent VRAIMENT au public cible
2. Assure une DIVERSITÉ de catégories (pas 2 monuments consécutifs, alterner palais/souks/places/jardins)
3. Ordonne les stops pour un PARCOURS LOGIQUE géographiquement (minimiser les allers-retours)
4. ÉVITE les POIs marqués "DÉJÀ UTILISÉ" sauf s'ils sont incontournables pour ce public
5. La distance totale du parcours ne doit pas dépasser 2500m (parcours de 3h)
6. Privilégie les POIs avec un bon score qualité
7. Chaque stop doit avoir un contenu riche : description guide ET anecdote locale

POIs DISPONIBLES:
${poisText}

Génère en une seule réponse :
- Les poi_ids sélectionnés DANS L'ORDRE du parcours (8 à 12 stops)
- Un titre accrocheur FR et EN
- Une description 2-3 phrases FR et EN expliquant POURQUOI cette visite est unique pour ce public
- 3-5 highlights courts (FR)
- Le meilleur moment de la journée
- Un score qualité auto-évalué 1-10`;

          if (!LOVABLE_API_KEY) continue;

          const visitResponse = await fetch(AI_GATEWAY, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-pro",
              messages: [
                { role: "system", content: "Tu es un expert du tourisme culturel à Marrakech. Tu crées des parcours de visite uniques et variés." },
                { role: "user", content: selectionPrompt },
              ],
              tools: [{
                type: "function",
                function: {
                  name: "create_visit",
                  description: "Create a complete library visit with selected POIs",
                  parameters: {
                    type: "object",
                    properties: {
                      selected_poi_indices: { type: "array", items: { type: "integer" }, description: "Indices of selected POIs in visit order" },
                      title_fr: { type: "string" },
                      title_en: { type: "string" },
                      description_fr: { type: "string" },
                      description_en: { type: "string" },
                      highlights: { type: "array", items: { type: "string" } },
                      best_time: { type: "string" },
                      quality_score: { type: "number" },
                    },
                    required: ["selected_poi_indices", "title_fr", "title_en", "description_fr", "description_en", "highlights", "best_time", "quality_score"],
                  },
                },
              }],
              tool_choice: { type: "function", function: { name: "create_visit" } },
            }),
          });

          if (!visitResponse.ok) {
            const errText = await visitResponse.text();
            logs.push(`❌ Erreur IA visite: ${visitResponse.status} — ${errText.slice(0, 200)}`);
            continue;
          }

          const visitData = await visitResponse.json();
          const visitTool = visitData.choices?.[0]?.message?.tool_calls?.[0];
          if (!visitTool?.function?.arguments) {
            logs.push("❌ Pas de réponse structurée de l'IA");
            continue;
          }

          const visit = JSON.parse(visitTool.function.arguments);
          const selectedIndices: number[] = visit.selected_poi_indices || [];

          // Map indices back to POIs
          const selectedPois = selectedIndices
            .map((idx: number) => poisForAI.find((p: any) => p.idx === idx))
            .filter(Boolean);

          if (selectedPois.length < 3) {
            logs.push("⚠️ L'IA a sélectionné moins de 3 POIs, skip");
            continue;
          }

          // Calculate route stats
          let totalDist = 0;
          for (let i = 1; i < selectedPois.length; i++) {
            const prev = selectedPois[i - 1];
            const curr = selectedPois[i];
            totalDist += Math.sqrt(Math.pow((curr.lat - prev.lat) * 111320, 2) + Math.pow((curr.lng - prev.lng) * 111320 * Math.cos(curr.lat * Math.PI / 180), 2));
          }
          const walkTime = Math.round(totalDist / 50);

          // Category-aware visit times (minutes)
          const VISIT_TIMES: Record<string, number> = {
            monument: 15, palace: 20, museum: 25, medersa: 18,
            mosque: 10, tomb: 12, gate_bab: 8, fountain: 6,
            fondouk: 12, souk: 15, market: 15,
            craft_shop: 12, restaurant: 15, cafe: 12, hammam: 10,
            garden: 15, plaza: 10, hotel: 8, riad: 8,
            shrine_zaouia: 10, gallery: 15, boutique: 10, other: 10,
          };

          const visitTime = selectedPois.reduce((sum: number, p: any) => sum + (VISIT_TIMES[p.category] || 12), 0);
          const totalTime = walkTime + visitTime;

          // Build stops_data from original POI data
          const stopsData = selectedPois.map((p: any, i: number) => {
            const original = culturalPois[p.idx];
            const prevDist = i === 0 ? 0 : Math.round(
              Math.sqrt(Math.pow((p.lat - selectedPois[i-1].lat) * 111320, 2) + Math.pow((p.lng - selectedPois[i-1].lng) * 111320 * Math.cos(p.lat * Math.PI / 180), 2))
            );
            const cat = p.category || 'other';
            return {
              order: i + 1,
              poi_id: p.id,
              name: p.name,
              lat: p.lat,
              lng: p.lng,
              category: cat,
              distance_from_prev_m: prevDist,
              walk_time_min: i === 0 ? 0 : Math.round(prevDist / 50),
              visit_time_min: VISIT_TIMES[cat] || 12,
              story: original?.history_context || original?.local_anecdote || undefined,
              description: original?.description_short || undefined,
              photo_tip: original?.photo_tip || undefined,
            };
          });

          const theme = { foodies: "food", instagrammers: "photography", family: "complete", accessible: "complete", young_adults: "hidden_gems" }[audience] || "complete";

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
              stops_count: selectedPois.length,
              stops_data: stopsData,
              highlights: visit.highlights || [],
              best_time: visit.best_time,
              quality_score: visit.quality_score,
              agent_version: "v2.0",
            });

          if (insertErr) {
            logs.push(`❌ Erreur insertion: ${insertErr.message}`);
          } else {
            logs.push(`✅ Visite créée: "${visit.title_fr}" — ${selectedPois.length} stops, ${selectedPois.map((p: any) => p.name).join(' → ')}`);
            results.push({ phase: "library", action: "visit_created", count: 1, logs: [] });
          }

          generated = true;
        }
      }
    }

    if (!generated) {
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
