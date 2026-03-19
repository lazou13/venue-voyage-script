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
  is_active: boolean;
  radius_m: number;
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
  craft_shop: 10, restaurant: 30, cafe: 20, hammam: 8,
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

  // Proximity penalty (0 to -10)
  score -= (distanceFromStart / input.radius_m) * 10;

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

function selectPOIs(candidates: ScoredPOI[], input: EngineInput): ScoredPOI[] {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const selected: ScoredPOI[] = [];
  const usedIds = new Set<string>();
  const catCount: Record<string, number> = {};

  const themeCats = THEME_CATEGORIES[input.theme] ?? [];

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

  // Phase 2: fill up to max_stops with max 2 per category
  for (const poi of sorted) {
    if (selected.length >= input.max_stops) break;
    if (usedIds.has(poi.id)) continue;
    if ((catCount[poi.category_ai] ?? 0) >= 2) continue;
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
    curLat = picked.lat;
    curLng = picked.lng;
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

function enforceConsecutiveDiversity(pois: ScoredPOI[]): ScoredPOI[] {
  const result = [...pois];
  for (let i = 1; i < result.length; i++) {
    if (result[i].category_ai === result[i - 1].category_ai) {
      for (let j = i + 1; j < result.length; j++) {
        if (result[j].category_ai !== result[i].category_ai) {
          [result[i], result[j]] = [result[j], result[i]];
          break;
        }
      }
    }
  }
  return result;
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
  mode: EngineMode
): ScoredPOI[] {
  let current = [...pois];

  while (current.length > 3) {
    const { totalMin } = calcTotalTime(startLat, startLng, current, circular, mode);
    if (totalMin <= maxDurationMin - 5) break;

    // Remove lowest-scoring POI
    let minIdx = 0;
    let minScore = current[0].score;
    for (let i = 1; i < current.length; i++) {
      if (current[i].score < minScore) {
        minScore = current[i].score;
        minIdx = i;
      }
    }
    current.splice(minIdx, 1);
    current = twoOptImprove(startLat, startLng, current, circular);
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
    const prevLat = i === 0 ? startLat : pois[i - 1].lat;
    const prevLng = i === 0 ? startLng : pois[i - 1].lng;
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
      name: poi.name,
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
      // guided_tour
      stop.story = poi.tourist_interest || poi.description_short || undefined;
      stop.history_context = poi.history_context || undefined;
      stop.local_anecdote = poi.local_anecdote || undefined;
      stop.tourist_tips = buildTouristTip(poi);
      stop.photo_spot = poi.instagram_spot || (poi.metadata?.features?.visual_impact ?? 0) >= 7;
      stop.address = poi.address || undefined;
      stop.description = poi.description_short || undefined;
    }

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

export function generateQuest(input: EngineInput, allPOIs: POI[]): EngineOutput {
  // Step 1: Filter candidates
  const excludeSet = new Set(input.exclude_place_ids ?? []);
  const candidates = allPOIs.filter((p) => {
    if (!p.is_active) return false;
    if (p.is_start_hub) return false;
    if (excludeSet.has(p.id)) return false;
    const dist = haversineM(input.start_lat, input.start_lng, p.lat, p.lng);
    return dist <= input.radius_m;
  });

  if (candidates.length < 3) {
    throw new Error(
      `Seulement ${candidates.length} POI(s) trouvé(s) dans un rayon de ${input.radius_m}m. Minimum requis : 3.`
    );
  }

  // Step 2: Score each candidate
  const scored: ScoredPOI[] = candidates.map((poi) => {
    const dist = haversineM(input.start_lat, input.start_lng, poi.lat, poi.lng);
    return {
      ...poi,
      score: scorePOI(poi, input, dist),
      distance_from_start: dist,
    };
  });

  // Step 3: Select POIs
  const selected = selectPOIs(scored, input);

  // Step 4: Route optimization
  let route = nearestNeighborTSP(input.start_lat, input.start_lng, selected, input.circular);
  route = twoOptImprove(input.start_lat, input.start_lng, route, input.circular);
  route = enforceConsecutiveDiversity(route);

  // Step 5: Trim to fit duration
  route = trimToFitDuration(input.start_lat, input.start_lng, route, input.max_duration_min, input.circular);

  // Step 6: Calculate totals
  const timing = calcTotalTime(input.start_lat, input.start_lng, route, input.circular);

  // Step 7: Build stops
  const stops = buildStops(input.start_lat, input.start_lng, route, input);
  const totalPoints = stops.reduce((s, st) => s + (st.points ?? 0), 0);

  // Step 8: Build output
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
    algorithm_version: "3.0.0",
    generated_at: new Date().toISOString(),
  };
}
