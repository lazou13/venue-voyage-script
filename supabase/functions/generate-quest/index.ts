import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateQuest, type EngineInput, type POI } from "./QuestEngine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));

    // Validate required fields
    if (body.start_lat == null || body.start_lng == null) {
      return new Response(
        JSON.stringify({ error: "start_lat and start_lng are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validModes = ["treasure_hunt", "guided_tour"];
    if (body.mode && !validModes.includes(body.mode)) {
      return new Response(
        JSON.stringify({ error: `mode must be one of: ${validModes.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build input with defaults
    const input: EngineInput = {
      start_lat: body.start_lat,
      start_lng: body.start_lng,
      start_name: body.start_name,
      mode: body.mode ?? "treasure_hunt",
      theme: body.theme ?? "complete",
      audience: body.audience ?? "tourist",
      difficulty: body.difficulty ?? "easy",
      max_duration_min: clamp(body.max_duration_min ?? 90, 30, 240),
      radius_m: clamp(body.radius_m ?? 800, 200, 1500),
      max_stops: clamp(body.max_stops ?? 6, 3, 12),
      include_food_break: body.include_food_break ?? true,
      circular: body.circular ?? false,
      language: body.language ?? "fr",
      exclude_place_ids: body.exclude_place_ids ?? [],
    };

    // Fetch POIs from database
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: rawPois, error: dbError } = await supabase
      .from("medina_pois")
      .select(
        "id, name, lat, lng, category_ai, category_google, rating, reviews_count, poi_quality_score, address, description_short, history_context, local_anecdote, riddle_easy, riddle_medium, riddle_hard, challenge, tourist_interest, instagram_spot, is_start_hub, is_active, radius_m, metadata, price_info, opening_hours, must_see_details, must_try, must_visit_nearby, is_photo_spot, photo_tip, ruelle_etroite"
      )
      .eq("is_active", true)
      .not("lat", "is", null)
      .not("lng", "is", null)
      .not("status", "in", "(filtered,merged)");

    if (dbError) throw dbError;

    const pois: POI[] = (rawPois ?? []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      name: p.name as string,
      lat: p.lat as number,
      lng: p.lng as number,
      category_ai: (p.category_ai ?? p.category_google ?? "other") as string,
      category_google: (p.category_google ?? "") as string,
      rating: (p.rating as number) ?? 3,
      reviews_count: (p.reviews_count as number) ?? 0,
      poi_quality_score: (p.poi_quality_score as number) ?? 5,
      address: (p.address ?? "") as string,
      description_short: (p.description_short ?? "") as string,
      history_context: (p.history_context ?? "") as string,
      local_anecdote: (p.local_anecdote ?? "") as string,
      riddle_easy: (p.riddle_easy ?? "") as string,
      riddle_medium: (p.riddle_medium ?? "") as string,
      riddle_hard: (p.riddle_hard ?? "") as string,
      challenge: (p.challenge ?? "") as string,
      tourist_interest: (p.tourist_interest ?? "") as string,
      instagram_spot: (p.instagram_spot ?? false) as boolean,
      is_start_hub: (p.is_start_hub ?? false) as boolean,
      is_active: (p.is_active ?? true) as boolean,
      radius_m: (p.radius_m as number) ?? 30,
      metadata: (p.metadata ?? {}) as POI["metadata"],
    }));

    // Generate quest (haversine-based initial route)
    const result = generateQuest(input, pois);

    // ── pgRouting enhancement pass ─────────────────────────────
    // If street_nodes / streets tables are populated, replace
    // euclidean distances with real pedestrian walking distances.
    let routeEnhanced = false;
    try {
      // 1. Gather all points (start + stops)
      const points: { lat: number; lng: number }[] = [
        { lat: input.start_lat, lng: input.start_lng },
        ...result.stops.map((s) => ({ lat: s.lat, lng: s.lng })),
      ];

      // 2. Find nearest graph node for each point
      const nodeIds: (number | null)[] = await Promise.all(
        points.map(async (pt) => {
          const { data } = await supabase.rpc("nearby_nodes_knn", {
            p_lat: pt.lat,
            p_lng: pt.lng,
            p_limit: 1,
          }).single();
          return (data as { id: number } | null)?.id ?? null;
        })
      );

      const allNodeIds = nodeIds.filter((id): id is number => id !== null);

      // Only proceed if we have nodes for all points
      if (allNodeIds.length === points.length) {
        // 3. Build cost matrix via pgr_dijkstraCostMatrix
        const { data: costRows, error: costErr } = await supabase.rpc(
          "get_walking_cost_matrix",
          { node_ids: allNodeIds }
        );

        if (!costErr && costRows && Array.isArray(costRows) && costRows.length > 0) {
          // Build lookup: [from_idx][to_idx] → cost_seconds
          const n = allNodeIds.length;
          const nodeToIdx = new Map(allNodeIds.map((id, i) => [id, i]));
          const costMatrix: number[][] = Array.from({ length: n }, () =>
            new Array(n).fill(Infinity)
          );
          for (let i = 0; i < n; i++) costMatrix[i][i] = 0;
          for (const row of costRows as { start_vid: number; end_vid: number; agg_cost: number }[]) {
            const i = nodeToIdx.get(row.start_vid);
            const j = nodeToIdx.get(row.end_vid);
            if (i !== undefined && j !== undefined) {
              costMatrix[i][j] = row.agg_cost; // seconds
            }
          }

          // 4. Update each stop's distance and walk_time with real values
          let totalDistM = 0;
          let totalWalkSec = 0;
          let cumMin = 0;

          for (let i = 0; i < result.stops.length; i++) {
            const fromIdx = i; // 0 = start, i = stop i-1
            const toIdx = i + 1; // i+1 = stop i
            const walkSec = costMatrix[fromIdx][toIdx];

            if (walkSec !== Infinity) {
              const walkMin = Math.ceil(walkSec / 60);
              // Approx distance: cost_sec × 0.83 m/s
              const distM = Math.round(walkSec * 0.83);
              result.stops[i].distance_from_prev_m = distM;
              result.stops[i].walk_time_min = walkMin;
              totalDistM += distM;
              totalWalkSec += walkSec;
            } else {
              // Fallback: keep haversine value
              totalDistM += result.stops[i].distance_from_prev_m;
              totalWalkSec += result.stops[i].walk_time_min * 60;
            }

            // Adaptive validation radius based on street type around the stop
            // (derb/covered: 50m, open plaza: 15m, default: 30m)
            const { data: nearPoi } = await supabase
              .from("medina_pois")
              .select("street_type, radius_m")
              .eq("id", result.stops[i].poi_id)
              .single();

            if (nearPoi) {
              const streetType = (nearPoi as { street_type?: string }).street_type;
              const baseRadius = (nearPoi as { radius_m?: number }).radius_m ?? 30;
              const adaptiveRadius =
                streetType === "derb" || streetType === "covered_passage" ? Math.max(baseRadius, 50) :
                streetType === "plaza" || streetType === "main_street" ? Math.min(baseRadius, 20) :
                baseRadius;
              result.stops[i].validation_radius_m = adaptiveRadius;
            }

            cumMin = result.stops[i - 1]?.cumulative_time_min ?? 0;
            cumMin += result.stops[i].walk_time_min + result.stops[i].visit_time_min;
            result.stops[i].cumulative_time_min = cumMin;
          }

          // 5. Recalculate totals
          const totalWalkMin = Math.ceil(totalWalkSec / 60);
          result.total_distance_m = totalDistM;
          result.walking_time_min = totalWalkMin;
          result.total_time_min = totalWalkMin + result.visit_time_min;

          routeEnhanced = true;
        }
      }
    } catch {
      // pgRouting not available or graph not populated — silently use haversine
    }

    // Add routing metadata
    (result as Record<string, unknown>).routing_method = routeEnhanced ? "pgrouting" : "haversine";
    (result as Record<string, unknown>).algorithm_version = routeEnhanced ? "4.0.0-spatial" : "3.0.0";

    // Try to save to generated_quests (ignore if table doesn't exist yet)
    try {
      await supabase.from("generated_quests").insert({
        id: result.id,
        mode: result.mode,
        theme: result.theme,
        difficulty: result.difficulty,
        start_lat: input.start_lat,
        start_lng: input.start_lng,
        start_name: input.start_name,
        total_stops: result.total_stops,
        total_distance_m: result.total_distance_m,
        total_time_min: result.total_time_min,
        total_points: result.total_points,
        stops_data: result.stops,
      });
    } catch {
      // Table may not exist yet — silently ignore
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-quest error:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("Seulement") ? 422 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
