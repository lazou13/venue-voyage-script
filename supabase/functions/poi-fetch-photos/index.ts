import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_PLACES_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!GOOGLE_PLACES_API_KEY) throw new Error("GOOGLE_PLACES_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find POIs with google_raw but no photo in poi_media
    const { data: allPois, error: poisErr } = await supabase
      .from("medina_pois")
      .select("id, google_raw")
      .not("google_raw", "is", null)
      .neq("status", "filtered")
      .neq("status", "merged");
    if (poisErr) throw poisErr;

    // Get POI IDs that already have a photo
    const { data: existingMedia, error: mediaErr } = await supabase
      .from("poi_media")
      .select("medina_poi_id")
      .eq("media_type", "photo");
    if (mediaErr) throw mediaErr;

    const hasPhoto = new Set((existingMedia ?? []).map((m: any) => m.medina_poi_id));

    // Filter to eligible POIs (have photo_reference, no existing photo)
    const eligible: { id: string; photoRef: string }[] = [];
    for (const poi of allPois ?? []) {
      if (hasPhoto.has(poi.id)) continue;
      const raw = poi.google_raw as any;
      if (!raw) continue;

      const photoRef =
        raw?.details?.photos?.[0]?.photo_reference ??
        raw?.nearby?.photos?.[0]?.photo_reference ??
        raw?.photos?.[0]?.photo_reference ??
        null;
      if (photoRef) eligible.push({ id: poi.id, photoRef });
    }

    const batch = eligible.slice(0, BATCH_SIZE);
    const logs: string[] = [`📷 ${eligible.length} POIs éligibles, traitement de ${batch.length}`];

    let fetched = 0;
    let errors = 0;

    for (const { id, photoRef } of batch) {
      try {
        // Fetch photo from Google Places Photo API (follows redirect)
        const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${GOOGLE_PLACES_API_KEY}`;
        const photoResp = await fetch(photoUrl, { redirect: "follow" });
        if (!photoResp.ok) {
          logs.push(`⚠ ${id}: Google API ${photoResp.status}`);
          errors++;
          continue;
        }

        const blob = await photoResp.arrayBuffer();
        const contentType = photoResp.headers.get("content-type") ?? "image/jpeg";

        // Upload to storage
        const storagePath = `${id}/google_cover.jpg`;
        const { error: upErr } = await supabase.storage
          .from("poi-media")
          .upload(storagePath, new Uint8Array(blob), {
            contentType,
            upsert: true,
          });
        if (upErr) {
          logs.push(`⚠ ${id}: upload error: ${upErr.message}`);
          errors++;
          continue;
        }

        // Insert poi_media row
        const { error: insErr } = await supabase.from("poi_media").insert({
          medina_poi_id: id,
          media_type: "photo",
          storage_bucket: "poi-media",
          storage_path: storagePath,
          mime_type: contentType,
          size_bytes: blob.byteLength,
          is_cover: true,
          sort_order: 0,
          role_tags: ["repere"],
          extra: { source: "google_places" },
        });
        if (insErr) {
          logs.push(`⚠ ${id}: insert error: ${insErr.message}`);
          errors++;
          continue;
        }

        fetched++;
        logs.push(`✓ ${id}: photo enregistrée (${(blob.byteLength / 1024).toFixed(0)} Ko)`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logs.push(`✗ ${id}: ${msg}`);
        errors++;
      }
    }

    const skipped = eligible.length - batch.length;
    logs.push(`✅ Terminé: ${fetched} fetched, ${skipped} restants, ${errors} erreurs`);

    return new Response(
      JSON.stringify({ fetched, skipped, errors, remaining: skipped, logs }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
