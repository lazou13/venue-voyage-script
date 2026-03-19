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
        "id, name, lat, lng, category_ai, category_google, rating, reviews_count, poi_quality_score, address, description_short, history_context, local_anecdote, riddle_easy, riddle_medium, riddle_hard, challenge, tourist_interest, instagram_spot, is_start_hub, is_active, radius_m, metadata"
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

    // Generate quest
    const result = generateQuest(input, pois);

    // Try to save to generated_quests (ignore if table doesn't exist yet)
    try {
      await supabase.from("generated_quests").insert({
        id: result.id,
        mode: result.mode,
        theme: result.theme,
        difficulty: result.difficulty,
        language: result.language,
        total_stops: result.total_stops,
        total_distance_m: result.total_distance_m,
        total_time_min: result.total_time_min,
        total_points: result.total_points,
        quest_data: result,
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
