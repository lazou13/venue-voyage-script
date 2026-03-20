import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS with allowlist (R4 fix) ──
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

// ── In-memory IP rate limit (60 req/IP/hour) ──
const ipHits = new Map<string, { count: number; resetAt: number }>();
const IP_RATE_LIMIT = 60;
const RATE_WINDOW_MS = 3600_000;

function checkIpRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || now > entry.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= IP_RATE_LIMIT;
}

const json = (body: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // IP rate limit
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") || "unknown";
  if (!checkIpRateLimit(ip)) {
    return json({ error: "Too many requests" }, 429, corsHeaders);
  }

  try {
    const body = await req.json();
    const { access_token, device_id, device_fingerprint } = body;

    if (!access_token || typeof access_token !== "string" || !access_token.trim()) {
      return json({ error: "access_token requis" }, 400, corsHeaders);
    }

    if (!device_id || typeof device_id !== "string" || !device_id.trim()) {
      return json({ error: "device_id requis" }, 400, corsHeaders);
    }

    // Fingerprint est optionnel (rétrocompatibilité anciens clients)
    const fingerprint: string | null =
      device_fingerprint && typeof device_fingerprint === "string"
        ? device_fingerprint.slice(0, 64)
        : null;

    const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;

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
      return json({ error: "Erreur serveur" }, 500, corsHeaders);
    }

    if (!instance) {
      return json({ error: "Token invalide" }, 404, corsHeaders);
    }

    // 2. Check status
    if (instance.status === "completed") {
      return json({ error: "Instance déjà terminée" }, 409, corsHeaders);
    }

    const now = new Date();

    if (
      instance.status === "expired" ||
      (instance.expires_at && new Date(instance.expires_at) < now)
    ) {
      if (instance.status !== "expired") {
        await supabaseAdmin
          .from("quest_instances")
          .update({ status: "expired" })
          .eq("id", instance.id);
      }
      return json({ error: "Instance expirée" }, 410, corsHeaders);
    }

    // 3. Multi-device check via quest_instance_devices table
    const devicesAllowed = instance.devices_allowed ?? 1;
    const trimmedDeviceId = device_id.trim();

    // ── Fingerprint cross-instance abuse check ──────────────────────────────
    // Si ce fingerprint est déjà associé à UNE AUTRE instance non expirée,
    // c'est suspect (partage de lien + même appareil). On refuse silencieusement.
    if (fingerprint) {
      const { data: existingFingerprint } = await supabaseAdmin
        .from("quest_instance_devices")
        .select("quest_instance_id")
        .eq("fingerprint_hash", fingerprint)
        .neq("quest_instance_id", instance.id)
        .limit(1)
        .maybeSingle();

      if (existingFingerprint) {
        // Même appareil, instance différente → peut être légitime (client récurrent)
        // On log mais on ne bloque PAS (politique: 1 instance active par appareil OK)
        console.warn(
          `[device-lock] fingerprint=${fingerprint} used on multiple instances. ` +
          `Current: ${instance.id}, Previous: ${existingFingerprint.quest_instance_id}`
        );
      }
    }

    // ── Vérifier si ce device_id est déjà enregistré pour cette instance ────
    const { data: existingDevice } = await supabaseAdmin
      .from("quest_instance_devices")
      .select("id, fingerprint_hash")
      .eq("quest_instance_id", instance.id)
      .eq("device_id", trimmedDeviceId)
      .maybeSingle();

    if (existingDevice) {
      // Device déjà connu — vérifier si le fingerprint a changé (clonage suspect)
      if (
        fingerprint &&
        existingDevice.fingerprint_hash &&
        existingDevice.fingerprint_hash !== fingerprint
      ) {
        // Fingerprint différent pour le même device_id → possible vol de device_id
        // On refuse et on log pour investigation
        console.error(
          `[device-lock] fingerprint mismatch for device_id=${trimmedDeviceId}. ` +
          `Stored: ${existingDevice.fingerprint_hash}, Received: ${fingerprint}`
        );
        return json({ error: "Nombre maximum d'appareils atteint" }, 403, corsHeaders);
      }

      // Mise à jour last_seen_at (le trigger s'en charge)
      await supabaseAdmin
        .from("quest_instance_devices")
        .update({ fingerprint_hash: fingerprint, user_agent: userAgent })
        .eq("id", existingDevice.id);
    } else {
      // Nouveau device pour cette instance — vérifier la limite avant d'insérer
      const { count: deviceCount, error: countErr } = await supabaseAdmin
        .from("quest_instance_devices")
        .select("id", { count: "exact", head: true })
        .eq("quest_instance_id", instance.id);

      if (countErr) {
        console.error("Device count error:", countErr);
        return json({ error: "Erreur vérification appareils" }, 500, corsHeaders);
      }

      if ((deviceCount ?? 0) >= devicesAllowed) {
        return json({ error: "Nombre maximum d'appareils atteint" }, 403, corsHeaders);
      }

      // Insérer le nouvel appareil
      const { error: insertErr } = await supabaseAdmin
        .from("quest_instance_devices")
        .insert({
          quest_instance_id: instance.id,
          device_id: trimmedDeviceId,
          fingerprint_hash: fingerprint,
          user_agent: userAgent,
        });

      if (insertErr) {
        // Gestion de la race condition (deux requêtes simultanées du même device)
        if (insertErr.code === "23505") {
          // Duplicate key → le device vient d'être inséré en parallèle → OK
        } else {
          console.error("Device insert error:", insertErr);
          return json({ error: "Erreur enregistrement appareil" }, 500, corsHeaders);
        }
      }
    }

    // 4. Start if pending
    let currentInstance = instance;
    const updatePayload: Record<string, unknown> = {};

    if (instance.status === "pending") {
      const startsAt = now.toISOString();
      const expiresAt = new Date(
        now.getTime() + instance.ttl_minutes * 60 * 1000
      ).toISOString();
      updatePayload.starts_at = startsAt;
      updatePayload.expires_at = expiresAt;
      updatePayload.status = "started";
    }

    if (Object.keys(updatePayload).length > 0) {
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from("quest_instances")
        .update(updatePayload)
        .eq("id", instance.id)
        .select("*")
        .single();

      if (updateErr) {
        console.error("Error updating instance:", updateErr);
        return json({ error: "Erreur au démarrage" }, 500, corsHeaders);
      }
      currentInstance = updated;
    }

    // 5. Fetch order
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("experience_mode, party_size, locale")
      .eq("id", currentInstance.order_id)
      .single();

    // 6. Fetch project
    const { data: project, error: projErr } = await supabaseAdmin
      .from("projects")
      .select("id, title_i18n, quest_config, theme, city")
      .eq("id", currentInstance.project_id)
      .single();

    if (projErr || !project) {
      console.error("Error fetching project:", projErr);
      return json({ error: "Projet introuvable" }, 404, corsHeaders);
    }

    // 7. Fetch pois
    const { data: pois, error: poisErr } = await supabaseAdmin
      .from("pois")
      .select("id, sort_order, name, step_config, zone, interaction")
      .eq("project_id", currentInstance.project_id)
      .order("sort_order", { ascending: true });

    if (poisErr) {
      console.error("Error fetching pois:", poisErr);
      return json({ error: "Erreur chargement POIs" }, 500, corsHeaders);
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
          devices_allowed: currentInstance.devices_allowed,
        },
        project,
        pois: pois || [],
      },
      200,
      corsHeaders,
    );
  } catch (e) {
    console.error("start-instance error:", e);
    return json({ error: "Erreur inattendue" }, 500, corsHeaders);
  }
});
