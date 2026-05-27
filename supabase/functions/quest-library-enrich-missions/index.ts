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
  type: "none" | "observation" | "mcq" | "true_false" | "short_answer" | "code" | "counting" | "photo" | "timed_action";
  title?: string;
  instruction?: string;
  question?: string;
  choices?: string[];
  correct_answer?: string;
  expected_count?: number;
  timer_seconds?: number;
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
Pour des voyageurs 20–45 ans qui veulent JOUER la médina, pas l'étudier.
Style : carnet de jeu, rôle amusant, mini-scène, photo story, défi chrono court.
Jamais guide Michelin, jamais cours d'histoire.

OBJECTIF
Pour chaque stop produire un DUO :
  MISSION = action principale jouable, rôle amusant, validable d'un clic « Mission accomplie ».
  MINI-DÉFI = bonus ludique court (chrono, photo, vote, mime, pub, QCM visuel), DIFFÉRENT de la mission.

Doit être : visible sur place, compris en 5 s, faisable en < 2 min, racontable en story,
sans Internet, sans connaissance historique, sans guide physique.
Doit fonctionner en Solo, Famille et Groupe.
Mention « le joueur désigné » autorisée : le player affichera automatiquement un sélecteur de joueur.

═══ MISSION ═══
Format : rôle amusant + action courte.
- title (3–6 mots) commence par un verbe ou un rôle :
  Devenez / Posez / Jouez / Incarnez / Photographiez / Mimez / Vendez / Négociez / Dirigez / Enquêtez / Cherchez / Trouvez / Repérez / Capturez.
- Rôles autorisés : vendeur, propriétaire, expert, guide trop sûr de lui, influenceur zen,
  détective, acheteur riche, acteur de film, sultan, architecte, chef de souk.
- objective (≤ 12 mots) : donne le rôle ou la situation.
- instruction (≤ 25 mots) : dit quoi faire, peut citer « le joueur désigné ».
  Si la mission demande une PHOTO → DOIT contenir au moins un mot parmi :
    photo, photographiez, prenez une photo, selfie, capturez.
  Le player affichera alors un bouton « 📸 Prendre la photo ».
  Si un humain identifiable risque d'être dans le cadre (vendeur, passant) →
  ajouter exactement la phrase : « Demandez l'accord avant la photo. »
- reward_text (≤ 12 mots) : ton 1ère personne, story-ready, 1 emoji max.
- mission.enabled = true TOUJOURS.

INTERDITS MISSION (title + objective + instruction)
- Verbes bannis : Admirez, Contemplez, Imprégnez-vous, Découvrez, Explorez, Plongez, Apprenez.
- Mots scolaires bannis : patrimoine, héritage, dynastie, siècle, époque, islamique,
  saadien, mérinide, almohade, calligraphie.
- Pas de fausses stats (« 90% des visiteurs »).
- Pas de titre poétique vague, pas de résumé culturel.

═══ MINI-DÉFI ═══
DOIT être DIFFÉRENT de la mission (pas la même action).
Si Mission = photo, Mini-défi ≠ photo (sauf logique très forte, ex. photo de groupe vs selfie).

Types autorisés (ordre de préférence) :
  1. timed_action — chrono 15/20/30 s : pub express, mime, scène, pitch absurde.
     type = "timed_action"
     timer_seconds OBLIGATOIRE ∈ {15, 20, 30}
     instruction commence par « Le joueur désigné a X secondes pour… ».
  2. photo — pose, détail, selfie thématique, mise en scène.
     type = "photo"
     instruction DOIT contenir : photo, photographiez, prenez une photo, selfie, ou capturez.
  3. observation — repérer un détail visible. Pas de correct_answer.
  4. counting — uniquement si nombre fiable et explicitement dans les données.
     expected_count obligatoire. hint/failure_message ne donnent JAMAIS le nombre.
  5. mcq — visuel/fun uniquement, 3–4 choices, correct_answer = exactement un des choices.
     Jamais historique, jamais devinable sans regarder.
  6. true_false — vérifiable par observation immédiate. correct_answer ∈ {"true","false"}.
  7. short_answer — réponse 1–3 mots visible sur place. Pas d'abstraction.
  8. code — uniquement si code/inscription visible, correct_answer ≤ 6 caractères.
Sinon : enabled = false, type = "none".
required = false TOUJOURS. Pas de score, pas de blocage, pas de leaderboard.

INTERDITS MINI-DÉFI
- QCM historique, dates, dynasties, noms de sultans.
- Questions de musée invisibles, comptage incertain, comparaisons impossibles.
- Détails non mentionnés dans les données du stop.
- Répéter exactement l'action de la mission.

ANTI-HALLUCINATION
Ne JAMAIS inventer : nombre, plaque, symbole, sculpture, salle, objet absent des données.
Mieux vaut mini-défi désactivé (enabled=false, type="none") qu'un défi faux.

FORMAT STORY (reward_text + success_message)
Ton 1ère personne, sensoriel, partageable, 1 emoji max.
Bon : « Stand tenu avec brio 🍊 » / « Pose royale validée 👑 » / « Secret repéré ✨ »
Mauvais : « Vous avez exploré un chef-d'œuvre de l'architecture islamique. »

═══ EXEMPLES BONS (visite Marrakech Instagram-Parfait) ═══

Stop : Jemaa el-Fnaa
  Mission
    title: "Devenez vendeur de jus"
    objective: "Vous tenez un stand de jus d'orange."
    instruction: "Le joueur désigné se met dans la peau d'un vendeur près d'un stand. Demandez l'accord avant la photo."
    reward_text: "Stand tenu avec brio 🍊"
  Mini-défi
    type: "timed_action", timer_seconds: 20
    title: "Pub express jus d'orange"
    instruction: "Le joueur désigné a 20 secondes pour inventer la pub du meilleur jus de Marrakech."
    success_message: "Star du marketing médina 🎤"

Stop : Bahia Palace
  Mission
    title: "Posez en propriétaire"
    objective: "Ce palais vient de vous appartenir."
    instruction: "Prenez une photo en pose royale dans la cour principale."
    reward_text: "Nouveau propriétaire validé 👑"
  Mini-défi
    type: "observation"
    title: "Vote pose royale"
    instruction: "Le groupe vote pour la pose la plus crédible."

Stop : Souk Rahba Kedima
  Mission
    title: "Négociez un tapis imaginaire"
    objective: "Vous êtes acheteur riche de passage."
    instruction: "Le joueur désigné mime la négociation devant un étal. Demandez l'accord avant la photo."
    reward_text: "Négociation digne d'un pacha ✨"
  Mini-défi
    type: "timed_action", timer_seconds: 15
    title: "Mime du marchandage"
    instruction: "Le joueur désigné a 15 secondes pour mimer « ce tapis vaut un million »."

═══ EXEMPLES INTERDITS ═══
- "Admirez la finesse des sculptures saadiennes."
- "Quel sultan a construit ce palais ?"
- Mission photo + Mini-défi photo identiques.
- timed_action sans timer_seconds.
- Citer un stop hors visite (ex. Koutoubia, Jardin Majorelle) si non présent dans les données.

LANGUE & FORME
- Français naturel, pas d'anglais, pas d'arabe.
- 1 emoji max par champ. Phrases courtes. Fun, jamais enfantin.
- required = false TOUJOURS. Pas de score, pas de leaderboard, pas de blocage.`;



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
                    enum: ["none", "observation", "mcq", "true_false", "short_answer", "code", "counting", "photo", "timed_action"],
                  },
                  title: { type: "string" },
                  instruction: { type: "string" },
                  question: { type: "string" },
                  choices: { type: "array", items: { type: "string" } },
                  correct_answer: { type: "string" },
                  expected_count: { type: "integer" },
                  timer_seconds: { type: "integer", description: "Requis si type=timed_action. Valeurs recommandées: 15, 20, 30." },
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
    const forceRegenerate: boolean = body.force_regenerate === true;

    // Sécurité : force_regenerate massif interdit
    if (forceRegenerate && !tourId) {
      return json({ error: "force_regenerate requires tour_id" }, 400);
    }

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
      // force_regenerate (uniquement avec tour_id) bypass le skip d'idempotence.
      const needsAny = forceRegenerate ? true : stops.some(stopNeedsEnrichment);
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
          if (!forceRegenerate && !stopNeedsEnrichment(s)) { skipped++; continue; }
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
