/**
 * Pure function: select & order medina POIs for a sur-mesure quest.
 */

export interface ItineraryParams {
  zone: string;
  categories: string[];
  pause: boolean;
  count: number;
  seed?: string;
  /** Optional hub coordinates to geo-sort from */
  startLat?: number;
  startLng?: number;
}

export interface StartHub {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface MedinaPOILike {
  id: string;
  zone: string;
  category: string;
  is_active: boolean;
  lat?: number | null;
  lng?: number | null;
  is_start_hub?: boolean;
  status?: string;
}

/** Simple seeded PRNG (mulberry32) */
function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return () => {
    h |= 0;
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function generateMedinaItinerary(
  allPois: MedinaPOILike[],
  params: ItineraryParams,
): string[] {
  const { zone, categories, pause, count, seed, startLat, startLng } = params;
  const rng = seededRandom(seed ?? String(Date.now()));

  // 1. Filter by zone + active + validated + exclude hubs
  let pool = allPois.filter((p) => p.is_active && (p.status ?? 'validated') === 'validated' && p.zone === zone && !('is_start_hub' in p && (p as any).is_start_hub));

  // 2. Filter by categories if specified
  if (categories.length > 0) {
    pool = pool.filter((p) => categories.includes(p.category));
  }

  // 3. Separate food_drink for pause injection
  const foodDrink = pool.filter((p) => p.category === 'food_drink');
  const nonFood = pool.filter((p) => p.category !== 'food_drink');

  // 4. Shuffle non-food
  const shuffled = shuffle(nonFood, rng);

  // 5. Greedy diversity: no 2 consecutive same category + max 2 per category
  const result: MedinaPOILike[] = [];
  const remaining = [...shuffled];
  const catCount: Record<string, number> = {};

  const targetCount = pause && foodDrink.length > 0 ? count - 1 : count;
  const MAX_PER_CAT = 2;

  while (result.length < targetCount && remaining.length > 0) {
    const lastCat = result.length > 0 ? result[result.length - 1].category : null;

    // Strict pass: different from last AND under max per category
    let pickIdx = remaining.findIndex(
      (p) => p.category !== lastCat && (catCount[p.category] ?? 0) < MAX_PER_CAT,
    );

    // Relaxed pass: just different from last (ignore max per category)
    if (pickIdx < 0) {
      pickIdx = remaining.findIndex((p) => p.category !== lastCat);
    }

    // Fallback: take anything
    if (pickIdx < 0) pickIdx = 0;

    const picked = remaining.splice(pickIdx, 1)[0];
    catCount[picked.category] = (catCount[picked.category] ?? 0) + 1;
    result.push(picked);
  }

  // 6. Inject food_drink at ~middle if pause requested
  if (pause && foodDrink.length > 0) {
    const pick = foodDrink[Math.floor(rng() * foodDrink.length)];
    const mid = Math.floor(result.length / 2);
    result.splice(mid, 0, pick);
  }

  let final = result.slice(0, count);

  // 7. Geo-sort from hub if start coords provided
  if (startLat != null && startLng != null) {
    final = nearestNeighborSort(final, startLat, startLng);
  }

  // 8. Post-sort diversity fix: swap consecutive same-category if possible
  for (let i = 1; i < final.length; i++) {
    if (final[i].category === final[i - 1].category) {
      // Try to swap with next non-same
      for (let j = i + 1; j < final.length; j++) {
        if (final[j].category !== final[i].category) {
          [final[i], final[j]] = [final[j], final[i]];
          break;
        }
      }
    }
  }

  return final.map((p) => p.id);
}

/** Nearest-neighbour ordering starting from a geographic anchor */
function nearestNeighborSort(pois: MedinaPOILike[], startLat: number, startLng: number): MedinaPOILike[] {
  const remaining = [...pois];
  const sorted: MedinaPOILike[] = [];
  let curLat = startLat;
  let curLng = startLng;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const p = remaining[i];
      if (p.lat == null || p.lng == null) continue;
      const d = haversineDistance(curLat, curLng, p.lat!, p.lng!);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    const picked = remaining.splice(bestIdx, 1)[0];
    sorted.push(picked);
    if (picked.lat != null && picked.lng != null) {
      curLat = picked.lat!;
      curLng = picked.lng!;
    }
  }
  return sorted;
}
