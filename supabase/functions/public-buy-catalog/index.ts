import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS ──
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

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, corsHeaders);
  }

  try {
    const body = await req.json();

    // Honeypot
    if (body.honeypot_website) {
      return json({ error: "Bad request" }, 400, corsHeaders);
    }

    const slug = (body.slug ?? "").trim().slice(0, 60);
    if (!slug) return json({ error: "slug required" }, 400, corsHeaders);

    const customer_email = (body.customer_email ?? "").trim().slice(0, 120);
    const customer_name = ((body.customer_name ?? "").trim() || "Anonyme").slice(0, 80);
    const locale = (body.locale ?? "fr").slice(0, 5);
    const party_size = Math.max(1, Math.min(20, Number(body.party_size) || 2));

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Rate limit: 5/email/hour (skip if no email)
    if (customer_email) {
      const { count, error: rlErr } = await sb
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("customer_email", customer_email)
        .gte("created_at", new Date(Date.now() - 3600_000).toISOString());
      if (rlErr) throw rlErr;
      if ((count ?? 0) >= 5) {
        return json({ error: "Rate limit: max 5 per email per hour" }, 429, corsHeaders);
      }
    }

    // Find public project by slug
    const { data: projects, error: pErr } = await sb
      .from("projects")
      .select("id, quest_config, title_i18n")
      .limit(100);
    if (pErr) throw pErr;

    const project = (projects ?? []).find((p: any) => {
      const cat = p.quest_config?.catalog;
      return cat?.is_public === true && cat?.slug === slug;
    });

    if (!project) {
      return json({ error: "Experience not found" }, 404, corsHeaders);
    }

    const catalog = (project as any).quest_config.catalog;
    // Source of truth for mode is quest_config.experience_mode
    const experience_mode = (project as any).quest_config.experience_mode || catalog.mode || "visit";
    const price = catalog.price ?? 0;
    const currency = catalog.currency ?? "MAD";

    // Create order
    const { data: order, error: oErr } = await sb
      .from("orders")
      .insert({
        project_id: project.id,
        customer_name,
        customer_email: customer_email || null,
        experience_mode,
        party_size,
        locale,
        status: "pending",
        payment_status: "stub",
        amount_total: price,
        currency,
      })
      .select("id")
      .single();
    if (oErr) throw oErr;

    // Create quest instance
    const { data: instance, error: iErr } = await sb
      .from("quest_instances")
      .insert({
        order_id: order.id,
        project_id: project.id,
        ttl_minutes: 240,
      })
      .select("id, access_token")
      .single();
    if (iErr) throw iErr;

    return json(
      {
        order_id: order.id,
        instance_id: instance.id,
        access_token: instance.access_token,
        project_id: project.id,
        price: catalog.price ?? 0,
        currency: catalog.currency ?? "MAD",
      },
      200,
      corsHeaders,
    );
  } catch (e: any) {
    console.error("public-buy-catalog error:", e);
    return json({ error: "Internal error" }, 500, corsHeaders);
  }
});
