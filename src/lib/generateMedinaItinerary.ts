/**
 * Pure function: select & order medina POIs for a sur-mesure quest.
 */

export interface ItineraryParams {
  zone: string;
  categories: string[];
  pause: boolean;
  count: number;
  seed?: string;
}

export interface MedinaPOILike {
  id: string;
  zone: string;
  category: string;
  is_active: boolean;
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

export function generateMedinaItinerary(
  allPois: MedinaPOILike[],
  params: ItineraryParams,
): string[] {
  const { zone, categories, pause, count, seed } = params;
  const rng = seededRandom(seed ?? String(Date.now()));

  // 1. Filter by zone + active
  let pool = allPois.filter((p) => p.is_active && p.zone === zone);

  // 2. Filter by categories if specified
  if (categories.length > 0) {
    pool = pool.filter((p) => categories.includes(p.category));
  }

  // 3. Separate food_drink for pause injection
  const foodDrink = pool.filter((p) => p.category === 'food_drink');
  const nonFood = pool.filter((p) => p.category !== 'food_drink');

  // 4. Shuffle non-food
  const shuffled = shuffle(nonFood, rng);

  // 5. Greedy diversity: no 2 same categories in a row
  const result: MedinaPOILike[] = [];
  const remaining = [...shuffled];

  const targetCount = pause && foodDrink.length > 0 ? count - 1 : count;

  while (result.length < targetCount && remaining.length > 0) {
    const lastCat = result.length > 0 ? result[result.length - 1].category : null;
    const diverseIdx = remaining.findIndex((p) => p.category !== lastCat);
    const pickIdx = diverseIdx >= 0 ? diverseIdx : 0;
    result.push(remaining.splice(pickIdx, 1)[0]);
  }

  // 6. Inject food_drink at ~middle if pause requested
  if (pause && foodDrink.length > 0) {
    const pick = foodDrink[Math.floor(rng() * foodDrink.length)];
    const mid = Math.floor(result.length / 2);
    result.splice(mid, 0, pick);
  }

  return result.slice(0, count).map((p) => p.id);
}
