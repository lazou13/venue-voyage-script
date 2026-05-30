// quest-library-rebuild
// One-shot: purge la table quest_library puis régénère exactement
// 3 visites par hub × 3 hubs (Koutoubia, Jemaa el-Fna, Ferblantiers/Mellah)
// = 9 visites au total. Thèmes: complete, hidden_gems, photography.
// Aucune visite culinaire. Uniquement des POIs validés AVEC audio_url_fr.
//
// Admin-only (verify_jwt par défaut). Réutilise hydrateStopsFromPois et
// attachMissionsV2 comme le pipeline existant.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { hydrateStopsFromPois } from "../_shared/hydrateStops.ts";
import { attachMissionsV2, isPrivateBoutiqueBlacklisted } from "../_shared/missionsV2.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Hubs canoniques — coords alignées avec poi-auto-agent + mémoire start-hubs
const HUBS = [
  { id: "koutoubia",    name: "Mosquée Koutoubia",          lat: 31.6237, lng: -7.9934 },
  { id: "jemaa_el_fna", name: "Place Jemaa el-Fna",         lat: 31.6258, lng: -7.9892 },
  { id: "mellah",       name: "Place des Ferblantiers (Mellah)", lat: 31.6220, lng: -7.9770 },
];

// Thèmes autorisés (aucun culinaire)
const THEMES: { id: "complete" | "hidden_gems" | "photography"; label: string; brief: string }[] = [
  { id: "complete",    label: "Parcours complet",  brief: "Vue d'ensemble équilibrée des incontournables culturels du hub : monuments, places, palais, médersas, jardins. Pas de focus alimentaire." },
  { id: "hidden_gems", label: "Trésors cachés",    brief: "Ruelles secrètes, fondouks oubliés, fontaines discrètes, ateliers d'artisans hors des sentiers battus. Insolite, ambiance, lieux peu connus." },
  { id: "photography", label: "Spots photogéniques", brief: "Lieux à fort score Instagram : architecture remarquable, jeux de lumière, patios, riads visitables, points de vue, mosaïques." },
];

// Catégories culturelles uniquement — exclusion totale alimentaire / hospitalité
const EXCLUDED_CATEGORIES = new Set([
  "restaurant", "café", "cafe", "street_food", "food_court", "bakery",
  "market", "grocery", "supermarket",
  "hotel", "riad", "tour_agency", "travel_agency", "car_rental",
  "pharmacy", "bank", "atm", "gym", "spa", "generic",
  "equestrian", "horseback", "parking", "gas_station", "laundry",
]);

const VISIT_TIMES: Record<string, number> = {
  monument: 15, palace: 20, museum: 25, medersa: 18, mosque: 10, tomb: 12,
  gate_bab: 8, fountain: 6, fondouk: 12, souk: 15, craft_shop: 12,
  hammam: 10, garden: 15, plaza: 10, shrine_zaouia: 10, gallery: 15,
  boutique: 10, historic: 12, other: 10,
};

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180, Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
    // 1) Purge totale
    const { error: delErr } = await supabase.from("quest_library").delete().not("id", "is", null);
    if (delErr) throw new Error(`Purge échouée: ${delErr.message}`);
    logs.push("🧹 quest_library purgée");

    // 2) Charger POIs candidats (validés + audio FR + enrichis + culturels + bbox médina)
    const { data: allPois, error: poisErr } = await supabase
      .from("medina_pois")
      .select("id, name, name_fr, lat, lng, category_ai, description_short, audience_tags, route_tags, instagram_score, accessibility_notes, history_context, history_context_en, local_anecdote, local_anecdote_en, photo_tip, poi_quality_score, ruelle_etroite, audio_url_fr")
      .eq("status", "validated")
      .eq("is_active", true)
      .not("audio_url_fr", "is", null)
      .not("history_context", "is", null)
      .not("category_ai", "is", null)
      .gte("lat", 31.615).lte("lat", 31.645)
      .gte("lng", -8.01).lte("lng", -7.97)
      .limit(500);

    if (poisErr) throw new Error(`Lecture POIs échouée: ${poisErr.message}`);

    const candidates = (allPois || []).filter((p: any) => {
      if (!p.audio_url_fr || String(p.audio_url_fr).trim() === "") return false;
      if (!p.history_context || String(p.history_context).trim() === "") return false;
      const cat = (p.category_ai || "").toLowerCase();
      if (EXCLUDED_CATEGORIES.has(cat)) return false;
      if (isPrivateBoutiqueBlacklisted(p.name_fr || p.name)) return false;
      return true;
    });

    logs.push(`📚 ${candidates.length} POIs candidats (validés + audio FR + enrichis + culturels)`);

    if (candidates.length < 10) {
      throw new Error(`Pas assez de POIs candidats (${candidates.length}). Minimum 10 requis.`);
    }

    // 3) Pour chaque hub × thème
    for (const hub of HUBS) {
      const localPool = candidates
        .map((p: any) => ({ ...p, dist_m: Math.round(haversineM(hub.lat, hub.lng, p.lat, p.lng)) }))
        .filter((p: any) => p.dist_m <= 1500)
        .sort((a: any, b: any) => a.dist_m - b.dist_m);

      logs.push(`🎯 Hub ${hub.name}: ${localPool.length} POIs ≤ 1500m`);

      if (localPool.length < 6) {
        logs.push(`⚠️ Hub ${hub.name}: pool insuffisant, skip`);
        continue;
      }

      const usedAcrossThemes = new Set<string>();

      for (const theme of THEMES) {
        const poisForAI = localPool.map((p: any, i: number) => ({
          idx: i, id: p.id, name: p.name_fr || p.name, category: p.category_ai,
          lat: p.lat, lng: p.lng, dist_m: p.dist_m,
          score: p.poi_quality_score,
          instagram_score: p.instagram_score || 0,
          audience_tags: p.audience_tags || [],
          route_tags: p.route_tags || [],
          already_used_other_theme: usedAcrossThemes.has(p.id),
          description: (p.description_short || "").slice(0, 100),
        }));

        const poisText = poisForAI.map((p: any) =>
          `[${p.idx}] "${p.name}" (${p.category}) — ${p.dist_m}m du départ, score:${p.score}/10, ` +
          `instagram:${p.instagram_score}/10, audiences:[${p.audience_tags.join(",")}], ` +
          `routes:[${p.route_tags.join(",")}]` +
          `${p.already_used_other_theme ? " ⚠️ déjà utilisé dans une autre visite de ce hub" : ""}`
        ).join("\n");

        const prompt = `Tu es un expert culturel de la médina de Marrakech. Crée UNE visite guidée de ~150 minutes.

POINT DE DÉPART: ${hub.name} (lat:${hub.lat}, lng:${hub.lng})
THÈME: ${theme.label} — ${theme.brief}

RÈGLES STRICTES:
1. Choisis 6 à 10 stops parmi les POIs proposés.
2. AUCUN lieu alimentaire (restaurant, café, street food, marché alimentaire) — focus 100% culturel/patrimonial.
3. Diversité de catégories (alterner monuments, places, palais, fondouks, jardins, médersas).
4. Parcours géographiquement logique (minimiser allers-retours).
5. Évite autant que possible les POIs marqués "déjà utilisé dans une autre visite de ce hub" sauf si incontournable pour le thème.
6. Distance totale ≤ 1800 m.
7. Privilégie les POIs avec un score qualité élevé et — selon le thème — un bon score instagram.

POIs DISPONIBLES (tous ont déjà un audio FR enrichi):
${poisText}

Génère: indices ordonnés, titre+description bilingues, 3-5 highlights FR, meilleur moment, score qualité auto-évalué.`;

        const aiRes = await fetch(AI_GATEWAY, {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-pro",
            messages: [
              { role: "system", content: "Tu es un expert du tourisme culturel à Marrakech. Tu crées des parcours uniques, diversifiés et géographiquement cohérents." },
              { role: "user", content: prompt },
            ],
            tools: [{
              type: "function",
              function: {
                name: "create_visit",
                description: "Create a library visit with selected POIs",
                parameters: {
                  type: "object",
                  properties: {
                    selected_poi_indices: { type: "array", items: { type: "integer" } },
                    title_fr: { type: "string" }, title_en: { type: "string" },
                    description_fr: { type: "string" }, description_en: { type: "string" },
                    highlights: { type: "array", items: { type: "string" } },
                    best_time: { type: "string" }, quality_score: { type: "number" },
                  },
                  required: ["selected_poi_indices", "title_fr", "title_en", "description_fr", "description_en", "highlights", "best_time", "quality_score"],
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "create_visit" } },
          }),
        });

        if (!aiRes.ok) {
          const errText = await aiRes.text();
          logs.push(`❌ ${hub.id}/${theme.id}: IA ${aiRes.status} — ${errText.slice(0, 200)}`);
          continue;
        }

        const aiData = await aiRes.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall?.function?.arguments) {
          logs.push(`❌ ${hub.id}/${theme.id}: pas de tool call`);
          continue;
        }

        const visit = JSON.parse(toolCall.function.arguments);
        const indices: number[] = visit.selected_poi_indices || [];
        const selected = indices.map((idx) => poisForAI.find((p: any) => p.idx === idx)).filter(Boolean) as any[];

        if (selected.length < 5) {
          logs.push(`⚠️ ${hub.id}/${theme.id}: seulement ${selected.length} POIs, skip`);
          continue;
        }

        // Construire stops_data + métriques
        let totalDist = 0;
        for (let i = 1; i < selected.length; i++) {
          totalDist += haversineM(selected[i - 1].lat, selected[i - 1].lng, selected[i].lat, selected[i].lng);
        }
        const walkTime = Math.round(totalDist / 50); // 50 m/min en médina piétonne
        const visitTime = selected.reduce((s, p) => s + (VISIT_TIMES[p.category] || 12), 0);
        const totalTime = walkTime + visitTime;

        const stopsData = selected.map((p: any, i: number) => {
          const original = localPool.find((o: any) => o.id === p.id);
          const prev = i > 0 ? selected[i - 1] : null;
          const prevDist = prev ? Math.round(haversineM(prev.lat, prev.lng, p.lat, p.lng)) : 0;
          return {
            order: i + 1, poi_id: p.id, name: p.name, lat: p.lat, lng: p.lng,
            category: p.category, distance_from_prev_m: prevDist,
            walk_time_min: i === 0 ? 0 : Math.round(prevDist / 50),
            visit_time_min: VISIT_TIMES[p.category] || 12,
            story: original?.history_context, story_en: original?.history_context_en,
            history_context: original?.history_context, history_context_en: original?.history_context_en,
            description: original?.description_short, photo_tip: original?.photo_tip,
          };
        });

        const stopsHydrated = await hydrateStopsFromPois(supabase, stopsData);
        const stopsFinal = attachMissionsV2(stopsHydrated);

        const { error: insErr } = await supabase.from("quest_library").insert({
          start_hub: hub.id, start_lat: hub.lat, start_lng: hub.lng,
          audience: "all", mode: "guided_tour", theme: theme.id,
          difficulty: "medium",
          title_fr: visit.title_fr, title_en: visit.title_en,
          description_fr: visit.description_fr, description_en: visit.description_en,
          duration_min: totalTime, distance_m: Math.round(totalDist),
          stops_count: selected.length, stops_data: stopsFinal,
          highlights: visit.highlights || [], best_time: visit.best_time,
          quality_score: visit.quality_score, agent_version: "v3.1-rebuild",
        });

        if (insErr) {
          logs.push(`❌ ${hub.id}/${theme.id} insert: ${insErr.message}`);
          continue;
        }

        for (const p of selected) usedAcrossThemes.add(p.id);
        created.push({ hub: hub.id, theme: theme.id, title: visit.title_fr, stops: selected.length, duration: totalTime });
        logs.push(`✅ ${hub.id}/${theme.id}: "${visit.title_fr}" (${selected.length} stops, ${totalTime}min)`);
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
