import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function callFunction(name: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const step = body.step ?? "all";
    const limit = body.limit ?? 500;
    const batchSize = body.batch_size ?? 5;

    const pipeline: string[] = [];
    const results: Record<string, unknown> = {};
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Extract
    if (step === "all" || step === "extract") {
      pipeline.push("extract");
      results.extract = await callFunction("poi-extract", { limit, with_details: true });
    }

    // 2. Enrich (classify + content in one pass)
    if (step === "all" || step === "enrich") {
      pipeline.push("enrich");
      let totalEnriched = 0;
      let iteration = 0;
      const enrichLogs: string[] = [];

      while (iteration < 200) {
        const res = await callFunction("poi-enrich", { batch_size: batchSize, status: "raw" });
        if (res.enriched === 0) break;
        totalEnriched += res.enriched ?? 0;
        enrichLogs.push(...(res.logs ?? []));
        iteration++;
      }
      results.enrich = { enriched: totalEnriched, iterations: iteration, logs: enrichLogs };
    }

    // 3. Clean low-quality POIs
    if (step === "all" || step === "clean") {
      pipeline.push("clean");
      const { data: cleanResult, error: cleanErr } = await supabase.rpc("clean_low_quality_pois");
      if (cleanErr) {
        results.clean = { error: cleanErr.message };
      } else {
        results.clean = cleanResult;
      }
    }

    // 4. Merge duplicates
    if (step === "all" || step === "merge") {
      pipeline.push("merge");
      const { data: mergeResult, error: mergeErr } = await supabase.rpc("merge_duplicate_pois");
      if (mergeErr) {
        results.merge = { error: mergeErr.message };
      } else {
        results.merge = mergeResult;
      }
    }

    // 5. Proximity
    if (step === "all" || step === "proximity") {
      pipeline.push("proximity");
      results.proximity = await callFunction("poi-proximity", {});
    }

    // 6. Final stats
    const { data: stats } = await supabase
      .from("medina_pois")
      .select("enrichment_status, status");
    
    const counts: Record<string, number> = {};
    for (const row of stats ?? []) {
      const es = (row as any).enrichment_status ?? "unknown";
      const st = (row as any).status ?? "unknown";
      counts[`enrichment_${es}`] = (counts[`enrichment_${es}`] ?? 0) + 1;
      counts[`status_${st}`] = (counts[`status_${st}`] ?? 0) + 1;
      counts.total = (counts.total ?? 0) + 1;
    }

    return new Response(JSON.stringify({ success: true, pipeline, results, stats: counts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("poi-pipeline error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
