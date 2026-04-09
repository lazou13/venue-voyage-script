import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function getCorsHeaders(req: Request) {
  const allowedOrigin = Deno.env.get("PUBLIC_SITE_ORIGIN");
  const requestOrigin = req.headers.get("Origin") ?? "*";
  const origin = allowedOrigin
    ? (requestOrigin === allowedOrigin ? allowedOrigin : allowedOrigin)
    : "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Vary": "Origin",
  };
}

const ipHits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 3600_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || now > entry.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

function json(body: unknown, status: number, cors: Record<string, string>, cache = true) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", ...(cache ? { "Cache-Control": "public, max-age=300" } : {}) },
  });
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") || "unknown";
  if (!checkRateLimit(ip)) return json({ error: "Too many requests" }, 429, cors);

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") || "list";

    // ── MODE: HEALTH ──
    if (mode === "health") {
      const [totalRes, validatedRes, enrichedRes, mediaRes, toursRes, photosRes, recosRes] = await Promise.all([
        sb.from("medina_pois").select("id", { count: "exact", head: true }).eq("is_active", true),
        sb.from("medina_pois").select("id", { count: "exact", head: true }).eq("status", "validated"),
        sb.from("medina_pois").select("id", { count: "exact", head: true }).eq("status", "enriched"),
        sb.from("poi_media").select("id", { count: "exact", head: true }),
        sb.from("quest_library").select("id", { count: "exact", head: true }),
        sb.from("quest_photos").select("id", { count: "exact", head: true }),
        sb.from("client_poi_recommendations").select("id", { count: "exact", head: true }),
      ]);

      // Get latest update timestamp
      const { data: latestPoi } = await sb
        .from("medina_pois")
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return json({
        status: "ok",
        timestamp: new Date().toISOString(),
        last_updated: latestPoi?.updated_at ?? null,
        counts: {
          pois_active: totalRes.count ?? 0,
          pois_validated: validatedRes.count ?? 0,
          pois_enriched: enrichedRes.count ?? 0,
          media: mediaRes.count ?? 0,
          tours: toursRes.count ?? 0,
          client_photos: photosRes.count ?? 0,
          client_recommendations: recosRes.count ?? 0,
        },
      }, 200, cors, false);
    }

    // ── MODE: LIST ──
    if (mode === "list") {
      const { data, error } = await sb
        .from("projects")
        .select("id, hotel_name, city, quest_config, title_i18n, created_at, updated_at, is_complete, difficulty, target_duration_mins, theme");
      if (error) throw error;
      const projects = (data ?? []).map((p: any) => ({
        id: p.id, hotel_name: p.hotel_name, city: p.city, title_i18n: p.title_i18n,
        theme: p.theme, difficulty: p.difficulty, target_duration_mins: p.target_duration_mins,
        is_complete: p.is_complete, project_type: p.quest_config?.project_type,
        play_mode: p.quest_config?.play_mode, languages: p.quest_config?.languages,
        catalog: p.quest_config?.catalog, created_at: p.created_at, updated_at: p.updated_at,
      }));
      return json({ projects }, 200, cors);
    }

    // ── MODE: PROJECT ──
    if (mode === "project") {
      const id = (url.searchParams.get("id") ?? "").trim();
      if (!id || id.length > 40) return json({ error: "id parameter required" }, 400, cors);

      const [projectRes, poisRes, tracesRes, avatarsRes] = await Promise.all([
        sb.from("projects").select("*").eq("id", id).maybeSingle(),
        sb.from("pois").select("*").eq("project_id", id).order("sort_order"),
        sb.from("route_traces").select("*").eq("project_id", id).order("created_at", { ascending: false }),
        sb.from("avatars").select("*").eq("project_id", id),
      ]);

      if (projectRes.error) throw projectRes.error;
      if (!projectRes.data) return json({ error: "Project not found" }, 404, cors);

      const traceIds = (tracesRes.data ?? []).map((t: any) => t.id);
      let markers: any[] = [];
      if (traceIds.length > 0) {
        const { data: mData, error: mErr } = await sb.from("route_markers").select("*").in("trace_id", traceIds);
        if (mErr) throw mErr;
        markers = mData ?? [];
      }

      const markersByTrace = new Map<string, any[]>();
      for (const m of markers) {
        const arr = markersByTrace.get(m.trace_id) || [];
        arr.push(m);
        markersByTrace.set(m.trace_id, arr);
      }

      const traces = (tracesRes.data ?? []).map((t: any) => ({ ...t, markers: markersByTrace.get(t.id) || [] }));
      return json({ project: projectRes.data, pois: poisRes.data ?? [], traces, avatars: avatarsRes.data ?? [] }, 200, cors);
    }

    // ── MODE: LIBRARY ──
    if (mode === "library") {
      const zone = url.searchParams.get("zone")?.trim().slice(0, 80);
      const category = url.searchParams.get("category")?.trim().slice(0, 80);

      let query = sb.from("medina_pois").select(`
        id, name, name_fr, name_en, name_ar,
        lat, lng, zone, category, category_ai,
        category_google, status, is_active, is_start_hub,
        rating, reviews_count, poi_quality_score,
        address, description_short, history_context,
        local_anecdote, local_anecdote_fr, local_anecdote_en,
        fun_fact_fr, fun_fact_en, wikipedia_summary,
        price_info, opening_hours, must_see_details,
        must_try, must_visit_nearby, is_photo_spot,
        photo_tip, ruelle_etroite, crowd_level,
        accessibility_notes, visit_route, metadata,
        enrichment_quality, last_enriched_at,
        client_photos_count, visit_count,
        best_client_photo_url, nearby_pois_ids,
        riddle_easy, riddle_medium, riddle_hard,
        challenge, tourist_interest, instagram_spot,
        radius_m, district, audience_tags,
        street_food_spot, street_food_details,
        instagram_score, best_time_visit
      `).eq("is_active", true).eq("status", "validated");
      if (zone) query = query.eq("zone", zone);
      if (category) query = query.eq("category", category);

      const { data: pois, error } = await query.order("name");
      if (error) throw error;

      const poiIds = (pois ?? []).map((p: any) => p.id);
      let media: any[] = [];
      if (poiIds.length > 0) {
        const { data: mData, error: mErr } = await sb.from("poi_media").select("*").in("medina_poi_id", poiIds).order("sort_order");
        if (mErr) throw mErr;
        media = mData ?? [];
      }

      const mediaByPoi = new Map<string, any[]>();
      for (const m of media) {
        const arr = mediaByPoi.get(m.medina_poi_id) || [];
        arr.push(m);
        mediaByPoi.set(m.medina_poi_id, arr);
      }

      const result = (pois ?? []).map((p: any) => ({ ...p, media: mediaByPoi.get(p.id) || [] }));
      return json({ pois: result }, 200, cors);
    }

    // ── MODE: TOURS ──
    if (mode === "tours") {
      const audience = url.searchParams.get("audience")?.trim().slice(0, 80);
      const hub = url.searchParams.get("hub")?.trim().slice(0, 80);

      let query = sb.from("quest_library").select("*").order("quality_score", { ascending: false });
      if (audience) query = query.eq("audience", audience);
      if (hub) query = query.eq("start_hub", hub);

      const { data, error } = await query;
      if (error) throw error;
      return json({ tours: data ?? [] }, 200, cors);
    }

    return json({ error: "Invalid mode. Use: list, project, library, tours, health" }, 400, cors);
  } catch (e: any) {
    console.error("public-project-data error:", e);
    return json({ error: "Internal error" }, 500, cors);
  }
});
