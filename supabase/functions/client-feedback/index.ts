import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

  // Validate access_token
  const accessToken = typeof body.access_token === "string" ? body.access_token.trim() : "";
  if (!accessToken || accessToken.length < 10 || accessToken.length > 200) {
    return json({ error: "access_token requis" }, 400);
  }

  // Resolve instance
  const { data: instance, error: instErr } = await sb
    .from("quest_instances")
    .select("id, project_id, status")
    .eq("access_token", accessToken)
    .single();

  if (instErr || !instance) return json({ error: "Token invalide" }, 401);

  const type = body.type as string;

  // ── PHOTO ──
  if (type === "photo") {
    const base64 = typeof body.data === "string" ? body.data : "";
    const mediaType = typeof body.media_type === "string" ? body.media_type : "photo";
    const poiId = typeof body.poi_id === "string" ? body.poi_id : null;
    const caption = typeof body.caption === "string" ? body.caption.slice(0, 500) : null;
    const lat = typeof body.lat === "number" ? body.lat : null;
    const lng = typeof body.lng === "number" ? body.lng : null;
    const deviceId = typeof body.device_id === "string" ? body.device_id.slice(0, 200) : null;

    if (!base64) return json({ error: "data (base64) requis" }, 400);

    // Decode base64
    let bytes: Uint8Array;
    try {
      // Strip data URI prefix if present
      const raw = base64.includes(",") ? base64.split(",")[1] : base64;
      const binary = atob(raw);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    } catch {
      return json({ error: "base64 invalide" }, 400);
    }

    // Max 10MB
    if (bytes.length > 10 * 1024 * 1024) return json({ error: "Fichier trop volumineux (max 10MB)" }, 400);

    const ext = mediaType === "video" ? "mp4" : "jpg";
    const mime = mediaType === "video" ? "video/mp4" : "image/jpeg";
    const ts = Date.now();
    const path = `${instance.id}/${poiId || "general"}/${ts}.${ext}`;

    const { error: uploadErr } = await sb.storage
      .from("quest-photos")
      .upload(path, bytes, { contentType: mime, upsert: false });

    if (uploadErr) return json({ error: "Upload échoué: " + uploadErr.message }, 500);

    const { error: insertErr } = await sb.from("quest_photos").insert({
      quest_instance_id: instance.id,
      medina_poi_id: poiId,
      storage_path: path,
      media_type: mediaType,
      caption,
      lat,
      lng,
      device_id: deviceId,
    });

    if (insertErr) return json({ error: "Insert échoué: " + insertErr.message }, 500);

    return json({ ok: true, path });
  }

  // ── RECOMMENDATION ──
  if (type === "recommendation") {
    const poiName = typeof body.poi_name === "string" ? body.poi_name.slice(0, 200) : null;
    const comment = typeof body.comment === "string" ? body.comment.slice(0, 1000) : null;
    const rating = typeof body.rating === "number" && body.rating >= 1 && body.rating <= 5 ? body.rating : null;
    const lat = typeof body.lat === "number" ? body.lat : null;
    const lng = typeof body.lng === "number" ? body.lng : null;
    const photoUrl = typeof body.photo_url === "string" ? body.photo_url.slice(0, 500) : null;
    const medinaPoiId = typeof body.medina_poi_id === "string" ? body.medina_poi_id : null;

    if (!poiName && !medinaPoiId) return json({ error: "poi_name ou medina_poi_id requis" }, 400);

    const { error: insertErr } = await sb.from("client_poi_recommendations").insert({
      source_instance_id: instance.id,
      medina_poi_id: medinaPoiId,
      poi_name: poiName,
      comment,
      rating,
      lat,
      lng,
      photo_url: photoUrl,
    });

    if (insertErr) return json({ error: "Insert échoué: " + insertErr.message }, 500);

    return json({ ok: true });
  }

  return json({ error: "type doit être 'photo' ou 'recommendation'" }, 400);
});
