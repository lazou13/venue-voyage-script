import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const SYSTEM_PROMPT = `Tu es l'Agent IA full-power de Hunt Planner Pro, expert de la Médina de Marrakech et administrateur de la base medina_pois.

Tu peux LIRE, MODIFIER, SUPPRIMER, FUSIONNER les POIs, GÉNÉRER des audios, LANCER les agents d'enrichissement et de qualité. Tu disposes d'outils typés — utilise-les TOUJOURS pour toute donnée factuelle ou action. Ne JAMAIS inventer un nom, un id, un chiffre.

RÈGLES :
- Réponds en français, concis, markdown si pertinent.
- Cite les POIs avec id court (8 premiers caractères) + nom.
- Pour LIRE : utilise directement query_pois / count_pois / get_poi_detail / pipeline_stats / list_categories / list_zones / find_duplicates.
- Pour MODIFIER UN champ texte/booléen ou GÉNÉRER UN audio sur un POI précis : exécute directement, pas besoin de demander confirmation.
- Pour ACTIONS DESTRUCTIVES (delete_poi, merge_pois, bulk_update) : tu DOIS d'abord présenter exactement ce que tu vas faire (ids concernés, champs modifiés) puis ATTENDRE une confirmation explicite de l'utilisateur ("ok", "oui", "vas-y", "confirme") avant de rappeler l'outil avec confirm: true.
- Pour ENRICHISSEMENT/PHOTOS/QUALITY/WATCHDOG : exécute si la portée est claire (un POI nommé, ou mode dry-run), sinon demande clarification.

MODE INVESTIGATEUR : si l'utilisateur conteste ("c'est faux", "il manque X"), appelle query_pois({name: "..."}) puis get_poi_detail, et explique pourquoi le POI n'apparaissait pas (statut, champ NULL, doublon, etc.).

Champs clés : history_context(_en), local_anecdote_fr/en, fun_fact_fr/en, riddle_easy/medium/hard, audio_url_fr/en/ar, anecdote_audio_url_fr/en, hero_image, poi_quality_score, status, enrichment_status, is_active, is_start_hub, hub_theme.`;

// ---------- Whitelists ----------
const QUERY_FIELD_WHITELIST = new Set([
  "id", "name", "name_fr", "name_en", "name_ar", "category", "category_ai", "zone", "district",
  "status", "is_active", "is_start_hub", "hub_theme", "lat", "lng",
  "poi_quality_score", "enrichment_status", "enrichment_quality",
  "history_context", "history_context_en", "local_anecdote_fr", "local_anecdote_en", "local_anecdote",
  "fun_fact_fr", "fun_fact_en", "riddle_easy", "riddle_easy_en", "riddle_medium", "riddle_hard", "challenge",
  "audio_url_fr", "audio_url_en", "audio_url_ar", "anecdote_audio_url_fr", "anecdote_audio_url_en",
  "hero_image", "thumbnail", "best_time_visit", "crowd_level", "must_try", "must_see_details",
  "wikipedia_summary", "wikipedia_summary_en", "wikidata_id", "rating", "reviews_count",
  "created_at", "updated_at", "last_enriched_at", "agent_enriched_at", "validated_at",
]);

const MISSING_FIELD_WHITELIST = new Set([
  "local_anecdote_fr", "local_anecdote_en", "local_anecdote",
  "history_context", "history_context_en",
  "fun_fact_fr", "fun_fact_en",
  "riddle_easy", "riddle_easy_en", "riddle_medium", "riddle_hard", "challenge",
  "audio_url_fr", "audio_url_en", "audio_url_ar",
  "anecdote_audio_url_fr", "anecdote_audio_url_en",
  "hero_image", "thumbnail", "wikipedia_summary", "wikipedia_summary_en", "wikidata_id",
  "must_try", "must_see_details", "best_time_visit", "photo_tip",
  "name_fr", "name_en", "name_ar", "category_ai",
]);

// Fields the agent is allowed to UPDATE
const UPDATE_FIELD_WHITELIST = new Set([
  "name", "name_fr", "name_en", "name_ar",
  "category", "category_ai", "subcategory", "zone", "district", "hub_theme",
  "status", "is_active", "is_start_hub", "is_photo_spot", "instagram_spot", "street_food_spot",
  "history_context", "history_context_en",
  "local_anecdote", "local_anecdote_fr", "local_anecdote_en",
  "fun_fact_fr", "fun_fact_en",
  "riddle_easy", "riddle_easy_en", "riddle_medium", "riddle_hard", "challenge",
  "audio_url_fr", "audio_url_en", "audio_url_ar",
  "anecdote_audio_url_fr", "anecdote_audio_url_en",
  "hero_image", "thumbnail",
  "best_time_visit", "best_time_visit_en", "crowd_level",
  "must_try", "must_try_en", "must_see_details", "must_see_details_en",
  "must_visit_nearby", "must_visit_nearby_en",
  "tourist_tips", "tourist_tips_en", "photo_tip", "photo_tip_en",
  "price_info", "price_info_en", "accessibility_notes", "accessibility_notes_en",
  "wikipedia_summary", "wikipedia_summary_en", "wikidata_id",
  "rating", "reviews_count", "poi_quality_score",
  "enrichment_status", "enrichment_quality",
  "lat", "lng", "address", "phone", "website", "website_url",
  "description_short", "tourist_interest",
]);

// ---------- Tools schema ----------
const TOOLS = [
  // READS
  {
    type: "function",
    function: {
      name: "query_pois",
      description: "Liste des POIs filtrés.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" }, category: { type: "string" }, zone: { type: "string" },
          status: { type: "string" }, is_active: { type: "boolean" },
          has_audio_fr: { type: "boolean" }, has_audio_en: { type: "boolean" }, has_hero_image: { type: "boolean" },
          missing_field: { type: "string" },
          extra_fields: { type: "array", items: { type: "string" } },
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
          name: { type: "string" }, category: { type: "string" }, zone: { type: "string" },
          status: { type: "string" }, is_active: { type: "boolean" },
          has_audio_fr: { type: "boolean" }, has_audio_en: { type: "boolean" }, has_hero_image: { type: "boolean" },
          missing_field: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_poi_detail",
      description: "Fiche complète d'un POI par id (uuid) ou name.",
      parameters: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } } },
    },
  },
  { type: "function", function: { name: "pipeline_stats", description: "Stats globales d'enrichissement.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "list_categories", description: "Catégories distinctes + comptes.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "list_zones", description: "Zones distinctes + comptes.", parameters: { type: "object", properties: {} } } },
  {
    type: "function",
    function: {
      name: "find_duplicates",
      description: "Détecte doublons par nom approchant (ILIKE) ou GPS proche (< X mètres, défaut 30m).",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nom à chercher (ILIKE)" },
          radius_m: { type: "integer", default: 30, minimum: 5, maximum: 200 },
          lat: { type: "number" }, lng: { type: "number" },
        },
      },
    },
  },

  // WRITES
  {
    type: "function",
    function: {
      name: "update_poi",
      description: "Met à jour un ou plusieurs champs whitelistés sur un POI (par id).",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID du POI" },
          updates: { type: "object", description: "Objet { champ: valeur } (whitelist)" },
        },
        required: ["id", "updates"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_poi_status",
      description: "Raccourci pour changer le status (draft/validated/archived) et/ou is_active.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          status: { type: "string" },
          is_active: { type: "boolean" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_poi",
      description: "Supprime un POI. ACTION DESTRUCTIVE — exige confirm:true après accord utilisateur.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" }, confirm: { type: "boolean" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "merge_pois",
      description: "Fusionne des doublons : déplace les poi_media vers canonical_id puis supprime les autres. ACTION DESTRUCTIVE — exige confirm:true.",
      parameters: {
        type: "object",
        properties: {
          canonical_id: { type: "string" },
          duplicate_ids: { type: "array", items: { type: "string" } },
          confirm: { type: "boolean" },
        },
        required: ["canonical_id", "duplicate_ids"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_update",
      description: "Update sur plusieurs POIs sélectionnés par filtre (max 50). ACTION SENSIBLE — exige confirm:true.",
      parameters: {
        type: "object",
        properties: {
          filter: {
            type: "object",
            description: "Mêmes clés que query_pois (name, category, zone, status, is_active, missing_field, has_audio_fr/en, has_hero_image)",
          },
          updates: { type: "object" },
          confirm: { type: "boolean" },
          limit: { type: "integer", maximum: 50, default: 50 },
        },
        required: ["filter", "updates"],
      },
    },
  },

  // ACTIONS (edge functions)
  {
    type: "function",
    function: {
      name: "generate_audio",
      description: "Génère un audio TTS pour un POI. Crée chemin versionné (timestamp) et update le champ audio_url correspondant.",
      parameters: {
        type: "object",
        properties: {
          poi_id: { type: "string" },
          lang: { type: "string", enum: ["fr", "en", "ar"] },
          kind: { type: "string", enum: ["history", "anecdote"], default: "history" },
        },
        required: ["poi_id", "lang"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "enrich_poi",
      description: "Lance un agent d'enrichissement sur un POI précis.",
      parameters: {
        type: "object",
        properties: {
          poi_id: { type: "string" },
          agent: { type: "string", enum: ["anecdote-enricher", "wiki-name-enricher", "poi-enricher"] },
        },
        required: ["poi_id", "agent"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "translate_poi_fields",
      description: "Traduit les champs FR -> EN manquants d'un POI via la fonction translate.",
      parameters: { type: "object", properties: { poi_id: { type: "string" } }, required: ["poi_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_photos",
      description: "Récupère la photo Google Places pour un POI (poi-fetch-photos).",
      parameters: { type: "object", properties: { poi_id: { type: "string" } }, required: ["poi_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "run_quality_agent",
      description: "Lance poi-quality-agent (dry_run par défaut).",
      parameters: { type: "object", properties: { dry_run: { type: "boolean", default: true } } },
    },
  },
  {
    type: "function",
    function: {
      name: "run_watchdog",
      description: "Lance poi-watchdog.",
      parameters: { type: "object", properties: {} },
    },
  },
];

// ---------- Filters helper ----------
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

// ---------- Invoke other edge function ----------
async function invokeEdge(name: string, body: any) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE}`,
      apikey: SERVICE_ROLE,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await r.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { ok: r.ok, status: r.status, data };
}

// ---------- Tool implementations ----------
async function execTool(sb: any, name: string, args: any, isAdmin: boolean): Promise<any> {
  const WRITE_TOOLS = new Set([
    "update_poi", "set_poi_status", "delete_poi", "merge_pois", "bulk_update",
    "generate_audio", "enrich_poi", "translate_poi_fields", "fetch_photos",
    "run_quality_agent", "run_watchdog",
  ]);
  const DESTRUCTIVE = new Set(["delete_poi", "merge_pois", "bulk_update"]);

  if (WRITE_TOOLS.has(name) && !isAdmin) {
    return { error: "Action refusée : droit admin requis pour cet outil." };
  }
  if (DESTRUCTIVE.has(name) && args?.confirm !== true) {
    return {
      error: "CONFIRMATION REQUISE",
      message: "Présente exactement ce qui sera fait à l'utilisateur, attends son accord ('ok', 'oui', 'vas-y'), puis rappelle ce même outil avec confirm:true.",
    };
  }

  try {
    // ---------- READS ----------
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

    if (name === "find_duplicates") {
      const out: any[] = [];
      if (args.name) {
        const { data } = await sb.from("medina_pois")
          .select("id, name, name_fr, lat, lng, status, is_active, audio_url_fr, hero_image")
          .or(`name.ilike.%${args.name}%,name_fr.ilike.%${args.name}%,name_en.ilike.%${args.name}%`)
          .limit(50);
        out.push(...(data ?? []).map((r: any) => ({ ...r, match: "name" })));
      }
      if (typeof args.lat === "number" && typeof args.lng === "number") {
        const radius = args.radius_m ?? 30;
        const dLat = radius / 111000;
        const dLng = radius / (111000 * Math.cos(args.lat * Math.PI / 180));
        const { data } = await sb.from("medina_pois")
          .select("id, name, lat, lng, status, is_active")
          .gte("lat", args.lat - dLat).lte("lat", args.lat + dLat)
          .gte("lng", args.lng - dLng).lte("lng", args.lng + dLng)
          .limit(50);
        // Haversine refine
        const haversine = (a: any, b: any) => {
          const R = 6371000;
          const toRad = (x: number) => x * Math.PI / 180;
          const dLat2 = toRad(b.lat - a.lat);
          const dLng2 = toRad(b.lng - a.lng);
          const s = Math.sin(dLat2 / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng2 / 2) ** 2;
          return 2 * R * Math.asin(Math.sqrt(s));
        };
        const ref = { lat: args.lat, lng: args.lng };
        for (const r of data ?? []) {
          const d = haversine(ref, r);
          if (d <= radius) out.push({ ...r, match: "geo", distance_m: Math.round(d) });
        }
      }
      // Dedup by id
      const seen = new Set<string>();
      const dedup = out.filter((r: any) => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
      return { count: dedup.length, results: dedup };
    }

    // ---------- WRITES on medina_pois ----------
    if (name === "update_poi") {
      if (!args.id || !args.updates || typeof args.updates !== "object") {
        return { error: "id et updates requis" };
      }
      const clean: Record<string, any> = {};
      const rejected: string[] = [];
      for (const [k, v] of Object.entries(args.updates)) {
        if (UPDATE_FIELD_WHITELIST.has(k)) clean[k] = v;
        else rejected.push(k);
      }
      if (Object.keys(clean).length === 0) return { error: "Aucun champ valide à mettre à jour", rejected };
      const { data, error } = await sb.from("medina_pois").update(clean).eq("id", args.id).select("id, name").maybeSingle();
      if (error) throw error;
      console.log("[agent] update_poi", args.id, Object.keys(clean));
      return { ok: true, updated: clean, rejected, poi: data };
    }

    if (name === "set_poi_status") {
      const patch: any = {};
      if (args.status) patch.status = args.status;
      if (typeof args.is_active === "boolean") patch.is_active = args.is_active;
      if (args.status === "validated") patch.validated_at = new Date().toISOString();
      if (Object.keys(patch).length === 0) return { error: "status ou is_active requis" };
      const { data, error } = await sb.from("medina_pois").update(patch).eq("id", args.id).select("id, name, status, is_active").maybeSingle();
      if (error) throw error;
      console.log("[agent] set_poi_status", args.id, patch);
      return { ok: true, poi: data };
    }

    if (name === "delete_poi") {
      // Cascade: delete poi_media first
      await sb.from("poi_media").delete().eq("medina_poi_id", args.id);
      const { data, error } = await sb.from("medina_pois").delete().eq("id", args.id).select("id, name").maybeSingle();
      if (error) throw error;
      console.log("[agent] delete_poi", args.id);
      return { ok: true, deleted: data };
    }

    if (name === "merge_pois") {
      const { canonical_id, duplicate_ids } = args;
      if (!canonical_id || !Array.isArray(duplicate_ids) || duplicate_ids.length === 0) {
        return { error: "canonical_id et duplicate_ids requis" };
      }
      // Move poi_media
      await sb.from("poi_media").update({ medina_poi_id: canonical_id }).in("medina_poi_id", duplicate_ids);
      // Delete duplicates
      const { data, error } = await sb.from("medina_pois").delete().in("id", duplicate_ids).select("id, name");
      if (error) throw error;
      console.log("[agent] merge_pois", canonical_id, "<-", duplicate_ids);
      return { ok: true, merged_into: canonical_id, removed: data };
    }

    if (name === "bulk_update") {
      const clean: Record<string, any> = {};
      const rejected: string[] = [];
      for (const [k, v] of Object.entries(args.updates ?? {})) {
        if (UPDATE_FIELD_WHITELIST.has(k)) clean[k] = v; else rejected.push(k);
      }
      if (Object.keys(clean).length === 0) return { error: "Aucun champ valide", rejected };
      const limit = Math.min(args.limit ?? 50, 50);
      let q = sb.from("medina_pois").select("id");
      q = applyFilters(q, args.filter ?? {});
      const { data: targets, error: e1 } = await q.limit(limit);
      if (e1) throw e1;
      const ids = (targets ?? []).map((r: any) => r.id);
      if (ids.length === 0) return { ok: true, updated: 0, message: "Aucun POI ne correspond au filtre" };
      const { error: e2 } = await sb.from("medina_pois").update(clean).in("id", ids);
      if (e2) throw e2;
      console.log("[agent] bulk_update", ids.length, "rows", Object.keys(clean));
      return { ok: true, updated_count: ids.length, ids: ids.slice(0, 10), updates: clean, rejected };
    }

    // ---------- ACTIONS (edge function calls) ----------
    if (name === "generate_audio") {
      const ts = Date.now();
      const kind = args.kind ?? "history";
      const filename = kind === "anecdote"
        ? `anecdote_${args.lang}_v${ts}.mp3`
        : `${args.lang}_v${ts}.mp3`;
      const r = await invokeEdge("generate-poi-audio", {
        poi_id: args.poi_id, lang: args.lang, kind, filename,
      });
      return { ok: r.ok, status: r.status, result: r.data };
    }

    if (name === "enrich_poi") {
      const r = await invokeEdge(args.agent, { poi_id: args.poi_id, ids: [args.poi_id] });
      return { ok: r.ok, status: r.status, result: r.data };
    }

    if (name === "translate_poi_fields") {
      const r = await invokeEdge("translate", { poi_id: args.poi_id });
      return { ok: r.ok, status: r.status, result: r.data };
    }

    if (name === "fetch_photos") {
      const r = await invokeEdge("poi-fetch-photos", { poi_id: args.poi_id, ids: [args.poi_id] });
      return { ok: r.ok, status: r.status, result: r.data };
    }

    if (name === "run_quality_agent") {
      const r = await invokeEdge("poi-quality-agent", { dry_run: args.dry_run ?? true });
      return { ok: r.ok, status: r.status, result: r.data };
    }

    if (name === "run_watchdog") {
      const r = await invokeEdge("poi-watchdog", {});
      return { ok: r.ok, status: r.status, result: r.data };
    }

    return { error: `Outil inconnu: ${name}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------- Gateway ----------
async function callGateway(apiKey: string, body: any) {
  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function resolveAdminFromAuthHeader(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) {
    return { isAdmin: false, userId: null, reason: "missing_bearer" };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return { isAdmin: false, userId: null, reason: "empty_token" };
  }

  try {
    const sbAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: userData, error: userError } = await sbAdmin.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      console.warn("[agent-chat] getUser failed", userError);
      return { isAdmin: false, userId: null, reason: userError?.message ?? "user_not_found" };
    }

    const userId = userData.user.id;
    const { data: roleCheck, error: roleError } = await sbAdmin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (roleError) {
      console.warn("[agent-chat] has_role failed", roleError);
      return { isAdmin: false, userId, reason: roleError.message };
    }

    return { isAdmin: roleCheck === true, userId, reason: roleCheck === true ? "ok" : "not_admin" };
  } catch (e) {
    console.warn("[agent-chat] auth resolution failed", e);
    return {
      isAdmin: false,
      userId: null,
      reason: e instanceof Error ? e.message : String(e),
    };
  }
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

    const authHeader = req.headers.get("Authorization");
    const { isAdmin, userId, reason: adminReason } = await resolveAdminFromAuthHeader(authHeader);
    console.log("[agent-chat] auth", { isAdmin, userId, reason: adminReason });

    // Service role client for tools (bypasses RLS — admin guard is enforced in execTool)
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    const sysPrompt = isAdmin
      ? SYSTEM_PROMPT
      : SYSTEM_PROMPT + "\n\nIMPORTANT : l'utilisateur courant N'EST PAS admin. Tu n'as accès qu'aux outils de LECTURE. Refuse poliment toute demande de modification.";

    const convo: any[] = [
      { role: "system", content: sysPrompt },
      ...messages,
    ];

    const MAX_ITER = 10;
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
        convo.push({ role: "assistant", content: msg.content ?? "", tool_calls: toolCalls });
        for (const tc of toolCalls) {
          let args: any = {};
          try { args = JSON.parse(tc.function?.arguments || "{}"); } catch {}
          const result = await execTool(sb, tc.function?.name, args, isAdmin);
          convo.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result).slice(0, 12000),
          });
        }
        continue;
      }

      const streamResp = await callGateway(LOVABLE_API_KEY, {
        model: "google/gemini-2.5-flash",
        messages: [
          ...convo,
          { role: "system", content: "Réponds maintenant à l'utilisateur en te basant uniquement sur les données et résultats d'outils ci-dessus. Concis, en français, markdown si pertinent. Si une action destructive vient d'être bloquée pour confirmation, présente clairement ce qui sera fait et demande l'accord." },
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
