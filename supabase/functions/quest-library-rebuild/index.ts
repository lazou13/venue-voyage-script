// quest-library-rebuild — v4 (unifié sur QuestEngine)
// One-shot: purge quest_library, régénère 3 thèmes × 3 hubs (Koutoubia,
// Jemaa el-Fna, Mellah/Ferblantiers) en déléguant la sélection ET l'ordre
// géographique au moteur generate-quest (NN + 2-opt + diversité).
//
// - Aucune logique de sélection IA en parallèle : l'IA n'est consultée que
//   pour produire titre/description/highlights APRÈS que la route soit fixée.
// - `require_audio_fr: true` est passé à l'engine : zéro POI muet possible.
// - Aucune visite culinaire (food_break OFF + EXCLUDED_CATEGORIES dans
//   le moteur exclut déjà restaurant/café/market/etc.).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { hydrateStopsFromPois } from "../_shared/hydrateStops.ts";
import { attachMissionsV2 } from "../_shared/missionsV2.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const HUBS = [
  { id: "koutoubia",    name: "Mosquée Koutoubia",               lat: 31.6237, lng: -7.9934 },
  { id: "jemaa_el_fna", name: "Place Jemaa el-Fna",              lat: 31.6258, lng: -7.9892 },
  { id: "mellah",       name: "Place des Ferblantiers (Mellah)", lat: 31.6220, lng: -7.9770 },
];

const THEMES: { id: "complete" | "hidden_gems" | "photography"; label: string; brief: string }[] = [
  { id: "complete",    label: "Parcours complet",     brief: "Vue d'ensemble équilibrée des incontournables culturels du hub." },
  { id: "hidden_gems", label: "Trésors cachés",       brief: "Ruelles secrètes, fondouks oubliés, ateliers d'artisans hors des sentiers battus." },
  { id: "photography", label: "Spots photogéniques",  brief: "Architecture remarquable, jeux de lumière, patios, points de vue." },
];

async function generateMeta(
  apiKey: string,
  hubName: string,
  themeLabel: string,
  themeBrief: string,
  stops: Array<{ name: string; category?: string }>,
): Promise<{ title_fr: string; title_en: string; description_fr: string; description_en: string; highlights: string[]; best_time: string; quality_score: number } | null> {
  const stopsTxt = stops.map((s, i) => `${i + 1}. ${s.name}${s.category ? ` (${s.category})` : ""}`).join("\n");
  const prompt = `Crée le titre, la description et les highlights d'une visite guidée déjà construite.
Départ: ${hubName}
Thème: ${themeLabel} — ${themeBrief}
Stops (ORDRE FIXÉ, ne pas modifier):
${stopsTxt}

Ne propose ni nouveaux POIs ni nouvel ordre.`;
  try {
    const res = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Tu es un éditeur culturel marrakchi. Concis, factuel, sans cliché." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "meta",
            parameters: {
              type: "object",
              properties: {
                title_fr: { type: "string" }, title_en: { type: "string" },
                description_fr: { type: "string" }, description_en: { type: "string" },
                highlights: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 5 },
                best_time: { type: "string" },
                quality_score: { type: "number" },
              },
              required: ["title_fr", "title_en", "description_fr", "description_en", "highlights", "best_time", "quality_score"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "meta" } },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    return args ? JSON.parse(args) : null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY manquant" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const logs: string[] = [];
  const created: any[] = [];

  try {
    // 1) Purge
    const { error: delErr } = await supabase.from("quest_library").delete().not("id", "is", null);
    if (delErr) throw new Error(`Purge échouée: ${delErr.message}`);
    logs.push("🧹 quest_library purgée");

    // 2) Boucle hub × thème → délègue à generate-quest
    for (const hub of HUBS) {
      for (const theme of THEMES) {
        const engineBody = {
          start_lat: hub.lat,
          start_lng: hub.lng,
          start_name: hub.name,
          mode: "guided_tour",
          theme: theme.id,
          audience: "tourist",
          difficulty: "easy",
          max_duration_min: 180,
          max_stops: 8,
          radius_m: 1200,
          include_food_break: false,
          circular: false,
          language: "fr",
          require_audio_fr: true,
        };

        const engineRes = await fetch(`${SUPABASE_URL}/functions/v1/generate-quest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_KEY}`,
            apikey: SERVICE_KEY,
          },
          body: JSON.stringify(engineBody),
        });

        if (!engineRes.ok) {
          const errTxt = await engineRes.text();
          logs.push(`❌ ${hub.id}/${theme.id} engine ${engineRes.status}: ${errTxt.slice(0, 200)}`);
          continue;
        }

        const engineData = await engineRes.json();
        const stops: any[] = engineData.stops ?? [];
        if (stops.length < 5) {
          logs.push(`⚠️ ${hub.id}/${theme.id}: seulement ${stops.length} stops après engine, skip`);
          continue;
        }

        // 3) Construire stops_data au format quest_library
        const stopsData = stops.map((s: any, i: number) => ({
          order: i + 1,
          poi_id: s.poi_id ?? s.id,
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          category: s.category_ai ?? s.category ?? "other",
          distance_from_prev_m: Math.round(s.distance_from_prev_m ?? 0),
          walk_time_min: Math.round(s.walk_time_min ?? 0),
          visit_time_min: Math.round(s.visit_time_min ?? 12),
          story: s.history_context ?? null,
          story_en: s.history_context_en ?? null,
          history_context: s.history_context ?? null,
          history_context_en: s.history_context_en ?? null,
          description: s.description_short ?? null,
          photo_tip: s.photo_tip ?? null,
        }));

        const stopsHydrated = await hydrateStopsFromPois(supabase, stopsData);
        const stopsFinal = attachMissionsV2(stopsHydrated);

        // 4) Métadonnées (titre/description) via IA — sans toucher à la route
        const meta = await generateMeta(
          LOVABLE_API_KEY,
          hub.name,
          theme.label,
          theme.brief,
          stops.map((s: any) => ({ name: s.name, category: s.category_ai ?? s.category })),
        );

        const totalDist = Math.round(engineData.total_distance_m ?? stopsData.reduce((a, s) => a + s.distance_from_prev_m, 0));
        const totalTime = Math.round(engineData.total_time_min ?? stopsData.reduce((a, s) => a + s.walk_time_min + s.visit_time_min, 0));

        const { error: insErr } = await supabase.from("quest_library").insert({
          start_hub: hub.id,
          start_lat: hub.lat,
          start_lng: hub.lng,
          audience: "all",
          mode: "guided_tour",
          theme: theme.id,
          difficulty: "easy",
          title_fr: meta?.title_fr ?? `${theme.label} — ${hub.name}`,
          title_en: meta?.title_en ?? `${theme.label} — ${hub.name}`,
          description_fr: meta?.description_fr ?? theme.brief,
          description_en: meta?.description_en ?? theme.brief,
          duration_min: totalTime,
          distance_m: totalDist,
          stops_count: stops.length,
          stops_data: stopsFinal,
          highlights: meta?.highlights ?? [],
          best_time: meta?.best_time ?? "matinée",
          quality_score: meta?.quality_score ?? 8,
          agent_version: "v4-engine-unified",
        });

        if (insErr) {
          logs.push(`❌ ${hub.id}/${theme.id} insert: ${insErr.message}`);
          continue;
        }

        created.push({ hub: hub.id, theme: theme.id, title: meta?.title_fr, stops: stops.length, duration: totalTime, distance: totalDist });
        logs.push(`✅ ${hub.id}/${theme.id}: ${stops.length} stops, ${totalTime}min, ${totalDist}m`);
      }
    }

    return new Response(JSON.stringify({ ok: true, created_count: created.length, created, logs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    logs.push(`💥 ${e instanceof Error ? e.message : String(e)}`);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e), logs }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
