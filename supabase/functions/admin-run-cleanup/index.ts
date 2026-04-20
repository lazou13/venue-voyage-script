import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabaseUser.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);

    const userId = claimsData.claims.sub;
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Forbidden: admin role required" }, 403);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const action = (body.action as string) ?? "all";
    const logs: string[] = [];
    const results: Record<string, unknown> = {};

    const runOne = async (rpcName: string, label: string) => {
      logs.push(`▶ ${label}…`);
      const { data, error } = await supabaseAdmin.rpc(rpcName as any);
      if (error) {
        logs.push(`❌ ${label}: ${error.message}`);
        results[rpcName] = { error: error.message };
        return;
      }
      results[rpcName] = data;
      logs.push(`✅ ${label}: ${JSON.stringify(data)}`);
    };

    if (action === "clean" || action === "all") {
      await runOne("clean_low_quality_pois", "Nettoyage POIs faible qualité");
    }
    if (action === "merge" || action === "all") {
      await runOne("merge_duplicate_pois", "Fusion doublons POIs");
    }
    if (action === "expired") {
      await runOne("cleanup_expired_data", "Suppression données expirées");
    }

    if (Object.keys(results).length === 0) {
      return json({ error: `Unknown action: ${action}. Use clean, merge, all, expired.` }, 400);
    }

    return json({ ok: true, action, logs, results }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("admin-run-cleanup error:", e);
    return json({ error: msg }, 500);
  }
});
