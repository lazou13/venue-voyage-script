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

  const poiId = typeof body.poi_id === "string" ? body.poi_id.trim() : "";
  const questCode = typeof body.quest_code === "string" ? body.quest_code.slice(0, 50) : null;
  const photoBase64 = typeof body.photo_base64 === "string" ? body.photo_base64 : "";
  const photoType = typeof body.photo_type === "string" ? body.photo_type : "visit";
  const playerEmail = typeof body.player_email === "string" ? body.player_email.slice(0, 200) : null;
  const lat = typeof body.lat === "number" ? body.lat : null;
  const lng = typeof body.lng === "number" ? body.lng : null;

  if (!poiId) return json({ error: "poi_id requis" }, 400);
  if (!photoBase64) return json({ error: "photo_base64 requis" }, 400);

  // 1. Validate POI exists
  const { data: poi, error: poiErr } = await sb
    .from("medina_pois")
    .select("id, name")
    .eq("id", poiId)
    .maybeSingle();

  if (poiErr || !poi) return json({ error: "POI introuvable" }, 404);

  // 2. Decode base64
  let bytes: Uint8Array;
  try {
    const raw = photoBase64.includes(",") ? photoBase64.split(",")[1] : photoBase64;
    const binary = atob(raw);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  } catch {
    return json({ error: "base64 invalide" }, 400);
  }

  if (bytes.length > 10 * 1024 * 1024) return json({ error: "Fichier trop volumineux (max 10MB)" }, 400);

  // 3. Upload to Storage
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 6);
  const path = `pois/${poiId}/${ts}_${rand}.jpg`;

  const { error: uploadErr } = await sb.storage
    .from("client-media")
    .upload(path, bytes, { contentType: "image/jpeg", upsert: false });

  if (uploadErr) return json({ error: "Upload échoué: " + uploadErr.message }, 500);

  // Build photo URL
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const photoUrl = `${supabaseUrl}/storage/v1/object/authenticated/client-media/${path}`;

  // 4. AI quality analysis (fire & forget — don't block on failure)
  let qualityScore = 0.5;
  let isUsable = true;

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (apiKey) {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Rate this photo quality for a travel guide:
1) Is the location clearly visible?
2) Is it sharp?
3) Is lighting acceptable?
Return ONLY valid JSON: {"quality_score": 0.0-1.0, "is_usable": boolean, "issues": string[]}`,
                },
                {
                  type: "image_url",
                  image_url: { url: `data:image/jpeg;base64,${photoBase64.includes(",") ? photoBase64.split(",")[1] : photoBase64}` },
                },
              ],
            },
          ],
        }),
      });

      if (aiResp.ok) {
        const aiData = await aiResp.json();
        const content = aiData.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          qualityScore = typeof parsed.quality_score === "number" ? parsed.quality_score : 0.5;
          isUsable = typeof parsed.is_usable === "boolean" ? parsed.is_usable : true;
        }
      } else {
        await aiResp.text(); // consume body
      }
    }
  } catch (e) {
    console.error("AI quality check failed (non-blocking):", (e as Error).message);
  }

  const isApproved = qualityScore > 0.7;

  // 5. Insert into client_photos
  const { error: insertErr } = await sb.from("client_photos").insert({
    poi_id: poiId,
    quest_code: questCode,
    player_email: playerEmail,
    photo_url: photoUrl,
    photo_type: photoType,
    quality_score: qualityScore,
    is_approved: isApproved,
    metadata: { lat, lng, is_usable: isUsable },
  });

  if (insertErr) {
    console.error("Insert client_photos failed:", insertErr.message);
    return json({ error: "Insert échoué: " + insertErr.message }, 500);
  }

  return json({ success: true, quality_score: qualityScore, is_approved: isApproved });
});
