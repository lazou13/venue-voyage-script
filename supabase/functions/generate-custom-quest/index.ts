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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // ── 1. Authenticate caller & verify admin ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userErr,
    } = await admin.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2. Parse input ──
    const body = await req.json();
    const {
      customer_name,
      customer_email,
      experience_mode = "visit",
      duration_minutes = 60,
      ttl_minutes = 240,
      medina_poi_ids = [],
    } = body as {
      customer_name: string;
      customer_email?: string;
      experience_mode: string;
      duration_minutes: number;
      ttl_minutes: number;
      medina_poi_ids: string[];
    };

    if (!customer_name || medina_poi_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "customer_name and medina_poi_ids required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 3. Create project ──
    const { data: project, error: projErr } = await admin
      .from("projects")
      .insert({
        hotel_name: `Sur-mesure ${customer_name}`,
        city: "Médina",
        quest_config: { experience_mode, project_type: "medina_custom" },
        target_duration_mins: duration_minutes,
        title_i18n: { fr: `Parcours sur-mesure — ${customer_name}` },
      })
      .select("id")
      .single();
    if (projErr || !project) throw projErr ?? new Error("Project creation failed");

    // ── 4. Fetch medina POIs ──
    const { data: medinaPois, error: mpErr } = await admin
      .from("medina_pois")
      .select("*")
      .in("id", medina_poi_ids);
    if (mpErr) throw mpErr;

    // Build id->poi map preserving requested order
    const poiMap = new Map((medinaPois ?? []).map((p: any) => [p.id, p]));

    // ── 5. Fetch all media for these medina POIs in 1 query ──
    const { data: allMedia } = await admin
      .from("poi_media")
      .select("id, medina_poi_id, media_type, is_cover")
      .in("medina_poi_id", medina_poi_ids);

    // Group media by medina_poi_id
    const mediaByPoi = new Map<string, any[]>();
    for (const m of allMedia ?? []) {
      const list = mediaByPoi.get(m.medina_poi_id) ?? [];
      list.push(m);
      mediaByPoi.set(m.medina_poi_id, list);
    }

    // ── 6. Build POI rows for bulk insert ──
    const poiRows = medina_poi_ids
      .map((mpId: string, idx: number) => {
        const mpoi = poiMap.get(mpId);
        if (!mpoi) return null;

        const baseConfig = (mpoi.step_config ?? {}) as Record<string, unknown>;
        const stepConfig: Record<string, unknown> = {
          ...baseConfig,
          geo: {
            lat: mpoi.lat,
            lng: mpoi.lng,
            radius_m: mpoi.radius_m,
            zone: mpoi.zone,
            category: mpoi.category,
          },
        };

        // Attach media refs
        const mediaRows = mediaByPoi.get(mpId);
        if (mediaRows && mediaRows.length > 0) {
          const mediaRef: Record<string, unknown> = {
            photoIds: [] as string[],
            audioIds: [] as string[],
            videoIds: [] as string[],
          };
          for (const row of mediaRows) {
            if (row.media_type === "photo") (mediaRef.photoIds as string[]).push(row.id);
            else if (row.media_type === "audio") (mediaRef.audioIds as string[]).push(row.id);
            else if (row.media_type === "video") (mediaRef.videoIds as string[]).push(row.id);
            if (row.is_cover && row.media_type === "photo") mediaRef.coverPhotoId = row.id;
          }
          stepConfig.media = mediaRef;
        }

        return {
          project_id: project.id,
          name: mpoi.name,
          zone: mpoi.zone || "",
          interaction: "puzzle",
          risk: "low",
          minutes_from_prev: 5,
          sort_order: idx,
          step_config: stepConfig,
          library_poi_id: mpId,
        };
      })
      .filter(Boolean);

    // Bulk insert POIs
    if (poiRows.length > 0) {
      const { error: poisErr } = await admin.from("pois").insert(poiRows);
      if (poisErr) throw poisErr;
    }

    // ── 7. Create order ──
    const { data: order, error: ordErr } = await admin
      .from("orders")
      .insert({
        project_id: project.id,
        customer_name,
        customer_email: customer_email || null,
        experience_mode,
        locale: "fr",
        party_size: 2,
      })
      .select("id")
      .single();
    if (ordErr || !order) throw ordErr ?? new Error("Order creation failed");

    // ── 8. Create quest instance ──
    const { data: instance, error: instErr } = await admin
      .from("quest_instances")
      .insert({
        order_id: order.id,
        project_id: project.id,
        ttl_minutes,
      })
      .select("id, access_token")
      .single();
    if (instErr || !instance) throw instErr ?? new Error("Instance creation failed");

    return new Response(
      JSON.stringify({
        project_id: project.id,
        order_id: order.id,
        instance_id: instance.id,
        access_token: instance.access_token,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("generate-custom-quest error:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
