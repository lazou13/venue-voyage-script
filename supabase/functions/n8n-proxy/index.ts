import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Authenticate via X-API-Key header OR Supabase admin auth
  const apiKey = req.headers.get("x-api-key");
  const N8N_API_KEY = Deno.env.get("N8N_API_KEY");
  const authHeader = req.headers.get("authorization");

  let isAuthed = false;

  // Method 1: x-api-key matches N8N_API_KEY
  if (N8N_API_KEY && apiKey === N8N_API_KEY) {
    isAuthed = true;
  }

  // Method 2: Supabase JWT from an admin user
  if (!isAuthed && authHeader?.startsWith("Bearer ")) {
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await anonClient.auth.getUser(token);
    if (user) {
      const svcClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: roles } = await svcClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin");
      if (roles && roles.length > 0) isAuthed = true;
    }
  }

  // Method 3: Service role key (for internal edge-function-to-edge-function calls)
  if (!isAuthed && authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    if (token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
      isAuthed = true;
    }
  }

  if (!isAuthed) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "auto-agent";

    if (action === "auto-agent") {
      // Call poi-auto-agent internally
      const baseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      const res = await fetch(`${baseUrl}/functions/v1/poi-auto-agent`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list-library") {
      const { data, error } = await supabase
        .from("quest_library")
        .select("id, title_fr, audience, start_hub, stops_count, quality_score, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, count: data?.length || 0, visits: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "clear-library") {
      const { error } = await supabase.from("quest_library").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, message: "Library cleared" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "stats") {
      const [libRes, poisRes] = await Promise.all([
        supabase.from("quest_library").select("id", { count: "exact", head: true }),
        supabase.from("medina_pois").select("id", { count: "exact", head: true }).eq("is_active", true),
      ]);

      return new Response(JSON.stringify({
        ok: true,
        library_count: libRes.count || 0,
        active_pois: poisRes.count || 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "enrich_poi") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: pois, error } = await supabase
        .from("medina_pois")
        .select("id, name, name_fr, name_en, category, category_ai, district, description_short, history_context, wikidata_description, wikipedia_summary, construction_date, historical_period, architect")
        .eq("enrichment_status", "wikidata_done")
        .is("story_fr", null)
        .order("poi_quality_score", { ascending: false })
        .limit(5);

      if (error) throw error;
      if (!pois || pois.length === 0) {
        return new Response(JSON.stringify({ ok: true, enriched: 0, skipped: 0, message: "Aucun POI à enrichir" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let enriched = 0;
      let skipped = 0;
      const logs: string[] = [];

      for (const poi of pois) {
        try {
          const displayName = poi.name_fr || poi.name_en || poi.name;
          const category = poi.category_ai || poi.category || "lieu";
          const district = poi.district || "médina de Marrakech";

          const contextParts = [
            poi.description_short && `Description: ${poi.description_short}`,
            poi.history_context && `Contexte historique: ${poi.history_context}`,
            poi.wikipedia_summary && `Wikipedia: ${poi.wikipedia_summary}`,
            poi.wikidata_description && `Wikidata: ${poi.wikidata_description}`,
            poi.construction_date && `Date de construction: ${poi.construction_date}`,
            poi.historical_period && `Période: ${poi.historical_period}`,
            poi.architect && `Architecte: ${poi.architect}`,
          ].filter(Boolean).join("\n");

          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: "Tu es un expert en patrimoine culturel marocain et guide touristique de Marrakech. Génère du contenu narratif authentique, spécifique et immersif." },
                { role: "user", content: `Génère le contenu narratif pour ce lieu de la médina de Marrakech:\n\nNom: "${displayName}"\nCatégorie: ${category}\nQuartier: ${district}\n${contextParts}` },
              ],
              tools: [{
                type: "function",
                function: {
                  name: "enrich_poi_content",
                  description: "Enrichit un POI avec du contenu narratif trilingue",
                  parameters: {
                    type: "object",
                    properties: {
                      story_fr: { type: "string", description: "Récit immersif en français (200-300 mots). Fait découvrir le lieu comme si on y était." },
                      story_en: { type: "string", description: "Natural English translation of story_fr (200-300 words)." },
                      story_ar: { type: "string", description: "ترجمة عربية طبيعية (150-250 كلمة)" },
                      fun_facts: { type: "array", items: { type: "object", properties: { fr: { type: "string" }, en: { type: "string" } }, required: ["fr", "en"] }, description: "2-3 faits surprenants et vérifiables" },
                      visitor_tips: { type: "array", items: { type: "object", properties: { fr: { type: "string" }, en: { type: "string" } }, required: ["fr", "en"] }, description: "2-3 conseils pratiques pour les visiteurs" },
                    },
                    required: ["story_fr", "story_en", "story_ar", "fun_facts", "visitor_tips"],
                    additionalProperties: false,
                  },
                },
              }],
              tool_choice: { type: "function", function: { name: "enrich_poi_content" } },
            }),
          });

          if (!aiResp.ok) {
            const errText = await aiResp.text();
            logs.push(`⚠️ AI ${aiResp.status} for ${displayName}: ${errText.substring(0, 100)}`);
            if (aiResp.status === 429) await new Promise(r => setTimeout(r, 10000));
            skipped++;
            continue;
          }

          const aiData = await aiResp.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (!toolCall) { logs.push(`⚠️ No tool call for ${displayName}`); skipped++; continue; }

          const parsed = JSON.parse(toolCall.function.arguments);

          const { error: updErr } = await supabase
            .from("medina_pois")
            .update({
              story_fr: parsed.story_fr,
              story_en: parsed.story_en,
              story_ar: parsed.story_ar,
              fun_facts: parsed.fun_facts,
              visitor_tips: parsed.visitor_tips,
              enrichment_status: "content_done",
              last_enriched_at: new Date().toISOString(),
            })
            .eq("id", poi.id);

          if (updErr) { logs.push(`❌ DB error ${displayName}: ${updErr.message}`); skipped++; }
          else { enriched++; logs.push(`✅ ${displayName}`); }
        } catch (e) {
          logs.push(`❌ ${e instanceof Error ? e.message : "unknown"}`);
          skipped++;
        }

        // Delay between calls
        await new Promise(r => setTimeout(r, 1500));
      }

      return new Response(JSON.stringify({ ok: true, enriched, skipped, logs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "score_poi") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: pois, error } = await supabase
        .from("medina_pois")
        .select("id, name, name_fr, name_en, category, category_ai, district, description_short, history_context, story_fr, fun_facts, visitor_tips, wikidata_description, wikipedia_summary, construction_date, historical_period, architect, unesco_status, instagram_spot, ruelle_etroite, street_type, opening_hours, price_info, rating, reviews_count, accessibility_notes, street_food_spot, photo_tip, is_photo_spot, crowd_level")
        .eq("enrichment_status", "content_done")
        .is("treasure_hunt_score", null)
        .order("poi_quality_score", { ascending: false })
        .limit(10);

      if (error) throw error;
      if (!pois || pois.length === 0) {
        return new Response(JSON.stringify({ ok: true, scored: 0, message: "Aucun POI à scorer" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let scored = 0;
      const logs: string[] = [];

      for (const poi of pois) {
        try {
          const displayName = poi.name_fr || poi.name_en || poi.name;
          const category = poi.category_ai || poi.category || "lieu";

          const contextParts = [
            `Catégorie: ${category}`,
            poi.district && `Quartier: ${poi.district}`,
            poi.description_short && `Description: ${poi.description_short}`,
            poi.history_context && `Contexte historique: ${poi.history_context}`,
            poi.wikipedia_summary && `Wikipedia: ${poi.wikipedia_summary.substring(0, 300)}`,
            poi.construction_date && `Date de construction: ${poi.construction_date}`,
            poi.historical_period && `Période: ${poi.historical_period}`,
            poi.architect && `Architecte: ${poi.architect}`,
            poi.unesco_status && `UNESCO: oui`,
            poi.instagram_spot && `Spot Instagram: oui`,
            poi.ruelle_etroite && `Ruelle étroite: oui`,
            poi.street_type && `Type de rue: ${poi.street_type}`,
            poi.opening_hours && `Horaires: ${JSON.stringify(poi.opening_hours)}`,
            poi.price_info && `Prix: ${poi.price_info}`,
            poi.rating && `Note Google: ${poi.rating}`,
            poi.reviews_count && `Avis: ${poi.reviews_count}`,
            poi.accessibility_notes && `Accessibilité: ${poi.accessibility_notes}`,
            poi.street_food_spot && `Street food: oui`,
            poi.is_photo_spot && `Spot photo: oui`,
            poi.crowd_level && `Affluence: ${poi.crowd_level}`,
          ].filter(Boolean).join("\n");

          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: `Tu es un expert en game design urbain et en tourisme à Marrakech. Évalue ce POI selon des critères précis pour le moteur QuestEngine. Sois objectif et cohérent.` },
                { role: "user", content: `Évalue ce lieu pour le moteur de quêtes urbaines:\n\nNom: "${displayName}"\n${contextParts}\n\nRègles de scoring:\n- historical_significance: 0-100 (100=monument iconique mondial, 50=intérêt local notable, 10=lieu ordinaire)\n- photo_opportunity_score: 0-100 (100=spot photo exceptionnel, 50=photogénique, 10=peu d'intérêt visuel)\n- difficulty_score: 1-5 (1=évident à trouver, 5=très caché/difficile d'accès)\n- crowd_level_score: 1-5 (1=désert, 5=bondé en permanence)\n- average_visit_duration: en minutes (temps réaliste pour visiter)\n- best_time_visit: "morning" ou "afternoon" ou "sunset"\n- proximity_difficulty: 1-5 (1=accès facile, 5=ruelles très étroites/complexes)\n\nScores de mode (0-100):\n- treasure_hunt_score: potentiel pour chasse au trésor (énigmes, défis, exploration)\n- guided_tour_score: potentiel pour visite guidée (histoire, culture, narration)\n- team_building_score: potentiel pour activité de groupe (interaction, challenge collectif)` },
              ],
              tools: [{
                type: "function",
                function: {
                  name: "score_poi_dimensions",
                  description: "Score un POI selon les 7 dimensions + 3 scores de mode",
                  parameters: {
                    type: "object",
                    properties: {
                      historical_significance: { type: "integer", description: "0-100" },
                      photo_opportunity_score: { type: "integer", description: "0-100" },
                      difficulty_score: { type: "integer", description: "1-5" },
                      crowd_level_score: { type: "integer", description: "1-5" },
                      average_visit_duration: { type: "integer", description: "Minutes" },
                      best_time_visit: { type: "string", enum: ["morning", "afternoon", "sunset"] },
                      proximity_difficulty: { type: "integer", description: "1-5" },
                      treasure_hunt_score: { type: "integer", description: "0-100" },
                      guided_tour_score: { type: "integer", description: "0-100" },
                      team_building_score: { type: "integer", description: "0-100" },
                    },
                    required: ["historical_significance", "photo_opportunity_score", "difficulty_score", "crowd_level_score", "average_visit_duration", "best_time_visit", "proximity_difficulty", "treasure_hunt_score", "guided_tour_score", "team_building_score"],
                    additionalProperties: false,
                  },
                },
              }],
              tool_choice: { type: "function", function: { name: "score_poi_dimensions" } },
            }),
          });

          if (!aiResp.ok) {
            const errText = await aiResp.text();
            logs.push(`⚠️ AI ${aiResp.status} for ${displayName}: ${errText.substring(0, 100)}`);
            if (aiResp.status === 429) await new Promise(r => setTimeout(r, 10000));
            continue;
          }

          const aiData = await aiResp.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (!toolCall) { logs.push(`⚠️ No tool call for ${displayName}`); continue; }

          const s = JSON.parse(toolCall.function.arguments);

          // Map crowd_level_score to text
          const crowdMap: Record<number, string> = { 1: "low", 2: "low-medium", 3: "medium", 4: "high", 5: "very_high" };

          const { error: updErr } = await supabase
            .from("medina_pois")
            .update({
              historical_significance: s.historical_significance,
              photo_opportunity_score: s.photo_opportunity_score,
              difficulty_score: s.difficulty_score,
              crowd_level: crowdMap[s.crowd_level_score] || "medium",
              average_visit_duration: s.average_visit_duration,
              best_time_visit: s.best_time_visit,
              treasure_hunt_score: s.treasure_hunt_score,
              guided_tour_score: s.guided_tour_score,
              team_building_score: s.team_building_score,
              enrichment_status: "complete",
              last_enriched_at: new Date().toISOString(),
            })
            .eq("id", poi.id);

          if (updErr) { logs.push(`❌ DB error ${displayName}: ${updErr.message}`); }
          else { scored++; logs.push(`✅ ${displayName} — TH:${s.treasure_hunt_score} GT:${s.guided_tour_score} TB:${s.team_building_score}`); }
        } catch (e) {
          logs.push(`❌ ${e instanceof Error ? e.message : "unknown"}`);
        }

        await new Promise(r => setTimeout(r, 1000));
      }

      return new Response(JSON.stringify({ ok: true, scored, total: pois.length, logs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "download_images") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

      const { data: pois, error } = await supabase
        .from("medina_pois")
        .select("id, name, name_fr, name_en, wikidata_id, wikimedia_images")
        .eq("enrichment_status", "content_done")
        .is("hero_image", null)
        .not("wikidata_id", "is", null)
        .order("poi_quality_score", { ascending: false })
        .limit(5);

      if (error) throw error;
      if (!pois || pois.length === 0) {
        return new Response(JSON.stringify({ ok: true, processed: 0, message: "Aucun POI à traiter" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let processed = 0;
      const logs: string[] = [];

      for (const poi of pois) {
        try {
          const displayName = poi.name_fr || poi.name_en || poi.name;

          // 1. Fetch Wikidata entity to get P18 (image) claims
          const wdResp = await fetch(
            `https://www.wikidata.org/wiki/Special:EntityData/${poi.wikidata_id}.json`
          );
          if (!wdResp.ok) {
            logs.push(`⚠️ Wikidata ${wdResp.status} for ${displayName}`);
            continue;
          }
          const wdData = await wdResp.json();
          const entity = wdData.entities?.[poi.wikidata_id!];
          if (!entity) { logs.push(`⚠️ No entity for ${displayName}`); continue; }

          // Extract image filenames from P18 (image), P373 fallback not needed
          const p18Claims = entity.claims?.P18 || [];
          const fileNames: string[] = p18Claims
            .map((c: any) => c.mainsnak?.datavalue?.value)
            .filter(Boolean)
            .slice(0, 4);

          // Also try P3451 (nighttime view) and P8517 (winter view) as bonus
          for (const prop of ["P3451", "P8517", "P154"]) {
            const extra = entity.claims?.[prop] || [];
            for (const c of extra) {
              const v = c.mainsnak?.datavalue?.value;
              if (v && !fileNames.includes(v) && fileNames.length < 4) fileNames.push(v);
            }
          }

          if (fileNames.length === 0) {
            logs.push(`⚠️ No images for ${displayName}`);
            // Still mark as media_done so pipeline continues
            await supabase.from("medina_pois").update({
              enrichment_status: "media_done",
              last_enriched_at: new Date().toISOString(),
            }).eq("id", poi.id);
            continue;
          }

          const uploadedUrls: string[] = [];
          let heroUrl: string | null = null;

          for (let i = 0; i < fileNames.length; i++) {
            const fileName = fileNames[i];
            const encodedName = encodeURIComponent(fileName.replace(/ /g, "_"));

            // Wikimedia Commons thumbnail URL (800px wide)
            const commonsUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodedName}?width=800`;

            try {
              const imgResp = await fetch(commonsUrl, { redirect: "follow" });
              if (!imgResp.ok) {
                logs.push(`  ⚠️ ${fileName}: HTTP ${imgResp.status}`);
                continue;
              }

              const blob = await imgResp.arrayBuffer();
              const contentType = imgResp.headers.get("content-type") ?? "image/jpeg";
              const ext = contentType.includes("png") ? "png" : "jpg";
              const storagePath = `${poi.id}/${i === 0 ? "hero" : `gallery_${i}`}.${ext}`;

              const { error: upErr } = await supabase.storage
                .from("poi-images")
                .upload(storagePath, new Uint8Array(blob), {
                  contentType,
                  upsert: true,
                });

              if (upErr) {
                logs.push(`  ⚠️ Upload ${fileName}: ${upErr.message}`);
                continue;
              }

              const publicUrl = `${supabaseUrl}/storage/v1/object/public/poi-images/${storagePath}`;
              uploadedUrls.push(publicUrl);
              if (i === 0) heroUrl = publicUrl;
            } catch (imgErr) {
              logs.push(`  ⚠️ ${fileName}: ${imgErr instanceof Error ? imgErr.message : "error"}`);
            }

            // Small delay between downloads
            await new Promise(r => setTimeout(r, 500));
          }

          // Update POI
          const { error: updErr } = await supabase
            .from("medina_pois")
            .update({
              hero_image: heroUrl,
              thumbnail: heroUrl,
              wikimedia_images: uploadedUrls.map(url => ({ url, source: "wikimedia" })),
              media_attribution: "Wikimedia Commons",
              enrichment_status: "media_done",
              last_enriched_at: new Date().toISOString(),
            })
            .eq("id", poi.id);

          if (updErr) {
            logs.push(`❌ DB error ${displayName}: ${updErr.message}`);
          } else {
            processed++;
            logs.push(`✅ ${displayName}: ${uploadedUrls.length} images`);
          }
        } catch (e) {
          logs.push(`❌ ${e instanceof Error ? e.message : "unknown"}`);
        }

        await new Promise(r => setTimeout(r, 1000));
      }

      return new Response(JSON.stringify({ ok: true, processed, total: pois.length, logs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "enrich_wikidata") {
      const { data: pois, error } = await supabase
        .from("medina_pois")
        .select("id, name, name_fr, name_en, lat, lng")
        .eq("enrichment_status", "pending")
        .is("wikidata_id", null)
        .not("lat", "is", null)
        .not("lng", "is", null)
        .order("poi_quality_score", { ascending: false })
        .limit(10);

      if (error) throw error;
      if (!pois || pois.length === 0) {
        return new Response(JSON.stringify({ ok: true, enriched: 0, message: "Aucun POI à enrichir" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let enriched = 0;
      const logs: string[] = [];

      for (const poi of pois) {
        try {
          const displayName = poi.name_fr || poi.name_en || poi.name;
          const searchName = (poi.name_fr || poi.name_en || poi.name).trim();

          // 1. Search Wikidata by name + coordinates radius
          const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(searchName)}&language=fr&uselang=fr&type=item&limit=5&format=json`;
          const searchResp = await fetch(searchUrl);
          if (!searchResp.ok) {
            logs.push(`⚠️ Wikidata search ${searchResp.status} for ${displayName}`);
            continue;
          }
          const searchData = await searchResp.json();
          const candidates = searchData.search || [];

          if (candidates.length === 0) {
            logs.push(`⚠️ No Wikidata result for "${searchName}"`);
            // Mark as wikidata_done anyway to not block pipeline
            await supabase.from("medina_pois").update({
              enrichment_status: "wikidata_done",
              last_enriched_at: new Date().toISOString(),
            }).eq("id", poi.id);
            enriched++;
            continue;
          }

          // 2. Try each candidate – pick the one with coordinates closest to POI
          let bestQid: string | null = null;
          let bestDesc = "";
          let bestDist = Infinity;
          let bestEntity: any = null;

          for (const candidate of candidates.slice(0, 3)) {
            const qid = candidate.id;
            const entityResp = await fetch(
              `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`
            );
            if (!entityResp.ok) continue;
            const entityData = await entityResp.json();
            const ent = entityData.entities?.[qid];
            if (!ent) continue;

            // Check P625 (coordinate location)
            const coords = ent.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
            if (coords && poi.lat && poi.lng) {
              const dlat = coords.latitude - poi.lat;
              const dlng = coords.longitude - poi.lng;
              const dist = Math.sqrt(dlat * dlat + dlng * dlng);
              if (dist < bestDist) {
                bestDist = dist;
                bestQid = qid;
                bestDesc = ent.descriptions?.fr?.value || ent.descriptions?.en?.value || candidate.description || "";
                bestEntity = ent;
              }
            } else if (!bestQid) {
              // No coords but first match
              bestQid = qid;
              bestDesc = ent.descriptions?.fr?.value || ent.descriptions?.en?.value || candidate.description || "";
              bestEntity = ent;
            }

            await new Promise(r => setTimeout(r, 300));
          }

          if (!bestQid || !bestEntity) {
            logs.push(`⚠️ No valid entity for ${displayName}`);
            await supabase.from("medina_pois").update({
              enrichment_status: "wikidata_done",
              last_enriched_at: new Date().toISOString(),
            }).eq("id", poi.id);
            enriched++;
            continue;
          }

          // 3. Extract historical info from claims
          const getClaimValue = (prop: string) => {
            const claim = bestEntity.claims?.[prop]?.[0]?.mainsnak?.datavalue?.value;
            if (!claim) return null;
            if (typeof claim === "string") return claim;
            if (claim.text) return claim.text;
            if (claim.time) return claim.time.replace(/^\+/, "").split("T")[0];
            if (claim.id) return claim.id; // QID reference
            return null;
          };

          const getLabel = (prop: string) => {
            const qidRef = getClaimValue(prop);
            if (!qidRef || !qidRef.startsWith?.("Q")) return null;
            // We won't resolve labels for now, just store QID
            return qidRef;
          };

          const updateData: Record<string, any> = {
            wikidata_id: bestQid,
            wikidata_description: bestDesc,
            enrichment_status: "wikidata_done",
            last_enriched_at: new Date().toISOString(),
          };

          // P84 = architect, P571 = inception date, P1435 = heritage status
          const architect = getClaimValue("P84");
          if (architect) updateData.architect = architect;

          const constructionDate = getClaimValue("P571");
          if (constructionDate) updateData.construction_date = constructionDate;

          const historicalPeriod = getClaimValue("P2348");
          if (historicalPeriod) updateData.historical_period = historicalPeriod;

          // P1435 = heritage designation → unesco flag
          const heritage = bestEntity.claims?.P1435;
          if (heritage && heritage.length > 0) updateData.unesco_status = true;

          const { error: updErr } = await supabase
            .from("medina_pois")
            .update(updateData)
            .eq("id", poi.id);

          if (updErr) {
            logs.push(`❌ DB error ${displayName}: ${updErr.message}`);
          } else {
            enriched++;
            logs.push(`✅ ${displayName} → ${bestQid} (${bestDesc.substring(0, 60)})`);
          }
        } catch (e) {
          logs.push(`❌ ${e instanceof Error ? e.message : "unknown"}`);
        }

        await new Promise(r => setTimeout(r, 500));
      }

      return new Response(JSON.stringify({ ok: true, enriched, total: pois.length, logs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "translate_pois") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const batchSize = body.batch_size || 5;

      // Broader filter: catch any POI missing ANY EN translation
      // Use raw SQL filter via .or() to cover all cases
      const { data: pois, error } = await supabase
        .from("medina_pois")
        .select("id, name, name_fr, name_en, local_anecdote_fr, local_anecdote_en, fun_fact_fr, fun_fact_en, history_context, history_context_en, story_fr, story_en, riddle_easy, riddle_easy_en, wikipedia_summary, wikipedia_summary_en, must_see_details, must_see_details_en, must_try, must_try_en, must_visit_nearby, must_visit_nearby_en, photo_tip, photo_tip_en, tourist_tips, tourist_tips_en, price_info, price_info_en, accessibility_notes, accessibility_notes_en, best_time_visit, best_time_visit_en, street_food_details, street_food_details_en")
        .eq("is_active", true)
        .or("and(local_anecdote_fr.not.is.null,local_anecdote_en.is.null),and(history_context.not.is.null,history_context_en.is.null),and(riddle_easy.not.is.null,riddle_easy_en.is.null),and(name_fr.not.is.null,name_en.is.null),and(story_fr.not.is.null,story_en.is.null),name_en.is.null,and(must_see_details.not.is.null,must_see_details_en.is.null),and(must_try.not.is.null,must_try_en.is.null),and(must_visit_nearby.not.is.null,must_visit_nearby_en.is.null),and(photo_tip.not.is.null,photo_tip_en.is.null),and(tourist_tips.not.is.null,tourist_tips_en.is.null),and(price_info.not.is.null,price_info_en.is.null),and(accessibility_notes.not.is.null,accessibility_notes_en.is.null),and(best_time_visit.not.is.null,best_time_visit_en.is.null),and(street_food_details.not.is.null,street_food_details_en.is.null)")
        .order("poi_quality_score", { ascending: false, nullsFirst: false })
        .limit(batchSize);

      if (error) throw error;
      if (!pois || pois.length === 0) {
        return new Response(JSON.stringify({ ok: true, translated: 0, message: "Aucun POI à traduire" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let translated = 0;
      const logs: string[] = [];

      for (const poi of pois) {
        try {
          const displayName = poi.name_fr || poi.name;

          // Build fields to translate
          const fieldsToTranslate: Record<string, string> = {};
          if (poi.local_anecdote_fr) fieldsToTranslate.local_anecdote_fr = poi.local_anecdote_fr;
          if (poi.fun_fact_fr && !poi.fun_fact_en) fieldsToTranslate.fun_fact_fr = poi.fun_fact_fr;
          if (poi.history_context && !poi.history_context_en) fieldsToTranslate.history_context = poi.history_context;
          if (!poi.name_en) fieldsToTranslate.name = poi.name_fr || poi.name;
          if (poi.story_fr && !poi.story_en) fieldsToTranslate.story_fr = poi.story_fr;
          if (poi.riddle_easy && !poi.riddle_easy_en) fieldsToTranslate.riddle_easy = poi.riddle_easy;
          if (poi.wikipedia_summary && !poi.wikipedia_summary_en) fieldsToTranslate.wikipedia_summary = poi.wikipedia_summary;
          if (poi.must_see_details && !poi.must_see_details_en) fieldsToTranslate.must_see_details = poi.must_see_details;
          if (poi.must_try && !poi.must_try_en) fieldsToTranslate.must_try = poi.must_try;
          if (poi.must_visit_nearby && !poi.must_visit_nearby_en) fieldsToTranslate.must_visit_nearby = poi.must_visit_nearby;
          if (poi.photo_tip && !poi.photo_tip_en) fieldsToTranslate.photo_tip = poi.photo_tip;
          if (poi.tourist_tips && !poi.tourist_tips_en) fieldsToTranslate.tourist_tips = poi.tourist_tips;
          if (poi.price_info && !poi.price_info_en) fieldsToTranslate.price_info = poi.price_info;
          if (poi.accessibility_notes && !poi.accessibility_notes_en) fieldsToTranslate.accessibility_notes = poi.accessibility_notes;
          if (poi.best_time_visit && !poi.best_time_visit_en) fieldsToTranslate.best_time_visit = poi.best_time_visit;
          if (poi.street_food_details && !poi.street_food_details_en) fieldsToTranslate.street_food_details = poi.street_food_details;

          if (Object.keys(fieldsToTranslate).length === 0) {
            logs.push(`⏭️ ${displayName}: rien à traduire`);
            continue;
          }

          const fieldsList = Object.entries(fieldsToTranslate)
            .map(([k, v]) => `### ${k}\n${v}`)
            .join("\n\n");

          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: "You are a professional French-to-English translator specializing in Moroccan cultural heritage and tourism. Translate naturally, preserving the tone, cultural references, and proper nouns. Keep Arabic/Amazigh terms as-is with brief explanation if needed." },
                { role: "user", content: `Translate each of the following French texts to English. The texts are about "${displayName}", a point of interest in the Marrakech medina.\n\n${fieldsList}` },
              ],
              tools: [{
                type: "function",
                function: {
                  name: "save_translations",
                  description: "Save English translations of POI content fields",
                  parameters: {
                    type: "object",
                    properties: {
                      local_anecdote_en: { type: "string", description: "English translation of local_anecdote_fr" },
                      fun_fact_en: { type: "string", description: "English translation of fun_fact_fr" },
                      history_context_en: { type: "string", description: "English translation of history_context" },
                      name_en: { type: "string", description: "English translation of name_fr" },
                      story_en: { type: "string", description: "English translation of story_fr" },
                      riddle_easy_en: { type: "string", description: "English translation of riddle_easy" },
                      wikipedia_summary_en: { type: "string", description: "English translation of wikipedia_summary" },
                      must_see_details_en: { type: "string", description: "English translation of must_see_details" },
                      must_try_en: { type: "string", description: "English translation of must_try" },
                      must_visit_nearby_en: { type: "string", description: "English translation of must_visit_nearby" },
                      photo_tip_en: { type: "string", description: "English translation of photo_tip" },
                      tourist_tips_en: { type: "string", description: "English translation of tourist_tips" },
                      price_info_en: { type: "string", description: "English translation of price_info" },
                      accessibility_notes_en: { type: "string", description: "English translation of accessibility_notes" },
                      best_time_visit_en: { type: "string", description: "English translation of best_time_visit" },
                      street_food_details_en: { type: "string", description: "English translation of street_food_details" },
                    },
                    required: Object.keys(fieldsToTranslate).map(k => {
                      const directMap: Record<string, string> = {
                        history_context: "history_context_en",
                        riddle_easy: "riddle_easy_en",
                        wikipedia_summary: "wikipedia_summary_en",
                        name: "name_en",
                        must_see_details: "must_see_details_en",
                        must_try: "must_try_en",
                        must_visit_nearby: "must_visit_nearby_en",
                        photo_tip: "photo_tip_en",
                        tourist_tips: "tourist_tips_en",
                        price_info: "price_info_en",
                        accessibility_notes: "accessibility_notes_en",
                        best_time_visit: "best_time_visit_en",
                        street_food_details: "street_food_details_en",
                      };
                      return directMap[k] || k.replace("_fr", "_en");
                    }),
                    additionalProperties: false,
                  },
                },
              }],
              tool_choice: { type: "function", function: { name: "save_translations" } },
            }),
          });

          if (!aiResp.ok) {
            const errText = await aiResp.text();
            logs.push(`⚠️ AI ${aiResp.status} for ${displayName}: ${errText.substring(0, 100)}`);
            if (aiResp.status === 429) await new Promise(r => setTimeout(r, 10000));
            continue;
          }

          const aiData = await aiResp.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (!toolCall) { logs.push(`⚠️ No tool call for ${displayName}`); continue; }

          const t = JSON.parse(toolCall.function.arguments);

          const updateData: Record<string, string> = {};
          if (t.local_anecdote_en) updateData.local_anecdote_en = t.local_anecdote_en;
          if (t.fun_fact_en) updateData.fun_fact_en = t.fun_fact_en;
          if (t.name_en) updateData.name_en = t.name_en;
          if (t.story_en) updateData.story_en = t.story_en;
          if (t.history_context_en) updateData.history_context_en = t.history_context_en;
          if (t.riddle_easy_en) updateData.riddle_easy_en = t.riddle_easy_en;
          if (t.wikipedia_summary_en) updateData.wikipedia_summary_en = t.wikipedia_summary_en;
          if (t.must_see_details_en) updateData.must_see_details_en = t.must_see_details_en;
          if (t.must_try_en) updateData.must_try_en = t.must_try_en;
          if (t.must_visit_nearby_en) updateData.must_visit_nearby_en = t.must_visit_nearby_en;
          if (t.photo_tip_en) updateData.photo_tip_en = t.photo_tip_en;
          if (t.tourist_tips_en) updateData.tourist_tips_en = t.tourist_tips_en;
          if (t.price_info_en) updateData.price_info_en = t.price_info_en;
          if (t.accessibility_notes_en) updateData.accessibility_notes_en = t.accessibility_notes_en;
          if (t.best_time_visit_en) updateData.best_time_visit_en = t.best_time_visit_en;
          if (t.street_food_details_en) updateData.street_food_details_en = t.street_food_details_en;

          const { error: updErr } = await supabase
            .from("medina_pois")
            .update(updateData)
            .eq("id", poi.id);

          if (updErr) { logs.push(`❌ DB error ${displayName}: ${updErr.message}`); }
          else { translated++; logs.push(`✅ ${displayName} (${Object.keys(updateData).join(", ")})`); }
        } catch (e) {
          logs.push(`❌ ${e instanceof Error ? e.message : "unknown"}`);
        }

        await new Promise(r => setTimeout(r, 1500));
      }

      return new Response(JSON.stringify({ ok: true, translated, total: pois.length, logs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate_fun_facts") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const batchSize = body.batch_size || 5;

      const { data: pois, error } = await supabase
        .from("medina_pois")
        .select("id, name, name_fr, name_en, category, category_ai, local_anecdote_fr, history_context, wikipedia_summary")
        .is("fun_fact_fr", null)
        .not("local_anecdote_fr", "is", null)
        .order("poi_quality_score", { ascending: false })
        .order("id", { ascending: true })
        .limit(batchSize);

      if (error) throw error;
      if (!pois || pois.length === 0) {
        const { count } = await supabase.from("medina_pois").select("id", { count: "exact", head: true }).is("fun_fact_fr", null).not("local_anecdote_fr", "is", null);
        return new Response(JSON.stringify({ ok: true, generated: 0, total_remaining: count || 0, message: "Aucun POI à traiter" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let generated = 0;
      const logs: string[] = [];

      for (const poi of pois) {
        try {
          const displayName = poi.name_fr || poi.name_en || poi.name;
          const category = poi.category_ai || poi.category || "lieu";

          const contextParts = [
            `Catégorie: ${category}`,
            poi.local_anecdote_fr && `Anecdote: ${poi.local_anecdote_fr.substring(0, 500)}`,
            poi.history_context && `Histoire: ${poi.history_context.substring(0, 500)}`,
            poi.wikipedia_summary && `Wikipedia: ${poi.wikipedia_summary.substring(0, 300)}`,
          ].filter(Boolean).join("\n");

          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: "Tu es un expert en patrimoine marocain. Génère UN SEUL fait surprenant, vérifiable, en une phrase percutante (20-40 mots). Pas de 'Saviez-vous que'. Pas d'introduction. Juste le fait brut." },
                { role: "user", content: `Génère un fun fact pour ce lieu de Marrakech:\n\nNom: "${displayName}"\n${contextParts}` },
              ],
              tools: [{
                type: "function",
                function: {
                  name: "set_fun_fact",
                  description: "Définit le fun fact FR et EN pour un POI",
                  parameters: {
                    type: "object",
                    properties: {
                      fun_fact_fr: { type: "string", description: "Fait surprenant en français (20-40 mots, une seule phrase)" },
                      fun_fact_en: { type: "string", description: "English translation of the fun fact (one sentence)" },
                    },
                    required: ["fun_fact_fr", "fun_fact_en"],
                    additionalProperties: false,
                  },
                },
              }],
              tool_choice: { type: "function", function: { name: "set_fun_fact" } },
            }),
          });

          if (!aiResp.ok) {
            const errText = await aiResp.text();
            logs.push(`⚠️ AI ${aiResp.status} for ${displayName}: ${errText.substring(0, 100)}`);
            if (aiResp.status === 429) await new Promise(r => setTimeout(r, 10000));
            continue;
          }

          const aiData = await aiResp.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (!toolCall) { logs.push(`⚠️ No tool call for ${displayName}`); continue; }

          const parsed = JSON.parse(toolCall.function.arguments);

          const { error: updErr } = await supabase
            .from("medina_pois")
            .update({
              fun_fact_fr: parsed.fun_fact_fr,
              fun_fact_en: parsed.fun_fact_en,
            })
            .eq("id", poi.id);

          if (updErr) { logs.push(`❌ DB error ${displayName}: ${updErr.message}`); }
          else { generated++; logs.push(`✅ ${displayName}: ${parsed.fun_fact_fr.substring(0, 80)}…`); }
        } catch (e) {
          logs.push(`❌ ${e instanceof Error ? e.message : "unknown"}`);
        }

        await new Promise(r => setTimeout(r, 1500));
      }

      const { count } = await supabase.from("medina_pois").select("id", { count: "exact", head: true }).is("fun_fact_fr", null).not("local_anecdote_fr", "is", null);

      return new Response(JSON.stringify({ ok: true, generated, total_remaining: count || 0, logs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "sync_projects") {
      const targets = [
        { name: "Questride B2C/B2B", url: "https://brhckhyrbpjfnieexggq.supabase.co/functions/v1/sync-pois-import" },
        { name: "Quest Rides PRO", url: "https://zdzycbqwypriveenxnsh.supabase.co/functions/v1/sync-pois-import" },
      ];

      const results: Record<string, any> = {};
      for (const t of targets) {
        try {
          const res = await fetch(t.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source: "hpp-n8n-proxy" }),
          });
          results[t.name] = await res.json();
        } catch (e) {
          results[t.name] = { error: e instanceof Error ? e.message : "unknown" };
        }
      }

      return new Response(JSON.stringify({ ok: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}`, available: ["auto-agent", "list-library", "clear-library", "stats", "enrich_poi", "score_poi", "download_images", "enrich_wikidata", "translate_pois", "generate_fun_facts", "sync_projects"] }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
