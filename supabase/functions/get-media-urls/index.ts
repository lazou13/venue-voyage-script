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

const MAX_MEDIA_IDS = 20;
const SIGNED_URL_EXPIRY = 900; // 15 min

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { access_token, media_ids } = await req.json();

    // Validate inputs
    if (!access_token || typeof access_token !== "string" || !access_token.trim()) {
      return json({ error: "access_token requis" }, 400);
    }
    if (!Array.isArray(media_ids) || media_ids.length === 0) {
      return json({ error: "media_ids requis (array non vide)" }, 400);
    }
    if (media_ids.length > MAX_MEDIA_IDS) {
      return json({ error: `Maximum ${MAX_MEDIA_IDS} media_ids par requête` }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Validate access_token → get instance
    const { data: instance, error: instErr } = await supabaseAdmin
      .from("quest_instances")
      .select("id, project_id, status, expires_at")
      .eq("access_token", access_token.trim())
      .maybeSingle();

    if (instErr) {
      console.error("DB error:", instErr);
      return json({ error: "Erreur serveur" }, 500);
    }
    if (!instance) {
      return json({ error: "Token invalide" }, 404);
    }

    // 2. Build allowlist from project POIs' step_config.media
    const { data: pois, error: poisErr } = await supabaseAdmin
      .from("pois")
      .select("step_config")
      .eq("project_id", instance.project_id);

    if (poisErr) {
      console.error("Error fetching pois:", poisErr);
      return json({ error: "Erreur serveur" }, 500);
    }

    const allowedIds = new Set<string>();
    for (const poi of pois || []) {
      const media = (poi.step_config as Record<string, unknown>)?.media as
        | Record<string, unknown>
        | undefined;
      if (!media) continue;
      if (typeof media.coverPhotoId === "string") allowedIds.add(media.coverPhotoId);
      for (const key of ["photoIds", "audioIds", "videoIds"]) {
        const arr = media[key];
        if (Array.isArray(arr)) {
          for (const id of arr) {
            if (typeof id === "string") allowedIds.add(id);
          }
        }
      }
    }

    // 3. Check all requested ids are allowed
    const forbidden = media_ids.filter((id: string) => !allowedIds.has(id));
    if (forbidden.length > 0) {
      return json({ error: "Media non autorisé", forbidden }, 403);
    }

    // 4. Fetch storage paths from poi_media
    const { data: mediaRows, error: mediaErr } = await supabaseAdmin
      .from("poi_media")
      .select("id, storage_path")
      .in("id", media_ids);

    if (mediaErr) {
      console.error("Error fetching poi_media:", mediaErr);
      return json({ error: "Erreur serveur" }, 500);
    }

    // 5. Generate signed URLs
    const urls: Record<string, string> = {};
    for (const row of mediaRows || []) {
      const { data: signed, error: signErr } = await supabaseAdmin.storage
        .from("poi-media")
        .createSignedUrl(row.storage_path, SIGNED_URL_EXPIRY);

      if (signErr) {
        console.error(`Sign error for ${row.id}:`, signErr);
        continue;
      }
      if (signed?.signedUrl) {
        urls[row.id] = signed.signedUrl;
      }
    }

    return json({ urls, expires_in: SIGNED_URL_EXPIRY }, 200);
  } catch (e) {
    console.error("get-media-urls error:", e);
    return json({ error: "Erreur inattendue" }, 500);
  }
});
