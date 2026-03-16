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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const token = authHeader.replace("Bearer ", "").trim();

    // Validate JWT when it's a user session token.
    // In this project, some internal screens currently call functions with the anon token.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    let userId: string | null = null;
    if (token !== anonKey) {
      const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims?.sub) {
        return new Response(JSON.stringify({ error: "Token invalide" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = String(claimsData.claims.sub);
    }

    // Admin client for privileged operations
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // If we have a user token, enforce admin role
    if (userId) {
      const { data: roleRow } = await admin
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleRow) {
        return new Response(JSON.stringify({ error: "Accès refusé" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Parse input
    const { marker_id, ai_analysis } = await req.json();
    if (!marker_id) {
      return new Response(
        JSON.stringify({ error: "marker_id requis" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Load marker
    const { data: marker, error: markerErr } = await admin
      .from("route_markers")
      .select("*")
      .eq("id", marker_id)
      .maybeSingle();

    if (markerErr || !marker) {
      return new Response(
        JSON.stringify({ error: "Marqueur introuvable" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Create medina_poi with AI analysis in metadata
    const poiMetadata: Record<string, unknown> = {
      source_trace_id: marker.trace_id,
      source_marker_id: marker.id,
    };
    if (ai_analysis) {
      poiMetadata.ai_analysis = ai_analysis;
      // Extract reference photos from Instagram examples
      if (ai_analysis.instagram_spot?.instagram_example_posts) {
        poiMetadata.reference_photos = ai_analysis.instagram_spot.instagram_example_posts
          .filter((p: any) => p.url)
          .map((p: any) => ({ url: p.url, description: p.description }));
      }
    }

    const poiCategory = ai_analysis?.category || "terrain";
    const poiName = ai_analysis?.location_guess || marker.note || "POI terrain";

    const { data: newPoi, error: poiErr } = await admin
      .from("medina_pois")
      .insert({
        name: poiName,
        zone: "terrain",
        category: poiCategory,
        lat: marker.lat,
        lng: marker.lng,
        status: "draft",
        metadata: poiMetadata,
      })
      .select("id")
      .single();

    if (poiErr || !newPoi) {
      throw new Error(`Création POI échouée: ${poiErr?.message}`);
    }

    const medinaPoiId = newPoi.id;
    let mediaCreatedCount = 0;

    // Helper: copy a storage file from fieldwork to poi-media
    async function copyMedia(
      sourceUrl: string,
      mediaType: "photo" | "audio"
    ) {
      // Extract storage path from the URL
      // URLs look like: .../storage/v1/object/public/fieldwork/path/to/file.jpg
      // or could be a signed URL with /object/sign/fieldwork/...
      let sourcePath: string | null = null;

      try {
        const url = new URL(sourceUrl);
        const parts = url.pathname.split("/fieldwork/");
        if (parts.length >= 2) {
          sourcePath = parts[1].split("?")[0]; // remove query params
        }
      } catch {
        // Not a valid URL, try using it as a path directly
        sourcePath = sourceUrl;
      }

      if (!sourcePath) {
        console.warn(`Cannot parse storage path from: ${sourceUrl}`);
        return;
      }

      // Download from fieldwork bucket
      const { data: fileData, error: dlErr } = await admin.storage
        .from("fieldwork")
        .download(sourcePath);

      if (dlErr || !fileData) {
        console.error(`Download failed for ${sourcePath}:`, dlErr?.message);
        return;
      }

      // Determine extension
      const ext = sourcePath.split(".").pop() || (mediaType === "photo" ? "jpg" : "webm");
      const newFileName = `${crypto.randomUUID()}.${ext}`;
      const destPath = `${medinaPoiId}/${newFileName}`;

      // Upload to poi-media bucket
      const { error: upErr } = await admin.storage
        .from("poi-media")
        .upload(destPath, fileData, {
          contentType: fileData.type || (mediaType === "photo" ? "image/jpeg" : "audio/webm"),
          upsert: false,
        });

      if (upErr) {
        console.error(`Upload failed for ${destPath}:`, upErr.message);
        return;
      }

      // Determine mime
      const mimeType =
        fileData.type ||
        (mediaType === "photo" ? "image/jpeg" : "audio/webm");

      // Create poi_media row
      const { error: mediaErr } = await admin.from("poi_media").insert({
        medina_poi_id: medinaPoiId,
        media_type: mediaType,
        storage_bucket: "poi-media",
        storage_path: destPath,
        mime_type: mimeType,
        size_bytes: fileData.size || null,
        is_cover: mediaType === "photo",
        sort_order: mediaCreatedCount,
      });

      if (mediaErr) {
        console.error(`poi_media insert failed:`, mediaErr.message);
        return;
      }

      mediaCreatedCount++;
    }

    // 4. Copy photo if exists
    if (marker.photo_url) {
      await copyMedia(marker.photo_url, "photo");
    }

    // 5. Copy audio if exists
    if (marker.audio_url) {
      await copyMedia(marker.audio_url, "audio");
    }

    // 6. Mark marker as promoted
    await admin
      .from("route_markers")
      .update({ promoted: true })
      .eq("id", marker_id);

    // 7. Return result
    return new Response(
      JSON.stringify({
        medina_poi_id: medinaPoiId,
        media_created_count: mediaCreatedCount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("promote-marker-to-library error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erreur interne" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
