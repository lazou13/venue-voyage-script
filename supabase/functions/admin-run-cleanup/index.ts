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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    // Verify admin role via Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Verify user via anon client with their token
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabaseUser.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userId = claimsData.claims.sub;

    // Check admin role
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (!isAdmin) {
      return json({ error: "Forbidden: admin role required" }, 403);
    }

    // Run cleanup via RPC
    const { data: result, error: rpcErr } = await supabaseAdmin.rpc("cleanup_expired_data");

    if (rpcErr) {
      console.error("Cleanup RPC error:", rpcErr);
      return json({ error: "Cleanup failed" }, 500);
    }

    return json({ ok: true, result }, 200);
  } catch (e: any) {
    console.error("admin-run-cleanup error:", e);
    return json({ error: "Internal error" }, 500);
  }
});
