import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-feedback-key",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface AuthContext {
  instanceId: string | null;
  projectId: string | null;
  sourceProject: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // ── AUTH: dual mode ──
  let auth: AuthContext;

  const feedbackKey = req.headers.get("x-feedback-key");
  const sourceProject = typeof body.source_project === "string" ? body.source_project.trim() : "";

  if (feedbackKey) {
    // External mode: validate shared secret
    const expectedKey = Deno.env.get("EXTERNAL_FEEDBACK_KEY");
    if (!expectedKey || feedbackKey !== expectedKey) {
      return json({ error: "Clé API invalide" }, 401);
    }
    if (!sourceProject) {
      return json({ error: "source_project requis en mode externe" }, 400);
    }
    if (sourceProject.length > 100) {
      return json({ error: "source_project trop long" }, 400);
    }
    auth = { instanceId: null, projectId: null, sourceProject };
  } else {
    // Internal mode: resolve via access_token
    const accessToken = typeof body.access_token === "string" ? body.access_token.trim() : "";
    if (!accessToken || accessToken.length < 10 || accessToken.length > 200) {
      return json({ error: "access_token requis" }, 400);
    }

    const { data: instance, error: instErr } = await sb
      .from("quest_instances")
      .select("id, project_id, status")
      .eq("access_token", accessToken)
      .single();

    if (instErr || !instance) return json({ error: "Token invalide" }, 401);
    auth = { instanceId: instance.id, projectId: instance.project_id, sourceProject: sourceProject || null };
  }

  const type = body.type as string;

  // ── PHOTO ──
  if (type === "photo") {
    const base64 = typeof body.data === "string" ? body.data : "";
    const mediaUrl = typeof body.media_url === "string" ? body.media_url.trim() : "";
    const mediaType = typeof body.media_type === "string" ? body.media_type : "photo";
    const poiId = typeof body.poi_id === "string" ? body.poi_id : null;
    const poiName = typeof body.poi_name === "string" ? body.poi_name.slice(0, 200) : null;
    const caption = typeof body.caption === "string" ? body.caption.slice(0, 500) : null;
    const lat = typeof body.lat === "number" ? body.lat : (typeof body.poi_lat === "number" ? body.poi_lat : null);
    const lng = typeof body.lng === "number" ? body.lng : (typeof body.poi_lng === "number" ? body.poi_lng : null);
    const deviceId = typeof body.device_id === "string" ? body.device_id.slice(0, 200) : null;
    const sourceInstanceId = typeof body.source_instance_id === "string" ? body.source_instance_id.slice(0, 200) : null;

    let bytes: Uint8Array;

    if (base64) {
      // Decode base64
      try {
        const raw = base64.includes(",") ? base64.split(",")[1] : base64;
        const binary = atob(raw);
        bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      } catch {
        return json({ error: "base64 invalide" }, 400);
      }
    } else if (mediaUrl) {
      // External mode: fetch image from URL
      try {
        const resp = await fetch(mediaUrl, { signal: AbortSignal.timeout(15000) });
        if (!resp.ok) return json({ error: `Échec téléchargement media: ${resp.status}` }, 400);
        bytes = new Uint8Array(await resp.arrayBuffer());
      } catch (e) {
        return json({ error: `Erreur fetch media_url: ${(e as Error).message}` }, 400);
      }
    } else {
      return json({ error: "data (base64) ou media_url requis" }, 400);
    }

    if (bytes.length > 10 * 1024 * 1024) return json({ error: "Fichier trop volumineux (max 10MB)" }, 400);

    const ext = mediaType === "video" ? "mp4" : "jpg";
    const mime = mediaType === "video" ? "video/mp4" : "image/jpeg";
    const ts = Date.now();
    const folder = auth.instanceId || auth.sourceProject || "external";
    const path = `${folder}/${poiId || "general"}/${ts}.${ext}`;

    const { error: uploadErr } = await sb.storage
      .from("quest-photos")
      .upload(path, bytes, { contentType: mime, upsert: false });

    if (uploadErr) return json({ error: "Upload échoué: " + uploadErr.message }, 500);

    const { error: insertErr } = await sb.from("quest_photos").insert({
      quest_instance_id: auth.instanceId,
      medina_poi_id: poiId,
      storage_path: path,
      media_type: mediaType,
      caption: caption || poiName,
      lat,
      lng,
      device_id: deviceId,
      source_project: auth.sourceProject,
      source_instance_id: sourceInstanceId,
    });

    if (insertErr) return json({ error: "Insert échoué: " + insertErr.message }, 500);

    return json({ ok: true, path });
  }

  // ── RECOMMENDATION ──
  if (type === "recommendation") {
    const poiName = typeof body.poi_name === "string" ? body.poi_name.slice(0, 200) : null;
    const comment = typeof body.comment === "string" ? body.comment.slice(0, 1000) : null;
    const rating = typeof body.rating === "number" && body.rating >= 1 && body.rating <= 5 ? body.rating : null;
    const lat = typeof body.lat === "number" ? body.lat : (typeof body.poi_lat === "number" ? body.poi_lat : null);
    const lng = typeof body.lng === "number" ? body.lng : (typeof body.poi_lng === "number" ? body.poi_lng : null);
    const photoUrl = typeof body.photo_url === "string" ? body.photo_url.slice(0, 500) : null;
    const medinaPoiId = typeof body.medina_poi_id === "string" ? body.medina_poi_id : null;

    if (!poiName && !medinaPoiId) return json({ error: "poi_name ou medina_poi_id requis" }, 400);

    const { error: insertErr } = await sb.from("client_poi_recommendations").insert({
      source_instance_id: auth.instanceId,
      medina_poi_id: medinaPoiId,
      poi_name: poiName,
      comment,
      rating,
      lat,
      lng,
      photo_url: photoUrl,
      source_project: auth.sourceProject,
    });

    if (insertErr) return json({ error: "Insert échoué: " + insertErr.message }, 500);

    return json({ ok: true });
  }

  return json({ error: "type doit être 'photo' ou 'recommendation'" }, 400);
});
