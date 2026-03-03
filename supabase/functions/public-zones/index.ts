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

// ── In-memory rate limit (60 req/IP/hour) ──
const ipHits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 3600_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || now > entry.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

function json(body: unknown, status: number, corsH: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsH,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
    },
  });
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limit by IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") || "unknown";
  if (!checkRateLimit(ip)) {
    return json({ error: "Too many requests" }, 429, corsHeaders);
  }

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") || "zones";

    if (mode === "categories") {
      const zone = (url.searchParams.get("zone") ?? "").trim().slice(0, 80);
      if (!zone) return json({ error: "zone parameter required" }, 400, corsHeaders);

      const { data, error } = await sb
        .from("medina_pois")
        .select("category")
        .eq("zone", zone)
        .eq("is_active", true);
      if (error) throw error;
      const categories = [...new Set((data ?? []).map((r: any) => r.category))].sort();
      return json({ categories }, 200, corsHeaders);
    }

    // Default: mode=zones
    const { data, error } = await sb
      .from("medina_pois")
      .select("zone")
      .eq("is_active", true);
    if (error) throw error;
    const zones = [...new Set((data ?? []).map((r: any) => r.zone))].filter(Boolean).sort();
    return json({ zones }, 200, corsHeaders);
  } catch (e: any) {
    return json({ error: "Internal error" }, 500, corsHeaders);
  }
});
