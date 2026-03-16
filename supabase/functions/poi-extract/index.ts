import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CENTER = { lat: 31.630, lng: -7.990 };
const RADIUS = 1500;
const TYPES = [
  "tourist_attraction", "museum", "restaurant", "cafe",
  "lodging", "store", "art_gallery", "shopping_mall",
];

interface PlaceResult {
  place_id: string;
  name: string;
  geometry: { location: { lat: number; lng: number } };
  types: string[];
  rating?: number;
  user_ratings_total?: number;
  vicinity?: string;
}

async function fetchPlacesPage(type: string, pageToken?: string): Promise<{ results: PlaceResult[]; next_page_token?: string }> {
  const params = new URLSearchParams({
    location: `${CENTER.lat},${CENTER.lng}`,
    radius: String(RADIUS),
    type,
    key: GOOGLE_API_KEY,
  });
  if (pageToken) params.set("pagetoken", pageToken);

  const res = await fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`);
  return res.json();
}

async function fetchPlaceDetails(placeId: string) {
  const fields = "website,formatted_phone_number,opening_hours,reviews,photos,formatted_address";
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_API_KEY}&language=fr`;
  const res = await fetch(url);
  const data = await res.json();
  return data.result ?? {};
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const limit = body.limit ?? 500;
    const withDetails = body.with_details !== false;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const logs: string[] = [];
    let totalInserted = 0;
    let totalSkipped = 0;

    for (const type of TYPES) {
      let pageToken: string | undefined;
      let page = 0;

      do {
        if (totalInserted >= limit) break;
        if (pageToken) await new Promise(r => setTimeout(r, 2000)); // Google requires delay

        const data = await fetchPlacesPage(type, pageToken);
        const results = data.results ?? [];
        pageToken = data.next_page_token;
        page++;

        logs.push(`[${type}] page ${page}: ${results.length} results`);

        for (const place of results) {
          if (totalInserted >= limit) break;

          // Fetch details if requested
          let details: Record<string, unknown> = {};
          if (withDetails) {
            try {
              details = await fetchPlaceDetails(place.place_id);
            } catch (e) {
              logs.push(`[details-error] ${place.place_id}: ${e}`);
            }
          }

          const row = {
            place_id: place.place_id,
            name: place.name,
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng,
            category_google: type,
            category: type === "restaurant" || type === "cafe" ? "restaurant" : "generic",
            rating: place.rating ?? null,
            reviews_count: place.user_ratings_total ?? 0,
            address: (details as any).formatted_address ?? place.vicinity ?? "",
            website: (details as any).website ?? null,
            phone: (details as any).formatted_phone_number ?? null,
            google_raw: { nearby: place, details },
            enrichment_status: "raw",
            status: "draft",
            zone: "medina",
          };

          const { error } = await supabase
            .from("medina_pois")
            .upsert(row, { onConflict: "place_id" });

          if (error) {
            if (error.code === "23505") {
              totalSkipped++;
            } else {
              logs.push(`[upsert-error] ${place.name}: ${error.message}`);
            }
          } else {
            totalInserted++;
          }
        }
      } while (pageToken && totalInserted < limit);
    }

    logs.push(`--- DONE: ${totalInserted} inserted, ${totalSkipped} skipped ---`);

    return new Response(JSON.stringify({ success: true, inserted: totalInserted, skipped: totalSkipped, logs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("poi-extract error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
