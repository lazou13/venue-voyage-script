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

    return new Response(JSON.stringify({ error: `Unknown action: ${action}`, available: ["auto-agent", "list-library", "clear-library", "stats", "enrich_poi"] }), {
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
