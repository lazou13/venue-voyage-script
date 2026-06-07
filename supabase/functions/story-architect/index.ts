// story-architect — PR2-C
// Génère une couche narrative "geo_series" et l'écrit UNIQUEMENT dans
// public.pois.step_config.narrative_layer (jamais dans medina_pois).
//
// Lecture POI : table `pois` (champs projet) + fallback factuel via
// `pois.library_poi_id -> medina_pois` (lecture seule).
//
// Aucune migration. Aucun champ classique modifié. Pas d'audio.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_POIS = 8;
const NARRATIVE_VERSION = "story-architect-v1";
const MODEL = Deno.env.get("STORY_ARCHITECT_MODEL") || "google/gemini-3-flash-preview";

type Json = Record<string, unknown>;

interface Input {
  project_id: string;
  poi_ids: string[];
  format: string;
  tone: string;
  goal: string;
  language?: string;
  max_pois?: number;
  regenerate?: boolean;
  dry_run?: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validateInput(raw: unknown): { ok: true; data: Required<Input> } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "body must be an object" };
  const b = raw as Json;
  const project_id = String(b.project_id ?? "");
  const poi_ids = Array.isArray(b.poi_ids) ? b.poi_ids.map(String) : [];
  const format = String(b.format ?? "");
  const tone = String(b.tone ?? "");
  const goal = String(b.goal ?? "");
  const language = (b.language ? String(b.language) : "fr").toLowerCase();
  const max_pois = Math.min(MAX_POIS, Math.max(1, Number(b.max_pois ?? MAX_POIS)));
  const regenerate = Boolean(b.regenerate ?? false);
  const dry_run = Boolean(b.dry_run ?? false);

  if (!UUID_RE.test(project_id)) return { ok: false, error: "project_id must be a uuid" };
  if (poi_ids.length < 1) return { ok: false, error: "poi_ids must contain at least 1 id" };
  if (poi_ids.length > MAX_POIS) return { ok: false, error: `poi_ids max is ${MAX_POIS}` };
  if (!poi_ids.every((id) => UUID_RE.test(id))) return { ok: false, error: "poi_ids must be uuids" };
  if (new Set(poi_ids).size !== poi_ids.length) return { ok: false, error: "poi_ids must be unique" };
  if (!format || !tone || !goal) return { ok: false, error: "format, tone, goal are required" };
  if (!["fr", "en"].includes(language)) return { ok: false, error: "language must be fr or en" };

  return {
    ok: true,
    data: { project_id, poi_ids, format, tone, goal, language, max_pois, regenerate, dry_run },
  };
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function buildSystemPrompt(language: string): string {
  const fr = `Tu es Story Architect, scénariste de séries audio géolocalisées immersives pour la médina de Marrakech.
Tu produis une œuvre éditoriale (PAS un article Wikipedia) : ton vivant, immersif, sensoriel.

RÈGLES ABSOLUES :
- N'invente JAMAIS de fait historique. Si une info est incertaine, écris : "selon certaines sources", "la tradition raconte", "il est souvent dit que".
- Si tu n'as aucune donnée factuelle pour un POI, formule prudemment et concentre-toi sur l'ambiance/sensoriel. Ne fabrique pas de dates, noms d'architectes ou événements.
- Mission = photo + émotion + histoire. Facile, fun, partageable, réalisable en vacances en 3-5 min.
- Mission NON intrusive : pas d'interaction obligatoire avec vendeurs, habitants ou passants.
- Pas de photo de personnes identifiables sans consentement. Toujours fournir un champ "respect_rules".
- Le visiteur doit s'amuser, pas passer un examen. Évite les quiz scolaires.

Tu réponds STRICTEMENT en JSON valide, sans markdown, sans backticks, sans commentaire.`;
  const en = `You are Story Architect, screenwriter for immersive geolocated audio series in the Marrakech medina.
Output an editorial piece (NOT Wikipedia): vivid, immersive, sensory tone.

ABSOLUTE RULES:
- NEVER invent historical facts. If uncertain, write: "according to some sources", "tradition has it", "it is often said that".
- If you have no factual data for a POI, stay sensory and prudent. Do not fabricate dates, architects or events.
- Mission = photo + emotion + story. Easy, fun, shareable, doable on vacation in 3-5 min.
- Mission MUST be non-intrusive: no forced interaction with vendors, locals or passers-by.
- No identifiable people photographed without consent. Always include "respect_rules".
- The visitor must have fun, not pass an exam. Avoid school-style quizzes.

Reply STRICTLY in valid JSON, no markdown, no backticks, no comments.`;
  return language === "en" ? en : fr;
}

function truncate(s: string | null | undefined, n: number): string {
  if (!s) return "";
  const t = String(s).trim();
  return t.length <= n ? t : t.slice(0, n) + "…";
}

interface MergedPoi {
  id: string;
  name: string;
  zone?: string | null;
  lat?: number | null;
  lng?: number | null;
  history?: string;
  anecdote?: string;
  fun_fact?: string;
  must_see?: string;
  must_try?: string;
  wiki?: string;
}

function buildUserPrompt(input: Required<Input>, pois: MergedPoi[]): string {
  const header = {
    project_id: input.project_id,
    language: input.language,
    format: input.format,
    tone: input.tone,
    goal: input.goal,
    total_episodes: pois.length,
  };
  const items = pois.map((p, i) => ({
    index: i + 1,
    poi_id: p.id,
    name: p.name,
    zone: p.zone ?? null,
    facts: {
      history: truncate(p.history, 500),
      anecdote: truncate(p.anecdote, 300),
      fun_fact: truncate(p.fun_fact, 200),
      must_see: truncate(p.must_see, 200),
      must_try: truncate(p.must_try, 200),
      wikipedia: truncate(p.wiki, 300),
    },
  }));

  const schema = `{
  "series": {
    "title": "string",
    "format": "string",
    "red_thread": "string",
    "visitor_transformation": "string",
    "guide_tone_arc": ["string"]
  },
  "episodes": [
    {
      "poi_id": "uuid (doit correspondre au POI fourni dans l'ordre)",
      "number": 1,
      "title": "string",
      "emotion": "string",
      "hook": "string ≤ 180 car",
      "scene": ["3 à 5 lignes immersives"],
      "secret": "string ≤ 500 car (formulation prudente si incertain)",
      "mission": {
        "title": "string",
        "instruction": "string courte",
        "caption": "string partageable",
        "photo_required": true,
        "respect_rules": "string"
      },
      "revelation": "string ≤ 400 car",
      "cliffhanger": "string ≤ 200 car",
      "transition_to_next": "string ≤ 200 car (ou vide pour le dernier)"
    }
  ],
  "guide": {
    "persona": "string en cohérence avec 'tone'",
    "arrival_script": "string 2-3 phrases d'accueil"
  }
}`;

  return [
    "Contexte :",
    JSON.stringify(header, null, 2),
    "",
    "POI ordonnés (l'ordre = ordre des épisodes, ne change pas l'ordre) :",
    JSON.stringify(items, null, 2),
    "",
    "Produis un JSON STRICT respectant ce schéma :",
    schema,
    "",
    "Ne renvoie rien d'autre que le JSON.",
  ].join("\n");
}

function safeParseJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(trimmed);
}

interface AiEpisode {
  poi_id?: string;
  number?: number;
  title?: string;
  emotion?: string;
  hook?: string;
  scene?: string[];
  secret?: string;
  mission?: {
    title?: string;
    instruction?: string;
    caption?: string;
    photo_required?: boolean;
    respect_rules?: string;
  };
  revelation?: string;
  cliffhanger?: string;
  transition_to_next?: string;
}
interface AiPayload {
  series: Json;
  episodes: AiEpisode[];
  guide?: Json;
}

function validateAiPayload(raw: unknown, pois: MergedPoi[]): { ok: true; data: AiPayload } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "AI payload not an object" };
  const p = raw as Json;
  if (!p.series || typeof p.series !== "object") return { ok: false, error: "series missing" };
  if (!Array.isArray(p.episodes)) return { ok: false, error: "episodes missing" };
  if (p.episodes.length !== pois.length) return { ok: false, error: `episodes length ${p.episodes.length} != pois ${pois.length}` };
  for (let i = 0; i < pois.length; i++) {
    const ep = p.episodes[i] as AiEpisode;
    if (!ep || typeof ep !== "object") return { ok: false, error: `episode[${i}] not an object` };
    if (!ep.hook || typeof ep.hook !== "string") return { ok: false, error: `episode[${i}].hook missing` };
    if (!Array.isArray(ep.scene) || ep.scene.length === 0) return { ok: false, error: `episode[${i}].scene missing` };
    if (!ep.mission || !ep.mission.instruction) return { ok: false, error: `episode[${i}].mission.instruction missing` };
  }
  return { ok: true, data: p as unknown as AiPayload };
}

function buildNarrativeLayer(
  input: Required<Input>,
  series: Json,
  guide: Json | undefined,
  episode: AiEpisode,
  index: number,
  total: number,
) {
  return {
    version: "1.0",
    product_type: "geo_series",
    series: {
      title: series.title ?? null,
      format: input.format,
      red_thread: series.red_thread ?? null,
      visitor_transformation: series.visitor_transformation ?? null,
      guide_tone_arc: Array.isArray(series.guide_tone_arc) ? series.guide_tone_arc : [],
    },
    episode: {
      number: index + 1,
      total,
      title: episode.title ?? null,
      emotion: episode.emotion ?? null,
      hook: episode.hook ?? "",
      scene: episode.scene ?? [],
      secret: episode.secret ?? null,
      mission: {
        title: episode.mission?.title ?? null,
        instruction: episode.mission?.instruction ?? "",
        caption: episode.mission?.caption ?? null,
        photo_required: episode.mission?.photo_required ?? true,
        respect_rules:
          episode.mission?.respect_rules ??
          "Pas de photo de personnes identifiables sans leur accord. Reste discret et respectueux des lieux.",
      },
      revelation: episode.revelation ?? null,
      cliffhanger: episode.cliffhanger ?? null,
      transition_to_next: index === total - 1 ? null : (episode.transition_to_next ?? null),
    },
    guide: {
      persona: (guide?.persona as string) ?? input.tone,
      arrival_script: (guide?.arrival_script as string) ?? null,
      faq_context: [],
    },
    audio: { series_audio_fr: null, series_audio_en: null },
    meta: {
      generated_at: new Date().toISOString(),
      version: NARRATIVE_VERSION,
      model: MODEL,
      format: input.format,
      tone: input.tone,
      goal: input.goal,
      language: input.language,
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const runId = crypto.randomUUID();
  try {
    // ---- Auth ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await userClient.auth.getClaims(token);
    if (authErr || !claims?.claims?.sub) return jsonResponse({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE);

    // Admin check via has_role SQL helper (exists per project RLS policies)
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) {
      console.error("[story-architect] has_role error", roleErr);
      return jsonResponse({ error: "Authorization check failed" }, 500);
    }
    if (!isAdmin) return jsonResponse({ error: "Forbidden: admin only" }, 403);

    // ---- Input ----
    const body = await req.json().catch(() => null);
    const validated = validateInput(body);
    if (!validated.ok) return jsonResponse({ error: validated.error }, 400);
    const input = validated.data;
    console.log(`[story-architect] run=${runId} project=${input.project_id} pois=${input.poi_ids.length} dry=${input.dry_run}`);

    // ---- Load project POIs (ordered as input) ----
    const { data: projectPois, error: poisErr } = await admin
      .from("pois")
      .select("id, project_id, name, name_fr, name_en, zone, step_config, history_context, local_anecdote_fr, fun_fact_fr, wikipedia_summary, library_poi_id")
      .eq("project_id", input.project_id)
      .in("id", input.poi_ids);
    if (poisErr) {
      console.error("[story-architect] pois read error", poisErr);
      return jsonResponse({ error: "Failed to read project POIs" }, 500);
    }

    const byId = new Map<string, typeof projectPois[number]>();
    for (const p of projectPois ?? []) byId.set(p.id, p);
    const missing = input.poi_ids.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      return jsonResponse({ error: `POIs not found in project: ${missing.join(",")}` }, 400);
    }

    // ---- Fallback factual lookup in medina_pois via library_poi_id (READ ONLY) ----
    const libIds = (projectPois ?? []).map((p) => p.library_poi_id).filter(Boolean) as string[];
    const libMap = new Map<string, Json>();
    if (libIds.length > 0) {
      const { data: libRows } = await admin
        .from("medina_pois")
        .select("id, history_context, local_anecdote_fr, fun_fact_fr, must_see_details, must_try, must_visit_nearby, wikipedia_summary, wikidata_description")
        .in("id", libIds);
      for (const r of libRows ?? []) libMap.set(r.id as string, r as Json);
    }

    const merged: MergedPoi[] = input.poi_ids.map((id) => {
      const p = byId.get(id)!;
      const lib = p.library_poi_id ? (libMap.get(p.library_poi_id as string) ?? {}) : {};
      return {
        id,
        name: (p.name_fr || p.name || (lib.name_fr as string) || "POI") as string,
        zone: p.zone ?? null,
        history: (p.history_context as string) || (lib.history_context as string) || "",
        anecdote: (p.local_anecdote_fr as string) || (lib.local_anecdote_fr as string) || "",
        fun_fact: (p.fun_fact_fr as string) || (lib.fun_fact_fr as string) || "",
        must_see: (lib.must_see_details as string) || "",
        must_try: (lib.must_try as string) || "",
        wiki: (p.wikipedia_summary as string) || (lib.wikipedia_summary as string) || (lib.wikidata_description as string) || "",
      };
    });

    // ---- Cache lookup ----
    const cacheKeySource = JSON.stringify({
      v: NARRATIVE_VERSION,
      project_id: input.project_id,
      poi_ids: input.poi_ids,
      format: input.format,
      tone: input.tone,
      goal: input.goal,
      language: input.language,
      model: MODEL,
    });
    const signature = await sha256Hex(cacheKeySource);

    let aiPayload: AiPayload | null = null;
    let cacheHit = false;
    if (!input.regenerate) {
      const { data: cached } = await admin
        .from("quest_narratives_cache")
        .select("narrative")
        .eq("signature", signature)
        .maybeSingle();
      if (cached?.narrative) {
        const validated = validateAiPayload(cached.narrative, merged);
        if (validated.ok) {
          aiPayload = validated.data;
          cacheHit = true;
          console.log(`[story-architect] run=${runId} cache HIT`);
        }
      }
    }

    // ---- AI call ----
    if (!aiPayload) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) return jsonResponse({ error: "LOVABLE_API_KEY missing" }, 500);

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: buildSystemPrompt(input.language) },
            { role: "user", content: buildUserPrompt(input, merged) },
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
          max_tokens: 3000,
        }),
      });

      if (!aiResp.ok) {
        const t = await aiResp.text();
        console.error(`[story-architect] AI error ${aiResp.status}`, t);
        if (aiResp.status === 429) return jsonResponse({ error: "Rate limit, retry later" }, 429);
        if (aiResp.status === 402) return jsonResponse({ error: "AI credits exhausted" }, 402);
        return jsonResponse({ error: "AI gateway error", status: aiResp.status }, 502);
      }
      const aiJson = await aiResp.json();
      const text: string = aiJson?.choices?.[0]?.message?.content ?? "";

      let parsed: unknown;
      try { parsed = safeParseJson(text); }
      catch (e) {
        console.error("[story-architect] invalid JSON from AI", e, text.slice(0, 400));
        return jsonResponse({ error: "AI returned invalid JSON" }, 502);
      }
      const validated = validateAiPayload(parsed, merged);
      if (!validated.ok) {
        console.error("[story-architect] AI payload invalid:", validated.error);
        return jsonResponse({ error: `AI payload invalid: ${validated.error}` }, 502);
      }
      aiPayload = validated.data;

      // Write cache (best-effort, ignore conflicts)
      const { error: cacheErr } = await admin.from("quest_narratives_cache").insert({
        signature,
        narrative_version: NARRATIVE_VERSION,
        theme: input.format,
        audience: input.goal,
        difficulty: 0,
        poi_ids: input.poi_ids,
        narrative: aiPayload as unknown as Json,
      });
      if (cacheErr) console.warn("[story-architect] cache insert failed (non-fatal)", cacheErr.message);
    }

    // ---- Per-POI write (merge step_config.narrative_layer only) ----
    const total = merged.length;
    const results: Array<{ poi_id: string; status: string; narrative_layer?: Json; error: string | null }> = [];

    for (let i = 0; i < merged.length; i++) {
      const poi = merged[i];
      const ep = aiPayload.episodes[i];
      try {
        const layer = buildNarrativeLayer(input, aiPayload.series, aiPayload.guide, ep, i, total);

        if (input.dry_run) {
          results.push({ poi_id: poi.id, status: "skipped", narrative_layer: layer, error: null });
          continue;
        }

        // Read current step_config, merge only narrative_layer, write back.
        const { data: row, error: readErr } = await admin
          .from("pois")
          .select("step_config")
          .eq("project_id", input.project_id)
          .eq("id", poi.id)
          .single();
        if (readErr) throw readErr;

        const current = (row?.step_config && typeof row.step_config === "object") ? row.step_config as Json : {};
        const next = { ...current, narrative_layer: layer };

        const { error: updErr } = await admin
          .from("pois")
          .update({ step_config: next })
          .eq("project_id", input.project_id)
          .eq("id", poi.id);
        if (updErr) throw updErr;

        results.push({
          poi_id: poi.id,
          status: cacheHit ? "cached" : "generated",
          narrative_layer: layer,
          error: null,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[story-architect] POI ${poi.id} failed:`, msg);
        results.push({ poi_id: poi.id, status: "error", error: msg });
      }
    }

    return jsonResponse({
      ok: true,
      run_id: runId,
      project_id: input.project_id,
      language: input.language,
      dry_run: input.dry_run,
      cache: { hit: cacheHit },
      series: aiPayload.series,
      results,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[story-architect] run=${runId} fatal`, msg);
    return jsonResponse({ error: msg }, 500);
  }
});
