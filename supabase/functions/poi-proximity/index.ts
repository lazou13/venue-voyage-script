import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Fetch all POIs with coordinates
    const { data: allPois, error } = await supabase
      .from("medina_pois")
      .select("id, name, lat, lng, category, category_ai, category_google")
      .not("lat", "is", null)
      .not("lng", "is", null);

    if (error) throw error;
    if (!allPois?.length) {
      return new Response(JSON.stringify({ success: true, updated: 0, logs: ["No POIs with coords"] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const logs: string[] = [`Processing ${allPois.length} POIs`];
    let updated = 0;

    const restaurantCategories = ["restaurant", "cafe"];

    for (const poi of allPois) {
      const distances = allPois
        .filter(p => p.id !== poi.id)
        .map(p => ({
          id: p.id,
          name: p.name,
          category: p.category_ai ?? p.category,
          distance_m: Math.round(haversineM(poi.lat!, poi.lng!, p.lat!, p.lng!)),
        }))
        .sort((a, b) => a.distance_m - b.distance_m);

      const nearbyRestaurants = distances
        .filter(d => restaurantCategories.includes(d.category) || 
          allPois.find(p => p.id === d.id && restaurantCategories.includes(p.category_google ?? "")))
        .slice(0, 5);

      const nearbyPois = distances
        .filter(d => !restaurantCategories.includes(d.category))
        .slice(0, 5);

      const { error: upErr } = await supabase
        .from("medina_pois")
        .update({
          nearby_restaurants: nearbyRestaurants,
          nearby_pois_data: nearbyPois,
        })
        .eq("id", poi.id);

      if (upErr) {
        logs.push(`✗ ${poi.name}: ${upErr.message}`);
      } else {
        updated++;
      }
    }

    logs.push(`--- DONE: ${updated}/${allPois.length} updated ---`);

    return new Response(JSON.stringify({ success: true, updated, logs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("poi-proximity error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
