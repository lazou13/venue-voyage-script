import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Authenticate via X-API-Key header
  const apiKey = req.headers.get("x-api-key");
  const N8N_API_KEY = Deno.env.get("N8N_API_KEY");

  if (!N8N_API_KEY || apiKey !== N8N_API_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "auto-agent";

    if (action === "auto-agent") {
      // Call poi-auto-agent internally
      const baseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      const res = await fetch(`${baseUrl}/functions/v1/poi-auto-agent`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list-library") {
      const { data, error } = await supabase
        .from("quest_library")
        .select("id, title_fr, audience, start_hub, stops_count, quality_score, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, count: data?.length || 0, visits: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "clear-library") {
      const { error } = await supabase.from("quest_library").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, message: "Library cleared" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "stats") {
      const [libRes, poisRes] = await Promise.all([
        supabase.from("quest_library").select("id", { count: "exact", head: true }),
        supabase.from("medina_pois").select("id", { count: "exact", head: true }).eq("is_active", true),
      ]);

      return new Response(JSON.stringify({
        ok: true,
        library_count: libRes.count || 0,
        active_pois: poisRes.count || 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}`, available: ["auto-agent", "list-library", "clear-library", "stats"] }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
