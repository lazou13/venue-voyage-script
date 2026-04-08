import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
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

  const questCode = typeof body.quest_code === "string" ? body.quest_code.slice(0, 50) : null;
  const playerEmail = typeof body.player_email === "string" ? body.player_email.slice(0, 200) : null;
  const poiId = typeof body.poi_id === "string" ? body.poi_id.trim() : null;
  const poiName = typeof body.poi_name === "string" ? body.poi_name.slice(0, 200) : null;
  const lat = typeof body.lat === "number" ? body.lat : null;
  const lng = typeof body.lng === "number" ? body.lng : null;
  const comment = typeof body.comment === "string" ? body.comment.slice(0, 1000) : "";
  const rating = typeof body.rating === "number" && body.rating >= 1 && body.rating <= 5 ? body.rating : null;
  const photoBase64 = typeof body.photo_base64 === "string" ? body.photo_base64 : "";
  const categorySuggestion = typeof body.category_suggestion === "string" ? body.category_suggestion.slice(0, 100) : null;

  if (!poiId && !poiName) return json({ error: "poi_id ou poi_name requis" }, 400);
  if (!comment) return json({ error: "comment requis" }, 400);

  // 1. Upload photo if present
  let photoUrl: string | null = null;
  if (photoBase64) {
    try {
      const raw = photoBase64.includes(",") ? photoBase64.split(",")[1] : photoBase64;
      const binary = atob(raw);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      if (bytes.length > 10 * 1024 * 1024) {
        return json({ error: "Photo trop volumineuse (max 10MB)" }, 400);
      }

      const ts = Date.now();
      const rand = Math.random().toString(36).slice(2, 6);
      const path = `recommendations/${ts}_${rand}.jpg`;

      const { error: uploadErr } = await sb.storage
        .from("client-media")
        .upload(path, bytes, { contentType: "image/jpeg", upsert: false });

      if (uploadErr) {
        console.error("Photo upload failed (non-blocking):", uploadErr.message);
      } else {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        photoUrl = `${supabaseUrl}/storage/v1/object/authenticated/client-media/${path}`;
      }
    } catch (e) {
      console.error("Photo decode failed (non-blocking):", (e as Error).message);
    }
  }

  // 2. Insert into client_recommendations
  const { error: insertErr } = await sb.from("client_recommendations").insert({
    poi_id: poiId,
    quest_code: questCode,
    player_email: playerEmail,
    poi_name: poiName || "Lieu inconnu",
    lat,
    lng,
    comment,
    rating,
    photo_url: photoUrl,
    category_suggestion: categorySuggestion,
    status: "pending",
  });

  if (insertErr) {
    console.error("Insert client_recommendations failed:", insertErr.message);
    return json({ error: "Insert échoué: " + insertErr.message }, 500);
  }

  // 3. Webhook n8n if high-quality recommendation
  if (rating && rating >= 4 && comment.length > 30) {
    try {
      const webhookUrl = Deno.env.get("N8N_WEBHOOK_URL");
      if (webhookUrl) {
        await fetch(webhookUrl + "/recommendation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            poi_name: poiName || poiId,
            comment,
            rating,
            quest_code: questCode,
          }),
          signal: AbortSignal.timeout(5000),
        }).catch((e) => console.error("n8n webhook failed (non-blocking):", e.message));
      }
    } catch (e) {
      console.error("n8n webhook error (non-blocking):", (e as Error).message);
    }
  }

  return json({ success: true, message: "Merci pour votre recommandation !" });
});
