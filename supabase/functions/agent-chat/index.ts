import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es l'Agent IA de Hunt Planner Pro, expert de la Médina de Marrakech et du pipeline d'enrichissement des POIs (table medina_pois).

Tu disposes d'OUTILS pour interroger la vraie base de données. RÈGLES STRICTES :
- Utilise TOUJOURS les outils pour répondre sur des données factuelles (listes, comptages, fiches, statistiques).
- Ne JAMAIS inventer un nom de POI, un chiffre, un statut.
- Si la demande est ambiguë (ex : zone non précisée), demande une clarification courte.
- Réponds en français (sauf si l'utilisateur écrit en anglais), sois concis et actionnable, formate les listes avec markdown.
- Quand tu cites des POIs, mentionne id court + nom + zone/category quand pertinent.

Outils :
- query_pois : recherche/filtre POIs (name ILIKE, category, zone, status, is_active, has_audio_fr/en, missing_field, limit ≤ 50).
- count_pois : compte POIs avec mêmes filtres.
- get_poi_detail : fiche complète d'un POI (par id ou name).
- pipeline_stats : vue d'ensemble enrichissement (couverture par champ).
- list_categories / list_zones : taxonomies disponibles.

Champs enrichis clés : history_context(_en), local_anecdote_fr/en, fun_fact_fr/en, riddle_easy/medium/hard, audio_url_fr/en/ar, anecdote_audio_url_fr/en, hero_image, poi_quality_score, status (draft/validated/...), enrichment_status.

RÈGLE CRITIQUE — MODE INVESTIGATEUR :
Si l'utilisateur conteste ta réponse, dit "c'est faux", "il manque X", ou mentionne un POI nommé qui devrait/ne devrait pas être dans ta réponse, tu DOIS OBLIGATOIREMENT :
1. Appeler query_pois({name: "<nom contesté>"}) avec extra_fields pertinents (audio_url_fr, audio_url_en, status, is_active, etc.) pour chercher TOUTES les graphies possibles du POI.
2. Si tu trouves des résultats, appeler get_poi_detail sur la fiche la plus pertinente (validated + is_active de préférence).
3. Expliquer clairement à l'utilisateur :
   - Le POI existe-t-il en base ? Sous quelle(s) graphie(s) ? Combien de doublons ?
   - Quel est son statut (draft/validated) et is_active ?
   - Quels champs sont remplis vs manquants par rapport au filtre initial ?
   - Pourquoi il n'apparaissait pas dans ta réponse précédente (filtre exact, champ NULL, etc.) ?
4. Si des doublons existent, le signaler explicitement avec leurs id courts.
Ne jamais te contenter de répéter ta réponse précédente — investigue toujours avant de répondre.`;

// ---------- Tools schema ----------
const TOOLS = [
  {
    type: "function",
    function: {
      name: "query_pois",
      description: "Liste des POIs filtrés. Retourne id, name, category, zone, status + champs demandés.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Filtre ILIKE sur name/name_fr/name_en" },
          category: { type: "string" },
          zone: { type: "string" },
          status: { type: "string", description: "draft, validated, archived, etc." },
          is_active: { type: "boolean" },
          has_audio_fr: { type: "boolean" },
          has_audio_en: { type: "boolean" },
          has_hero_image: { type: "boolean" },
          missing_field: {
            type: "string",
            description: "Filtre POIs où ce champ est NULL/vide (ex: local_anecdote_fr, history_context_en, riddle_easy, audio_url_fr).",
          },
          extra_fields: {
            type: "array",
            items: { type: "string" },
            description: "Colonnes additionnelles à retourner (whitelist).",
          },
          limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "count_pois",
      description: "Compte les POIs avec les mêmes filtres que query_pois.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          category: { type: "string" },
          zone: { type: "string" },
          status: { type: "string" },
          is_active: { type: "boolean" },
          has_audio_fr: { type: "boolean" },
          has_audio_en: { type: "boolean" },
          has_hero_image: { type: "boolean" },
          missing_field: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_poi_detail",
      description: "Fiche complète d'un POI par id (uuid) ou name (ILIKE, premier match).",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pipeline_stats",
      description: "Statistiques globales d'enrichissement : total, par status, couverture par champ enrichi.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_categories",
      description: "Liste les catégories distinctes avec leur compte.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_zones",
      description: "Liste les zones distinctes avec leur compte.",
      parameters: { type: "object", properties: {} },
    },
  },
];

// ---------- Whitelists ----------
const QUERY_FIELD_WHITELIST = new Set([
  "id", "name", "name_fr", "name_en", "name_ar", "category", "category_ai", "zone", "district",
  "status", "is_active", "is_start_hub", "hub_theme", "lat", "lng",
  "poi_quality_score", "enrichment_status", "enrichment_quality",
  "history_context", "history_context_en", "local_anecdote_fr", "local_anecdote_en", "local_anecdote",
  "fun_fact_fr", "fun_fact_en", "riddle_easy", "riddle_medium", "riddle_hard", "challenge",
  "audio_url_fr", "audio_url_en", "audio_url_ar", "anecdote_audio_url_fr", "anecdote_audio_url_en",
  "hero_image", "thumbnail", "best_time_visit", "crowd_level", "must_try", "must_see_details",
  "wikipedia_summary", "wikidata_id", "rating", "reviews_count",
  "created_at", "updated_at", "last_enriched_at", "agent_enriched_at",
]);

const MISSING_FIELD_WHITELIST = new Set([
  "local_anecdote_fr", "local_anecdote_en", "local_anecdote",
  "history_context", "history_context_en",
  "fun_fact_fr", "fun_fact_en",
  "riddle_easy", "riddle_easy_en", "riddle_medium", "riddle_hard", "challenge",
  "audio_url_fr", "audio_url_en", "audio_url_ar",
  "anecdote_audio_url_fr", "anecdote_audio_url_en",
  "hero_image", "thumbnail", "wikipedia_summary", "wikidata_id",
  "must_try", "must_see_details", "best_time_visit", "photo_tip",
  "name_fr", "name_en", "name_ar", "category_ai",
]);

// ---------- Tool implementations ----------
function applyFilters(q: any, args: any) {
  if (args.name) q = q.or(`name.ilike.%${args.name}%,name_fr.ilike.%${args.name}%,name_en.ilike.%${args.name}%`);
  if (args.category) q = q.eq("category", args.category);
  if (args.zone) q = q.eq("zone", args.zone);
  if (args.status) q = q.eq("status", args.status);
  if (typeof args.is_active === "boolean") q = q.eq("is_active", args.is_active);
  if (args.has_audio_fr === true) q = q.not("audio_url_fr", "is", null);
  if (args.has_audio_fr === false) q = q.is("audio_url_fr", null);
  if (args.has_audio_en === true) q = q.not("audio_url_en", "is", null);
  if (args.has_audio_en === false) q = q.is("audio_url_en", null);
  if (args.has_hero_image === true) q = q.not("hero_image", "is", null);
  if (args.has_hero_image === false) q = q.is("hero_image", null);
  if (args.missing_field && MISSING_FIELD_WHITELIST.has(args.missing_field)) {
    q = q.is(args.missing_field, null);
  }
  return q;
}

async function execTool(sb: any, name: string, args: any): Promise<any> {
  try {
    if (name === "query_pois") {
      const baseFields = ["id", "name", "category", "zone", "status"];
      const extras = (args.extra_fields ?? []).filter((f: string) => QUERY_FIELD_WHITELIST.has(f));
      const select = Array.from(new Set([...baseFields, ...extras])).join(", ");
      let q = sb.from("medina_pois").select(select);
      q = applyFilters(q, args);
      const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);
      const { data, error } = await q.order("name").limit(limit);
      if (error) throw error;
      return { count: data?.length ?? 0, results: data ?? [] };
    }

    if (name === "count_pois") {
      let q = sb.from("medina_pois").select("id", { count: "exact", head: true });
      q = applyFilters(q, args);
      const { count, error } = await q;
      if (error) throw error;
      return { count: count ?? 0 };
    }

    if (name === "get_poi_detail") {
      let q = sb.from("medina_pois").select("*").limit(1);
      if (args.id) q = q.eq("id", args.id);
      else if (args.name) q = q.or(`name.ilike.%${args.name}%,name_fr.ilike.%${args.name}%,name_en.ilike.%${args.name}%`);
      else return { error: "id ou name requis" };
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      if (!data) return { error: "POI introuvable" };
      // Strip heavy/raw fields
      const { google_raw, geom, wikimedia_images, nearby_pois_data, nearby_restaurants, ...clean } = data as any;
      return clean;
    }

    if (name === "pipeline_stats") {
      const fields = [
        "history_context", "history_context_en",
        "local_anecdote_fr", "local_anecdote_en",
        "fun_fact_fr", "fun_fact_en",
        "riddle_easy", "riddle_medium",
        "audio_url_fr", "audio_url_en",
        "anecdote_audio_url_fr", "anecdote_audio_url_en",
        "hero_image", "wikipedia_summary",
      ];
      const { count: total } = await sb.from("medina_pois").select("id", { count: "exact", head: true });
      const coverage: Record<string, { filled: number; pct: number }> = {};
      for (const f of fields) {
        const { count } = await sb.from("medina_pois").select("id", { count: "exact", head: true }).not(f, "is", null);
        coverage[f] = { filled: count ?? 0, pct: total ? Math.round(((count ?? 0) / total) * 100) : 0 };
      }
      // Status breakdown
      const { data: statusRows } = await sb.from("medina_pois").select("status");
      const byStatus: Record<string, number> = {};
      (statusRows ?? []).forEach((r: any) => { byStatus[r.status] = (byStatus[r.status] ?? 0) + 1; });
      return { total: total ?? 0, by_status: byStatus, coverage };
    }

    if (name === "list_categories") {
      const { data, error } = await sb.from("medina_pois").select("category");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r: any) => { counts[r.category] = (counts[r.category] ?? 0) + 1; });
      return { categories: Object.entries(counts).map(([k, v]) => ({ category: k, count: v })).sort((a, b) => b.count - a.count) };
    }

    if (name === "list_zones") {
      const { data, error } = await sb.from("medina_pois").select("zone");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r: any) => { const z = r.zone || "(vide)"; counts[z] = (counts[z] ?? 0) + 1; });
      return { zones: Object.entries(counts).map(([k, v]) => ({ zone: k, count: v })).sort((a, b) => b.count - a.count) };
    }

    return { error: `Outil inconnu: ${name}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------- Gateway calls ----------
async function callGateway(apiKey: string, body: any) {
  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function gatewayErrorResponse(status: number, fallback: string) {
  if (status === 429) return { status: 429, msg: "Limite de requêtes atteinte, réessayez dans un instant." };
  if (status === 402) return { status: 402, msg: "Crédits IA insuffisants." };
  return { status: 500, msg: fallback };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Missing required field: messages" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Conversation working set
    const convo: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    // Agent loop: up to 5 tool iterations, then final stream
    const MAX_ITER = 5;
    for (let iter = 0; iter < MAX_ITER; iter++) {
      const resp = await callGateway(LOVABLE_API_KEY, {
        model: "google/gemini-2.5-flash",
        messages: convo,
        tools: TOOLS,
        stream: false,
      });

      if (!resp.ok) {
        const t = await resp.text();
        console.error("Gateway tool-phase error:", resp.status, t);
        const err = gatewayErrorResponse(resp.status, "Erreur du service IA");
        return new Response(JSON.stringify({ error: err.msg }), {
          status: err.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await resp.json();
      const choice = data.choices?.[0];
      const msg = choice?.message;
      if (!msg) {
        return new Response(JSON.stringify({ error: "Réponse IA vide" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const toolCalls = msg.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        // Push assistant tool_calls message
        convo.push({
          role: "assistant",
          content: msg.content ?? "",
          tool_calls: toolCalls,
        });
        // Execute each tool
        for (const tc of toolCalls) {
          let args: any = {};
          try { args = JSON.parse(tc.function?.arguments || "{}"); } catch {}
          const result = await execTool(sb, tc.function?.name, args);
          convo.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result).slice(0, 12000), // cap payload
          });
        }
        continue; // next iteration
      }

      // No tool calls → stream final answer
      // Re-prompt as a streamed call so the client gets token-by-token
      // Add the assistant's draft to convo? No: we simply ask again with stream=true
      // Actually we already have the final content in msg.content, but to keep SSE
      // contract identical with the client, we restream it as a single completion.
      const streamResp = await callGateway(LOVABLE_API_KEY, {
        model: "google/gemini-2.5-flash",
        messages: [
          ...convo,
          { role: "system", content: "Réponds maintenant à l'utilisateur en te basant uniquement sur les données déjà récupérées via les outils ci-dessus. Sois concis, en français, et formate avec markdown si pertinent." },
        ],
        stream: true,
      });

      if (!streamResp.ok) {
        const t = await streamResp.text();
        console.error("Gateway stream error:", streamResp.status, t);
        const err = gatewayErrorResponse(streamResp.status, "Erreur du service IA");
        return new Response(JSON.stringify({ error: err.msg }), {
          status: err.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(streamResp.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Reached max iterations
    return new Response(JSON.stringify({ error: "Trop d'étapes — reformulez votre question plus précisément." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("agent-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
