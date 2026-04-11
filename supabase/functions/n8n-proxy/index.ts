import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Authenticate via X-API-Key header
  const apiKey = req.headers.get("x-api-key");
  const N8N_API_KEY = Deno.env.get("N8N_API_KEY");

  if (!N8N_API_KEY || apiKey !== N8N_API_KEY) {
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

    return new Response(JSON.stringify({ error: `Unknown action: ${action}`, available: ["auto-agent", "list-library", "clear-library", "stats", "enrich_poi", "score_poi", "download_images"] }), {
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
