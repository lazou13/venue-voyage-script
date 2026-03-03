import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS with optional allowlist ──
function getCorsHeaders(req: Request) {
  const allowedOrigin = Deno.env.get("PUBLIC_SITE_ORIGIN");
  const requestOrigin = req.headers.get("Origin") ?? "*";
  const origin = allowedOrigin
    ? (requestOrigin === allowedOrigin ? allowedOrigin : allowedOrigin)
    : "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Vary": "Origin",
  };
}

const DURATION_TO_COUNT: Record<number, number> = { 60: 6, 90: 8, 120: 10, 180: 12, 240: 15 };

// ── In-memory config caches (5 min TTL) ──
interface CacheEntry<T> { payload: T; fetchedAt: number }
let cachedPricing: CacheEntry<PricingConfig> | null = null;
let cachedExpConfig: CacheEntry<ExperiencePageConfig> | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

// ── Types ──
interface PricingConfig {
  currency: string;
  base_prices: Record<string, number>;
  duration_multipliers: Record<string, number>;
  party_thresholds: { min: number; max: number; supplement: number }[];
  pause_supplement: number;
  add_ons: { key: string; label_i18n: Record<string, string>; price: number }[];
}

interface PricingModelDef {
  pricing_model: "group" | "per_person";
  group_price?: number;
  party_size_max?: number;
  devices_allowed?: number;
  devices_allowed_rule?: "party_size";
}

interface GameFieldDef {
  key: string;
  enabled: boolean;
  pricing?: { price_per_person: number };
  title?: string;
}

interface ExperiencePageConfig {
  pricing_models?: Record<string, PricingModelDef>;
  game_builder?: {
    enabled: boolean;
    fields: GameFieldDef[];
  };
  per_person_pricing?: {
    base_price_per_person_by_mode: Record<string, number>;
    duration_multiplier: Record<string, number>;
    addons: { key: string; price_per_person: number; enabled: boolean }[];
  };
}

// ── Config fetchers ──
async function getPricingConfig(db: any): Promise<{ config: PricingConfig; cacheStatus: "HIT" | "MISS" }> {
  const now = Date.now();
  if (cachedPricing && now - cachedPricing.fetchedAt < CACHE_TTL_MS) {
    return { config: cachedPricing.payload, cacheStatus: "HIT" };
  }
  const { data: row, error } = await db
    .from("app_configs")
    .select("payload")
    .eq("key", "pricing")
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !row) throw new Error("Pricing configuration unavailable");
  cachedPricing = { payload: row.payload as PricingConfig, fetchedAt: now };
  return { config: cachedPricing.payload, cacheStatus: "MISS" };
}

async function getExperienceConfig(db: any): Promise<ExperiencePageConfig | null> {
  const now = Date.now();
  if (cachedExpConfig && now - cachedExpConfig.fetchedAt < CACHE_TTL_MS) {
    return cachedExpConfig.payload;
  }
  const { data: row } = await db
    .from("app_configs")
    .select("payload")
    .eq("key", "experience_page_config")
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row) return null;
  cachedExpConfig = { payload: row.payload as ExperiencePageConfig, fetchedAt: now };
  return cachedExpConfig.payload;
}

// ── Seeded PRNG (mulberry32) ──
function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
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

// ── Group pricing calculation ──
function calculateGroupPrice(
  input: { experience_mode: string; pause: boolean; add_ons: string[]; locale: string },
  modelDef: PricingModelDef,
  pricingConfig: PricingConfig,
) {
  const groupPrice = modelDef.group_price ?? 0;
  const pause_supplement = input.pause ? pricingConfig.pause_supplement : 0;

  const add_ons_detail: { key: string; price: number }[] = [];
  for (const key of input.add_ons) {
    const a = pricingConfig.add_ons.find((x) => x.key === key);
    if (a) add_ons_detail.push({ key: a.key, price: a.price });
  }
  const add_ons_total = add_ons_detail.reduce((s, a) => s + a.price, 0);

  return {
    pricing_model: "group" as const,
    base_price: groupPrice,
    total: Math.round(groupPrice + pause_supplement + add_ons_total),
    pause_supplement,
    add_ons_total,
    add_ons_detail,
    devices_allowed: modelDef.devices_allowed ?? 1,
    party_size_max: modelDef.party_size_max,
    currency: pricingConfig.currency,
  };
}

// ── Per-person pricing calculation (new model) ──
function calculatePerPersonPrice(
  input: { experience_mode: string; duration_minutes: number; party_size: number; selected_addons: string[]; game_config?: Record<string, unknown> },
  expConfig: ExperiencePageConfig,
  modelDef?: PricingModelDef,
) {
  const pp = expConfig.per_person_pricing!;
  const basePrice = pp.base_price_per_person_by_mode[input.experience_mode] ?? 25;
  const multiplier = pp.duration_multiplier[String(input.duration_minutes)] ?? 1;
  const base_per_person = Math.round(basePrice * multiplier);

  const addons_detail: { key: string; price_per_person: number }[] = [];
  for (const key of input.selected_addons) {
    const a = pp.addons.find((x) => x.key === key && x.enabled);
    if (a) addons_detail.push({ key: a.key, price_per_person: a.price_per_person });
  }
  const addons_per_person = addons_detail.reduce((s, a) => s + a.price_per_person, 0);

  let game_addons_per_person = 0;
  const game_addons_detail: { key: string; title: string; price_per_person: number }[] = [];
  if (input.game_config && expConfig.game_builder?.enabled) {
    for (const f of expConfig.game_builder.fields) {
      if (!f.enabled || !f.pricing || f.pricing.price_per_person <= 0) continue;
      const val = input.game_config[f.key];
      if (val !== undefined && val !== null && val !== false && val !== "" && !(Array.isArray(val) && (val as unknown[]).length === 0)) {
        game_addons_detail.push({ key: f.key, title: f.title ?? f.key, price_per_person: f.pricing.price_per_person });
        game_addons_per_person += f.pricing.price_per_person;
      }
    }
  }

  const total_per_person = base_per_person + addons_per_person + game_addons_per_person;
  const total = total_per_person * input.party_size;

  const devices_allowed = modelDef?.devices_allowed_rule === "party_size"
    ? input.party_size
    : (modelDef?.devices_allowed ?? input.party_size);

  return {
    pricing_model: "per_person" as const,
    base_per_person,
    addons_per_person,
    game_addons_per_person,
    total_per_person,
    total,
    addons_detail,
    game_addons_detail,
    devices_allowed,
    currency: "MAD",
  };
}

// ── Legacy pricing calculation ──
function calculatePriceLegacy(
  input: { experience_mode: string; duration_minutes: number; party_size: number; pause: boolean; add_ons: string[]; locale: string },
  config: PricingConfig,
) {
  const base_price = config.base_prices[input.experience_mode] ?? 0;
  const duration_multiplier = config.duration_multipliers[String(input.duration_minutes)] ?? 1;
  const partyT = config.party_thresholds.find((t) => input.party_size >= t.min && input.party_size <= t.max);
  const party_supplement = partyT?.supplement ?? 0;
  const pause_supplement = input.pause ? config.pause_supplement : 0;

  const add_ons_detail: { key: string; label: string; price: number }[] = [];
  for (const key of input.add_ons) {
    const a = config.add_ons.find((x) => x.key === key);
    if (a) add_ons_detail.push({ key: a.key, label: a.label_i18n[input.locale] ?? a.label_i18n.fr ?? a.key, price: a.price });
  }
  const add_ons_total = add_ons_detail.reduce((s, a) => s + a.price, 0);
  const total = Math.round(base_price * duration_multiplier + party_supplement + pause_supplement + add_ons_total);

  return { pricing_model: "per_person" as const, base_price, duration_multiplier, party_supplement, pause_supplement, add_ons_total, add_ons_detail, total, currency: config.currency, devices_allowed: input.party_size };
}

// ── Main handler ──
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    const body = await req.json();

    // ── 1. Honeypot ──
    if (body.honeypot_website) {
      return json({ error: "Bad request" }, 400);
    }

    // ── 2. Validate input ──
    const customer_email = (body.customer_email ?? "").trim().slice(0, 120);
    if (!customer_email || !customer_email.includes("@")) {
      return json({ error: "customer_email required (valid email)" }, 400);
    }
    const customer_name = ((body.customer_name ?? "").trim() || customer_email.split("@")[0]).slice(0, 80);
    const experience_mode = body.experience_mode === "game" ? "game" : "visit";
    const duration_minutes = [60, 90, 120, 180, 240].includes(body.duration_minutes) ? body.duration_minutes : 120;
    const zone = (body.zone ?? "").trim().slice(0, 100);
    if (!zone) return json({ error: "zone required" }, 400);
    const categories: string[] = Array.isArray(body.categories) ? body.categories.slice(0, 10) : [];
    if (categories.some((c: unknown) => typeof c !== "string")) return json({ error: "categories must be strings" }, 400);
    const pause: boolean = body.pause === true;
    const add_ons: string[] = Array.isArray(body.add_ons) ? body.add_ons.slice(0, 10) : [];
    if (add_ons.some((a: unknown) => typeof a !== "string")) return json({ error: "add_ons must be strings" }, 400);
    const locale: string = (body.locale ?? "fr").slice(0, 5);
    const party_size: number = Math.max(1, Math.min(20, Number(body.party_size) || 2));
    const seed: string = body.seed ?? customer_email;

    const game_config: Record<string, unknown> | null =
      experience_mode === "game" && body.game_config && typeof body.game_config === "object" && !Array.isArray(body.game_config)
        ? body.game_config
        : null;

    const selected_addons: string[] = Array.isArray(body.selected_addons) ? body.selected_addons.slice(0, 10) : add_ons;

    // ── 3. Rate limit: 3 creations / email / hour ──
    const { count: rlCount, error: rlErr } = await db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_email", customer_email)
      .gte("created_at", new Date(Date.now() - 3600_000).toISOString());
    if (rlErr) throw rlErr;
    if ((rlCount ?? 0) >= 3) {
      return json({ error: "Rate limit: max 3 per email per hour" }, 429);
    }

    // ── 4. Load configs ──
    const expConfig = await getExperienceConfig(db);
    const { config: pricingConfig } = await getPricingConfig(db);

    // Determine pricing model from config
    const modelDef: PricingModelDef | undefined = expConfig?.pricing_models?.[experience_mode];
    const pricingModel = modelDef?.pricing_model ?? "per_person";

    let pricingResult: { total: number; currency: string; pricing_model: string; devices_allowed: number; party_size_max?: number; [k: string]: unknown };

    if (pricingModel === "group" && modelDef) {
      // Validate party_size against max
      const maxParty = modelDef.party_size_max ?? 20;
      if (party_size > maxParty) {
        return json({ error: `party_size exceeds maximum (${maxParty}) for group pricing` }, 400);
      }
      pricingResult = calculateGroupPrice(
        { experience_mode, pause, add_ons: selected_addons, locale },
        modelDef,
        pricingConfig,
      );
    } else if (expConfig?.per_person_pricing) {
      const result = calculatePerPersonPrice(
        { experience_mode, duration_minutes, party_size, selected_addons, game_config: game_config ?? undefined },
        expConfig,
        modelDef,
      );
      pricingResult = { ...result, currency: pricingConfig.currency };
    } else {
      const result = calculatePriceLegacy(
        { experience_mode, duration_minutes, party_size, pause, add_ons: selected_addons, locale },
        pricingConfig,
      );
      pricingResult = result;
    }

    // ── 5. Select POIs server-side ──
    const count = DURATION_TO_COUNT[duration_minutes] ?? 6;

    let poiQuery = db
      .from("medina_pois")
      .select("*")
      .eq("zone", zone)
      .eq("is_active", true);
    if (categories.length > 0) {
      poiQuery = poiQuery.in("category", categories);
    }
    const { data: allPois, error: poiErr } = await poiQuery;
    if (poiErr) throw poiErr;
    if (!allPois || allPois.length === 0) {
      return json({ error: categories.length > 0
        ? "No POIs found for this zone/categories combination"
        : "No POIs found for this zone" }, 404);
    }

    const rng = seededRandom(seed);

    const foodDrink = allPois.filter((p: any) => p.category === "food_drink");
    const nonFood = allPois.filter((p: any) => p.category !== "food_drink");
    const shuffled = shuffle(nonFood, rng);

    const hasPause = pause || selected_addons.includes("pause");
    const targetCount = hasPause && foodDrink.length > 0 ? count - 1 : count;
    const selected: any[] = [];
    const remaining = [...shuffled];

    while (selected.length < targetCount && remaining.length > 0) {
      const lastCat = selected.length > 0 ? selected[selected.length - 1].category : null;
      const diverseIdx = remaining.findIndex((p) => p.category !== lastCat);
      const pickIdx = diverseIdx >= 0 ? diverseIdx : 0;
      selected.push(remaining.splice(pickIdx, 1)[0]);
    }

    if (hasPause && foodDrink.length > 0) {
      const pick = foodDrink[Math.floor(rng() * foodDrink.length)];
      const mid = Math.floor(selected.length / 2);
      selected.splice(mid, 0, pick);
    }

    const finalPois = selected.slice(0, count);
    const medinaPoiIds = finalPois.map((p: any) => p.id);

    // ── 6. Fetch all media for selected POIs ──
    const { data: allMedia } = await db
      .from("poi_media")
      .select("id, medina_poi_id, media_type, is_cover")
      .in("medina_poi_id", medinaPoiIds);

    const mediaByPoi = new Map<string, any[]>();
    for (const m of allMedia ?? []) {
      const list = mediaByPoi.get(m.medina_poi_id) ?? [];
      list.push(m);
      mediaByPoi.set(m.medina_poi_id, list);
    }

    // ── 7. Build quest_config ──
    const questConfig: Record<string, unknown> = {
      experience_mode,
      project_type: "medina_custom",
      origin: "public_configurator",
    };
    if (game_config) {
      questConfig.game_config = game_config;
    }

    // ── 8. Create project ──
    const { data: project, error: projErr } = await db
      .from("projects")
      .insert({
        hotel_name: `Sur-mesure ${customer_name}`,
        city: "Médina",
        quest_config: questConfig,
        target_duration_mins: duration_minutes,
        title_i18n: { fr: `Parcours sur-mesure — ${customer_name}` },
      })
      .select("id")
      .single();
    if (projErr || !project) throw projErr ?? new Error("Project creation failed");

    // ── 9. Bulk insert POIs ──
    const poiRows = finalPois.map((mpoi: any, idx: number) => {
      const baseConfig = (mpoi.step_config ?? {}) as Record<string, unknown>;
      const stepConfig: Record<string, unknown> = {
        ...baseConfig,
        geo: { lat: mpoi.lat, lng: mpoi.lng, radius_m: mpoi.radius_m, zone: mpoi.zone, category: mpoi.category },
      };

      const mediaRows = mediaByPoi.get(mpoi.id);
      if (mediaRows && mediaRows.length > 0) {
        const mediaRef: Record<string, unknown> = { photoIds: [] as string[], audioIds: [] as string[], videoIds: [] as string[] };
        for (const row of mediaRows) {
          if (row.media_type === "photo") (mediaRef.photoIds as string[]).push(row.id);
          else if (row.media_type === "audio") (mediaRef.audioIds as string[]).push(row.id);
          else if (row.media_type === "video") (mediaRef.videoIds as string[]).push(row.id);
          if (row.is_cover && row.media_type === "photo") mediaRef.coverPhotoId = row.id;
        }
        stepConfig.media = mediaRef;
      }

      return {
        project_id: project.id,
        name: mpoi.name,
        zone: mpoi.zone || "",
        interaction: "puzzle",
        risk: "low",
        minutes_from_prev: 5,
        sort_order: idx,
        step_config: stepConfig,
        library_poi_id: mpoi.id,
      };
    });

    if (poiRows.length > 0) {
      const { error: poisErr } = await db.from("pois").insert(poiRows);
      if (poisErr) throw poisErr;
    }

    // ── 10. Build order metadata ──
    const orderMetadata: Record<string, unknown> = {
      pricing_model: pricingModel,
      devices_allowed: pricingResult.devices_allowed,
    };
    if (pricingModel === "group") {
      orderMetadata.party_size_max = pricingResult.party_size_max;
    }
    if (game_config) {
      orderMetadata.game_config = game_config;
    }
    if (selected_addons.length > 0) {
      orderMetadata.selected_addons = selected_addons;
    }

    // ── 11. Create order ──
    const { data: order, error: ordErr } = await db
      .from("orders")
      .insert({
        project_id: project.id,
        customer_name,
        customer_email,
        experience_mode,
        locale,
        party_size,
        notes: add_ons.length > 0 ? JSON.stringify({ add_ons }) : null,
        metadata: orderMetadata,
        status: "pending",
        payment_status: "stub",
        amount_total: pricingResult.total,
        currency: pricingResult.currency,
      })
      .select("id")
      .single();
    if (ordErr || !order) throw ordErr ?? new Error("Order creation failed");

    // ── 12. Create quest instance with device rules ──
    const { data: instance, error: instErr } = await db
      .from("quest_instances")
      .insert({
        order_id: order.id,
        project_id: project.id,
        ttl_minutes: 240,
        devices_allowed: pricingResult.devices_allowed,
      })
      .select("id, access_token")
      .single();
    if (instErr || !instance) throw instErr ?? new Error("Instance creation failed");

    return json({
      order_id: order.id,
      instance_id: instance.id,
      access_token: instance.access_token,
      project_id: project.id,
      pricing: pricingResult,
    });
  } catch (err: any) {
    console.error("public-generate-quest error:", err);
    return json({ error: err.message ?? "Internal error" }, 500);
  }
});
