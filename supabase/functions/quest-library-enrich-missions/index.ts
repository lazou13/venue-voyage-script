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
const SYSTEM_PROMPT = `Tu es un game designer d'expériences urbaines à Marrakech.
Pour des voyageurs 20–45 ans qui veulent JOUER la médina, pas l'étudier.

═══ DÉCISION PRODUIT V4.0 ═══
Les "missions" sont DÉPRÉCIÉES. Le mini_challenge (= "Défi") est désormais
L'UNIQUE interaction jouable principale de chaque stop, affichée dans le player QRP.

Le champ mission DOIT être retourné en legacy désactivé :
  mission.enabled = false
  mission.title = ""
  mission.objective = ""
  mission.instruction = ""
  mission.reward_text = ""
N'ÉCRIS AUCUN contenu produit dans mission. C'est un stub de compatibilité, rien d'autre.

Toute ton énergie créative va dans mini_challenge.

═══ MINI_CHALLENGE — INTERACTION PRINCIPALE ═══
Chaque stop DOIT produire UN mini_challenge de qualité, basé sur un élément
RÉELLEMENT observable sur place et issu des données du POI fournies
(riddle_easy, riddle_medium, riddle_hard, challenge, must_see_details,
local_anecdote, history_context, photo_tip).

mini_challenge.enabled = true (sauf cas extrême "none" justifié par absence totale de données).
mini_challenge.required = false TOUJOURS.

Un bon défi :
- compréhensible en < 10 s
- faisable sur place en < 2 min
- validation claire quand le type le permet
- lié à un détail réel et stable du POI
- pas de question historique abstraite, pas de mime gratuit, pas de vote générique
- pas de "prends une photo" sans intention

═══ PRIORITÉ DES TYPES (du meilleur au pire) ═══
1. short_answer  — réponse 1–3 mots basée sur un détail visible (idéal pour réutiliser riddle_easy).
2. mcq           — observation visuelle, 3–4 choices courts, 1 seule bonne réponse, distracteurs plausibles.
3. code          — code/inscription/nombre court visible, correct_answer ≤ 6 caractères.
4. counting      — UNIQUEMENT si l'élément est réellement et stablement comptable sur place
                   (et un nombre fiable apparaît dans les données). expected_count obligatoire.
                   INTERDIT pour magasins, souks, boutiques, étals, vendeurs, foule.
5. photo         — intention claire et précise (un détail nommé, pas "le lieu").
                   Si une personne identifiable peut être dans le cadre, ajouter exactement :
                   "Demandez l'accord avant la photo."
6. timed_action  — action simple, non dangereuse, non gênante, courte (15/20/30 s).
                   timer_seconds OBLIGATOIRE ∈ {15, 20, 30}.
                   ÉVITER dans tombeaux, lieux de recueillement, jardins zen.
7. true_false    — UNIQUEMENT si tranchable d'un coup d'œil en < 5 s par n'importe quel visiteur,
                   sur un élément stable (jamais sur tenues de passants, foule, stand temporaire,
                   dynastie, dates, comparaisons d'âge ou de hauteur).
8. observation   — dernier recours quand aucune validation fiable n'est possible.
                   Pas de correct_answer.

═══ CHAMPS REQUIS PAR TYPE ═══
- short_answer : instruction OU question, correct_answer (1–3 mots), hint conseillé.
- mcq          : question, choices (3–4), correct_answer = exactement l'un des choices.
- code         : instruction, correct_answer (≤ 6 caractères, idéalement chiffres/lettres).
- counting     : instruction, expected_count (entier). hint/failure_message ne révèlent JAMAIS le nombre.
- photo        : instruction précise (détail nommé), aucune correct_answer.
- timed_action : instruction démarrant par "Le joueur désigné a X secondes pour…", timer_seconds.
- true_false   : question, correct_answer ∈ {"true","false","vrai","faux"}.
- observation  : instruction (consigne d'observation ou vote de groupe). Pas de correct_answer.

═══ RÉUTILISATION DES DONNÉES POI ═══
Tu reçois pour chaque stop : riddle_easy, riddle_medium, riddle_hard, challenge,
must_see_details, local_anecdote_fr, history_context, photo_tip, name, description_short.
PRIORITÉ : si riddle_easy existe et reste vérifiable sur place, transforme-le en short_answer
(question = riddle_easy reformulé court, correct_answer = la réponse attendue).
Sinon utilise must_see_details pour une observation/mcq, ou photo_tip pour une photo intentionnelle.
N'invente JAMAIS de nombre, plaque, inscription, salle, objet absent des données.

═══ TON ═══
Français naturel, pas d'anglais ni d'arabe. Phrases courtes. 1 emoji max par champ.
Respectueux, jamais enfantin, jamais bruyant dans lieux sensibles, jamais humiliant.

═══ INTERDITS ABSOLUS (TOUS champs de mini_challenge : title, instruction, question, hint,
success_message, failure_message, correct_answer, choices) ═══
Mots/phrases STRICTEMENT bannis (zéro occurrence, MÊME en idiome) :
  dynastie, siècle, époque, patrimoine, héritage, historique, architecturale,
  saadien, mérinide, almohade, islamique, calligraphie,
  "Quel sultan", "En quelle année".
Idiomes interdits : "affaire du siècle", "trésor historique", "héritage vivant",
"décor d'époque", "beauté architecturale", "œuvre architecturale", "lieu chargé d'histoire".

Interdictions de contenu :
- "Mime…" gratuit, "Votez le plus beau…" sans critère, "Prenez une photo souvenir…"
- "Repérez un motif" sans détail précis
- Toute question de date, siècle, dynastie, sultan, attribution savante
- Contenu historique scolaire
- Défi impossible à vérifier sur place
- Citer un lieu hors visite (ex. Koutoubia, Majorelle) si absent des données

AVANT DE RENVOYER : relis chaque champ texte du mini_challenge et vérifie
qu'aucun mot banni n'apparaît, même partiellement, même dans un idiome.

═══ ANTI-DOUBLE-PHOTO ═══
Comme mission est désactivée, il n'y a plus de risque de double-photo Mission+Mini.
La phrase "Demandez l'accord avant la photo." n'est autorisée QUE dans un
mini_challenge de type "photo" dont l'instruction contient un verbe photo explicite
(photographiez | prenez une photo | selfie | capturez).

═══ ANTI-HALLUCINATION ═══
Mieux vaut mini_challenge.type="observation" générique que correct_answer faux.
En dernier recours : enabled=false, type="none".

═══ FORMAT DE SORTIE ═══
Pour chaque stop, retourne :
  order               : int (fourni en entrée)
  mission             : stub legacy désactivé (enabled=false, autres champs "")
  mini_challenge      : l'interaction principale, conforme aux règles ci-dessus.
required = false TOUJOURS sur mini_challenge.`;



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

// ─────────────────────────────────────────────────────────────
// Banned terms filter (post-LLM)
// ─────────────────────────────────────────────────────────────
const BANNED_WORDS = [
  "dynastie", "dynasties",
  "siècle", "siècles",
  "époque", "époques",
  "patrimoine",
  "héritage",
  "historique", "historiques",
  "architecturale", "architecturales",
  "islamique", "islamiques",
  "saadien", "saadienne", "saadiens", "saadiennes",
  "mérinide", "mérinides",
  "almohade", "almohades",
  "calligraphie", "calligraphies",
];
const BANNED_PHRASES = ["quel sultan", "en quelle année"];

function findBannedInString(value: string): string[] {
  if (!value) return [];
  const v = value.toLowerCase();
  const hits: string[] = [];
  for (const w of BANNED_WORDS) {
    const re = new RegExp(`(^|[^\\p{L}])${w}([^\\p{L}]|$)`, "iu");
    if (re.test(v)) hits.push(w);
  }
  for (const p of BANNED_PHRASES) {
    if (v.includes(p)) hits.push(p);
  }
  return hits;
}

type Violation = { order: number; name: string | null; field: string; term: string; value: string };

function collectBannedTermsInStop(
  index: number,
  name: string | null,
  mission: Mission | undefined,
  mc: MiniChallenge | undefined,
): Violation[] {
  const out: Violation[] = [];
  const scan = (field: string, value: unknown) => {
    if (typeof value !== "string" || !value) return;
    for (const term of findBannedInString(value)) {
      out.push({ order: index, name, field, term, value });
    }
  };
  if (mission) {
    scan("mission.title", mission.title);
    scan("mission.objective", mission.objective);
    scan("mission.instruction", mission.instruction);
    scan("mission.reward_text", mission.reward_text);
  }
  if (mc) {
    scan("mini_challenge.title", mc.title);
    scan("mini_challenge.instruction", mc.instruction);
    scan("mini_challenge.question", (mc as any).question);
    scan("mini_challenge.hint", (mc as any).hint);
    scan("mini_challenge.success_message", (mc as any).success_message);
    scan("mini_challenge.failure_message", (mc as any).failure_message);
    scan("mini_challenge.correct_answer", (mc as any).correct_answer);
    const choices = (mc as any).choices;
    if (Array.isArray(choices)) {
      choices.forEach((c, i) => scan(`mini_challenge.choices[${i}]`, c));
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// Completeness validation (post-LLM)
// ─────────────────────────────────────────────────────────────
type CompletenessViolation = {
  type: "missing_order" | "duplicate_order" | "out_of_range_order" | "name_mismatch" | "missing_payload";
  order: number;
  expected_name?: string | null;
  received_name?: string | null;
  details?: string;
};

function normalizeName(s: unknown): string {
  return typeof s === "string" ? s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim() : "";
}

function collectCompletenessViolations(
  expectedStops: Array<{ order: number; name: string | null }>,
  generatedStops: Array<{ order?: unknown; mission?: unknown; mini_challenge?: unknown; name?: unknown }>,
): CompletenessViolation[] {
  const out: CompletenessViolation[] = [];
  const expectedOrders = new Set(expectedStops.map((s) => s.order));
  const expectedByOrder = new Map(expectedStops.map((s) => [s.order, s] as const));

  // Duplicates + out_of_range
  const seen = new Map<number, number>();
  for (const g of generatedStops) {
    const o = typeof g?.order === "number" ? g.order : Number(g?.order);
    if (!Number.isInteger(o)) continue;
    seen.set(o, (seen.get(o) ?? 0) + 1);
    if (!expectedOrders.has(o)) {
      out.push({ type: "out_of_range_order", order: o, details: `order ${o} not in expected set` });
    }
  }
  for (const [o, count] of seen) {
    if (count > 1) out.push({ type: "duplicate_order", order: o, details: `order ${o} appears ${count}x` });
  }

  // Missing orders + missing payloads + name mismatch
  const genByOrder = new Map<number, any>();
  for (const g of generatedStops) {
    const o = typeof g?.order === "number" ? g.order : Number(g?.order);
    if (Number.isInteger(o) && !genByOrder.has(o)) genByOrder.set(o, g);
  }
  for (const exp of expectedStops) {
    const g = genByOrder.get(exp.order);
    if (!g) {
      out.push({ type: "missing_order", order: exp.order, expected_name: exp.name });
      continue;
    }
    if (!g.mission || !g.mini_challenge) {
      out.push({ type: "missing_payload", order: exp.order, expected_name: exp.name, details: "mission or mini_challenge missing" });
    }
    if (typeof g.name === "string" && exp.name) {
      const a = normalizeName(g.name);
      const b = normalizeName(exp.name);
      if (a && b && !a.includes(b) && !b.includes(a)) {
        out.push({ type: "name_mismatch", order: exp.order, expected_name: exp.name, received_name: g.name });
      }
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// Product sanitization (deterministic, post-LLM)
// ─────────────────────────────────────────────────────────────
type Sanitization = {
  order: number;
  name: string | null;
  field: string;
  issue:
    | "invalid_counting"
    | "false_photo_trigger"
    | "unstable_true_false"
    | "double_photo";
  action:
    | "converted_to_observation"
    | "stripped_photo_terms"
    | "converted_mini_photo_to_observation";
  before: unknown;
  after: unknown;
};

const PHOTO_VERBS_RE = /\b(photographiez|prenez une photo|selfie|capturez)\b/i;
const VARIABLE_PLACE_RE = /\b(magasin|boutique|souk|étal|etal|stand|march[ée]|vendeur|restaurant|terrasse|foule|personnes?)\b/i;
const VARIABLE_OBJECT_RE = /\b(tapis|stands?|vendeurs?|personnes?|vitrines?|étals?|etals?|épices|epices|objets? expos[ée]s?)\b/i;
const UNSTABLE_TF_RE = /\b(vendeur|passant|personne|foule|groupe pr[ée]sent|v[êe]tement|djellaba|burnous|kaftan|portent?|porte\b|stand ouvert|stand ferm[ée]|temporaire)\b/i;

function missionTriggersPhoto(mission?: Mission | null): boolean {
  if (!mission) return false;
  const txt = `${mission.title ?? ""} ${mission.instruction ?? ""} ${mission.objective ?? ""}`;
  return PHOTO_VERBS_RE.test(txt);
}

function countingNumberInSource(src: { name?: unknown; description_short?: unknown; history_context?: unknown; local_anecdote_fr?: unknown; must_see_details?: unknown }): boolean {
  const blob = [src.name, src.description_short, src.history_context, src.local_anecdote_fr, src.must_see_details]
    .filter((v) => typeof v === "string")
    .join(" ")
    .toLowerCase();
  // Either an Arabic numeral ≥ 2, or a French textual number (deux..vingt)
  if (/\b([2-9]|[1-9]\d+)\b/.test(blob)) return true;
  return /\b(deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingt)\b/.test(blob);
}

function stripPhotoTermsFromInstruction(instr: string): string {
  let out = instr;
  // Remove the explicit consent sentence (with surrounding spaces/punct)
  out = out.replace(/\s*Demandez l['’]accord avant la photo\.?/giu, "");
  // Replace "photogénique" with neutral term
  out = out.replace(/photog[ée]nique/giu, "marquant");
  // Strip light photo-trigger fragments
  out = out.replace(/\s*pour la photo\b/giu, "");
  out = out.replace(/\s*photo souvenir\b/giu, "");
  out = out.replace(/\s*accord photo\b/giu, "");
  // Strip lonely standalone "photo" word fragments like "une photo" if no verb
  out = out.replace(/\s+une photo\b/giu, "");
  return out.replace(/\s{2,}/g, " ").trim();
}

function sanitizeProductIssues(
  order: number,
  name: string | null,
  mission: Mission,
  mc: MiniChallenge,
  source: { name?: unknown; description_short?: unknown; history_context?: unknown; local_anecdote_fr?: unknown; must_see_details?: unknown },
): { mission: Mission; mini_challenge: MiniChallenge; sanitizations: Sanitization[] } {
  const sanitizations: Sanitization[] = [];
  let outMission: Mission = { ...mission };
  let outMC: MiniChallenge = { ...mc };

  // ── Case B — false photo trigger on mission ──
  const instr = outMission.instruction ?? "";
  const hasPhotoVerb = PHOTO_VERBS_RE.test(instr);
  const hasPhotoArtifact = /(Demandez l['’]accord avant la photo|photog[ée]nique|pour la photo|photo souvenir|accord photo)/iu.test(instr);
  if (!hasPhotoVerb && hasPhotoArtifact) {
    const before = instr;
    const after = stripPhotoTermsFromInstruction(instr);
    outMission = { ...outMission, instruction: after };
    sanitizations.push({
      order, name, field: "mission.instruction",
      issue: "false_photo_trigger", action: "stripped_photo_terms",
      before, after,
    });
  }

  // Recompute photo-trigger after mission strip
  const missionPhoto = missionTriggersPhoto(outMission);

  // ── Case D — double photo (mission photo + mini photo) ──
  if (missionPhoto && outMC.type === "photo") {
    const before = { type: outMC.type, title: outMC.title, instruction: outMC.instruction };
    outMC = {
      ...outMC,
      type: "observation",
      title: "Vote du meilleur détail",
      instruction: "Le groupe choisit le détail le plus marquant autour de vous.",
      question: undefined,
      choices: undefined,
      correct_answer: undefined,
      expected_count: undefined,
      timer_seconds: undefined,
      required: false,
      success_message: "Vote validé !",
    };
    sanitizations.push({
      order, name, field: "mini_challenge",
      issue: "double_photo", action: "converted_mini_photo_to_observation",
      before, after: { type: outMC.type, title: outMC.title, instruction: outMC.instruction },
    });
  }

  // ── Case A — counting invalid ──
  if (outMC.type === "counting") {
    const mcInstr = (outMC.instruction ?? "").trim();
    const mcQuestion = ((outMC as any).question ?? "").toString().trim();
    const probe = `${mcInstr} ${mcQuestion} ${outMC.title ?? ""}`;
    const noInstruction = !mcInstr;
    const noExpected = typeof outMC.expected_count !== "number" || !Number.isFinite(outMC.expected_count);
    const variablePlace =
      VARIABLE_PLACE_RE.test(typeof source.name === "string" ? source.name : "") ||
      VARIABLE_PLACE_RE.test(probe);
    const variableObject = VARIABLE_OBJECT_RE.test(probe);
    const numberFiable = countingNumberInSource(source);

    if (noInstruction || noExpected || variablePlace || variableObject || !numberFiable) {
      const before = { type: outMC.type, instruction: outMC.instruction, expected_count: outMC.expected_count, title: outMC.title };
      outMC = {
        ...outMC,
        type: "observation",
        title: outMC.title || "Détail à repérer",
        instruction: "Repérez le détail le plus intéressant autour de vous et partagez votre choix avec le groupe.",
        question: undefined,
        choices: undefined,
        correct_answer: undefined,
        expected_count: undefined,
        timer_seconds: undefined,
        required: false,
        success_message: outMC.success_message || "Choix validé !",
      };
      sanitizations.push({
        order, name, field: "mini_challenge",
        issue: "invalid_counting", action: "converted_to_observation",
        before, after: { type: outMC.type, title: outMC.title, instruction: outMC.instruction },
      });
    }
  }

  // ── Case C — unstable true_false ──
  if (outMC.type === "true_false") {
    const probe = `${(outMC as any).question ?? ""} ${outMC.instruction ?? ""}`;
    if (UNSTABLE_TF_RE.test(probe)) {
      const before = { type: outMC.type, question: (outMC as any).question, correct_answer: (outMC as any).correct_answer };
      outMC = {
        ...outMC,
        type: "observation",
        title: outMC.title || "Observation rapide",
        instruction: "Repérez un détail visible immédiatement et choisissez celui qui marque le plus le groupe.",
        question: undefined,
        choices: undefined,
        correct_answer: undefined,
        expected_count: undefined,
        timer_seconds: undefined,
        required: false,
        success_message: outMC.success_message || "Observation validée !",
      };
      sanitizations.push({
        order, name, field: "mini_challenge",
        issue: "unstable_true_false", action: "converted_to_observation",
        before, after: { type: outMC.type, title: outMC.title, instruction: outMC.instruction },
      });
    }
  }

  return { mission: outMission, mini_challenge: outMC, sanitizations };
}



async function callAIWithRetry(
  payloadStops: unknown[],
  previousViolations?: Violation[],
  completenessViolations?: CompletenessViolation[],
  expectedCount?: number,
): Promise<Array<{ order: number; mission: Mission; mini_challenge: MiniChallenge }>> {
  let note = "";
  if (completenessViolations && completenessViolations.length) {
    const missing = completenessViolations.filter((v) => v.type === "missing_order").map((v) => `${v.order} (${v.expected_name ?? "?"})`);
    const dups = completenessViolations.filter((v) => v.type === "duplicate_order").map((v) => v.order);
    const oor = completenessViolations.filter((v) => v.type === "out_of_range_order").map((v) => v.order);
    const mism = completenessViolations.filter((v) => v.type === "name_mismatch").map((v) => `${v.order}: attendu "${v.expected_name}" reçu "${v.received_name}"`);
    note += `\n\nCORRECTION COMPLÉTUDE — la génération précédente était incomplète/désordonnée :`;
    if (missing.length) note += `\n- orders MANQUANTS : ${missing.join(", ")}`;
    if (dups.length) note += `\n- orders DUPLIQUÉS : ${dups.join(", ")}`;
    if (oor.length) note += `\n- orders HORS PLAGE : ${oor.join(", ")}`;
    if (mism.length) note += `\n- NOMS incohérents : ${mism.join(" ; ")}`;
    const n = expectedCount ?? 0;
    note += `\nRetourne EXACTEMENT ${n} stops, avec les orders 0 à ${n - 1}, aucun manquant, aucun doublon, aucun stop inventé.`;
  }
  if (previousViolations && previousViolations.length) {
    note += `\n\nCORRECTION MOTS INTERDITS — corrige ces violations sans en introduire d'autres :\n${JSON.stringify(previousViolations, null, 2)}\nReformule chaque champ fautif en évitant strictement le terme banni, même sous forme idiomatique.`;
  }

  return await callAI(payloadStops, note);
}

async function callAI(payloadStops: unknown[], correctionNote = ""): Promise<Array<{ order: number; mission: Mission; mini_challenge: MiniChallenge }>> {
  const userPrompt = `Génère mission + mini_challenge pour CHAQUE stop ci-dessous, en respectant scrupuleusement les règles. Si un stop ne se prête PAS à un mini-défi vérifiable sur place, mets mini_challenge.enabled=false / type="none".

STOPS (JSON):
${JSON.stringify(payloadStops, null, 2)}${correctionNote}`;

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
        let aiStops = await callAI(payloadStops);

        const expectedStops = targets.map((i) => ({ order: i, name: (stops[i]?.name as string | null) ?? null }));
        const expectedCount = expectedStops.length;

        const buildByOrder = (arr: typeof aiStops) => {
          const m = new Map<number, { mission: Mission; mini_challenge: MiniChallenge }>();
          for (const r of arr) {
            if (r && typeof r.order === "number") {
              m.set(r.order, { mission: r.mission, mini_challenge: r.mini_challenge });
            }
          }
          return m;
        };
        let byOrder = buildByOrder(aiStops);

        // ── A. Completeness ──
        let compViolations = collectCompletenessViolations(expectedStops, aiStops as any[]);
        if (compViolations.length > 0) {
          logs.push(`[${tour.id}] completeness violation(s) — retry 1x: ${JSON.stringify(compViolations.map((v) => ({ t: v.type, o: v.order })))}`);
          aiStops = await callAIWithRetry(payloadStops, undefined, compViolations, expectedCount);
          byOrder = buildByOrder(aiStops);
          compViolations = collectCompletenessViolations(expectedStops, aiStops as any[]);
        }
        if (compViolations.length > 0) {
          errors++;
          logs.push(`[${tour.id}] BLOCKED — incomplete generation after retry, no write`);
          previews.push({
            tour_id: tour.id,
            title_fr: tour.title_fr,
            enriched_count: 0,
            blocked: true,
            reason: "incomplete_generation",
            completeness_violations: compViolations,
            stops: [],
          });
          continue;
        }

        // ── B. Product sanitization (deterministic, post-LLM, no AI call) ──
        const sanitizationsForTour: Sanitization[] = [];
        const sourceCtxByOrder = new Map<number, any>();
        for (let k = 0; k < targets.length; k++) {
          sourceCtxByOrder.set(targets[k], payloadStops[k]);
        }
        for (const i of targets) {
          const r = byOrder.get(i);
          if (!r) continue;
          const src = sourceCtxByOrder.get(i) ?? {};
          const out = sanitizeProductIssues(i, stops[i]?.name ?? null, r.mission, r.mini_challenge, src);
          if (out.sanitizations.length > 0) {
            byOrder.set(i, { mission: out.mission, mini_challenge: out.mini_challenge });
            for (const s of out.sanitizations) {
              sanitizationsForTour.push(s);
              logs.push(`[${tour.id}] product sanitization: ${s.issue} on order ${s.order} ${s.action}`);
            }
          }
        }

        // ── C. Banned terms (re-scan after sanitization) ──

        const scanAll = () => {
          const v: Violation[] = [];
          for (const i of targets) {
            const r = byOrder.get(i);
            if (!r) continue;
            v.push(...collectBannedTermsInStop(i, stops[i]?.name ?? null, r.mission, r.mini_challenge));
          }
          return v;
        };
        let violations = scanAll();

        if (violations.length > 0) {
          logs.push(`[${tour.id}] ${violations.length} banned-term violation(s) — retry 1x`);
          aiStops = await callAIWithRetry(payloadStops, violations, undefined, expectedCount);
          byOrder = buildByOrder(aiStops);
          const recheckComp = collectCompletenessViolations(expectedStops, aiStops as any[]);
          if (recheckComp.length > 0) {
            errors++;
            logs.push(`[${tour.id}] BLOCKED — incomplete after banned-terms retry, no write`);
            previews.push({
              tour_id: tour.id,
              title_fr: tour.title_fr,
              enriched_count: 0,
              blocked: true,
              reason: "incomplete_generation",
              completeness_violations: recheckComp,
              stops: [],
            });
            continue;
          }
          violations = scanAll();
        }

        if (violations.length > 0) {
          errors++;
          logs.push(`[${tour.id}] BLOCKED — banned terms persist after retry, no write`);
          previews.push({
            tour_id: tour.id,
            title_fr: tour.title_fr,
            enriched_count: 0,
            blocked: true,
            reason: "banned_terms",
            violations,
            stops: [],
          });
          continue;
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
          sanitizations: sanitizationsForTour,
          sanitizations_count: sanitizationsForTour.length,
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
