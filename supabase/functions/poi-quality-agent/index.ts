import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
