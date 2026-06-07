// story-architect — v2 (PR3-A)
// Enrichisseur de POI médina : génère une `story_layer` par medina_poi et
// l'écrit UNIQUEMENT dans `medina_pois.metadata.story_layer` (jamais dans `pois`).
//
// - Pas de notion de série / épisode / project_id.
// - Lecture: medina_pois (source de vérité).
// - Écriture: medina_pois.metadata via jsonb_set (préserve les autres clés).
// - Cache: quest_narratives_cache, clé par POI.
// - Aucune migration SQL. Aucun audio. Aucun champ classique modifié.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_POIS = 8;
const NARRATIVE_VERSION = "story-architect-v2";
const MODEL =
  Deno.env.get("STORY_ARCHITECT_MODEL") || "google/gemini-3-flash-preview";

const TONES = ["mysterious", "insolent", "family", "premium"] as const;
const GOALS = ["fun_share", "cultural_immersive", "light_investigation"] as const;
type Tone = typeof TONES[number];
type Goal = typeof GOALS[number];

type Json = Record<string, unknown>;

interface InputV2 {
  medina_poi_ids: string[];
  language: "fr" | "en";
  tone: Tone;
  goal: Goal;
  dry_run: boolean;
  regenerate: boolean;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validateInput(
  raw: unknown,
): { ok: true; data: InputV2 } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "body must be an object" };
  }
  const b = raw as Json;

  // Reject legacy v1 keys explicitly.
  for (const legacy of ["project_id", "poi_ids", "format", "max_pois"]) {
    if (legacy in b) {
      return {
        ok: false,
        error: `legacy key '${legacy}' is not accepted in v2; use medina_poi_ids`,
      };
    }
  }

  const ids = Array.isArray(b.medina_poi_ids) ? b.medina_poi_ids.map(String) : [];
  if (ids.length < 1) {
    return { ok: false, error: "medina_poi_ids must contain at least 1 id" };
  }
  if (ids.length > MAX_POIS) {
    return { ok: false, error: `medina_poi_ids max is ${MAX_POIS}` };
  }
  if (!ids.every((id) => UUID_RE.test(id))) {
    return { ok: false, error: "medina_poi_ids must be uuids" };
  }
  if (new Set(ids).size !== ids.length) {
    return { ok: false, error: "medina_poi_ids must be unique" };
  }

  const language = (b.language ? String(b.language) : "fr").toLowerCase();
  if (language !== "fr" && language !== "en") {
    return { ok: false, error: "language must be 'fr' or 'en'" };
  }

  const tone = String(b.tone ?? "");
  if (!TONES.includes(tone as Tone)) {
    return { ok: false, error: `tone must be one of: ${TONES.join(", ")}` };
  }

  const goal = String(b.goal ?? "");
  if (!GOALS.includes(goal as Goal)) {
    return { ok: false, error: `goal must be one of: ${GOALS.join(", ")}` };
  }

  const dry_run = b.dry_run === undefined ? true : Boolean(b.dry_run);
  const regenerate = Boolean(b.regenerate ?? false);

  return {
    ok: true,
    data: {
      medina_poi_ids: ids,
      language: language as "fr" | "en",
      tone: tone as Tone,
      goal: goal as Goal,
      dry_run,
      regenerate,
    },
  };
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function truncate(s: string | null | undefined, n: number): string {
  if (!s) return "";
  const t = String(s).trim();
  return t.length <= n ? t : t.slice(0, n) + "…";
}

interface MedinaPoiRow {
  id: string;
  name: string | null;
  name_fr: string | null;
  name_en: string | null;
  category: string | null;
  subcategory: string | null;
  zone: string | null;
  district: string | null;
  lat: number | null;
  lng: number | null;
  history_context: string | null;
  history_context_en: string | null;
  local_anecdote_fr: string | null;
  local_anecdote_en: string | null;
  fun_fact_fr: string | null;
  fun_fact_en: string | null;
  must_see_details: string | null;
  must_see_details_en: string | null;
  must_try: string | null;
  must_try_en: string | null;
  must_visit_nearby: string | null;
  must_visit_nearby_en: string | null;
  wikipedia_summary: string | null;
  wikidata_description: string | null;
  story_fr: string | null;
  story_en: string | null;
  metadata: Json | null;
}

interface FactPack {
  id: string;
  name: string;
  zone: string | null;
  category: string | null;
  history: string;
  anecdote: string;
  fun_fact: string;
  must_see: string;
  must_try: string;
  must_visit_nearby: string;
  wiki: string;
  story: string;
}

function packFacts(row: MedinaPoiRow, lang: "fr" | "en"): FactPack {
  const pick = (fr: string | null, en: string | null) =>
    (lang === "en" ? en || fr : fr || en) || "";
  return {
    id: row.id,
    name: row.name_fr || row.name || row.name_en || "POI",
    zone: row.zone ?? row.district ?? null,
    category: row.subcategory || row.category || null,
    history: pick(row.history_context, row.history_context_en),
    anecdote: pick(row.local_anecdote_fr, row.local_anecdote_en),
    fun_fact: pick(row.fun_fact_fr, row.fun_fact_en),
    must_see: pick(row.must_see_details, row.must_see_details_en),
    must_try: pick(row.must_try, row.must_try_en),
    must_visit_nearby: pick(row.must_visit_nearby, row.must_visit_nearby_en),
    wiki: pick(row.wikipedia_summary, null) || row.wikidata_description || "",
    story: pick(row.story_fr, row.story_en),
  };
}

function factsAreSufficient(f: FactPack): boolean {
  const len =
    f.history.length + f.anecdote.length + f.wiki.length + f.story.length;
  // Au moins ~120 caractères factuels exploitables pour éviter l'invention.
  return len >= 120;
}

function buildSystemPrompt(language: "fr" | "en"): string {
  const fr = `Tu es Story Architect, scénariste éditorial de POI à Marrakech (médina).
Tu produis pour CHAQUE POI une "story_layer" autonome, réutilisable (visite simple ou série).
Ton vivant, immersif, sensoriel — JAMAIS Wikipédia.

RÈGLES ABSOLUES :
- N'INVENTE JAMAIS un fait historique. Si une info est incertaine : "selon certaines sources", "la tradition raconte", "il est souvent dit que".
- Si les données factuelles fournies sont insuffisantes pour un POI : renvoie pour ce POI { "status": "insufficient_data" } à la place du contenu. Ne fabrique RIEN.
- Mission = photo + émotion + histoire. Facile, fun, partageable, réalisable seul en 3-5 min en vacances.
- Mission NON intrusive : aucune interaction obligatoire avec vendeurs, habitants ou passants.
- Pas de photo de personnes identifiables sans consentement. respect_rules est OBLIGATOIRE, non vide.
- Pas de quiz scolaire. Le visiteur s'amuse, il ne passe pas un examen.
- Contenu REUTILISABLE : pas de "épisode suivant", pas de "cliffhanger", pas de "transition vers", pas de numéro d'épisode. Aucune référence à un POI voisin.

Tu réponds STRICTEMENT en JSON valide, sans markdown, sans backticks, sans commentaire.`;

  const en = `You are Story Architect, editorial writer for POIs in Marrakech medina.
For EACH POI you produce a standalone "story_layer", reusable (single visit or series).
Vivid, immersive, sensory tone — NEVER Wikipedia.

ABSOLUTE RULES:
- NEVER invent historical facts. When uncertain: "according to some sources", "tradition has it", "it is often said that".
- If factual data for a POI is insufficient: return { "status": "insufficient_data" } for that POI instead of content. Do NOT fabricate.
- Mission = photo + emotion + story. Easy, fun, shareable, doable solo in 3-5 min on vacation.
- Mission MUST be non-intrusive: no forced interaction with vendors, locals or passers-by.
- No identifiable people photographed without consent. respect_rules is REQUIRED, non-empty.
- No school-style quizzes. The visitor has fun, not an exam.
- REUSABLE content: no "next episode", no cliffhanger, no "transition to", no episode number. No reference to a neighboring POI.

Reply STRICTLY in valid JSON, no markdown, no backticks, no comments.`;

  return language === "en" ? en : fr;
}

function buildUserPrompt(
  input: InputV2,
  facts: FactPack[],
): string {
  const items = facts.map((p, i) => ({
    index: i,
    medina_poi_id: p.id,
    name: p.name,
    zone: p.zone,
    category: p.category,
    facts: {
      history: truncate(p.history, 600),
      anecdote: truncate(p.anecdote, 350),
      fun_fact: truncate(p.fun_fact, 220),
      must_see: truncate(p.must_see, 220),
      must_try: truncate(p.must_try, 220),
      must_visit_nearby: truncate(p.must_visit_nearby, 220),
      wikipedia: truncate(p.wiki, 350),
      story: truncate(p.story, 350),
    },
  }));

  const schema = `{
  "layers": [
    {
      "medina_poi_id": "uuid (doit correspondre à l'entrée fournie, même ordre)",
      "status": "ok" | "insufficient_data",
      "hook": "string ≤ 180 car",
      "scene": ["3 à 5 lignes immersives"],
      "secret": "string ≤ 500 car (formulation prudente si incertain)",
      "emotion": "string courte",
      "mission": {
        "title": "string",
        "instruction": "string courte (3-5 min)",
        "caption": "string partageable",
        "photo_required": true,
        "respect_rules": "string non vide"
      },
      "revelation": "string ≤ 400 car",
      "guide_persona_hint": "string en cohérence avec le ton"
    }
  ]
}`;

  return [
    "Contexte :",
    JSON.stringify(
      {
        language: input.language,
        tone: input.tone,
        goal: input.goal,
        total_pois: facts.length,
      },
      null,
      2,
    ),
    "",
    "POI à enrichir (ordre = ordre de sortie, ne change pas l'ordre) :",
    JSON.stringify(items, null, 2),
    "",
    "Produis un JSON STRICT respectant ce schéma :",
    schema,
    "",
    "Si un POI a 'facts' trop pauvres pour produire un contenu authentique, mets son 'status' à 'insufficient_data' et omets les autres champs.",
    "Ne renvoie rien d'autre que le JSON.",
  ].join("\n");
}

function safeParseJson(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  return JSON.parse(trimmed);
}

interface AiLayer {
  medina_poi_id?: string;
  status?: "ok" | "insufficient_data";
  hook?: string;
  scene?: string[];
  secret?: string;
  emotion?: string;
  mission?: {
    title?: string;
    instruction?: string;
    caption?: string;
    photo_required?: boolean;
    respect_rules?: string;
  };
  revelation?: string;
  guide_persona_hint?: string;
}

function validateAiLayer(
  layer: AiLayer | undefined,
): { ok: true } | { ok: false; error: string } {
  if (!layer || typeof layer !== "object") {
    return { ok: false, error: "layer not an object" };
  }
  if (layer.status === "insufficient_data") return { ok: true };
  if (!layer.hook || typeof layer.hook !== "string") {
    return { ok: false, error: "hook missing" };
  }
  if (!Array.isArray(layer.scene) || layer.scene.length === 0) {
    return { ok: false, error: "scene missing" };
  }
  if (!layer.mission || typeof layer.mission !== "object") {
    return { ok: false, error: "mission missing" };
  }
  if (!layer.mission.instruction) {
    return { ok: false, error: "mission.instruction missing" };
  }
  if (!layer.mission.respect_rules) {
    return { ok: false, error: "mission.respect_rules missing" };
  }
  return { ok: true };
}

function buildStoryLayer(input: InputV2, layer: AiLayer): Json {
  return {
    version: "1.0",
    hook: layer.hook ?? "",
    scene: layer.scene ?? [],
    secret: layer.secret ?? null,
    emotion: layer.emotion ?? null,
    mission: {
      title: layer.mission?.title ?? null,
      instruction: layer.mission?.instruction ?? "",
      caption: layer.mission?.caption ?? null,
      photo_required: layer.mission?.photo_required ?? true,
      respect_rules:
        layer.mission?.respect_rules ??
        "Pas de photo de personnes identifiables sans leur accord. Reste discret et respectueux des lieux.",
    },
    revelation: layer.revelation ?? null,
    guide_persona_hint: layer.guide_persona_hint ?? input.tone,
    audio: { url_fr: null, url_en: null },
    meta: {
      generated_at: new Date().toISOString(),
      model: MODEL,
      language: input.language,
      tone: input.tone,
      goal: input.goal,
      source: NARRATIVE_VERSION,
    },
  };
}

async function cacheSignature(
  medina_poi_id: string,
  input: InputV2,
): Promise<string> {
  return await sha256Hex(
    JSON.stringify({
      v: NARRATIVE_VERSION,
      medina_poi_id,
      language: input.language,
      tone: input.tone,
      goal: input.goal,
      model: MODEL,
    }),
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const runId = crypto.randomUUID();
  try {
    // ---- Auth (inchangée : admin only) ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authErr } = await userClient.auth.getUser(
      token,
    );
    if (authErr || !userData?.user?.id) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE);

    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) {
      console.error("[story-architect/v2] has_role error", roleErr);
      return jsonResponse({ error: "Authorization check failed" }, 500);
    }
    if (!isAdmin) return jsonResponse({ error: "Forbidden: admin only" }, 403);

    // ---- Input ----
    const body = await req.json().catch(() => null);
    const validated = validateInput(body);
    if (!validated.ok) return jsonResponse({ error: validated.error }, 400);
    const input = validated.data;
    console.log(
      `[story-architect/v2] run=${runId} pois=${input.medina_poi_ids.length} lang=${input.language} tone=${input.tone} goal=${input.goal} dry_run=${input.dry_run} regen=${input.regenerate}`,
    );

    // ---- Load medina_pois ----
    const { data: rows, error: readErr } = await admin
      .from("medina_pois")
      .select(
        "id, name, name_fr, name_en, category, subcategory, zone, district, lat, lng, history_context, history_context_en, local_anecdote_fr, local_anecdote_en, fun_fact_fr, fun_fact_en, must_see_details, must_see_details_en, must_try, must_try_en, must_visit_nearby, must_visit_nearby_en, wikipedia_summary, wikidata_description, story_fr, story_en, metadata",
      )
      .in("id", input.medina_poi_ids);

    if (readErr) {
      console.error("[story-architect/v2] medina_pois read error", readErr);
      return jsonResponse({ error: "Failed to read medina_pois" }, 500);
    }

    const byId = new Map<string, MedinaPoiRow>();
    for (const r of (rows ?? []) as MedinaPoiRow[]) byId.set(r.id, r);
    const missing = input.medina_poi_ids.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      return jsonResponse(
        { error: `medina_pois not found: ${missing.join(",")}` },
        400,
      );
    }

    // Build per-POI fact packs in INPUT ORDER.
    const facts: FactPack[] = input.medina_poi_ids.map((id) =>
      packFacts(byId.get(id)!, input.language),
    );

    // ---- Cache lookup per POI ----
    type Slot = {
      medina_poi_id: string;
      facts: FactPack;
      cached?: Json;
      signature: string;
      sufficient: boolean;
    };
    const slots: Slot[] = [];
    for (const f of facts) {
      const signature = await cacheSignature(f.id, input);
      slots.push({
        medina_poi_id: f.id,
        facts: f,
        signature,
        sufficient: factsAreSufficient(f),
      });
    }

    let cacheCompatible = true;
    if (!input.regenerate) {
      const sigs = slots.map((s) => s.signature);
      const { data: cachedRows, error: cacheErr } = await admin
        .from("quest_narratives_cache")
        .select("signature, narrative")
        .in("signature", sigs);
      if (cacheErr) {
        console.warn(
          "[story-architect/v2] cache read failed (continuing without cache):",
          cacheErr.message,
        );
        cacheCompatible = false;
      } else {
        const map = new Map<string, Json>();
        for (const c of cachedRows ?? []) {
          map.set(c.signature as string, c.narrative as Json);
        }
        for (const s of slots) {
          const hit = map.get(s.signature);
          if (hit && typeof hit === "object") s.cached = hit;
        }
      }
    }

    // ---- AI call for non-cached POIs ----
    const toGenerate = slots.filter((s) => !s.cached && s.sufficient);
    const insufficient = slots.filter((s) => !s.cached && !s.sufficient);

    const aiLayersById = new Map<string, AiLayer>();

    if (toGenerate.length > 0) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return jsonResponse({ error: "LOVABLE_API_KEY missing" }, 500);
      }

      const promptFacts = toGenerate.map((s) => s.facts);
      const aiResp = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              { role: "system", content: buildSystemPrompt(input.language) },
              { role: "user", content: buildUserPrompt(input, promptFacts) },
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
            max_tokens: Math.min(800 + 600 * promptFacts.length, 6000),
          }),
        },
      );

      if (!aiResp.ok) {
        const t = await aiResp.text();
        console.error(
          `[story-architect/v2] AI error ${aiResp.status}`,
          t.slice(0, 400),
        );
        if (aiResp.status === 429) {
          return jsonResponse({ error: "Rate limit, retry later" }, 429);
        }
        if (aiResp.status === 402) {
          return jsonResponse({ error: "AI credits exhausted" }, 402);
        }
        return jsonResponse(
          { error: "AI gateway error", status: aiResp.status },
          502,
        );
      }

      const aiJson = await aiResp.json();
      const text: string = aiJson?.choices?.[0]?.message?.content ?? "";
      let parsed: unknown;
      try {
        parsed = safeParseJson(text);
      } catch (e) {
        console.error(
          "[story-architect/v2] invalid JSON from AI",
          e,
          text.slice(0, 400),
        );
        return jsonResponse({ error: "AI returned invalid JSON" }, 502);
      }

      const payload = parsed as { layers?: AiLayer[] } | null;
      if (!payload || !Array.isArray(payload.layers)) {
        return jsonResponse({ error: "AI payload missing 'layers' array" }, 502);
      }

      // Map by medina_poi_id, fallback to positional order if id missing.
      for (let i = 0; i < payload.layers.length; i++) {
        const l = payload.layers[i] as AiLayer;
        const id =
          l && l.medina_poi_id && UUID_RE.test(l.medina_poi_id)
            ? l.medina_poi_id
            : toGenerate[i]?.medina_poi_id;
        if (id) aiLayersById.set(id, l);
      }
    }

    // ---- Cache writes (best-effort) ----
    const cacheWrites: Array<Promise<unknown>> = [];

    // ---- Per-POI result assembly + optional DB write ----
    const results: Array<{
      medina_poi_id: string;
      status: "generated" | "cached" | "skipped" | "error";
      story_layer?: Json;
      error: string | null;
    }> = [];

    let cachedCount = 0;
    let generatedCount = 0;
    let errorCount = 0;

    for (const slot of slots) {
      try {
        let story_layer: Json | null = null;
        let status: "generated" | "cached" | "skipped" | "error" = "error";

        if (slot.cached) {
          story_layer = slot.cached;
          status = "cached";
          cachedCount++;
        } else if (!slot.sufficient) {
          throw new Error("insufficient_data: not enough factual content for this POI");
        } else {
          const aiLayer = aiLayersById.get(slot.medina_poi_id);
          if (!aiLayer) {
            throw new Error("AI did not return a layer for this POI");
          }
          if (aiLayer.status === "insufficient_data") {
            throw new Error("insufficient_data: AI flagged this POI as insufficient");
          }
          const vr = validateAiLayer(aiLayer);
          if (!vr.ok) throw new Error(`invalid layer: ${vr.error}`);

          story_layer = buildStoryLayer(input, aiLayer);
          status = "generated";
          generatedCount++;

          if (cacheCompatible) {
            cacheWrites.push(
              admin
                .from("quest_narratives_cache")
                .insert({
                  signature: slot.signature,
                  narrative_version: NARRATIVE_VERSION,
                  theme: input.tone,
                  audience: input.goal,
                  difficulty: 0,
                  poi_ids: [slot.medina_poi_id],
                  narrative: story_layer as unknown as Json,
                })
                .then(({ error }) => {
                  if (error) {
                    console.warn(
                      `[story-architect/v2] cache write failed for ${slot.medina_poi_id}: ${error.message}`,
                    );
                  }
                }),
            );
          }
        }

        if (input.dry_run) {
          // dry_run: NO DB write. Replace status with 'skipped' only when we'd have written.
          results.push({
            medina_poi_id: slot.medina_poi_id,
            status: status === "cached" ? "cached" : "skipped",
            story_layer: story_layer ?? undefined,
            error: null,
          });
          continue;
        }

        // Real write: jsonb_set metadata.story_layer, preserve other keys.
        const currentMeta =
          (byId.get(slot.medina_poi_id)?.metadata &&
            typeof byId.get(slot.medina_poi_id)!.metadata === "object" &&
            (byId.get(slot.medina_poi_id)!.metadata as Json)) ||
          {};
        const nextMeta = { ...(currentMeta as Json), story_layer };

        const { error: updErr } = await admin
          .from("medina_pois")
          .update({ metadata: nextMeta, updated_at: new Date().toISOString() })
          .eq("id", slot.medina_poi_id);
        if (updErr) throw updErr;

        results.push({
          medina_poi_id: slot.medina_poi_id,
          status,
          story_layer: story_layer ?? undefined,
          error: null,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(
          `[story-architect/v2] POI ${slot.medina_poi_id} failed:`,
          msg,
        );
        errorCount++;
        results.push({
          medina_poi_id: slot.medina_poi_id,
          status: "error",
          error: msg,
        });
      }
    }

    // best-effort: wait for cache writes (do not fail on cache errors)
    if (cacheWrites.length > 0) {
      await Promise.allSettled(cacheWrites);
    }

    // Mark any POI that we explicitly skipped for insufficient facts (no cache, not generated).
    void insufficient;

    return jsonResponse({
      ok: true,
      run_id: runId,
      language: input.language,
      dry_run: input.dry_run,
      stats: {
        requested: slots.length,
        generated: generatedCount,
        cached: cachedCount,
        errors: errorCount,
      },
      results,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[story-architect/v2] run=${runId} fatal`, msg);
    return jsonResponse({ error: msg }, 500);
  }
});
