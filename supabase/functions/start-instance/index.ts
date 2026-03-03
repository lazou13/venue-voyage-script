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

  try {
    const { access_token } = await req.json();

    if (!access_token || typeof access_token !== "string" || !access_token.trim()) {
      return json({ error: "access_token requis" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Fetch instance by token
    const { data: instance, error: fetchErr } = await supabaseAdmin
      .from("quest_instances")
      .select("*")
      .eq("access_token", access_token.trim())
      .maybeSingle();

    if (fetchErr) {
      console.error("DB error fetching instance:", fetchErr);
      return json({ error: "Erreur serveur" }, 500);
    }

    if (!instance) {
      return json({ error: "Token invalide" }, 404);
    }

    // 2. Check status
    if (instance.status === "completed") {
      return json({ error: "Instance déjà terminée" }, 409);
    }

    const now = new Date();

    if (
      instance.status === "expired" ||
      (instance.expires_at && new Date(instance.expires_at) < now)
    ) {
      // Sync status if needed
      if (instance.status !== "expired") {
        await supabaseAdmin
          .from("quest_instances")
          .update({ status: "expired" })
          .eq("id", instance.id);
      }
      return json({ error: "Instance expirée" }, 410);
    }

    // 3. Start if pending
    let currentInstance = instance;

    if (instance.status === "pending") {
      const startsAt = now.toISOString();
      const expiresAt = new Date(
        now.getTime() + instance.ttl_minutes * 60 * 1000
      ).toISOString();

      const { data: updated, error: updateErr } = await supabaseAdmin
        .from("quest_instances")
        .update({ starts_at: startsAt, expires_at: expiresAt, status: "started" })
        .eq("id", instance.id)
        .select("*")
        .single();

      if (updateErr) {
        console.error("Error starting instance:", updateErr);
        return json({ error: "Erreur au démarrage" }, 500);
      }
      currentInstance = updated;
    }

    // 4. Fetch order (for experience_mode)
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("experience_mode, party_size, locale")
      .eq("id", currentInstance.order_id)
      .single();

    // 5. Fetch project
    const { data: project, error: projErr } = await supabaseAdmin
      .from("projects")
      .select("id, title_i18n, quest_config, theme, city")
      .eq("id", currentInstance.project_id)
      .single();

    if (projErr || !project) {
      console.error("Error fetching project:", projErr);
      return json({ error: "Projet introuvable" }, 404);
    }

    // 5. Fetch pois
    const { data: pois, error: poisErr } = await supabaseAdmin
      .from("pois")
      .select("id, sort_order, name, step_config, zone, interaction")
      .eq("project_id", currentInstance.project_id)
      .order("sort_order", { ascending: true });

    if (poisErr) {
      console.error("Error fetching pois:", poisErr);
      return json({ error: "Erreur chargement POIs" }, 500);
    }

    return json(
      {
        instance: {
          id: currentInstance.id,
          status: currentInstance.status,
          starts_at: currentInstance.starts_at,
          expires_at: currentInstance.expires_at,
          ttl_minutes: currentInstance.ttl_minutes,
          score: currentInstance.score,
          experience_mode: order?.experience_mode || 'game',
          party_size: order?.party_size || 2,
          locale: order?.locale || 'fr',
        },
        project,
        pois: pois || [],
      },
      200
    );
  } catch (e) {
    console.error("start-instance error:", e);
    return json({ error: "Erreur inattendue" }, 500);
  }
});
