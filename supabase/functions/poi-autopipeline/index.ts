import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_RUNTIME_MS = 100_000; // 100s safety (edge fn limit ~150s)

// Geo-fence: Marrakech medina bounding box
const GEO_FILTER = {
  lat_min: 31.60, lat_max: 31.67,
  lng_min: -8.02, lng_max: -7.97,
};

async function callWorker(fnName: string): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `${fnName} HTTP ${res.status}: ${text.substring(0, 200)}` };
    }
    const data = await res.json();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: `${fnName}: ${e instanceof Error ? e.message : String(e)}` };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const logs: string[] = [];
  const results: Record<string, any> = {};

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Count what needs processing (geo-fenced to medina)
    const baseQuery = () => supabase
      .from("medina_pois")
      .select("*", { count: "exact", head: true })
      .neq("status", "filtered")
      .neq("status", "merged")
      .gte("lat", GEO_FILTER.lat_min)
      .lte("lat", GEO_FILTER.lat_max)
      .gte("lng", GEO_FILTER.lng_min)
      .lte("lng", GEO_FILTER.lng_max);

    // PHASE 1: Classification
    const { count: unclassified } = await baseQuery().is("category_ai", null);
    logs.push(`📊 Non classifiés: ${unclassified ?? 0}`);

    if ((unclassified ?? 0) > 0) {
      logs.push("🏷️ Lancement classification...");
      const r = await callWorker("poi-classify-worker");
      results.classify = r.data ?? r.error;
      if (r.ok) {
        logs.push(`✅ Classification: ${r.data?.classified ?? 0} classifiés, ${r.data?.errors ?? 0} erreurs`);
      } else {
        logs.push(`❌ Classification: ${r.error}`);
      }

      // If still within time and there's more to classify, stop here and let next cron pick up
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        logs.push("⏱ Timeout après classification");
        return respond(logs, results, startTime);
      }
    }

    // PHASE 2: Enrichissement
    const { count: rawCount } = await baseQuery().eq("enrichment_status", "raw");
    logs.push(`📊 Non enrichis (raw): ${rawCount ?? 0}`);

    if ((rawCount ?? 0) > 0) {
      logs.push("🧠 Lancement enrichissement...");
      const r = await callWorker("poi-worker");
      results.enrich = r.data ?? r.error;
      if (r.ok) {
        logs.push(`✅ Enrichissement: ${r.data?.processed ?? 0} enrichis, ${r.data?.errors ?? 0} erreurs, ${r.data?.remaining ?? "?"} restants`);
      } else {
        logs.push(`❌ Enrichissement: ${r.error}`);
      }

      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        logs.push("⏱ Timeout après enrichissement");
        return respond(logs, results, startTime);
      }
    }

    // PHASE 3: Nettoyage (SQL function)
    if ((unclassified ?? 0) === 0 && (rawCount ?? 0) === 0) {
      logs.push("🧹 Lancement nettoyage...");
      const { data: cleanResult, error: cleanErr } = await supabase.rpc("clean_low_quality_pois");
      if (cleanErr) {
        logs.push(`❌ Nettoyage: ${cleanErr.message}`);
      } else {
        results.clean = cleanResult;
        logs.push(`✅ Nettoyage: ${(cleanResult as any)?.filtered ?? 0} filtrés`);
      }

      // PHASE 4: Fusion doublons
      logs.push("🔀 Lancement fusion doublons...");
      const { data: mergeResult, error: mergeErr } = await supabase.rpc("merge_duplicate_pois");
      if (mergeErr) {
        logs.push(`❌ Fusion: ${mergeErr.message}`);
      } else {
        results.merge = mergeResult;
        logs.push(`✅ Fusion: ${(mergeResult as any)?.merged ?? 0} fusionnés`);
      }

      // PHASE 5: Proximité
      const { count: noProximity } = await baseQuery().is("nearby_pois_data", null);
      logs.push(`📊 Sans proximité: ${noProximity ?? 0}`);

      if ((noProximity ?? 0) > 0) {
        logs.push("📍 Lancement calcul proximité...");
        const r = await callWorker("poi-proximity");
        results.proximity = r.data ?? r.error;
        if (r.ok) {
          logs.push(`✅ Proximité: ${r.data?.updated ?? 0} mis à jour`);
        } else {
          logs.push(`❌ Proximité: ${r.error}`);
        }
      }
    }

    // Final stats
    const { count: totalActive } = await baseQuery();
    const { count: finalClassified } = await baseQuery().not("category_ai", "is", null);
    const { count: finalEnriched } = await baseQuery().eq("enrichment_status", "enriched");
    const { count: finalProximity } = await baseQuery().not("nearby_pois_data", "is", null);

    const finalStats = {
      active: totalActive ?? 0,
      classified: finalClassified ?? 0,
      enriched: finalEnriched ?? 0,
      with_proximity: finalProximity ?? 0,
      pipeline_complete: (totalActive ?? 0) > 0 &&
        totalActive === finalClassified &&
        totalActive === finalEnriched &&
        totalActive === finalProximity,
    };

    results.final_stats = finalStats;
    logs.push(`--- PIPELINE: ${finalStats.classified}/${finalStats.active} classifiés, ${finalStats.enriched}/${finalStats.active} enrichis, ${finalStats.with_proximity}/${finalStats.active} proximité ---`);

    if (finalStats.pipeline_complete) {
      logs.push("🎉 PIPELINE 100% COMPLET — tous les POI sont traités !");
    }

    return respond(logs, results, startTime);
  } catch (e) {
    console.error("poi-autopipeline error:", e);
    logs.push(`❌ Fatal: ${e instanceof Error ? e.message : String(e)}`);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", logs }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function respond(logs: string[], results: Record<string, any>, startTime: number) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  logs.push(`⏱ Durée totale: ${elapsed}s`);
  return new Response(JSON.stringify({
    success: true,
    elapsed_seconds: parseFloat(elapsed),
    results,
    logs,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
