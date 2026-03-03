import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const zone = url.searchParams.get("zone");

    if (zone) {
      // Return distinct categories for a zone
      const { data, error } = await sb
        .from("medina_pois")
        .select("category")
        .eq("zone", zone)
        .eq("is_active", true);
      if (error) throw error;
      const cats = [...new Set((data ?? []).map((r: any) => r.category))].sort();
      return new Response(JSON.stringify({ categories: cats }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return distinct zones
    const { data, error } = await sb
      .from("medina_pois")
      .select("zone")
      .eq("is_active", true);
    if (error) throw error;
    const zones = [...new Set((data ?? []).map((r: any) => r.zone))].filter(Boolean).sort();
    return new Response(JSON.stringify({ zones }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
