import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Duration → target POI count
const DURATION_MAP: Record<number, number> = { 60: 6, 90: 8, 120: 10, 180: 12, 240: 15 };

// Category mix rules: guaranteed diversity
const CATEGORY_QUOTAS: Record<string, { categories: Record<string, number>; fill: string[] }> = {
  easy: {
    categories: { monument: 1, restaurant: 1, cafe: 1, artisan: 1, souk: 1 },
    fill: ["boutique", "gallery", "viewpoint", "historic_site", "jardin", "riad"],
  },
  medium: {
    categories: { monument: 1, historic_site: 1, artisan: 2, souk: 1, cafe: 1 },
    fill: ["restaurant", "boutique", "mosquee", "gallery", "fontaine", "musee"],
  },
  hard: {
    categories: { historic_site: 2, monument: 1, mosquee: 1, artisan: 1, musee: 1 },
    fill: ["souk", "fontaine", "porte", "place", "gallery", "viewpoint"],
  },
};

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestNeighborSort<T extends { lat?: number | null; lng?: number | null }>(pois: T[], startLat: number, startLng: number): T[] {
  const remaining = [...pois];
  const sorted: T[] = [];
  let curLat = startLat, curLng = startLng;
  while (remaining.length > 0) {
    let bestIdx = 0, bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const p = remaining[i];
      if (p.lat == null || p.lng == null) continue;
      const d = haversineM(curLat, curLng, p.lat!, p.lng!);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    const picked = remaining.splice(bestIdx, 1)[0];
    sorted.push(picked);
    if (picked.lat != null && picked.lng != null) { curLat = picked.lat!; curLng = picked.lng!; }
  }
  return sorted;
}

function totalRouteDistanceKm(pois: { lat?: number | null; lng?: number | null }[]): number {
  let total = 0;
  for (let i = 1; i < pois.length; i++) {
    const a = pois[i - 1], b = pois[i];
    if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
      total += haversineM(a.lat!, a.lng!, b.lat!, b.lng!);
    }
  }
  return Math.round(total / 10) / 100; // km with 2 decimals
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const difficulty: "easy" | "medium" | "hard" = ["easy", "medium", "hard"].includes(body.difficulty) ? body.difficulty : "medium";
    const duration: number = [60, 90, 120, 180, 240].includes(body.duration) ? body.duration : 90;
    const targetCount = DURATION_MAP[duration] ?? 8;
    const seed = body.seed ?? String(Date.now());

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Fetch all active POIs with coordinates
    const { data: allPois, error } = await supabase
      .from("medina_pois")
      .select("id, name, lat, lng, category_ai, category_google, description_short, history_context, local_anecdote, riddle_easy, riddle_medium, riddle_hard, challenge, district, poi_quality_score, rating, reviews_count, instagram_spot, nearby_restaurants")
      .not("lat", "is", null)
      .not("lng", "is", null)
      .not("status", "in", "(filtered,merged)");

    if (error) throw error;
    if (!allPois?.length) {
      return new Response(JSON.stringify({ error: "No POIs available" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use category_ai if available, fall back to category_google
    const poisWithCat = allPois.map(p => ({
      ...p,
      effective_category: p.category_ai ?? p.category_google ?? "unknown",
    }));

    // Seeded shuffle
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    const rng = () => { h |= 0; h = (h + 0x6d2b79f5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

    // Select POIs with category diversity
    const quota = CATEGORY_QUOTAS[difficulty];
    const selected: typeof poisWithCat = [];
    const usedIds = new Set<string>();

    // 1. Fill mandatory categories
    for (const [cat, count] of Object.entries(quota.categories)) {
      const candidates = poisWithCat
        .filter(p => p.effective_category === cat && !usedIds.has(p.id))
        .sort(() => rng() - 0.5);
      for (let i = 0; i < count && i < candidates.length; i++) {
        selected.push(candidates[i]);
        usedIds.add(candidates[i].id);
      }
    }

    // 2. Fill remaining from fill categories + any other
    const remaining = targetCount - selected.length;
    if (remaining > 0) {
      const fillPool = poisWithCat
        .filter(p => !usedIds.has(p.id))
        .sort((a, b) => (b.poi_quality_score ?? 0) - (a.poi_quality_score ?? 0))
        .sort(() => rng() - 0.5);
      
      // Prefer fill categories first
      const fillCats = new Set(quota.fill);
      const fromFill = fillPool.filter(p => fillCats.has(p.effective_category));
      const fromOther = fillPool.filter(p => !fillCats.has(p.effective_category));
      const fillOrder = [...fromFill, ...fromOther];
      
      for (let i = 0; i < remaining && i < fillOrder.length; i++) {
        selected.push(fillOrder[i]);
        usedIds.add(fillOrder[i].id);
      }
    }

    // 3. Geo-sort using nearest-neighbor from medina center
    const MEDINA_CENTER = { lat: 31.6295, lng: -7.9889 };
    const sorted = nearestNeighborSort(selected, MEDINA_CENTER.lat, MEDINA_CENTER.lng);

    // 4. Post-sort diversity fix
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].effective_category === sorted[i - 1].effective_category) {
        for (let j = i + 1; j < sorted.length; j++) {
          if (sorted[j].effective_category !== sorted[i].effective_category) {
            [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
            break;
          }
        }
      }
    }

    // 5. Build quest JSON
    const riddleKey = difficulty === "easy" ? "riddle_easy" : difficulty === "hard" ? "riddle_hard" : "riddle_medium";
    const distanceKm = totalRouteDistanceKm(sorted);

    const QUEST_TITLES: Record<string, string[]> = {
      easy: ["Premiers Pas dans la Médina", "Découverte des Souks", "Ballade Enchantée", "Les Couleurs de Marrakech"],
      medium: ["Secrets de la Médina", "Sur les Traces des Artisans", "Mystères de la Ville Rouge", "L'Aventure Marrakchi"],
      hard: ["Énigmes de la Médina", "Le Code de la Casbah", "Chasseurs de Trésors", "Les Arcanes de Marrakech"],
    };
    const titles = QUEST_TITLES[difficulty];
    const title = titles[Math.floor(rng() * titles.length)];

    const quest = {
      id: crypto.randomUUID(),
      title,
      difficulty,
      duration_minutes: duration,
      duration_label: `${duration} minutes`,
      distance_km: distanceKm,
      poi_count: sorted.length,
      created_at: new Date().toISOString(),
      steps: sorted.map((p, idx) => ({
        step_order: idx + 1,
        poi_id: p.id,
        name: p.name,
        category: p.effective_category,
        district: p.district ?? null,
        lat: p.lat,
        lng: p.lng,
        riddle: p[riddleKey] ?? p.riddle_easy ?? null,
        story: p.description_short ?? null,
        history: p.history_context ?? null,
        anecdote: p.local_anecdote ?? null,
        challenge: p.challenge ?? null,
        instagram_spot: p.instagram_spot ?? false,
        quality_score: p.poi_quality_score ?? null,
        nearby_restaurants: p.nearby_restaurants ?? [],
      })),
    };

    return new Response(JSON.stringify({ success: true, quest }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-medina-quest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
