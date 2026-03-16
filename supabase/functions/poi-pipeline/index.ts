import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    if (step === "all" || step === "extract") {
      pipeline.push("extract");
      results.extract = await callFunction("poi-extract", { limit, with_details: true });
    }

    if (step === "all" || step === "enrich") {
      pipeline.push("enrich");
      // Run enrichment in batches until no more raw POIs
      let totalEnriched = 0;
      let iteration = 0;
      const enrichLogs: string[] = [];
      
      while (iteration < 100) { // safety max
        const res = await callFunction("poi-enrich", { batch_size: batchSize, status: "raw" });
        if (res.enriched === 0) break;
        totalEnriched += res.enriched ?? 0;
        enrichLogs.push(...(res.logs ?? []));
        iteration++;
      }
      results.enrich = { enriched: totalEnriched, iterations: iteration, logs: enrichLogs };
    }

    if (step === "all" || step === "proximity") {
      pipeline.push("proximity");
      results.proximity = await callFunction("poi-proximity", {});
    }

    return new Response(JSON.stringify({ success: true, pipeline, results }), {
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
