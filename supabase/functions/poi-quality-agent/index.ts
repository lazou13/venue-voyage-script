import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dryRun = body.dry_run !== false;
    const mode = body.mode ?? "audit"; // 'audit' (default) | 'recat_propose'

    // ──────────────────────────────────────────────────────────────────────
    // MODE: recat_propose (LOT 1A) — DRY-RUN STRICT, never writes medina_pois
    // ──────────────────────────────────────────────────────────────────────
    if (mode === "recat_propose") {
      const result = await runRecatPropose(supabase, body);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Count total active POIs
    const { count: totalPois } = await supabase
      .from("medina_pois")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);

    const issues: Record<string, { count: number; poi_ids?: unknown[]; pairs?: unknown[] }> = {};
    let autoFixed = 0;
    const poisToReview: string[] = [];

    // A) Content too short
    try {
      const { data } = await supabase
        .from("medina_pois")
        .select("id, name, category_ai")
        .eq("is_active", true)
        .not("history_context", "is", null)
        .neq("enrichment_quality", "low_value")
        .order("poi_quality_score", { ascending: false })
        .limit(500);

      const short = (data ?? []).filter((p: any) => {
        // We can't filter by LENGTH in postgrest, so do it client-side
        return true; // We'll use RPC below instead
      });

      // Use a raw query approach via rpc if available, otherwise just flag all with history_context
      // Since we can't do LENGTH() via postgrest, query all and filter client-side
      const { data: allWithHistory } = await supabase
        .from("medina_pois")
        .select("id, name, category_ai, history_context")
        .eq("is_active", true)
        .not("history_context", "is", null)
        .neq("enrichment_quality", "low_value")
        .limit(1000);

      const tooShort = (allWithHistory ?? []).filter((p: any) => (p.history_context?.length ?? 0) < 800);
      issues.content_too_short = {
        count: tooShort.length,
        poi_ids: tooShort.slice(0, 20).map((p: any) => ({ id: p.id, name: p.name, len: p.history_context?.length })),
      };
      tooShort.forEach((p: any) => { if (!poisToReview.includes(p.id)) poisToReview.push(p.id); });
    } catch (e) {
      console.error("Step A error:", e);
      issues.content_too_short = { count: -1, poi_ids: [] };
    }

    // B) Hallucinations
    try {
      const { data: allAnecdotes } = await supabase
        .from("medina_pois")
        .select("id, name, local_anecdote_fr, enrichment_quality")
        .eq("is_active", true)
        .not("local_anecdote_fr", "is", null)
        .neq("enrichment_quality", "suspect")
        .limit(1000);

      const hallPatterns = ["chuchotent", "murmurent", "on raconte", "la légende"];
      const hallucinated = (allAnecdotes ?? []).filter((p: any) =>
        hallPatterns.some((pat) => p.local_anecdote_fr?.toLowerCase().includes(pat))
      );

      issues.hallucinations = {
        count: hallucinated.length,
        poi_ids: hallucinated.slice(0, 20).map((p: any) => ({ id: p.id, name: p.name })),
      };

      if (!dryRun && hallucinated.length > 0) {
        for (const p of hallucinated) {
          const { error } = await supabase
            .from("medina_pois")
            .update({ enrichment_quality: "suspect" })
            .eq("id", p.id);
          if (!error) autoFixed++;
        }
      }
      hallucinated.forEach((p: any) => { if (!poisToReview.includes(p.id)) poisToReview.push(p.id); });
    } catch (e) {
      console.error("Step B error:", e);
      issues.hallucinations = { count: -1, poi_ids: [] };
    }

    // C) Missing EN anecdote on visited POIs
    try {
      const { data } = await supabase
        .from("medina_pois")
        .select("id, name")
        .eq("is_active", true)
        .gt("visit_count", 0)
        .is("local_anecdote_en", null)
        .neq("enrichment_quality", "low_value")
        .limit(200);

      const missing = data ?? [];
      issues.missing_en = {
        count: missing.length,
        poi_ids: missing.slice(0, 20).map((p: any) => ({ id: p.id, name: p.name })),
      };
      missing.forEach((p: any) => { if (!poisToReview.includes(p.id)) poisToReview.push(p.id); });
    } catch (e) {
      console.error("Step C error:", e);
      issues.missing_en = { count: -1, poi_ids: [] };
    }

    // D) Geographic duplicates (PostGIS — skip if unavailable)
    try {
      const { data, error } = await supabase.rpc("find_nearby_poi_duplicates" as any, { max_dist: 20, max_results: 20 });
      if (error) {
        // PostGIS RPC not available — fallback to client-side approximation
        const { data: withGps } = await supabase
          .from("medina_pois")
          .select("id, name, lat, lng")
          .eq("is_active", true)
          .not("lat", "is", null)
          .not("lng", "is", null)
          .limit(500);

        const pairs: unknown[] = [];
        const gps = withGps ?? [];
        for (let i = 0; i < gps.length && pairs.length < 20; i++) {
          for (let j = i + 1; j < gps.length; j++) {
            const d = Math.sqrt(
              Math.pow(((gps[i] as any).lat - (gps[j] as any).lat) * 111320, 2) +
              Math.pow(((gps[i] as any).lng - (gps[j] as any).lng) * 111320 * Math.cos((gps[i] as any).lat * Math.PI / 180), 2)
            );
            if (d < 20) {
              pairs.push({ id1: (gps[i] as any).id, id2: (gps[j] as any).id, name1: (gps[i] as any).name, name2: (gps[j] as any).name, dist_m: Math.round(d * 10) / 10 });
              if (pairs.length >= 20) break;
            }
          }
        }
        issues.duplicates = { count: pairs.length, pairs };
      } else {
        issues.duplicates = { count: (data ?? []).length, pairs: (data ?? []).slice(0, 20) };
      }
    } catch (e) {
      console.error("Step D error:", e);
      issues.duplicates = { count: -1, pairs: [] };
    }

    // E) Inconsistent scores (restaurants with score > 8)
    try {
      const { data } = await supabase
        .from("medina_pois")
        .select("id, name, category_ai, poi_quality_score")
        .eq("is_active", true)
        .eq("category_ai", "restaurant")
        .gt("poi_quality_score", 8)
        .limit(50);

      const inconsistent = data ?? [];
      issues.score_inconsistent = {
        count: inconsistent.length,
        poi_ids: inconsistent.map((p: any) => ({ id: p.id, name: p.name, score: p.poi_quality_score })),
      };

      if (!dryRun && inconsistent.length > 0) {
        for (const p of inconsistent) {
          const capped = Math.min(Number(p.poi_quality_score), 7.5);
          const { error } = await supabase
            .from("medina_pois")
            .update({ poi_quality_score: capped })
            .eq("id", p.id);
          if (!error) autoFixed++;
        }
      }
      inconsistent.forEach((p: any) => { if (!poisToReview.includes(p.id)) poisToReview.push(p.id); });
    } catch (e) {
      console.error("Step E error:", e);
      issues.score_inconsistent = { count: -1, poi_ids: [] };
    }

    // Quality score calculation
    const totalIssues = Object.values(issues).reduce((s, v) => s + Math.max(v.count, 0), 0);
    const total = totalPois ?? 1;
    const qualityScore = Math.max(0, Math.round((1 - totalIssues / total) * 100 * 10) / 10);

    const needsReview = poisToReview.length;

    // Save report
    await supabase.from("poi_quality_reports").insert({
      dry_run: dryRun,
      total_pois: total,
      issues_detail: issues,
      auto_fixed: autoFixed,
      needs_review: needsReview,
      quality_score: qualityScore,
      pois_to_review: poisToReview.slice(0, 100),
    });

    const report = {
      run_at: new Date().toISOString(),
      dry_run: dryRun,
      total_pois: total,
      issues,
      auto_fixed: autoFixed,
      needs_review: needsReview,
      quality_score: qualityScore,
    };

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("poi-quality-agent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// LOT 1A — recat_propose (DRY-RUN STRICT)
// Génère des propositions IA pour un batch pilote borné de POIs `generic`/
// `restaurant`. ÉCRIT UNIQUEMENT dans `poi_quality_reports` (jamais sur
// `medina_pois`). L'application des décisions humaines se fait via l'UI.
// ──────────────────────────────────────────────────────────────────────────
const TAXONOMY = [
  "monument", "historic_site", "museum", "mosque", "palace", "garden",
  "fountain", "gate_bab", "riad", "souk", "fondouk", "artisan",
  "food_drink", "photo_spot", "viewpoint", "cafe", "restaurant", "place", "generic",
];

const KEYWORD_REGEX = /(mosqu|medersa|palais|riad|fondouk|souk|place|bab |koubba|dar )/i;
const RESTAURANT_MISLABEL_REGEX = /(café|cafe|pâtisserie|patisserie|salon de thé|boulangerie)/i;

async function selectPilotPool(supabase: any, target = 30) {
  const baseFilter = (q: any) => q
    .eq("is_active", true)
    .eq("status", "validated")
    .not("name_fr", "is", null)
    .not("lat", "is", null)
    .not("lng", "is", null)
    .eq("is_start_hub", false)
    .eq("is_main_visit", false);

  // bucket A — generic with high signal (wikidata or wikipedia or historical_significance>=3)
  const { data: highSignal } = await baseFilter(
    supabase.from("medina_pois").select("id, name_fr, name, category, category_google, subcategory, address, wikidata_id, wikipedia_summary, historical_significance, rating, reviews_count")
      .eq("category", "generic")
      .or("wikidata_id.not.is.null,wikipedia_summary.not.is.null,historical_significance.gte.3")
      .limit(50)
  );

  // bucket B — generic with patrimonial keyword
  const { data: keywordPool } = await baseFilter(
    supabase.from("medina_pois").select("id, name_fr, name, category, category_google, subcategory, address, wikidata_id, wikipedia_summary, historical_significance, rating, reviews_count")
      .eq("category", "generic")
      .is("wikidata_id", null)
      .is("wikipedia_summary", null)
      .limit(200)
  );
  const bucketB = (keywordPool ?? []).filter((p: any) => KEYWORD_REGEX.test(p.name_fr ?? p.name ?? ""));

  // bucket C — restaurant mislabeled (cafe/patisserie/etc.)
  const { data: restPool } = await baseFilter(
    supabase.from("medina_pois").select("id, name_fr, name, category, category_google, subcategory, address, wikidata_id, wikipedia_summary, historical_significance, rating, reviews_count")
      .eq("category", "restaurant")
      .limit(300)
  );
  const bucketC = (restPool ?? []).filter((p: any) => RESTAURANT_MISLABEL_REGEX.test(p.name_fr ?? p.name ?? ""));

  // Adaptive composition: prefer 15/10/5; fall back if buckets short
  const wantA = 15, wantB = 10, wantC = 5;
  const picked: any[] = [];
  picked.push(...(highSignal ?? []).slice(0, wantA));
  picked.push(...bucketB.slice(0, wantB));
  picked.push(...bucketC.slice(0, wantC));

  // Backfill from bucketB then bucketC if total < target
  let i = wantB;
  while (picked.length < target && i < bucketB.length) { picked.push(bucketB[i++]); }
  let j = wantC;
  while (picked.length < target && j < bucketC.length) { picked.push(bucketC[j++]); }
  let k = wantA;
  while (picked.length < target && k < (highSignal?.length ?? 0)) { picked.push((highSignal as any)[k++]); }

  // Dedup by id
  const seen = new Set<string>();
  const unique = picked.filter((p) => !seen.has(p.id) && seen.add(p.id));
  return unique.slice(0, target);
}

async function classifyPoiViaAi(poi: any): Promise<{ proposed_category: string; confidence: number; reasoning: string }> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return { proposed_category: "generic", confidence: 0, reasoning: "no_api_key" };
  }
  const taxonomyList = TAXONOMY.join(", ");
  const sys = `Tu es un expert classificateur de POIs de la médina de Marrakech.
Tu reçois un POI et tu dois proposer une catégorie parmi cette taxonomie fermée: ${taxonomyList}.
Règles strictes:
- Réponds UNIQUEMENT en JSON: {"proposed_category":"...","confidence":0.0,"reasoning":"..."}
- "reasoning" est une seule phrase courte (max 20 mots).
- "confidence" est entre 0 et 1.
- Si données insuffisantes, retourne {"proposed_category":"generic","confidence":<0.3,"reasoning":"..."}.
- Aucune invention: ne déduis pas un statut historique sans signal explicite (wikidata, wikipedia, mot-clé fort).`;

  const user = JSON.stringify({
    name_fr: poi.name_fr,
    current_category: poi.category,
    category_google: poi.category_google,
    subcategory: poi.subcategory,
    address: poi.address,
    wikidata_id: poi.wikidata_id,
    wikipedia_summary: poi.wikipedia_summary?.slice(0, 400),
    historical_significance: poi.historical_significance,
    rating: poi.rating,
    reviews_count: poi.reviews_count,
  });

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      console.error("AI gateway error", resp.status, txt);
      return { proposed_category: "generic", confidence: 0, reasoning: `gateway_${resp.status}` };
    }
    const json = await resp.json();
    const raw = json?.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    const proposed = TAXONOMY.includes(parsed.proposed_category) ? parsed.proposed_category : "generic";
    const conf = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0)));
    return {
      proposed_category: proposed,
      confidence: conf,
      reasoning: String(parsed.reasoning ?? "").slice(0, 200),
    };
  } catch (e) {
    console.error("classifyPoiViaAi exception", e);
    return { proposed_category: "generic", confidence: 0, reasoning: "exception" };
  }
}

async function runRecatPropose(supabase: any, body: any) {
  const target = Math.max(1, Math.min(50, Number(body.pilot_size ?? 30)));
  const startedAt = new Date().toISOString();

  const pool = await selectPilotPool(supabase, target);
  const proposals: any[] = [];
  let confHigh = 0, confMid = 0, confLow = 0;

  for (const poi of pool) {
    const ai = await classifyPoiViaAi(poi);
    if (ai.confidence >= 0.9) confHigh++;
    else if (ai.confidence >= 0.7) confMid++;
    else confLow++;

    proposals.push({
      poi_id: poi.id,
      name_fr: poi.name_fr,
      current_category: poi.category,
      proposed_category: ai.proposed_category,
      confidence: ai.confidence,
      reasoning: ai.reasoning,
      human_decision: null, // pending
    });
    // Light delay to avoid rate limits
    await new Promise((r) => setTimeout(r, 250));
  }

  // Persist as a single report row (issues_detail holds proposals)
  const { data: inserted, error: insErr } = await supabase
    .from("poi_quality_reports")
    .insert({
      dry_run: true,
      total_pois: pool.length,
      auto_fixed: 0,
      needs_review: pool.length,
      quality_score: null,
      pois_to_review: pool.map((p: any) => p.id),
      issues_detail: {
        report_kind: "recat_proposal",
        batch: "lot1a_pilot",
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        confidence_distribution: { high: confHigh, mid: confMid, low: confLow },
        proposals,
      },
    })
    .select("id")
    .single();

  if (insErr) {
    return { error: insErr.message, proposals_count: proposals.length };
  }

  return {
    report_id: inserted?.id,
    pilot_size: pool.length,
    confidence_distribution: { high: confHigh, mid: confMid, low: confLow },
    proposals_preview: proposals.slice(0, 5),
    note: "DRY-RUN. Aucune mutation sur medina_pois. Validation humaine requise via UI AdminWatchdog.",
  };
}
