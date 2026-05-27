// quest-library-enrich-missions
// HPP — génère mission + mini_challenge par stop pour les visites de quest_library.
// Idempotent. dry_run=true par défaut. Pas d'écrasement (V1).
//
// Input JSON:
//   { tour_id?: string, batch_size?: number = 1, dry_run?: boolean = true }
//
// Output JSON:
//   { tours_processed, stops_enriched, skipped, errors,
//     previews?: [{ tour_id, title_fr, stops: [{order, poi_id, mission, mini_challenge}] }] }

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface Mission {
  enabled: boolean;
  title?: string;
  objective?: string;
  instruction?: string;
  reward_text?: string;
}
interface MiniChallenge {
  enabled: boolean;
  type: "none" | "observation" | "mcq" | "true_false" | "short_answer" | "code" | "counting";
  title?: string;
  instruction?: string;
  question?: string;
  choices?: string[];
  correct_answer?: string;
  expected_count?: number;
  hint?: string;
  hints?: string[];
  success_message?: string;
  failure_message?: string;
  required?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Prompt — schéma strict via tool calling
// ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Tu es un game designer d'expériences urbaines virales à Marrakech.
Tu écris pour des voyageurs de 20 à 45 ans qui veulent VIVRE la médina, pas l'étudier.
Style : carnet de jeu, exploration urbaine, secret à trouver, action simple, phrase courte.
Jamais guide Michelin. Jamais cours d'histoire.

OBJECTIF GLOBAL
Pour chaque stop produire :
1) une mission ultra-courte
2) un mini-défi faisable en moins de 2 minutes sur place

Tout doit être :
- visible sur place
- compréhensible en moins de 5 secondes
- racontable en story Instagram ou TikTok
- sans Internet, sans connaissance historique, sans guide physique

RÈGLES MISSION
- mission.title : 3 à 6 mots max, commence par un verbe d'ACTION :
  Trouvez / Repérez / Comptez / Photographiez / Devinez / Cherchez / Capturez.
  Jamais un titre poétique vague, jamais un résumé culturel.
- mission.objective : 1 phrase ≤ 12 mots, dit clairement ce qu'on cherche, donne une sensation de secret.
  Pas de fausses stats type "90% des visiteurs".
- mission.instruction : 1 phrase ≤ 20 mots, cite UN élément visible précis
  (couleur, forme, matière, motif, objet, geste, son, reflet, alignement) et où regarder / quoi faire.
- mission.reward_text : ≤ 12 mots, style légende de story, 1 emoji max, sensation de réussite.

INTERDITS MISSION (title + objective)
- Verbes bannis : Admirez, Contemplez, Imprégnez-vous, Découvrez, Explorez, Plongez, Apprenez.
  Observez interdit SAUF si suivi d'une action précise.
- Mots scolaires à éviter : patrimoine, héritage, dynastie, siècle, époque, islamique,
  saadien, mérinide, almohade, architecture (sauf nécessaire), calligraphie (sauf visible et central).

RÈGLES MINI-DÉFI
Interaction concrète, pas une question de cours.
Types autorisés : observation, counting, true_false, mcq, short_answer, code.
Ordre de préférence :
  1. observation
  2. observation avec intention photo
  3. counting si nombre fiable et explicitement déduit des données
  4. true_false basé sur observation visible
  5. mcq visuel
  6. short_answer très simple
À éviter : QCM historique, dates, dynasties, noms de sultans, questions de musée invisibles,
comptage incertain, détail difficile à vérifier, réponse basée sur culture générale.

RÈGLES PAR TYPE
- observation : majorité des stops.
  instruction commence par Repérez / Trouvez / Photographiez / Cherchez / Capturez.
  Pas de correct_answer. success_message valide l'ACTION, pas une vérité historique risquée.
- counting : seulement si l'élément est explicitement fiable.
  expected_count obligatoire. hint ne donne JAMAIS le nombre. failure_message ne donne JAMAIS le nombre.
  Si incertain : ne pas utiliser counting.
- mcq : uniquement visuel, 3 ou 4 choices, correct_answer = exactement un des choices.
  Pas de réponse devinable sans regarder. Pas de question historique.
- true_false : vérifiable par observation directe ou par texte du stop.
  correct_answer = "true" ou "false". Pas d'affirmation historique fragile.
- short_answer : réponse 1 à 3 mots, trouvable sur place ou dans le contenu du stop. Pas d'abstraction.
- code : seulement si un code, nombre, inscription ou repère court est visible.
  correct_answer ≤ 6 caractères. Sinon ne pas utiliser.

ANTI-HALLUCINATION
Ne JAMAIS inventer : nombre, plaque, symbole, main sculptée, forme précise,
détail invisible, accès à une salle, objet non mentionné dans les données.
Si aucun détail observable fiable :
  mini_challenge.enabled = false, type = "none", required = false.
Mieux vaut aucun mini-défi qu'un défi faux.

FORMAT STORY (reward_text + success_message)
Ton 1ère personne, sensoriel, partageable.
Bon : "J'ai trouvé le détail caché 👁️" / "Secret repéré dans la médina ✨" / "Mission accomplie, œil affûté."
Mauvais : "Vous avez exploré un chef-d'œuvre de l'architecture islamique." /
"Vous avez compris le patrimoine saadien." / "Vous avez admiré la richesse historique du lieu."

EXEMPLES BONS
Mission Madrasa Ben Youssef
  title: "Trouvez l'étoile cachée"
  objective: "Un motif se répète partout dans la cour."
  instruction: "Cherchez l'étoile à 8 branches sur les murs et le bois."
  reward_text: "Vous avez vu la signature des bâtisseurs ✨"
Mini-défi Marrakech Museum
  type: "observation", title: "📸 Selfie dans le lustre"
  instruction: "Le grand lustre central reflète la salle. Cherchez votre reflet."
  success_message: "Votre plus beau souvenir de la médina ✨"
Mini-défi Souk
  type: "observation", title: "Le rouge du souk"
  instruction: "Repérez l'épice rouge vif vendue en pyramide."
  hint: "Cherchez les tas colorés au niveau des étals."
  success_message: "Vous avez trouvé la couleur du souk."

EXEMPLES INTERDITS (ne JAMAIS produire)
- "Admirez la finesse des sculptures sur stuc de l'époque saadienne."
- "Explorez l'extravagance du palais."
- "Quel sultan a construit ce monument ?" / "En quelle année a-t-il été édifié ?"
- "Le Palais El Badi est-il à moins de 5 minutes ?"
- "Quel matériau est utilisé pour les parures ? Argent / Bois / Pierre" si non explicitement visible.

LANGUE & FORME
- Français naturel, pas d'anglais, pas d'arabe.
- 1 emoji max par champ. Phrases courtes. Ton fun mais pas enfantin.
- required TOUJOURS false. Pas de score, pas de blocage.`;

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "emit_missions",
    description: "Émet une mission + un mini_challenge par stop, dans l'ordre fourni.",
    parameters: {
      type: "object",
      properties: {
        stops: {
          type: "array",
          items: {
            type: "object",
            properties: {
              order: { type: "integer" },
              mission: {
                type: "object",
                properties: {
                  enabled: { type: "boolean" },
                  title: { type: "string" },
                  objective: { type: "string" },
                  instruction: { type: "string" },
                  reward_text: { type: "string" },
                },
                required: ["enabled", "title", "objective", "instruction", "reward_text"],
                additionalProperties: false,
              },
              mini_challenge: {
                type: "object",
                properties: {
                  enabled: { type: "boolean" },
                  type: {
                    type: "string",
                    enum: ["none", "observation", "mcq", "true_false", "short_answer", "code", "counting"],
                  },
                  title: { type: "string" },
                  instruction: { type: "string" },
                  question: { type: "string" },
                  choices: { type: "array", items: { type: "string" } },
                  correct_answer: { type: "string" },
                  expected_count: { type: "integer" },
                  hint: { type: "string" },
                  success_message: { type: "string" },
                  failure_message: { type: "string" },
                  required: { type: "boolean" },
                },
                required: ["enabled", "type", "required"],
                additionalProperties: false,
              },
            },
            required: ["order", "mission", "mini_challenge"],
            additionalProperties: false,
          },
        },
      },
      required: ["stops"],
      additionalProperties: false,
    },
  },
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stopNeedsEnrichment(stop: Record<string, unknown>): boolean {
  const m = stop.mission as Mission | undefined;
  const mc = stop.mini_challenge as MiniChallenge | undefined;
  // V1: pas de force. Si l'un OU l'autre est déjà présent → on skip.
  const hasMission = !!m && typeof m === "object";
  const hasMC = !!mc && typeof mc === "object";
  return !hasMission && !hasMC;
}

function truncate(v: unknown, n: number): string {
  const s = typeof v === "string" ? v : v == null ? "" : String(v);
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function buildStopContext(
  stop: Record<string, unknown>,
  poi: Record<string, unknown> | undefined,
  index: number
) {
  return {
    index,
    name: stop.name ?? poi?.name ?? null,
    name_en: poi?.name_en ?? null,
    category: stop.category ?? poi?.category_ai ?? poi?.category ?? null,
    description_short: truncate(stop.description ?? poi?.description_short ?? "", 400),
    history_context: truncate(poi?.history_context, 800),
    history_context_en: truncate(poi?.history_context_en, 400),
    local_anecdote_fr: truncate(poi?.local_anecdote_fr ?? poi?.local_anecdote, 600),
    local_anecdote_en: truncate(poi?.local_anecdote_en, 300),
    fun_fact_fr: truncate(poi?.fun_fact_fr, 300),
    must_see_details: truncate(poi?.must_see_details, 400),
    must_try: truncate(poi?.must_try, 300),
    must_visit_nearby: truncate(poi?.must_visit_nearby, 300),
    photo_tip: truncate(stop.photo_tip ?? poi?.photo_tip, 200),
    riddle_easy: truncate(poi?.riddle_easy, 200),
    opening_hours: poi?.opening_hours ?? null,
    price_info: truncate(poi?.price_info, 120),
    poi_score: poi?.poi_quality_score ?? null,
  };
}

async function callAI(payloadStops: unknown[]): Promise<Array<{ order: number; mission: Mission; mini_challenge: MiniChallenge }>> {
  const userPrompt = `Génère mission + mini_challenge pour CHAQUE stop ci-dessous, en respectant scrupuleusement les règles. Si un stop ne se prête PAS à un mini-défi vérifiable sur place, mets mini_challenge.enabled=false / type="none".

STOPS (JSON):
${JSON.stringify(payloadStops, null, 2)}`;

  const res = await fetch(AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      tools: [TOOL_SCHEMA],
      tool_choice: { type: "function", function: { name: "emit_missions" } },
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (res.status === 429) throw new Error("AI rate limited (429)");
  if (res.status === 402) throw new Error("AI credits exhausted (402)");
  if (!res.ok) throw new Error(`AI error ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) throw new Error("No tool call in AI response");
  const parsed = JSON.parse(toolCall.function.arguments);
  return Array.isArray(parsed?.stops) ? parsed.stops : [];
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const tourId: string | undefined = body.tour_id;
    const batchSize: number = Math.max(1, Math.min(Number(body.batch_size ?? 1), 10));
    const dryRun: boolean = body.dry_run === false ? false : true; // default true

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Sélection des visites
    let query = sb
      .from("quest_library")
      .select("id, title_fr, stops_data, updated_at");
    if (tourId) query = query.eq("id", tourId);
    else query = query.order("created_at", { ascending: false }).limit(batchSize * 4);

    const { data: rawTours, error: qErr } = await query;
    if (qErr) throw qErr;

    const candidates: Array<{ id: string; title_fr: string | null; stops_data: any[] }> = [];
    for (const t of rawTours ?? []) {
      const stops = Array.isArray(t.stops_data) ? t.stops_data : [];
      if (stops.length === 0) continue;
      // V1: skip si TOUS les stops ont déjà mission ou mini_challenge.
      const needsAny = stops.some(stopNeedsEnrichment);
      if (!needsAny) continue;
      candidates.push({ id: t.id as string, title_fr: t.title_fr as string | null, stops_data: stops });
      if (!tourId && candidates.length >= batchSize) break;
    }

    if (candidates.length === 0) {
      return json({
        tours_processed: 0,
        stops_enriched: 0,
        skipped: rawTours?.length ?? 0,
        errors: 0,
        dry_run: dryRun,
        message: tourId ? "Tour déjà enrichi ou introuvable" : "Aucune visite à enrichir",
        previews: [],
      });
    }

    // 2. Charger les POIs nécessaires (en une requête)
    const poiIds = new Set<string>();
    for (const t of candidates) for (const s of t.stops_data) if (s?.poi_id) poiIds.add(s.poi_id);
    const { data: poisRaw, error: poiErr } = await sb
      .from("medina_pois")
      .select(
        "id, name, name_en, category, category_ai, description_short, history_context, history_context_en, local_anecdote, local_anecdote_fr, local_anecdote_en, fun_fact_fr, must_see_details, must_try, must_visit_nearby, photo_tip, riddle_easy, opening_hours, price_info, poi_quality_score"
      )
      .in("id", Array.from(poiIds));
    if (poiErr) throw poiErr;
    const poiById = new Map<string, Record<string, unknown>>();
    for (const p of poisRaw ?? []) poiById.set(p.id as string, p as Record<string, unknown>);

    // 3. Traitement par visite
    let toursProcessed = 0;
    let stopsEnriched = 0;
    let skipped = 0;
    let errors = 0;
    const previews: any[] = [];
    const logs: string[] = [];

    for (const tour of candidates) {
      try {
        const stops = tour.stops_data;
        const targets: number[] = []; // indices à enrichir
        const payloadStops: any[] = [];
        for (let i = 0; i < stops.length; i++) {
          const s = stops[i];
          if (!stopNeedsEnrichment(s)) { skipped++; continue; }
          targets.push(i);
          payloadStops.push(buildStopContext(s, poiById.get(s.poi_id), i));
        }
        if (payloadStops.length === 0) { skipped++; continue; }

        logs.push(`[${tour.id}] AI call for ${payloadStops.length} stops`);
        const aiStops = await callAI(payloadStops);

        // Réindexer par "order" (= index passé au modèle)
        const byOrder = new Map<number, { mission: Mission; mini_challenge: MiniChallenge }>();
        for (const r of aiStops) {
          if (r && typeof r.order === "number") {
            byOrder.set(r.order, { mission: r.mission, mini_challenge: r.mini_challenge });
          }
        }

        const newStops = stops.map((s: any, i: number) => {
          const r = byOrder.get(i);
          if (!r) return s;
          // Merge non destructif: ne touche QUE mission / mini_challenge
          return { ...s, mission: r.mission, mini_challenge: r.mini_challenge };
        });

        const enrichedCount = targets.filter((i) => byOrder.has(i)).length;
        stopsEnriched += enrichedCount;
        toursProcessed++;

        const stopsPreview = targets
          .filter((i) => byOrder.has(i))
          .map((i) => ({
            order: i,
            poi_id: stops[i]?.poi_id,
            name: stops[i]?.name,
            mission: byOrder.get(i)!.mission,
            mini_challenge: byOrder.get(i)!.mini_challenge,
          }));

        previews.push({
          tour_id: tour.id,
          title_fr: tour.title_fr,
          enriched_count: enrichedCount,
          stops: stopsPreview,
        });

        if (!dryRun) {
          const { error: upErr } = await sb
            .from("quest_library")
            .update({ stops_data: newStops, updated_at: new Date().toISOString() })
            .eq("id", tour.id);
          if (upErr) {
            errors++;
            logs.push(`[${tour.id}] update error: ${upErr.message}`);
          } else {
            logs.push(`[${tour.id}] persisted ${enrichedCount} stops`);
          }
        } else {
          logs.push(`[${tour.id}] dry_run — no write`);
        }
      } catch (e) {
        errors++;
        logs.push(`[${tour.id}] error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return json({
      tours_processed: toursProcessed,
      stops_enriched: stopsEnriched,
      skipped,
      errors,
      dry_run: dryRun,
      model: MODEL,
      previews,
      logs,
    });
  } catch (e) {
    console.error("quest-library-enrich-missions error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
