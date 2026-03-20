import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// GPS grid covering the médina of Marrakech — maille 200m systématique
// Bbox: south=31.624, west=-7.995, north=31.638, east=-7.975
// Généré avec pas lat=0.0018° (~200m), pas lng=0.0025° (~200m)
const MEDINA_POINTS = (() => {
  const points: { lat: number; lng: number }[] = [];
  // Grille systématique 200m × 200m sur la médina
  for (let lat = 31.6245; lat <= 31.638; lat += 0.0018) {
    for (let lng = -7.995; lng <= -7.975; lng += 0.0025) {
      points.push({
        lat: Math.round(lat * 10000) / 10000,
        lng: Math.round(lng * 10000) / 10000,
      });
    }
  }
  // Points supplémentaires sur les zones clés non couvertes par la grille
  const keyPoints = [
    { lat: 31.6258, lng: -7.9890 }, // Jemaa el-Fna
    { lat: 31.6241, lng: -7.9843 }, // Mellah / Palais Bahia
    { lat: 31.6320, lng: -7.9879 }, // Souk Semmarine
    { lat: 31.6285, lng: -7.9873 }, // Ben Youssef / Derb el Cadi
    { lat: 31.6215, lng: -7.9872 }, // Kasbah / Tombeaux Saadiens
    { lat: 31.6238, lng: -7.9921 }, // Bab Doukkala
    { lat: 31.6305, lng: -7.9950 }, // Bab el-Khemis
    { lat: 31.6199, lng: -7.9857 }, // Bab Agnaou / Bab er-Robb
    { lat: 31.6270, lng: -7.9812 }, // Mellah central
    { lat: 31.6348, lng: -7.9918 }, // Bab el-Khemis nord
  ];
  // Éviter doublons exacts
  const seen = new Set(points.map(p => `${p.lat},${p.lng}`));
  for (const kp of keyPoints) {
    const key = `${kp.lat},${kp.lng}`;
    if (!seen.has(key)) { points.push(kp); seen.add(key); }
  }
  return points;
})();

const RADIUS = 300; // Réduit à 300m (grille dense = moins de recouvrement)

const TYPES = [
  "tourist_attraction", "museum", "restaurant", "cafe",
  "lodging", "store", "art_gallery", "mosque", "spa",
  "library", "jewelry_store", "clothing_store", "shoe_store",
  "book_store", "bakery", "food", "bar", "night_club",
];

const MAX_PAGES = 3; // Google returns max 20 results per page → 60 max per type+point

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
  type: string,
  lat: number,
  lng: number,
  pageToken?: string
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
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const logs: string[] = [];
    const seenPlaceIds = new Set<string>();
    let totalInserted = 0;
    let totalSkipped = 0;
    let totalDuplicates = 0;

    for (const type of TYPES) {
      for (const point of MEDINA_POINTS) {
        let pageToken: string | undefined;
        let page = 0;
        let pointResults = 0;
        let pointInserted = 0;

        do {
          if (pageToken) await new Promise((r) => setTimeout(r, 2000));

          const data = await fetchPlaces(type, point.lat, point.lng, pageToken);

          // Log Google status for debugging
          if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
            logs.push(
              `[${type}] point=${point.lat},${point.lng} page=${page + 1} status=${data.status} error=${data.error_message ?? "none"}`
            );
            break;
          }

          const results = data.results ?? [];
          pageToken = data.next_page_token;
          page++;
          pointResults += results.length;

          // Build rows, dedup in-memory
          const rows: Record<string, unknown>[] = [];
          for (const place of results) {
            if (seenPlaceIds.has(place.place_id)) {
              totalDuplicates++;
              continue;
            }
            seenPlaceIds.add(place.place_id);

            rows.push({
              place_id: place.place_id,
              name: place.name,
              lat: place.geometry.location.lat,
              lng: place.geometry.location.lng,
              category_google: type,
              category:
                type === "restaurant" || type === "cafe"
                  ? "restaurant"
                  : type === "lodging"
                    ? "hotel"
                    : "generic",
              rating: place.rating ?? null,
              reviews_count: place.user_ratings_total ?? 0,
              address: place.vicinity ?? "",
              google_raw: { nearby: place },
              enrichment_status: "raw",
              status: "draft",
              zone: "medina",
            });
          }

          // Batch upsert (ignoreDuplicates acts as ON CONFLICT DO NOTHING)
          if (rows.length > 0) {
            const { error, count } = await supabase
              .from("medina_pois")
              .upsert(rows, { onConflict: "place_id", ignoreDuplicates: true, count: "exact" });

            if (error) {
              logs.push(
                `[upsert-error] ${type} point=${point.lat},${point.lng}: ${error.message}`
              );
            } else {
              const inserted = count ?? rows.length;
              pointInserted += inserted;
              totalInserted += inserted;
            }
          }
        } while (pageToken && page < MAX_PAGES);

        if (pointResults > 0) {
          logs.push(
            `[${type}] point=${point.lat},${point.lng} results=${pointResults} inserted=${pointInserted} pages=${page}`
          );
        }
      }
    }

    totalSkipped = totalDuplicates;
    logs.push(
      `--- DONE: ${totalInserted} inserted, ${totalSkipped} duplicates skipped, ${seenPlaceIds.size} unique place_ids seen (${MEDINA_POINTS.length} grid points × ${TYPES.length} types) ---`
    );

    return new Response(
      JSON.stringify({
        success: true,
        types_processed: TYPES.length,
        points_processed: MEDINA_POINTS.length,
      grid_size: MEDINA_POINTS.length,
        total_inserted: totalInserted,
        total_skipped: totalSkipped,
        unique_places: seenPlaceIds.size,
        logs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("poi-extract error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
