// QuestEngine v3.0 — Unified quest generation engine
// Zero external dependencies — runs in Deno edge function context

// ━━━━━━━━━━━━━━ TYPES ━━━━━━━━━━━━━━

export type EngineMode = "treasure_hunt" | "guided_tour";
export type Difficulty = "easy" | "medium" | "hard";
export type Theme = "architecture" | "artisan" | "hidden_gems" | "food" | "family" | "history" | "photography" | "complete";
export type Audience = "solo" | "couple" | "family" | "friends" | "school" | "teambuilding" | "vip" | "tourist";

export interface EngineInput {
  start_lat: number;
  start_lng: number;
  start_name?: string;
  mode: EngineMode;
  theme: Theme;
  audience: Audience;
  difficulty: Difficulty;
  max_duration_min: number;
  radius_m: number;
  max_stops: number;
  include_food_break: boolean;
  circular: boolean;
  language: "fr" | "en" | "ar";
  exclude_place_ids?: string[];
  /** When true, POIs without a non-empty audio_url_fr are excluded. */
  require_audio_fr?: boolean;
}

export interface POI {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category_ai: string;
  category_google: string;
  rating: number;
  reviews_count: number;
  poi_quality_score: number;
  address: string;
  description_short: string;
  history_context: string;
  local_anecdote: string;
  riddle_easy: string;
  riddle_medium: string;
  riddle_hard: string;
  challenge: string;
  tourist_interest: string;
  instagram_spot: boolean;
  is_start_hub: boolean;
  is_main_visit: boolean;
  is_active: boolean;
  radius_m: number;
  // Enriched fields
  price_info: string;
  opening_hours: Record<string, string> | null;
  must_see_details: string;
  must_try: string;
  must_visit_nearby: string;
  is_photo_spot: boolean;
  photo_tip: string;
  ruelle_etroite: boolean;
  // Perplexity enriched fields
  local_anecdote_fr: string;
  local_anecdote_en: string;
  fun_fact_fr: string;
  fun_fact_en: string;
  wikipedia_summary: string;
  wikipedia_summary_en?: string;
  history_context_en?: string;
  crowd_level: string;
  accessibility_notes: string;
  metadata: {
    features?: {
      audience?: string[];
      difficulty?: number;
      walking_effort?: number;
      architectural_value?: number;
      historical_value?: number;
      visual_impact?: number;
      interaction_type?: string;
    };
  };
  visit_route?: { exit_point?: { lat: number; lng: number }; [k: string]: unknown } | null;
  audio_url_fr?: string | null;
}

export interface Stop {
  order: number;
  poi_id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  distance_from_prev_m: number;
  walk_time_min: number;
  visit_time_min: number;
  cumulative_time_min: number;
  riddle?: string;
  challenge?: string;
  points?: number;
  validation_radius_m?: number;
  story?: string;
  history_context?: string;
  local_anecdote?: string;
  tourist_tips?: string;
  photo_spot?: boolean;
  address?: string;
  description?: string;
  // Enriched fields
  price_info?: string | null;
  opening_hours?: Record<string, string> | null;
  must_see_details?: string | null;
  must_try?: string | null;
  must_visit_nearby?: string | null;
  is_photo_spot?: boolean;
  photo_tip?: string | null;
  ruelle_etroite?: boolean;
  fun_fact?: string;
  crowd_level?: string;
  accessibility_notes?: string;
  visit_route?: { exit_point?: { lat: number; lng: number }; [k: string]: unknown } | null;
  lang_debug?: { lang: string; description_src: string; history_context_src: string };
}

export interface EngineOutput {
  id: string;
  mode: EngineMode;
  theme: Theme;
  difficulty: Difficulty;
  language: string;
  start: { name: string; lat: number; lng: number };
  total_stops: number;
  total_distance_m: number;
  walking_time_min: number;
  visit_time_min: number;
  total_time_min: number;
  total_points: number;
  stops: Stop[];
  title: string;
  teaser: string;
  algorithm_version: string;
  generated_at: string;
}

// ━━━━━━━━━━━━━━ CONSTANTS ━━━━━━━━━━━━━━

const WALKING_SPEED_MS = 0.83; // 3 km/h realistic medina pace

const VISIT_TIME_TREASURE: Record<string, number> = {
  monument: 7, palace: 10, museum: 12, medersa: 8,
  mosque: 5, tomb: 5, gate_bab: 3, fountain: 3,
  fondouk: 5, souk: 7, market: 7,
  craft_shop: 5, restaurant: 10, cafe: 8, hammam: 4,
  garden: 6, plaza: 4, hotel: 3, riad: 3,
  shrine_zaouia: 5, gallery: 7, other: 4,
};

const VISIT_TIME_GUIDED: Record<string, number> = {
  monument: 12, palace: 18, museum: 25, medersa: 15,
  mosque: 8, tomb: 10, gate_bab: 6, fountain: 5,
  fondouk: 10, souk: 15, market: 15,
  craft_shop: 10, restaurant: 15, cafe: 12, hammam: 8,
  garden: 12, plaza: 8, hotel: 5, riad: 5,
  shrine_zaouia: 8, gallery: 15, other: 6,
};

const POINTS_BY_CATEGORY: Record<string, number> = {
  monument: 20, palace: 25, museum: 20, medersa: 20,
  mosque: 15, tomb: 15, gate_bab: 10, fountain: 10,
  fondouk: 15, souk: 10, market: 10,
  craft_shop: 10, restaurant: 5, cafe: 5, hammam: 10,
  garden: 10, plaza: 8, hotel: 5, riad: 5,
  shrine_zaouia: 15, gallery: 12, other: 8,
};

const THEME_CATEGORIES: Record<Theme, string[]> = {
  architecture:  ["monument", "palace", "medersa", "gate_bab", "mosque", "fondouk"],
  artisan:       ["craft_shop", "souk", "market", "fondouk", "gallery"],
  hidden_gems:   ["fountain", "fondouk", "shrine_zaouia", "garden", "plaza", "hammam"],
  food:          ["restaurant", "cafe", "market", "souk"],
  family:        ["plaza", "garden", "museum", "gate_bab", "fountain", "cafe"],
  history:       ["monument", "palace", "medersa", "tomb", "shrine_zaouia", "gate_bab"],
  photography:   ["monument", "fountain", "souk", "plaza", "garden", "gate_bab"],
  complete:      ["monument", "souk", "craft_shop", "fountain", "gate_bab", "cafe", "medersa", "garden", "fondouk", "museum"],
};

const THEME_FEATURE_WEIGHTS: Record<Theme, Record<string, number>> = {
  architecture:  { architectural_value: 3.0, historical_value: 1.5, visual_impact: 1.0 },
  artisan:       { architectural_value: 1.0, historical_value: 1.0, visual_impact: 2.0 },
  hidden_gems:   { historical_value: 2.0, visual_impact: 1.5, architectural_value: 1.5 },
  food:          { visual_impact: 1.0, difficulty: 0.5 },
  family:        { visual_impact: 2.0, difficulty: -1.0, walking_effort: -1.5 },
  history:       { historical_value: 3.0, architectural_value: 2.0 },
  photography:   { visual_impact: 3.0, architectural_value: 1.5 },
  complete:      { historical_value: 1.0, visual_impact: 1.0, architectural_value: 1.0 },
};

const AUDIENCE_MODIFIERS: Record<Audience, Record<string, number>> = {
  solo:         { difficulty: 1.0, walking_effort: 0 },
  couple:       { visual_impact: 1.5, difficulty: 0.5 },
  family:       { difficulty: -2.0, walking_effort: -2.0, visual_impact: 1.0 },
  friends:      { difficulty: 1.0, visual_impact: 1.0 },
  school:       { historical_value: 2.0, difficulty: -0.5 },
  teambuilding: { difficulty: 1.5, walking_effort: 0.5 },
  vip:          { architectural_value: 2.0, historical_value: 2.0, visual_impact: 2.0 },
  tourist:      { historical_value: 1.5, visual_impact: 1.5, difficulty: -0.5 },
};

const TITLES: Record<Theme, Record<EngineMode, string[]>> = {
  architecture:  { treasure_hunt: ["Le Secret des Murs de Pierre", "Les Gardiens de l'Ocre"], guided_tour: ["Architecture & Héritage de la Médina", "Les Joyaux de Marrakech"] },
  artisan:       { treasure_hunt: ["Les Mains d'Or de la Médina", "L'Héritage des Maâlems"], guided_tour: ["L'Art Vivant des Souks", "Sur les traces des artisans"] },
  hidden_gems:   { treasure_hunt: ["Les Secrets Oubliés", "La Médina Cachée"], guided_tour: ["Médina Secrète", "Les Perles Cachées de Marrakech"] },
  food:          { treasure_hunt: ["Les Saveurs du Moulay", "La Piste des Épices"], guided_tour: ["Marrakech dans l'Assiette", "Saveurs et Arômes"] },
  family:        { treasure_hunt: ["L'Aventure de la Famille", "Le Grand Jeu de la Médina"], guided_tour: ["Marrakech en Famille", "Découverte Familiale"] },
  history:       { treasure_hunt: ["Sur les Traces des Almoravides", "Le Testament du Sultan"], guided_tour: ["Mille Ans d'Histoire", "Les Dynasties de Marrakech"] },
  photography:   { treasure_hunt: ["L'Œil du Photographe", "Lumières de la Médina"], guided_tour: ["Marrakech en Images", "La Médina Photographique"] },
  complete:      { treasure_hunt: ["L'Odyssée de la Médina", "Le Grand Circuit"], guided_tour: ["Marrakech Essentiel", "La Médina Complète"] },
};

// ━━━━━━━━━━━━━━ UTILITY FUNCTIONS ━━━━━━━━━━━━━━

type ScoredPOI = POI & { score: number; distance_from_start: number };

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function walkTimeMin(distM: number): number {
  return Math.ceil(distM / WALKING_SPEED_MS / 60);
}

function generateId(): string {
  return crypto.randomUUID();
}

// ━━━━━━━━━━━━━━ SCORING ━━━━━━━━━━━━━━

// P1 hotfix 2026-05-11: cultural anchor categories.
// In guided_tour mode, any POI matching one of these categories receives a
// strong fixed bonus — this prevents proximity/Google-rating from pushing
// commercial neighbours above genuine cultural anchors (museum, palace…)
// located 400-700m away.
const CULTURAL_CATEGORIES_GUIDED = new Set([
  "museum", "palace", "garden", "historic_site", "mosque", "medersa",
  "monument", "fondouk", "gate_bab", "tomb", "shrine_zaouia",
  "fountain", "place", "plaza", "souk", "market", "gallery",
]);

function isCulturalGuided(poi: POI): boolean {
  const c = (poi.category_ai || "").toLowerCase();
  const g = (poi.category_google || "").toLowerCase();
  return CULTURAL_CATEGORIES_GUIDED.has(c) || CULTURAL_CATEGORIES_GUIDED.has(g);
}

function scorePOI(poi: POI, input: EngineInput, distanceFromStart: number): number {
  let score = 0;

  // Google quality: rating contribution (0-15) + reviews contribution (0-10)
  const ratingNorm = ((poi.rating ?? 3) - 1) / 4;
  score += ratingNorm * 15;
  score += Math.min(Math.log10((poi.reviews_count ?? 0) + 1) * 4, 10);

  // AI quality score (0-15)
  score += ((poi.poi_quality_score ?? 5) / 10) * 15;

  // Category rank in theme priorities (0-25)
  const themeCats = THEME_CATEGORIES[input.theme] ?? [];
  const catRank = themeCats.indexOf(poi.category_ai);
  if (catRank === 0) score += 25;
  else if (catRank === 1) score += 22;
  else if (catRank === 2 || catRank === 3) score += 18;
  else if (catRank > 3) score += 12;
  else score += 5; // absent from theme

  // Features metadata × weights + audience modifiers (normalized to 0-25)
  const features = poi.metadata?.features ?? {};
  const themeWeights = THEME_FEATURE_WEIGHTS[input.theme] ?? {};
  const audienceMods = AUDIENCE_MODIFIERS[input.audience] ?? {};

  let featureScore = 0;
  const allKeys = new Set([...Object.keys(themeWeights), ...Object.keys(audienceMods)]);
  for (const key of allKeys) {
    const val = (features as Record<string, number | string[] | string | undefined>)[key];
    if (typeof val !== "number") continue;
    const tw = themeWeights[key] ?? 0;
    const am = audienceMods[key] ?? 0;
    featureScore += val * (tw + am);
  }
  score += Math.min(Math.max(featureScore, 0), 25);

  // P1: in guided_tour, soften proximity penalty and CAP it.
  // The previous formula penalised distant POIs heavily (up to -10 within
  // a 800m radius), which crushed museums at 400-700m vs commerces at <100m.
  if (input.mode === "guided_tour") {
    score -= Math.min((distanceFromStart / input.radius_m) * 4, 4);
  } else {
    score -= (distanceFromStart / input.radius_m) * 10;
  }

  // Proximity boost: POI within 100m of start gets ×3 score
  // P1: disabled in guided_tour to stop commercial neighbours from
  // crushing real cultural anchors located 300-700m away.
  if (distanceFromStart < 100 && input.mode !== "guided_tour") {
    score *= 3;
  }

  // P1 cultural anchor bonus (guided_tour only): +25 for true cultural POIs.
  // Extra +10 if quality_score >= 7 (museum/palace/garden/historic).
  if (input.mode === "guided_tour" && isCulturalGuided(poi)) {
    score += 25;
    if ((poi.poi_quality_score ?? 0) >= 7) score += 10;
    if (poi.is_main_visit) score += 8;
  }

  // Bonus: instagram_spot for guided_tour + photography
  if (poi.instagram_spot && input.mode === "guided_tour" && input.theme === "photography") {
    score += 8;
  }

  // Bonus: riddle present for treasure_hunt
  if (input.mode === "treasure_hunt") {
    const riddleKey = `riddle_${input.difficulty}` as keyof POI;
    if (poi[riddleKey] || poi.riddle_easy) score += 5;
    if (poi.challenge) score += 3;
  }

  // Bonus: history/anecdote for guided_tour
  if (input.mode === "guided_tour") {
    if (poi.history_context) score += 4;
    if (poi.local_anecdote) score += 4;
  }

  return Math.max(0, score);
}

// ━━━━━━━━━━━━━━ SELECTION ━━━━━━━━━━━━━━

function selectPOIs(
  candidates: ScoredPOI[],
  input: EngineInput,
  mandatoryIconicPoiId?: string,
): ScoredPOI[] {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const selected: ScoredPOI[] = [];
  const usedIds = new Set<string>();
  const catCount: Record<string, number> = {};

  const themeCats = THEME_CATEGORIES[input.theme] ?? [];

  // Phase -1: force a mandatory iconic POI for explicit business contexts.
  // This is not a score bonus: the POI is injected into the tour before
  // the generic main-visits and category phases run.
  if (mandatoryIconicPoiId) {
    const mandatoryIconicPoi = sorted.find((p) => p.id === mandatoryIconicPoiId);
    if (mandatoryIconicPoi) {
      selected.push(mandatoryIconicPoi);
      usedIds.add(mandatoryIconicPoi.id);
      catCount[mandatoryIconicPoi.category_ai] = (catCount[mandatoryIconicPoi.category_ai] ?? 0) + 1;
    }
  }

  // Phase 0: prioritize main visits (is_main_visit=true) — max 3, skip food theme
  // Main POIs (Jemaa el-Fna, Koutoubia, Bahia, etc.) get a guaranteed slot.
  // Iconic POI rule: sort main visits by *proximity to start* (not by score)
  // so a landmark like Jemaa el-Fna is systematically selected when nearby,
  // even if its native category (e.g. "place") is absent from THEME_CATEGORIES.
  const MAIN_VISIT_CAP = 3;
  if (input.theme !== "food") {
    const mainVisits = sorted
      .filter((p) => p.is_main_visit === true && p.id !== mandatoryIconicPoiId)
      .slice()
      .sort((a, b) => a.distance_from_start - b.distance_from_start);
    const cap = Math.min(MAIN_VISIT_CAP, input.max_stops, mainVisits.length);
    for (let i = 0; i < cap; i++) {
      const mv = mainVisits[i];
      if (usedIds.has(mv.id)) continue;
      selected.push(mv);
      usedIds.add(mv.id);
      catCount[mv.category_ai] = (catCount[mv.category_ai] ?? 0) + 1;
    }
  }

  // Phase 1: pick best POI from top 4 priority categories
  for (let i = 0; i < Math.min(4, themeCats.length); i++) {
    const cat = themeCats[i];
    const best = sorted.find((p) => p.category_ai === cat && !usedIds.has(p.id));
    if (best) {
      selected.push(best);
      usedIds.add(best.id);
      catCount[cat] = (catCount[cat] ?? 0) + 1;
    }
  }

  // Phase 2: fill up to max_stops with per-category cap
  // P1: cap is 3 for guided_tour (souk diversity OK), 2 for treasure_hunt.
  const PER_CAT_CAP = input.mode === "guided_tour" ? 3 : 2;
  for (const poi of sorted) {
    if (selected.length >= input.max_stops) break;
    if (usedIds.has(poi.id)) continue;
    if ((catCount[poi.category_ai] ?? 0) >= PER_CAT_CAP) continue;

    // Limit food POIs to max 1 when food_break is on
    if (input.include_food_break && (poi.category_ai === "restaurant" || poi.category_ai === "cafe")) {
      const foodCount = (catCount["restaurant"] ?? 0) + (catCount["cafe"] ?? 0);
      if (foodCount >= 1) continue;
    }

    selected.push(poi);
    usedIds.add(poi.id);
    catCount[poi.category_ai] = (catCount[poi.category_ai] ?? 0) + 1;
  }

  // Phase 3: inject food break if requested and missing
  if (input.include_food_break) {
    const hasFood = selected.some(
      (p) => p.category_ai === "restaurant" || p.category_ai === "cafe"
    );
    if (!hasFood) {
      const foodPoi = sorted.find(
        (p) =>
          (p.category_ai === "cafe" || p.category_ai === "restaurant") &&
          !usedIds.has(p.id)
      );
      if (foodPoi) {
        const mid = Math.floor(selected.length / 2);
        selected.splice(mid, 0, foodPoi);
        usedIds.add(foodPoi.id);
        // Remove last if over max_stops
        if (selected.length > input.max_stops) {
          const removed = selected.pop()!;
          usedIds.delete(removed.id);
        }
      }
    }
  }

  return selected;
}

// ━━━━━━━━━━━━━━ ROUTE OPTIMIZATION ━━━━━━━━━━━━━━

function nearestNeighborTSP(
  startLat: number,
  startLng: number,
  pois: ScoredPOI[],
  _circular: boolean
): ScoredPOI[] {
  const remaining = [...pois];
  const sorted: ScoredPOI[] = [];
  let curLat = startLat;
  let curLng = startLng;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineM(curLat, curLng, remaining[i].lat, remaining[i].lng);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const picked = remaining.splice(bestIdx, 1)[0];
    sorted.push(picked);
    // Use exit_point if available for next distance calculation
    curLat = picked.visit_route?.exit_point?.lat ?? picked.lat;
    curLng = picked.visit_route?.exit_point?.lng ?? picked.lng;
  }

  return sorted;
}

function twoOptImprove(
  startLat: number,
  startLng: number,
  pois: ScoredPOI[],
  circular: boolean
): ScoredPOI[] {
  if (pois.length < 3) return [...pois];

  const route = [...pois];

  function calcTotal(): number {
    let total = haversineM(startLat, startLng, route[0].lat, route[0].lng);
    for (let i = 1; i < route.length; i++) {
      total += haversineM(route[i - 1].lat, route[i - 1].lng, route[i].lat, route[i].lng);
    }
    if (circular) {
      total += haversineM(route[route.length - 1].lat, route[route.length - 1].lng, startLat, startLng);
    }
    return total;
  }

  let improved = true;
  let iterations = 0;
  const MAX_ITERATIONS = 50;
  const THRESHOLD = 1; // 1 meter

  while (improved && iterations < MAX_ITERATIONS) {
    improved = false;
    iterations++;
    for (let i = 0; i < route.length - 1; i++) {
      for (let j = i + 1; j < route.length; j++) {
        const before = calcTotal();
        // Reverse segment [i, j]
        const segment = route.slice(i, j + 1).reverse();
        route.splice(i, j - i + 1, ...segment);
        const after = calcTotal();
        if (after < before - THRESHOLD) {
          improved = true;
        } else {
          // Revert
          const revert = route.slice(i, j + 1).reverse();
          route.splice(i, j - i + 1, ...revert);
        }
      }
    }
  }

  return route;
}

// P1.1 hotfix 2026-05-12: geo-aware diversity.
// The previous version blindly swapped same-category neighbours, which often
// destroyed the geographic order produced by 2-opt and created backtracks
// (e.g. Koutoubia → Bahia → back to El Badi). We now only accept a swap if
// it does NOT inflate the total walking distance beyond `maxInflateRatio`.
function enforceConsecutiveDiversity(
  startLat: number,
  startLng: number,
  pois: ScoredPOI[],
  circular: boolean,
  maxInflateRatio = 1.08,
): ScoredPOI[] {
  const result = [...pois];

  const totalDist = (arr: ScoredPOI[]): number => {
    if (arr.length === 0) return 0;
    let d = haversineM(startLat, startLng, arr[0].lat, arr[0].lng);
    for (let k = 1; k < arr.length; k++) {
      d += haversineM(arr[k - 1].lat, arr[k - 1].lng, arr[k].lat, arr[k].lng);
    }
    if (circular) d += haversineM(arr[arr.length - 1].lat, arr[arr.length - 1].lng, startLat, startLng);
    return d;
  };

  const baseline = totalDist(result);
  const cap = baseline * maxInflateRatio;

  for (let i = 1; i < result.length; i++) {
    if (result[i].category_ai !== result[i - 1].category_ai) continue;
    for (let j = i + 1; j < result.length; j++) {
      if (result[j].category_ai === result[i].category_ai) continue;
      // tentative swap
      [result[i], result[j]] = [result[j], result[i]];
      if (totalDist(result) <= cap) break; // accept
      // revert
      [result[i], result[j]] = [result[j], result[i]];
    }
  }
  return result;
}

// Compute per-segment distances (start→s0, s0→s1, …) and find the longest one.
function segmentStats(
  startLat: number,
  startLng: number,
  pois: ScoredPOI[],
): { segments_m: number[]; total_m: number; max_segment_m: number; max_from: string; max_to: string } {
  const segs: number[] = [];
  if (pois.length === 0) return { segments_m: [], total_m: 0, max_segment_m: 0, max_from: "", max_to: "" };
  segs.push(haversineM(startLat, startLng, pois[0].lat, pois[0].lng));
  for (let i = 1; i < pois.length; i++) {
    segs.push(haversineM(pois[i - 1].lat, pois[i - 1].lng, pois[i].lat, pois[i].lng));
  }
  let max = 0;
  let maxIdx = 0;
  for (let i = 0; i < segs.length; i++) {
    if (segs[i] > max) { max = segs[i]; maxIdx = i; }
  }
  const fromName = maxIdx === 0 ? "START" : pois[maxIdx - 1].name;
  const toName = pois[maxIdx]?.name ?? "";
  return {
    segments_m: segs.map((s) => Math.round(s)),
    total_m: Math.round(segs.reduce((a, b) => a + b, 0)),
    max_segment_m: Math.round(max),
    max_from: fromName,
    max_to: toName,
  };
}

// ━━━━━━━━━━━━━━ TIMING ━━━━━━━━━━━━━━

function calcTotalTime(
  startLat: number,
  startLng: number,
  pois: ScoredPOI[],
  circular: boolean,
  mode: EngineMode
): { walkingMin: number; visitMin: number; totalMin: number; totalDistM: number } {
  if (pois.length === 0) return { walkingMin: 0, visitMin: 0, totalMin: 0, totalDistM: 0 };

  const VISIT_TIME = mode === "treasure_hunt" ? VISIT_TIME_TREASURE : VISIT_TIME_GUIDED;

  let totalDistM = haversineM(startLat, startLng, pois[0].lat, pois[0].lng);
  for (let i = 1; i < pois.length; i++) {
    totalDistM += haversineM(pois[i - 1].lat, pois[i - 1].lng, pois[i].lat, pois[i].lng);
  }
  if (circular) {
    totalDistM += haversineM(pois[pois.length - 1].lat, pois[pois.length - 1].lng, startLat, startLng);
  }

  const walkingMin = walkTimeMin(totalDistM);
  const visitMin = pois.reduce(
    (sum, p) => sum + (VISIT_TIME[p.category_ai] ?? 5),
    0
  );
  return { walkingMin, visitMin, totalMin: walkingMin + visitMin, totalDistM };
}

function trimToFitDuration(
  startLat: number,
  startLng: number,
  pois: ScoredPOI[],
  maxDurationMin: number,
  circular: boolean,
  mode: EngineMode,
  maxStops: number,
  protectedPoiIds: Set<string> = new Set(),
  minStopsFloor: number = 3,
): ScoredPOI[] {
  let current = [...pois];
  const removed: ScoredPOI[] = [];

  // Phase 1: trim POIs that push us over budget — but never below minStopsFloor.
  const floor = Math.max(3, minStopsFloor);
  while (current.length > floor) {
    const { totalMin } = calcTotalTime(startLat, startLng, current, circular, mode);
    if (totalMin <= maxDurationMin - 5) break;

    // Remove lowest-scoring POI
    let minIdx = -1;
    let minScore = Infinity;
    for (let i = 0; i < current.length; i++) {
      if (protectedPoiIds.has(current[i].id)) continue;
      if (current[i].score < minScore) {
        minScore = current[i].score;
        minIdx = i;
      }
    }
    if (minIdx === -1) break;
    removed.push(current.splice(minIdx, 1)[0]);
    current = twoOptImprove(startLat, startLng, current, circular);
  }

  // Phase 2: if under maxStops and under budget, try re-injecting removed POIs
  if (removed.length > 0 && current.length < maxStops) {
    // Sort removed by score descending — best first
    removed.sort((a, b) => b.score - a.score);
    for (const poi of removed) {
      if (current.length >= maxStops) break;
      const candidate = [...current, poi];
      const reopt = twoOptImprove(startLat, startLng, candidate, circular);
      const { totalMin } = calcTotalTime(startLat, startLng, reopt, circular, mode);
      if (totalMin <= maxDurationMin - 5) {
        current = reopt;
      }
    }
  }

  return current;
}

// ━━━━━━━━━━━━━━ CONTENT BUILDERS ━━━━━━━━━━━━━━

function buildTouristTip(poi: POI): string {
  const features = poi.metadata?.features;
  const vi = features?.visual_impact ?? 0;
  const we = features?.walking_effort ?? 0;

  if (vi >= 8) return "Meilleure lumière en fin d'après-midi pour les photos.";
  if (poi.instagram_spot) return "Spot très photogénique — essayez l'angle depuis l'entrée.";
  if (we >= 7) return "Accès étroit — poussettes et PMR peuvent avoir des difficultés.";
  if (poi.category_ai === "souk" || poi.category_ai === "craft_shop")
    return "Prix libres — n'hésitez pas à négocier, c'est la tradition locale.";
  if (poi.category_ai === "mosque")
    return "Accessible aux non-musulmans uniquement depuis l'extérieur. Tenue correcte recommandée.";
  return poi.tourist_interest ?? "";
}

function buildStops(
  startLat: number,
  startLng: number,
  pois: ScoredPOI[],
  input: EngineInput
): Stop[] {
  const stops: Stop[] = [];
  let cumulative = 0;

  for (let i = 0; i < pois.length; i++) {
    const poi = pois[i];
    const prevPoi = i === 0 ? null : pois[i - 1];
    const prevLat = prevPoi ? (prevPoi.visit_route?.exit_point?.lat ?? prevPoi.lat) : startLat;
    const prevLng = prevPoi ? (prevPoi.visit_route?.exit_point?.lng ?? prevPoi.lng) : startLng;
    const distM = Math.round(haversineM(prevLat, prevLng, poi.lat, poi.lng));
    const walkMin = walkTimeMin(distM);
    const VISIT_TIME = input.mode === "treasure_hunt" ? VISIT_TIME_TREASURE : VISIT_TIME_GUIDED;
    const visitMin = VISIT_TIME[poi.category_ai] ?? 5;
    cumulative += walkMin + visitMin;

    const basePoints = POINTS_BY_CATEGORY[poi.category_ai] ?? 8;
    const qualityBonus = Math.round((poi.poi_quality_score ?? 0) * 0.5);
    const diffBonus = input.difficulty === "hard" ? 5 : input.difficulty === "medium" ? 2 : 0;
    const points = basePoints + qualityBonus + diffBonus;

    const riddleKey = `riddle_${input.difficulty}` as keyof POI;
    const riddle = (poi[riddleKey] as string) || poi.riddle_easy || undefined;

    const stop: Stop = {
      order: i + 1,
      poi_id: poi.id,
      name: poi.name || '',
      lat: poi.lat,
      lng: poi.lng,
      category: poi.category_ai,
      distance_from_prev_m: distM,
      walk_time_min: walkMin,
      visit_time_min: visitMin,
      cumulative_time_min: cumulative,
    };

    if (input.mode === "treasure_hunt") {
      stop.riddle = riddle;
      stop.challenge = poi.challenge || undefined;
      stop.points = points;
      stop.validation_radius_m = poi.radius_m ?? 30;
    } else {
      // guided_tour — FR/EN hotfix 2026-05-12
      // CRITICAL: description_short is mostly stored in EN in DB; history_context is FR.
      // Switch all localized fields explicitly on input.language.
      const isEn = input.language === "en";

      stop.story = poi.tourist_interest || poi.description_short || undefined;

      // ── history_context ────────────────────────────────────────────────
      let hcVal: string | undefined;
      let hcSrc = "none";
      if (isEn) {
        if (poi.history_context_en && poi.history_context_en.length >= 100) {
          hcVal = poi.history_context_en; hcSrc = "history_context_en";
        } else if (poi.wikipedia_summary_en && poi.wikipedia_summary_en.length >= 100) {
          hcVal = poi.wikipedia_summary_en; hcSrc = "wikipedia_summary_en";
        } else if (poi.history_context && poi.history_context.length >= 100) {
          hcVal = poi.history_context; hcSrc = "history_context_fr_fallback";
        }
      } else {
        if (poi.history_context && poi.history_context.length >= 100) {
          hcVal = poi.history_context; hcSrc = "history_context";
        } else if (poi.wikipedia_summary && poi.wikipedia_summary.length >= 100) {
          hcVal = poi.wikipedia_summary; hcSrc = "wikipedia_summary";
        } else if (poi.history_context_en && poi.history_context_en.length >= 100) {
          hcVal = poi.history_context_en; hcSrc = "history_context_en_fallback";
        }
      }
      stop.history_context = hcVal;

      // ── description ────────────────────────────────────────────────────
      // description_short is unreliable per language: in DB it's mostly EN.
      // FR: prefer truncated history_context (FR), then wiki_summary FR; ONLY
      // fallback to description_short if no FR source exists.
      // EN: description_short is fine as primary source.
      const truncate = (s: string, n = 280) => {
        if (s.length <= n) return s;
        const slice = s.slice(0, n);
        const lastDot = slice.lastIndexOf(". ");
        return (lastDot > 120 ? slice.slice(0, lastDot + 1) : slice).trim() + (lastDot > 120 ? "" : "…");
      };
      let descVal: string | undefined;
      let descSrc = "none";
      if (isEn) {
        if (poi.description_short) { descVal = poi.description_short; descSrc = "description_short"; }
        else if (poi.history_context_en) { descVal = truncate(poi.history_context_en); descSrc = "history_context_en_truncated"; }
        else if (poi.wikipedia_summary_en) { descVal = truncate(poi.wikipedia_summary_en); descSrc = "wikipedia_summary_en_truncated"; }
      } else {
        if (poi.history_context && poi.history_context.length >= 100) {
          descVal = truncate(poi.history_context); descSrc = "history_context_truncated";
        } else if (poi.wikipedia_summary && poi.wikipedia_summary.length >= 100) {
          descVal = truncate(poi.wikipedia_summary); descSrc = "wikipedia_summary_truncated";
        } else if (poi.description_short) {
          // Last resort — known to often be EN.
          descVal = poi.description_short; descSrc = "description_short_fallback_likely_en";
        }
      }
      stop.description = descVal;

      // ── local_anecdote (already language-aware) ────────────────────────
      if (isEn) {
        stop.local_anecdote = poi.local_anecdote_en || poi.local_anecdote || undefined;
      } else {
        stop.local_anecdote = poi.local_anecdote_fr || poi.local_anecdote || undefined;
      }

      // ── fun_fact (already language-aware) ──────────────────────────────
      const funFact = isEn ? poi.fun_fact_en : poi.fun_fact_fr;
      stop.fun_fact = funFact || undefined;

      stop.tourist_tips = buildTouristTip(poi);
      stop.photo_spot = poi.instagram_spot || (poi.metadata?.features?.visual_impact ?? 0) >= 7;
      stop.address = poi.address || undefined;
      // Enriched fields
      stop.price_info = poi.price_info || undefined;
      stop.opening_hours = poi.opening_hours || undefined;
      stop.must_see_details = poi.must_see_details || undefined;
      stop.must_try = poi.must_try || undefined;
      stop.must_visit_nearby = poi.must_visit_nearby || undefined;
      stop.is_photo_spot = poi.is_photo_spot || false;
      stop.photo_tip = poi.photo_tip || undefined;
      stop.ruelle_etroite = poi.ruelle_etroite || false;
      stop.crowd_level = poi.crowd_level || undefined;
      stop.accessibility_notes = poi.accessibility_notes || undefined;

      stop.lang_debug = { lang: input.language, description_src: descSrc, history_context_src: hcSrc };
    }

    // Attach visit_route for downstream use (pgRouting exit_point)
    stop.visit_route = poi.visit_route || null;

    stops.push(stop);
  }

  return stops;
}

// ━━━━━━━━━━━━━━ TITLE & TEASER ━━━━━━━━━━━━━━

function generateTitle(input: EngineInput): string {
  const options = TITLES[input.theme]?.[input.mode] ?? ["Parcours Médina"];
  return options[Math.floor(Math.random() * options.length)];
}

function formatDuration(min: number): string {
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
  return `${min} minutes`;
}

function generateTeaser(
  input: EngineInput,
  stops: Stop[],
  totalTimeMin: number
): string {
  const dur = formatDuration(totalTimeMin);
  const n = stops.length;

  if (input.mode === "treasure_hunt") {
    const totalPoints = stops.reduce((s, st) => s + (st.points ?? 0), 0);
    return `${n} énigmes à résoudre, ${dur} de jeu, ${totalPoints} points à gagner. Explorez la médina comme jamais — sans guide, sans commission.`;
  }
  return `${n} étapes soigneusement sélectionnées pour ${dur} de découverte authentique. Votre guide numérique personnel — sans pression, sans boutiques imposées.`;
}

// ━━━━━━━━━━━━━━ MAIN ENTRY POINT ━━━━━━━━━━━━━━

// P0 hotfix 2026-05-11: extended exclusion list (boutique/agency/services).
// Cultural categories like souk/museum/garden/palace/mosque/historic_site/place/
// fondouk/monument/artisan are NEVER excluded here.
const EXCLUDED_CATEGORIES = [
  "hotel", "riad", "lodging", "hostel",
  "restaurant", "cafe",
  "boutique", "craft_shop", "shop", "store", "souvenir_shop",
  "agency", "travel_agency", "tour_operator", "excursion",
  "pharmacy", "bank", "atm", "parking", "gas_station", "supermarket",
  "gym", "spa", "laundry", "equestrian", "horseback",
];

// P0 hotfix 2026-05-11: nominal blacklist (server-side parasites).
// Lowercased substring match on POI name. Add new entries here when QRP
// reports persistent parasites that slip through category filtering.
const NAME_BLACKLIST_SUBSTRINGS = [
  "morocco travel",
  "morocco trekking",
  "truly morocco",
  "zoco marrakech",
];

// P0.1 hotfix 2026-05-11: extra parasites blocked downstream by Questrides/QRP.
// Applied ONLY in guided_tour mode to avoid HPP returning stops that the player
// will silently filter out (which collapses the visible step count).
// Keep substrings highly specific — DO NOT add generic words like "souk",
// "bazar", "boutique", "shop", "artisan", "tapis".
const GUIDED_TOUR_NAME_BLACKLIST_SUBSTRINGS = [
  "matich",
  "maison culturelle du tapis",
  "zoco",
  "souk el bahja",
  "morocco travel",
  "morocco trekking",
  "truly morocco",
];

// P0 hotfix 2026-05-11: contextual block — these POIs may be valid culturally
// but are NEVER usable as a guided_tour stop when the tour starts from the
// referenced hub (or from <CONTEXT_HUB_BAN_RADIUS_M of it).
const CONTEXT_HUB_BAN_RADIUS_M = 250;
const HUB_CONTEXT_BANNED_NAMES: Record<string, string[]> = {
  // departing from Jemaa el-Fna → Souk El Bahja (83m) is too close + commercial
  jemaa_el_fna: ["souk el bahja"],
};

const CANONICAL_KOUTOUBIA_POI_ID = "eec26470-5202-4d52-a349-679843dae33b";
const CANONICAL_JEMAA_EL_FNA_POI_ID = "6d7f3e3f-9dfe-4877-9682-8e544068ea3f";
const KOUTOUBIA_START_CONTEXT_RADIUS_M = 250;

// Distance threshold (meters) under which a start_hub POI is considered "the departure itself"
// and thus excluded from candidates to avoid a duplicate first stop.
// P0 hotfix 2026-05-11: bumped from 80 → 150 to keep Souk El Bahja (83m from
// Jemaa el-Fna) out of guided tours starting from Jemaa.
const START_HUB_SELF_DISTANCE_M = 150;

function isNameBlacklisted(name: string | undefined | null): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return NAME_BLACKLIST_SUBSTRINGS.some((needle) => lower.includes(needle));
}

function isGuidedTourNameBlacklisted(name: string | undefined | null): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return GUIDED_TOUR_NAME_BLACKLIST_SUBSTRINGS.some((needle) => lower.includes(needle));
}

function isContextBanned(
  poi: POI,
  startLat: number,
  startLng: number,
  allPOIs: POI[],
): boolean {
  const lowerName = (poi.name || "").toLowerCase();
  // Build a list of nearby canonical hubs to evaluate context bans
  const jemaa = allPOIs.find((x) => x.id === CANONICAL_JEMAA_EL_FNA_POI_ID);
  if (jemaa) {
    const d = haversineM(startLat, startLng, jemaa.lat, jemaa.lng);
    if (d <= CONTEXT_HUB_BAN_RADIUS_M) {
      const banned = HUB_CONTEXT_BANNED_NAMES.jemaa_el_fna ?? [];
      if (banned.some((needle) => lowerName.includes(needle))) return true;
    }
  }
  return false;
}

// P1 hotfix 2026-05-11: minimum stop floors for guided_tour by duration.
function guidedMinStops(durationMin: number): number {
  if (durationMin >= 240) return 7;
  if (durationMin >= 180) return 6;
  if (durationMin >= 120) return 5;
  if (durationMin >= 90) return 4;
  return 3;
}

// P1 hotfix: extended search radius (cultural complement) when initial pool is short.
function extendedRadiusFor(durationMin: number, baseRadius: number): number {
  if (durationMin >= 180) return Math.max(baseRadius, 1500);
  if (durationMin >= 120) return Math.max(baseRadius, 1200);
  return Math.max(baseRadius, 1000);
}

interface GenerationDebug {
  candidates_initial_count: number;
  candidates_after_blacklist_count: number;
  candidates_within_radius_count: number;
  cultural_within_radius_count: number;
  selected_after_select_count: number;
  selected_after_complement_count: number;
  selected_after_trim_count: number;
  min_stops_target: number;
  cultural_complement_added: number;
  cultural_complement_names: string[];
  rejected_top_cultural: { name: string; reason: string; dist_m: number }[];
  // P1.1 — route order optimization
  order_before_optimization: string[];
  order_after_optimization: string[];
  total_distance_before_m: number;
  total_distance_after_m: number;
  max_segment_before_m: number;
  max_segment_after_m: number;
  longest_segment_from: string;
  longest_segment_to: string;
  segments_after_m: number[];
  long_segment_warnings: string[];
}

export function generateQuest(input: EngineInput, allPOIs: POI[]): EngineOutput {
  // Step 1: Filter candidates (with reason tracking for debug)
  const excludeSet = new Set(input.exclude_place_ids ?? []);
  let countAfterBlacklist = 0;
  let countWithinRadius = 0;
  let countCulturalWithinRadius = 0;
  const rejectedTopCultural: { name: string; reason: string; dist_m: number }[] = [];

  const candidates = allPOIs.filter((p) => {
    if (!p.is_active) return false;
    if (excludeSet.has(p.id)) return false;
    if (input.require_audio_fr && (!p.audio_url_fr || String(p.audio_url_fr).trim().length < 10)) return false;
    if (EXCLUDED_CATEGORIES.includes((p.category_ai || "").toLowerCase())) return false;
    if (EXCLUDED_CATEGORIES.includes((p.category_google || "").toLowerCase())) return false;
    if (isNameBlacklisted(p.name)) {
      if (isCulturalGuided(p)) rejectedTopCultural.push({ name: p.name, reason: "name_blacklist", dist_m: Math.round(haversineM(input.start_lat, input.start_lng, p.lat, p.lng)) });
      return false;
    }
    if (input.mode === "guided_tour" && isGuidedTourNameBlacklisted(p.name)) {
      if (isCulturalGuided(p)) rejectedTopCultural.push({ name: p.name, reason: "guided_tour_name_blacklist", dist_m: Math.round(haversineM(input.start_lat, input.start_lng, p.lat, p.lng)) });
      return false;
    }
    if (input.mode === "guided_tour" && isContextBanned(p, input.start_lat, input.start_lng, allPOIs)) {
      if (isCulturalGuided(p)) rejectedTopCultural.push({ name: p.name, reason: "context_banned", dist_m: Math.round(haversineM(input.start_lat, input.start_lng, p.lat, p.lng)) });
      return false;
    }
    countAfterBlacklist++;
    const dist = haversineM(input.start_lat, input.start_lng, p.lat, p.lng);
    if (dist > input.radius_m) return false;
    countWithinRadius++;
    if (isCulturalGuided(p)) countCulturalWithinRadius++;

    if (p.is_start_hub) {
      if (!p.is_main_visit) return false;
      if (dist < START_HUB_SELF_DISTANCE_M) return false;
    }

    return true;
  });

  if (candidates.length < 3) {
    throw new Error(
      `Seulement ${candidates.length} POI(s) trouvé(s) dans un rayon de ${input.radius_m}m. Minimum requis : 3.`
    );
  }

  // Step 2: Score each candidate
  const scored: ScoredPOI[] = candidates.map((poi) => {
    const dist = haversineM(input.start_lat, input.start_lng, poi.lat, poi.lng);
    return { ...poi, score: scorePOI(poi, input, dist), distance_from_start: dist };
  });

  const canonicalKoutoubia = allPOIs.find((poi) => poi.id === CANONICAL_KOUTOUBIA_POI_ID);
  const isKoutoubiaContext = canonicalKoutoubia
    ? haversineM(input.start_lat, input.start_lng, canonicalKoutoubia.lat, canonicalKoutoubia.lng) <= KOUTOUBIA_START_CONTEXT_RADIUS_M
    : false;
  const isArtisanSouksContext = input.theme === "artisan" && isKoutoubiaContext;
  const mandatoryIconicPoi = scored.find((poi) => poi.id === CANONICAL_JEMAA_EL_FNA_POI_ID);
  const mandatoryIconicPoiId = isArtisanSouksContext && mandatoryIconicPoi
    ? CANONICAL_JEMAA_EL_FNA_POI_ID
    : undefined;
  const protectedPoiIds = new Set<string>(mandatoryIconicPoiId ? [mandatoryIconicPoiId] : []);

  // Step 3: Select POIs
  let selected = selectPOIs(scored, input, mandatoryIconicPoiId);
  const selectedAfterSelectCount = selected.length;

  // Step 3.5 (P1): Cultural complement.
  // If guided_tour and selected < min target, scan extended radius for the
  // best validated cultural POIs not yet selected and inject them. This bypasses
  // the initial radius_m cap but NEVER bypasses category/name/context blacklists.
  const minStopsTarget = input.mode === "guided_tour"
    ? Math.min(guidedMinStops(input.max_duration_min), input.max_stops)
    : 3;
  const complementAdded: ScoredPOI[] = [];

  if (input.mode === "guided_tour" && selected.length < minStopsTarget) {
    const extRadius = extendedRadiusFor(input.max_duration_min, input.radius_m);
    const usedIds = new Set(selected.map((s) => s.id));

    const extPool = allPOIs
      .filter((p) => {
        if (!p.is_active) return false;
        if (usedIds.has(p.id)) return false;
        if (excludeSet.has(p.id)) return false;
        if (input.require_audio_fr && (!p.audio_url_fr || String(p.audio_url_fr).trim().length < 10)) return false;
        if (EXCLUDED_CATEGORIES.includes((p.category_ai || "").toLowerCase())) return false;
        if (EXCLUDED_CATEGORIES.includes((p.category_google || "").toLowerCase())) return false;
        if (isNameBlacklisted(p.name)) return false;
        if (isGuidedTourNameBlacklisted(p.name)) return false;
        if (isContextBanned(p, input.start_lat, input.start_lng, allPOIs)) return false;
        if (!isCulturalGuided(p)) return false;
        const dist = haversineM(input.start_lat, input.start_lng, p.lat, p.lng);
        if (dist > extRadius) return false;
        if (p.is_start_hub) {
          if (!p.is_main_visit) return false;
          if (dist < START_HUB_SELF_DISTANCE_M) return false;
        }
        // Quality floor: validated cultural with content
        if ((p.poi_quality_score ?? 0) < 5) return false;
        if (!p.history_context && !p.local_anecdote_fr && !p.wikipedia_summary) return false;
        return true;
      })
      .map((p) => {
        const dist = haversineM(input.start_lat, input.start_lng, p.lat, p.lng);
        return { ...p, score: scorePOI(p, input, dist), distance_from_start: dist } as ScoredPOI;
      })
      .sort((a, b) => b.score - a.score);

    while (selected.length < minStopsTarget && extPool.length > 0) {
      const next = extPool.shift()!;
      selected.push(next);
      complementAdded.push(next);
    }
  }
  const selectedAfterComplementCount = selected.length;

  // Step 4: Route optimization (P1.1: capture order BEFORE)
  const orderBefore = [...selected];
  const statsBefore = segmentStats(input.start_lat, input.start_lng, orderBefore);

  let route = nearestNeighborTSP(input.start_lat, input.start_lng, selected, input.circular);
  route = twoOptImprove(input.start_lat, input.start_lng, route, input.circular);
  route = enforceConsecutiveDiversity(input.start_lat, input.start_lng, route, input.circular);
  // P1.1: re-run 2-opt AFTER diversity (diversity may have introduced micro-zigzags)
  route = twoOptImprove(input.start_lat, input.start_lng, route, input.circular);

  // Step 5: Trim to fit duration — but never below minStopsTarget for guided_tour
  route = trimToFitDuration(
    input.start_lat,
    input.start_lng,
    route,
    input.max_duration_min,
    input.circular,
    input.mode,
    input.max_stops,
    protectedPoiIds,
    input.mode === "guided_tour" ? minStopsTarget : 3,
  );
  // P1.1: final 2-opt pass after trim re-injection
  route = twoOptImprove(input.start_lat, input.start_lng, route, input.circular);

  // Step 6: Calculate totals
  const timing = calcTotalTime(input.start_lat, input.start_lng, route, input.circular, input.mode);

  // Step 7: Build stops
  const stops = buildStops(input.start_lat, input.start_lng, route, input);
  const totalPoints = stops.reduce((s, st) => s + (st.points ?? 0), 0);

  // P1.1: segment analysis + warnings
  const statsAfter = segmentStats(input.start_lat, input.start_lng, route);
  const warnThreshold = input.max_duration_min >= 180 ? 1200 : 900;
  const longSegmentWarnings: string[] = [];
  for (let i = 0; i < statsAfter.segments_m.length; i++) {
    if (statsAfter.segments_m[i] > warnThreshold) {
      const fromN = i === 0 ? "START" : route[i - 1].name;
      const toN = route[i]?.name ?? "?";
      longSegmentWarnings.push(`segment#${i} ${statsAfter.segments_m[i]}m (${fromN} → ${toN}) > ${warnThreshold}m`);
    }
  }

  const debug: GenerationDebug = {
    candidates_initial_count: allPOIs.length,
    candidates_after_blacklist_count: countAfterBlacklist,
    candidates_within_radius_count: countWithinRadius,
    cultural_within_radius_count: countCulturalWithinRadius,
    selected_after_select_count: selectedAfterSelectCount,
    selected_after_complement_count: selectedAfterComplementCount,
    selected_after_trim_count: route.length,
    min_stops_target: minStopsTarget,
    cultural_complement_added: complementAdded.length,
    cultural_complement_names: complementAdded.map((p) => p.name),
    rejected_top_cultural: rejectedTopCultural.slice(0, 10),
    order_before_optimization: orderBefore.map((p) => p.name),
    order_after_optimization: route.map((p) => p.name),
    total_distance_before_m: statsBefore.total_m,
    total_distance_after_m: statsAfter.total_m,
    max_segment_before_m: statsBefore.max_segment_m,
    max_segment_after_m: statsAfter.max_segment_m,
    longest_segment_from: statsAfter.max_from,
    longest_segment_to: statsAfter.max_to,
    segments_after_m: statsAfter.segments_m,
    long_segment_warnings: longSegmentWarnings,
  };
  console.log("[generation_debug]", JSON.stringify(debug));
  if (longSegmentWarnings.length > 0) {
    console.warn("[long_segment_warnings]", longSegmentWarnings.join(" | "));
  }

  return {
    id: generateId(),
    mode: input.mode,
    theme: input.theme,
    difficulty: input.difficulty,
    language: input.language,
    start: {
      name: input.start_name ?? "Point de départ",
      lat: input.start_lat,
      lng: input.start_lng,
    },
    total_stops: stops.length,
    total_distance_m: Math.round(timing.totalDistM),
    walking_time_min: timing.walkingMin,
    visit_time_min: timing.visitMin,
    total_time_min: timing.totalMin,
    total_points: totalPoints,
    stops,
    title: generateTitle(input),
    teaser: generateTeaser(input, stops, timing.totalMin),
    algorithm_version: "3.2.0-p1.1",
    generated_at: new Date().toISOString(),
    ...({ generation_debug: debug } as Record<string, unknown>),
  } as EngineOutput;
}
