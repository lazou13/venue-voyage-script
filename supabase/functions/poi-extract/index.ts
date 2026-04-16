import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MEDINA_POINTS = (() => {
  const points: { lat: number; lng: number }[] = [];
  for (let lat = 31.6245; lat <= 31.638; lat += 0.0009) {
    for (let lng = -7.995; lng <= -7.975; lng += 0.0012) {
      points.push({
        lat: Math.round(lat * 100000) / 100000,
        lng: Math.round(lng * 100000) / 100000,
      });
    }
  }
  const keyPoints = [
    { lat: 31.6258, lng: -7.9890 },
    { lat: 31.6241, lng: -7.9843 },
    { lat: 31.6320, lng: -7.9879 },
    { lat: 31.6285, lng: -7.9873 },
    { lat: 31.6215, lng: -7.9872 },
    { lat: 31.6238, lng: -7.9921 },
    { lat: 31.6305, lng: -7.9950 },
    { lat: 31.6199, lng: -7.9857 },
    { lat: 31.6270, lng: -7.9812 },
    { lat: 31.6348, lng: -7.9918 },
    { lat: 31.6293, lng: -7.9905 },
    { lat: 31.6275, lng: -7.9850 },
    { lat: 31.6250, lng: -7.9860 },
    { lat: 31.6245, lng: -7.9880 },
    { lat: 31.6310, lng: -7.9860 },
    { lat: 31.6335, lng: -7.9870 },
    { lat: 31.6360, lng: -7.9850 },
    { lat: 31.6300, lng: -7.9920 },
    { lat: 31.6265, lng: -7.9935 },
    { lat: 31.6280, lng: -7.9830 },
    { lat: 31.6225, lng: -7.9855 },
    { lat: 31.6230, lng: -7.9830 },
    { lat: 31.6315, lng: -7.9835 },
    { lat: 31.6340, lng: -7.9900 },
    { lat: 31.6255, lng: -7.9910 },
  ];
  const seen = new Set(points.map(p => `${p.lat},${p.lng}`));
  for (const kp of keyPoints) {
    const key = `${kp.lat},${kp.lng}`;
    if (!seen.has(key)) { points.push(kp); seen.add(key); }
  }
  return points;
})();

const RADIUS = 150;

const TYPES = [
  "tourist_attraction", "museum", "restaurant", "cafe",
  "lodging", "store", "art_gallery", "mosque", "spa",
  "library", "jewelry_store", "clothing_store", "shoe_store",
  "book_store", "bakery", "food", "bar", "night_club",
  "park", "place_of_worship", "pharmacy", "market",
  "point_of_interest", "landmark", "travel_agency", "shopping_mall",
];

const MAX_PAGES = 3;

interface PlaceResult {
  place_id: string;
  name: string;
  geometry: { location: { lat: number; lng: number } };
  types: string[];
  rating?: number;
  user_ratings_total?: number;
  vicinity?: string;
}

interface NearbyResponse {
  status: string;
  error_message?: string;
  results: PlaceResult[];
  next_page_token?: string;
}

async function fetchPlaces(
  type: string, lat: number, lng: number, pageToken?: string
): Promise<NearbyResponse> {
  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    radius: String(RADIUS),
    type,
    key: GOOGLE_API_KEY,
  });
  if (pageToken) params.set("pagetoken", pageToken);
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`
  );
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const typeOffset = Number(body.type_offset ?? 0);
    const typesPerBatch = Number(body.types_per_batch ?? 1);
    const pointOffset = Number(body.point_offset ?? 0);
    const pointsPerBatch = Number(body.points_per_batch ?? 10);

    const typesSlice = TYPES.slice(typeOffset, typeOffset + typesPerBatch);
    const pointsSlice = MEDINA_POINTS.slice(pointOffset, pointOffset + pointsPerBatch);
    const hasMorePoints = pointOffset + pointsPerBatch < MEDINA_POINTS.length;
    const hasMoreTypes = typeOffset + typesPerBatch < TYPES.length;
    const nextPointOffset = hasMorePoints ? pointOffset + pointsPerBatch : null;
    const nextTypeOffset = hasMorePoints ? typeOffset : (hasMoreTypes ? typeOffset + typesPerBatch : null);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const logs: string[] = [];
    const seenPlaceIds = new Set<string>();
    let totalInserted = 0;
    let totalDuplicates = 0;

    logs.push(`📦 Batch: types ${typeOffset + 1}–${typeOffset + typesSlice.length}/${TYPES.length} (${typesSlice.join(", ")}), points ${pointOffset + 1}–${pointOffset + pointsSlice.length}/${MEDINA_POINTS.length}`);

    for (const type of typesSlice) {
      for (const point of pointsSlice) {
        let pageToken: string | undefined;
        let page = 0;
        let pointResults = 0;
        let pointInserted = 0;

        do {
          if (pageToken) await new Promise((r) => setTimeout(r, 2000));
          const data = await fetchPlaces(type, point.lat, point.lng, pageToken);

          if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
            logs.push(`[${type}] point=${point.lat},${point.lng} page=${page + 1} status=${data.status} error=${data.error_message ?? "none"}`);
            break;
          }

          const results = data.results ?? [];
          pageToken = data.next_page_token;
          page++;
          pointResults += results.length;

          const rows: Record<string, unknown>[] = [];
          for (const place of results) {
            if (seenPlaceIds.has(place.place_id)) { totalDuplicates++; continue; }
            seenPlaceIds.add(place.place_id);
            rows.push({
              place_id: place.place_id,
              name: place.name,
              lat: place.geometry.location.lat,
              lng: place.geometry.location.lng,
              category_google: type,
              category: type === "restaurant" || type === "cafe" ? "restaurant"
                : type === "lodging" ? "hotel" : "generic",
              rating: place.rating ?? null,
              reviews_count: place.user_ratings_total ?? 0,
              address: place.vicinity ?? "",
              google_raw: { nearby: place },
              enrichment_status: "raw",
              status: "draft",
              zone: "medina",
            });
          }

          if (rows.length > 0) {
            const { error, count } = await supabase
              .from("medina_pois")
              .upsert(rows, { onConflict: "place_id", ignoreDuplicates: true, count: "exact" });
            if (error) {
              logs.push(`[upsert-error] ${type} point=${point.lat},${point.lng}: ${error.message}`);
            } else {
              const inserted = count ?? rows.length;
              pointInserted += inserted;
              totalInserted += inserted;
            }
          }
        } while (pageToken && page < MAX_PAGES);

        if (pointResults > 0) {
          logs.push(`[${type}] point=${point.lat},${point.lng} results=${pointResults} inserted=${pointInserted} pages=${page}`);
        }
      }
    }

    logs.push(`--- Batch done: ${totalInserted} inserted, ${totalDuplicates} duplicates, ${seenPlaceIds.size} unique ---`);

    return new Response(
      JSON.stringify({
        success: true,
        types_processed: typesSlice.length,
        type_offset: typeOffset,
        next_offset: nextOffset,
        total_types: TYPES.length,
        points_processed: MEDINA_POINTS.length,
        total_inserted: totalInserted,
        total_skipped: totalDuplicates,
        unique_places: seenPlaceIds.size,
        logs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("poi-extract error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
