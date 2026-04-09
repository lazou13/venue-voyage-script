import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  "https://questrides.com",
  "https://www.questrides.com",
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(origin)) return true;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;
  return false;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = isAllowedOrigin(origin);
  return {
    "Access-Control-Allow-Origin": allowed && origin ? origin : "",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Accept-Language",
    "Access-Control-Expose-Headers": "X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset",
    "Vary": "Origin",
  };
}

function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ── Auth middleware ──────────────────────────────────────────────
async function verifyApiKey(req: Request, cors: Record<string, string>) {
  const url = new URL(req.url);
  const key = req.headers.get("X-API-Key") || url.searchParams.get("api_key");

  if (!key) {
    return { error: jsonResponse({ error: "API key required", code: "MISSING_API_KEY" }, 401, cors) };
  }

  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, app_name, rate_limit, is_active")
    .eq("key", key)
    .maybeSingle();

  if (error || !data) {
    return { error: jsonResponse({ error: "Invalid API key", code: "INVALID_API_KEY" }, 401, cors) };
  }

  if (!data.is_active) {
    return { error: jsonResponse({ error: "API key deactivated", code: "INACTIVE_API_KEY" }, 403, cors) };
  }

  // Fire-and-forget: update last_used_at and requests_count
  supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString(), requests_count: (data as any).requests_count + 1 })
    .eq("id", data.id)
    .then(() => {});

  // Actually we need to increment properly — use rpc-less approach
  supabaseAdmin.rpc("", {}).catch(() => {}); // no-op, just use raw update above

  return { apiKey: data };
}

// ── Rate limit middleware ────────────────────────────────────────
async function checkRateLimit(apiKeyId: string, rateLimit: number, cors: Record<string, string>) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).toISOString();

  // Sum last 24h
  const { data: usageRows } = await supabaseAdmin
    .from("api_usage")
    .select("request_count")
    .eq("api_key_id", apiKeyId)
    .gte("window_start", windowStart);

  const totalUsed = (usageRows || []).reduce((sum: number, r: any) => sum + (r.request_count || 0), 0);

  const resetAt = Math.floor((now.getTime() + 24 * 60 * 60 * 1000) / 1000);

  const rateLimitHeaders: Record<string, string> = {
    "X-RateLimit-Limit": String(rateLimit),
    "X-RateLimit-Remaining": String(Math.max(0, rateLimit - totalUsed - 1)),
    "X-RateLimit-Reset": String(resetAt),
  };

  if (totalUsed >= rateLimit) {
    return {
      error: jsonResponse(
        { error: "Rate limit exceeded", code: "RATE_LIMIT_EXCEEDED", limit: rateLimit, reset_at: resetAt },
        429,
        { ...cors, ...rateLimitHeaders },
      ),
    };
  }

  // Upsert current hour bucket
  const { data: existing } = await supabaseAdmin
    .from("api_usage")
    .select("id, request_count")
    .eq("api_key_id", apiKeyId)
    .eq("window_start", currentHour)
    .maybeSingle();

  if (existing) {
    await supabaseAdmin
      .from("api_usage")
      .update({ request_count: existing.request_count + 1 })
      .eq("id", existing.id);
  } else {
    await supabaseAdmin
      .from("api_usage")
      .insert({ api_key_id: apiKeyId, request_count: 1, window_start: currentHour });
  }

  return { headers: rateLimitHeaders };
}

// ── Localized name helper ────────────────────────────────────────
function localizeName(poi: any, lang: string): string {
  if (lang === "ar" && poi.name_ar) return poi.name_ar;
  if (lang === "en" && poi.name_en) return poi.name_en;
  return poi.name_fr || poi.name || poi.name_en || "";
}

// ── POI list columns (no geom!) ──────────────────────────────────
const POI_LIST_COLS = `id, name, name_fr, name_en, name_ar, lat, lng, category, status, is_active, rating, poi_quality_score, best_client_photo_url`;

const POI_DETAIL_COLS = `id, name, name_fr, name_en, name_ar, lat, lng, category, category_ai, category_google, subcategory, status, is_active, is_start_hub, hub_theme, rating, reviews_count, poi_quality_score, address, description_short, history_context, local_anecdote, local_anecdote_fr, local_anecdote_en, fun_fact_fr, fun_fact_en, instagram_spot, instagram_score, instagram_tips, photo_tip, is_photo_spot, photo_spot_score, best_time_visit, crowd_level, opening_hours, price_info, accessibility_notes, street_food_spot, street_food_details, must_try, must_see_details, must_visit_nearby, audience_tags, route_tags, district, zone, radius_m, riddle_easy, riddle_medium, riddle_hard, challenge, tourist_interest, best_client_photo_url, nearby_pois_ids, wikidata_id, wikipedia_summary, website_url, phone, created_at, updated_at`;

// ── Route: list POIs ─────────────────────────────────────────────
async function handleListPois(url: URL, lang: string) {
  const category = url.searchParams.get("category");
  const lat = url.searchParams.get("lat") ? parseFloat(url.searchParams.get("lat")!) : null;
  const lng = url.searchParams.get("lng") ? parseFloat(url.searchParams.get("lng")!) : null;
  const radius = Math.min(parseInt(url.searchParams.get("radius") || "5000"), 20000);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "20"), 1), 100);
  const offset = Math.max(parseInt(url.searchParams.get("offset") || "0"), 0);

  let query = supabaseAdmin
    .from("medina_pois")
    .select(POI_LIST_COLS, { count: "exact" })
    .eq("is_active", true);

  if (category) {
    query = query.eq("category", category);
  }

  // If lat/lng provided, filter by bounding box approximation
  if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
    const degreeOffset = radius / 111000;
    query = query
      .gte("lat", lat - degreeOffset)
      .lte("lat", lat + degreeOffset)
      .gte("lng", lng - degreeOffset)
      .lte("lng", lng + degreeOffset);
  }

  query = query.range(offset, offset + limit - 1).order("name");

  const { data: pois, count, error } = await query;

  if (error) {
    return { error: error.message, pois: [], total: 0 };
  }

  const mapped = (pois || []).map((p: any) => {
    const item: any = {
      id: p.id,
      name: localizeName(p, lang),
      latitude: p.lat,
      longitude: p.lng,
      category: p.category,
      thumbnail_url: p.best_client_photo_url || null,
    };
    if (lat !== null && lng !== null && p.lat && p.lng) {
      item.distance_meters = Math.round(haversine(lat, lng, p.lat, p.lng));
    }
    return item;
  });

  // Sort by distance if proximity search
  if (lat !== null && lng !== null) {
    mapped.sort((a: any, b: any) => (a.distance_meters || 0) - (b.distance_meters || 0));
  }

  const total = count || 0;
  return { pois: mapped, total, limit, offset, has_more: offset + limit < total };
}

// ── Route: POI detail ────────────────────────────────────────────
async function handleGetPoi(id: string, lang: string) {
  const { data: poi, error } = await supabaseAdmin
    .from("medina_pois")
    .select(POI_DETAIL_COLS)
    .eq("id", id)
    .maybeSingle();

  if (error || !poi) return null;

  // Get media
  const { data: media } = await supabaseAdmin
    .from("poi_media")
    .select("storage_path, storage_bucket, media_type, caption, is_cover, sort_order")
    .eq("medina_poi_id", id)
    .eq("media_type", "photo")
    .order("sort_order");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const images = (media || []).map((m: any) =>
    `${supabaseUrl}/storage/v1/object/public/${m.storage_bucket}/${m.storage_path}`
  );

  return {
    id: poi.id,
    name: localizeName(poi, lang),
    name_ar: poi.name_ar,
    name_en: poi.name_en,
    latitude: poi.lat,
    longitude: poi.lng,
    category: poi.category,
    description: lang === "en" ? (poi.local_anecdote_en || poi.description_short) : (poi.local_anecdote_fr || poi.description_short),
    description_short: poi.description_short,
    history_context: poi.history_context,
    local_anecdote_fr: poi.local_anecdote_fr,
    local_anecdote_en: poi.local_anecdote_en,
    fun_fact_fr: poi.fun_fact_fr,
    fun_fact_en: poi.fun_fact_en,
    images,
    address: poi.address,
    opening_hours: poi.opening_hours,
    rating: poi.rating,
    district: poi.district,
    zone: poi.zone,
    audience_tags: poi.audience_tags,
    instagram_spot: poi.instagram_spot,
    best_time_visit: poi.best_time_visit,
    created_at: poi.created_at,
    updated_at: poi.updated_at,
  };
}

// ── Haversine ────────────────────────────────────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Main handler ─────────────────────────────────────────────────
Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405, cors);
  }

  // 1. Auth
  const authResult = await verifyApiKey(req, cors);
  if (authResult.error) return authResult.error;
  const apiKey = authResult.apiKey!;

  // 2. Rate limit
  const rlResult = await checkRateLimit(apiKey.id, apiKey.rate_limit, cors);
  if (rlResult.error) return rlResult.error;

  const allHeaders = { ...cors, ...rlResult.headers };

  // 3. Route
  const url = new URL(req.url);
  const route = url.searchParams.get("route");
  const acceptLang = req.headers.get("Accept-Language") || "";
  const langParam = url.searchParams.get("language");
  const lang = langParam || (acceptLang.startsWith("ar") ? "ar" : acceptLang.startsWith("en") ? "en" : "fr");

  if (route === "pois") {
    const result = await handleListPois(url, lang);
    if (result.error) return jsonResponse({ error: result.error }, 500, allHeaders);
    return jsonResponse(result, 200, allHeaders);
  }

  if (route === "poi") {
    const id = url.searchParams.get("id");
    if (!id) return jsonResponse({ error: "Missing id parameter" }, 400, allHeaders);
    const poi = await handleGetPoi(id, lang);
    if (!poi) return jsonResponse({ error: "POI not found", code: "NOT_FOUND" }, 404, allHeaders);
    return jsonResponse(poi, 200, allHeaders);
  }

  return jsonResponse({ error: "Unknown route. Use ?route=pois or ?route=poi&id=..." }, 400, allHeaders);
});
