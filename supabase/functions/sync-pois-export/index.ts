import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all enriched POIs with relevant fields
    const fields = [
      "name", "name_fr", "name_en", "name_ar",
      "lat", "lng", "zone", "category", "category_ai",
      "history_context", "history_context_en",
      "wikipedia_summary", "wikipedia_summary_en",
      "description_short",
      "local_anecdote", "local_anecdote_fr", "local_anecdote_en",
      "fun_fact_fr", "fun_fact_en",
      "riddle_easy", "riddle_easy_en", "riddle_medium", "riddle_hard", "challenge",
      "best_time_visit", "best_time_visit_en",
      "crowd_level",
      "accessibility_notes", "accessibility_notes_en",
      "photo_tip", "photo_tip_en",
      "is_photo_spot", "instagram_spot",
      "must_try", "must_try_en",
      "must_see_details", "must_see_details_en",
      "must_visit_nearby", "must_visit_nearby_en",
      "price_info", "price_info_en",
      "street_food_details", "street_food_details_en",
      "tourist_tips", "tourist_tips_en",
      "poi_quality_score", "status", "enrichment_status",
      "audio_url_fr", "audio_url_en", "audio_url_ar",
      "anecdote_audio_url_fr", "anecdote_audio_url_en"
    ].join(",");

    // Paginate to get all POIs (bypass 1000 row limit)
    let allPois: any[] = [];
    let from = 0;
    const pageSize = 500;

    while (true) {
      const { data, error } = await sb
        .from("medina_pois")
        .select(fields)
        .eq("is_active", true)
        .not("lat", "is", null)
        .not("lng", "is", null)
        .range(from, from + pageSize - 1)
        .order("name");

      if (error) throw error;
      if (!data || data.length === 0) break;
      allPois = allPois.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    // Filter to only POIs that have at least some enrichment
    const enriched = allPois.filter(
      (p) => p.history_context || p.local_anecdote_fr || p.local_anecdote || p.fun_fact_fr
    );

    return new Response(
      JSON.stringify({
        count: enriched.length,
        total_in_db: allPois.length,
        exported_at: new Date().toISOString(),
        pois: enriched,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
