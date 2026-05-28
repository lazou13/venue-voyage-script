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
  type: "none" | "observation" | "mcq" | "true_false" | "short_answer" | "code" | "counting" | "photo" | "timed_action" | "text" | "self_check";
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
  // V2 — Missions terrain Questrides
  time_limit_sec?: number;
  requires_photo?: boolean;
  consent_required?: boolean;
  expected_answer_hint?: string;
}

// ─────────────────────────────────────────────────────────────
// Prompt — schéma strict via tool calling
// ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Tu es un game designer d'expériences urbaines à Marrakech.
Pour des voyageurs 20–45 ans qui veulent JOUER la médina, pas l'étudier.

═══ DÉCISION PRODUIT V4.1 ═══
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
Chaque stop DOIT produire UN mini_challenge VALIDABLE (réponse vérifiable sur place
ou cible concrète nommée), basé sur un élément RÉELLEMENT observable et issu des
données du POI fournies (riddle_easy, riddle_medium, riddle_hard, challenge,
must_see_details, local_anecdote, history_context, photo_tip).

mini_challenge.enabled = true (sauf cas extrême "none" si POI sans aucune donnée exploitable).
mini_challenge.required = false TOUJOURS.

Un bon défi :
- compréhensible en < 10 s
- faisable sur place en < 2 min
- VALIDATION concrète : correct_answer, expected_count, choices, OU cible nommée
- lié à un détail réel et stable du POI (objet, couleur, forme, nombre, inscription,
  matériau, détail architectural visible, produit vendu, élément central nommé)
- pas de question historique abstraite, pas de mime gratuit, pas de vote subjectif
- pas de "prends une photo" sans intention

═══ PRIORITÉ DES TYPES — RÈGLE DURE V4.1 ═══
SI au moins un des champs sources est non vide
   (riddle_easy, riddle_medium, riddle_hard, must_see_details, challenge),
ALORS observation est INTERDIT. Tu DOIS produire short_answer ou mcq (ou code/counting
si applicable) avec une correct_answer / expected_count concrète tirée de ces données.

Ordre de préférence :
1. short_answer  — réponse 1–3 mots issue de riddle_easy/medium/hard ou must_see_details.
                   correct_answer OBLIGATOIRE.
2. mcq           — observation visuelle, 3–4 choices courts, 1 seule bonne réponse,
                   distracteurs plausibles. correct_answer = exactement l'un des choices.
3. code          — code/inscription/nombre court visible, correct_answer ≤ 6 caractères.
4. counting      — UNIQUEMENT si nombre fiable apparaît explicitement dans les données
                   et que l'élément est stablement comptable. expected_count obligatoire.
                   INTERDIT pour magasins, souks, boutiques, étals, vendeurs, foule.
5. photo         — intention claire et précise (un détail nommé, pas "le lieu").
                   Si une personne identifiable peut être dans le cadre, ajouter exactement :
                   "Demandez l'accord avant la photo."
6. timed_action  — action simple, non dangereuse, non gênante, courte (15/20/30 s).
                   timer_seconds OBLIGATOIRE ∈ {15, 20, 30}.
                   ÉVITER dans tombeaux, lieux de recueillement, jardins zen.
7. true_false    — UNIQUEMENT si tranchable d'un coup d'œil en < 5 s par n'importe quel
                   visiteur, sur un élément stable (jamais tenues de passants, foule,
                   stand temporaire, dynastie, dates, comparaisons d'âge ou hauteur).
8. observation   — DERNIER RECOURS. AUTORISÉ UNIQUEMENT si TOUS les champs ci-dessus
                   (riddle_*, must_see_details, challenge) sont vides ET aucun autre
                   type fiable n'est possible. Dans ce cas, l'instruction DOIT nommer
                   une cible concrète (objet/forme/couleur/matériau précis), JAMAIS
                   une question subjective.

═══ CHAMPS REQUIS PAR TYPE ═══
- short_answer : question (ou instruction), correct_answer (1–3 mots), hint conseillé.
- mcq          : question, choices (3–4), correct_answer = exactement l'un des choices.
- code         : instruction, correct_answer (≤ 6 caractères).
- counting     : instruction, expected_count (entier). hint/failure_message ne révèlent JAMAIS le nombre.
- photo        : instruction précise (détail nommé), aucune correct_answer.
- timed_action : instruction démarrant par "Le joueur désigné a X secondes pour…", timer_seconds.
- true_false   : question, correct_answer ∈ {"true","false","vrai","faux"}.
- observation  : instruction avec CIBLE CONCRÈTE (ex. "Trouvez la fontaine octogonale
                 du patio principal"). PAS de question subjective.

═══ RÉUTILISATION DES DONNÉES POI ═══
Tu reçois pour chaque stop : riddle_easy, riddle_medium, riddle_hard, challenge,
must_see_details, local_anecdote_fr, history_context, photo_tip, name, description_short.
PRIORITÉ ABSOLUE : si riddle_easy existe, transforme-le en short_answer
(question = riddle_easy reformulé court, correct_answer = la réponse attendue).
Sinon utiliser riddle_medium/hard, puis must_see_details / challenge.
N'invente JAMAIS de nombre, plaque, inscription, salle, objet absent des données.

═══ TON ═══
Français naturel, pas d'anglais ni d'arabe. Phrases courtes. 1 emoji max par champ.
Respectueux, jamais enfantin, jamais bruyant dans lieux sensibles, jamais humiliant.

═══ INTERDITS ABSOLUS — TOUS champs de mini_challenge ═══
(title, instruction, question, hint, success_message, failure_message,
 correct_answer, choices)

Mots/phrases STRICTEMENT bannis (zéro occurrence, MÊME en idiome) :
  dynastie, siècle, époque, patrimoine, héritage, historique, architecturale,
  saadien, mérinide, almohade, islamique, calligraphie,
  "Quel sultan", "En quelle année".

VERBES TOURISTIQUES BANNIS (V4.1) — tous interdits, sous toutes formes conjuguées :
  Admirez, Contemplez, Imprégnez-vous (imprégnant, imprégné), Découvrez,
  Explorez, Plongez, Apprenez.
Remplacements obligatoires par verbes d'action concrets :
  Trouvez, Repérez, Comptez, Identifiez, Nommez, Lisez, Cherchez, Choisissez parmi.

QUESTIONS SUBJECTIVES BANNIES (V4.1) — toute formulation équivalente est INTERDITE :
  "Que ressentez-vous…", "Que remarquez-vous…" (sans cible précise nommée),
  "Que vous inspire…", "Quel est votre préféré…", "Choisissez le plus beau…",
  "Quel vous plaît le plus…", "Quelle ambiance…".
Toute question DOIT avoir une réponse vérifiable ou une cible nommée.

Idiomes interdits : "affaire du siècle", "trésor historique", "héritage vivant",
"décor d'époque", "beauté architecturale", "œuvre architecturale", "lieu chargé d'histoire".

Interdictions de contenu :
- "Mime…" gratuit, "Votez le plus beau…" sans critère, "Prenez une photo souvenir…"
- "Repérez un motif" sans détail précis
- Toute question de date, siècle, dynastie, sultan, attribution savante
  SAUF si la réponse exacte apparaît littéralement dans must_see_details ou riddle_*.
- Question au passé non vérifiable sur place ("Quelle était la hauteur…",
  "À quelle époque…") sauf source explicite dans riddle_*/must_see_details.
- Contenu historique scolaire
- Défi impossible à vérifier sur place
- Citer un lieu hors visite (ex. Koutoubia, Majorelle) si absent des données

AVANT DE RENVOYER : relis chaque champ texte du mini_challenge et vérifie
qu'aucun mot/phrase banni n'apparaît, même partiellement, même dans un idiome.
Vérifie aussi que observation n'est utilisé QUE si riddle_*/must_see_details/challenge
sont TOUS vides.

═══ ANTI-DOUBLE-PHOTO ═══
Comme mission est désactivée, il n'y a plus de risque de double-photo Mission+Mini.
La phrase "Demandez l'accord avant la photo." n'est autorisée QUE dans un
mini_challenge de type "photo" dont l'instruction contient un verbe photo explicite
(photographiez | prenez une photo | selfie | capturez).

═══ ANTI-HALLUCINATION ═══
Mieux vaut short_answer/mcq simple basé sur un détail nommé que correct_answer faux.
En dernier recours absolu : enabled=false, type="none".

═══ V4.2 — VÉRIFIABILITÉ SUR PLACE (RÈGLE DURE) ═══
Un mini_challenge n'est valide QUE si le joueur peut le vérifier sur place via
AU MOINS UN de ces moyens concrets :
  - détail visible et stable (objet, forme, couleur, matériau, motif)
  - panneau/cartel/plaque/inscription lisible sur place
  - objet exposé identifiable
  - produit vendu visible à l'étal/en vitrine
  - élément architectural directement observable
  - information littéralement présente dans must_see_details ou riddle_*

INTERDITS ABSOLUS V4.2 :
  - Mesure exacte (hauteur, longueur, largeur, profondeur, superficie, "X mètres",
    "combien mesure", "quelle est la taille") SAUF si la valeur exacte apparaît
    LITTÉRALEMENT dans must_see_details ou riddle_*.
  - Question historique scolaire ("Quel sultan", "Quelle dynastie", "ancien sultan",
    "almoravide/almohade/mérinide/saadien", "fondé/fondée/fondateur", "construit",
    "donna son nom", "porte le nom", "en quelle année", "à quelle époque",
    "quel siècle") SAUF DOUBLE CONDITION : (a) la réponse exacte est littéralement
    dans riddle_*/must_see_details, ET (b) la question dit explicitement de LIRE
    un panneau/cartel/plaque/inscription visible sur place.
  - Anecdote sans preuve terrain.
  - Réponse plausible mais non trouvable sur place.

═══ V4.2 — COHÉRENCE INTERNE QUESTION / HINT / FAILURE ═══
Si la question contient "donna son nom" ou "porte le nom" :
  → hint et failure_message NE DOIVENT PAS contenir "a fondé", "a construit",
    "fondateur", "fondation". Le sens doit rester strictement nominal.
Si la question contient "fondé", "fondée", "construit" :
  → correct_answer DOIT être explicitement sourcée dans riddle_*/must_see_details.

═══ V4.2 — ANTI-RÉPONSE GÉNÉRIQUE ═══
Si la question demande "le nom de l'endroit/lieu/espace/salle/cour/terrasse/jardin",
la correct_answer NE PEUT PAS être un mot générique (rooftop, terrasse, cour, salle,
jardin, musée, palais) seul. Elle DOIT être un nom propre identifiable
(ex. "Cour d'Honneur", "Palais Mnebhi", "Salle des Douze Colonnes", "Riad Mokri").

═══ V4.2 — SOUKS / BOUTIQUES / MARCHÉS — ANCRAGE OBLIGATOIRE ═══
Pour un POI de type souk, boutique, étal, marché, atelier artisanal :
le défi DOIT porter sur un élément DIRECTEMENT VISIBLE dans l'environnement
immédiat : produit vendu, couleur dominante, forme, matériau, motif, type de
panier, type d'épice identifiable visuellement, type de tapis identifiable, etc.
INTERDIT : détails botaniques/factuels douteux non observables — "reflets bleutés",
"parfum anisé", "propriété médicinale", "usage rituel supposé" — SAUF si
LITTÉRALEMENT présents dans riddle_*/must_see_details.

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
    riddle_medium: truncate(poi?.riddle_medium, 220),
    riddle_hard: truncate(poi?.riddle_hard, 240),
    challenge: truncate(poi?.challenge, 240),
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
  // V4.1 — verbes touristiques génériques (formes principales)
  "admirez", "admirer",
  "contemplez", "contempler", "contemplation",
  "découvrez", "decouvrez", "découvrir",
  "explorez", "explorer",
  "plongez", "plonger",
  "apprenez", "apprendre",
];
// BANNED_PHRASES uses substring match (lowercased) — utile pour radicaux/idiomes/questions ouvertes
const BANNED_PHRASES = [
  "quel sultan", "en quelle année",
  // V4.1 — radicaux verbes touristiques (toutes flexions)
  "imprégn", "impregn",
  "contempl",
  "admir", // admirez/admirer/admirable/admiration
  // V4.1 — questions subjectives interdites
  "que ressentez", "que ressens", "qu'éprouvez", "que vous évoque",
  "que remarquez-vous", "que remarques-tu",
  "que vous inspire", "qu'inspire",
  "votre préféré", "votre prefere", "votre favori",
  "le plus beau", "la plus belle", "les plus beaux",
  "choisissez le plus", "choisissez la plus",
  "quel vous plaît", "qui vous plaît le plus",
  "quelle ambiance",
];

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
// V4.1 — Vague-observation & unsourced-historical guards
// ─────────────────────────────────────────────────────────────
const RICH_SOURCE_KEYS = ["riddle_easy", "riddle_medium", "riddle_hard", "must_see_details", "challenge"] as const;

function sourceHasRichData(source: Record<string, unknown> | undefined | null): boolean {
  if (!source) return false;
  return RICH_SOURCE_KEYS.some((k) => {
    const v = source[k];
    return typeof v === "string" && v.trim().length > 0;
  });
}


// ─────────────────────────────────────────────────────────────
// V4.2 — Verifiability / consistency / generic-answer guards
// ─────────────────────────────────────────────────────────────

function sourceBlobLower(source: Record<string, unknown> | undefined | null): string {
  if (!source) return "";
  return RICH_SOURCE_KEYS
    .map((k) => (typeof source[k] === "string" ? (source[k] as string).toLowerCase() : ""))
    .join(" ");
}

// V4.2 — Mesures exactes non sourcées (hauteur, mètres, longueur, etc.)
const MEASURE_PATTERNS = [
  "hauteur", "longueur", "largeur", "profondeur", "superficie",
  "combien mesure", "quelle est la taille", "quelle est la hauteur",
  "quelle est la longueur", "quelle est la largeur", "quelle est la profondeur",
];
// Détection numérique de "X mètres / m / mètre" dans la question
const METER_VALUE_RE = /(\b\d{1,4}([.,]\d+)?\s*(m\b|m\.|mètre|metres|mètres))/iu;

function collectUnverifiableMeasureViolations(
  index: number,
  name: string | null,
  mc: MiniChallenge | undefined,
  source: Record<string, unknown> | undefined | null,
): Violation[] {
  if (!mc) return [];
  const q = `${mc.question ?? ""} ${mc.instruction ?? ""} ${mc.title ?? ""}`;
  const qLower = q.toLowerCase();
  const ans = (mc.correct_answer ?? "").toString();
  const ansLower = ans.toLowerCase().trim();

  const hits: string[] = [];
  for (const p of MEASURE_PATTERNS) {
    if (qLower.includes(p)) hits.push(p);
  }
  const meterMatch = q.match(METER_VALUE_RE) || ans.match(METER_VALUE_RE);
  if (meterMatch) hits.push(`meter_value:${meterMatch[0].trim()}`);

  if (hits.length === 0) return [];

  // Tolérance : la valeur exacte (réponse) doit apparaître littéralement dans une source rich.
  const blob = sourceBlobLower(source);
  if (ansLower && blob.includes(ansLower)) return [];
  // Tolérance : la valeur numérique exacte (ex. "17 mètres") apparaît littéralement dans la source.
  if (meterMatch) {
    const numToken = meterMatch[0].toLowerCase().replace(/\s+/g, " ").trim();
    if (blob.includes(numToken)) return [];
    // Test plus permissif : juste le nombre + "m"/"mètre" séparés
    const numOnly = (numToken.match(/\d+([.,]\d+)?/) || [""])[0];
    if (numOnly && blob.includes(numOnly) && (blob.includes("mètre") || blob.includes(" m "))) return [];
  }

  return hits.map((h) => ({
    order: index, name,
    field: "mini_challenge.question",
    term: `unverifiable_exact_measure:${h}`,
    value: q.slice(0, 200),
  }));
}

// V4.2 — Questions historiques "risquées" élargies
const RISKY_HISTORICAL_PATTERNS = [
  "sultan", "dynastie",
  "almoravide", "almoravides",
  "almohade", "almohades",
  "mérinide", "merinide", "mérinides", "merinides",
  "saadien", "saadienne", "saadiens", "saadiennes",
  "fondé", "fondée", "fonde ", "fondateur", "fondation",
  "construit", "construite",
  "donna son nom", "porte le nom", "qui a donné son nom",
  "ancien sultan",
  "en quelle année", "à quelle époque", "quel siècle",
];
// Marqueurs indiquant que la question demande de LIRE une plaque/cartel visible
const PLAQUE_MARKERS = [
  "panneau", "cartel", "plaque", "inscription", "lisez", "lire",
  "écrit sur", "ecrit sur", "indiqué sur", "indique sur",
];

function collectRiskyHistoricalViolations(
  index: number,
  name: string | null,
  mc: MiniChallenge | undefined,
  source: Record<string, unknown> | undefined | null,
): Violation[] {
  if (!mc) return [];
  const blob = `${mc.question ?? ""} ${mc.instruction ?? ""} ${mc.title ?? ""} ${(mc as any).hint ?? ""} ${(mc as any).failure_message ?? ""}`.toLowerCase();
  const hits = RISKY_HISTORICAL_PATTERNS.filter((p) => blob.includes(p));
  if (hits.length === 0) return [];

  // Double condition pour tolérer :
  // (a) la réponse exacte est littéralement dans riddle_*/must_see_details
  // (b) la question dit explicitement de lire un panneau/cartel/inscription
  const answer = (mc.correct_answer ?? "").toString().toLowerCase().trim();
  const sBlob = sourceBlobLower(source);
  const answerSourced = !!(answer && sBlob.includes(answer));
  const hasPlaqueMarker = PLAQUE_MARKERS.some((m) => blob.includes(m));

  if (answerSourced && hasPlaqueMarker) return [];

  return hits.map((h) => ({
    order: index, name,
    field: "mini_challenge.question",
    term: `risky_historical_question:${h}`,
    value: blob.slice(0, 200),
  }));
}

// V4.2 — Cohérence interne question / hint / failure
function collectInternalConsistencyViolations(
  index: number,
  name: string | null,
  mc: MiniChallenge | undefined,
  source: Record<string, unknown> | undefined | null,
): Violation[] {
  if (!mc) return [];
  const out: Violation[] = [];
  const q = (mc.question ?? mc.instruction ?? "").toString().toLowerCase();
  const hint = ((mc as any).hint ?? "").toString().toLowerCase();
  const failure = ((mc as any).failure_message ?? "").toString().toLowerCase();
  const aux = `${hint} ${failure}`;

  const nameOnlyTriggers = ["donna son nom", "porte le nom", "porte son nom"];
  const foundationTerms = ["a fondé", "a fondée", "a construit", "fondateur", "fondation", "a édifié", "a bâti"];

  if (nameOnlyTriggers.some((t) => q.includes(t))) {
    for (const ft of foundationTerms) {
      if (aux.includes(ft)) {
        out.push({
          order: index, name,
          field: "mini_challenge.hint_failure",
          term: `inconsistency_name_vs_foundation:${ft}`,
          value: aux.slice(0, 200),
        });
      }
    }
  }

  // Si la question dit "fondé/fondée/construit", correct_answer doit être sourcée littéralement
  const foundationQuestionTriggers = ["fondé", "fondée", "construit", "construite", "fondateur"];
  if (foundationQuestionTriggers.some((t) => q.includes(t))) {
    const answer = (mc.correct_answer ?? "").toString().toLowerCase().trim();
    const sBlob = sourceBlobLower(source);
    if (!answer || !sBlob.includes(answer)) {
      out.push({
        order: index, name,
        field: "mini_challenge.correct_answer",
        term: "unsourced_foundation_claim",
        value: q.slice(0, 200),
      });
    }
  }

  return out;
}

// V4.2 — Réponse générique quand la question demande un "nom"
const GENERIC_NAME_QUESTION_PATTERNS = [
  "nom de l'endroit", "nom de l endroit",
  "nom du lieu", "nom de la place",
  "nom de l'espace", "nom de l espace",
  "nom de la salle", "nom de la cour",
  "nom de la terrasse", "nom du jardin",
  "nom du musée", "nom du palais", "nom du riad",
  "comment s'appelle", "comment appelle-t-on", "comment appelle t on",
];
const GENERIC_ANSWERS = new Set([
  "rooftop", "terrasse", "cour", "salle", "jardin", "musée", "musee",
  "palais", "riad", "place", "souk", "patio", "fontaine",
]);

function collectGenericAnswerViolations(
  index: number,
  name: string | null,
  mc: MiniChallenge | undefined,
): Violation[] {
  if (!mc) return [];
  if (mc.type !== "short_answer" && mc.type !== "code") return [];
  const q = `${mc.question ?? ""} ${mc.instruction ?? ""}`.toLowerCase();
  if (!GENERIC_NAME_QUESTION_PATTERNS.some((p) => q.includes(p))) return [];
  const ans = (mc.correct_answer ?? "").toString().toLowerCase().trim();
  if (!ans) return [];
  // Si la réponse est un mot générique seul (pas de nom propre composé)
  const tokens = ans.split(/[\s\-']+/).filter(Boolean);
  if (tokens.length === 1 && GENERIC_ANSWERS.has(tokens[0])) {
    return [{
      order: index, name,
      field: "mini_challenge.correct_answer",
      term: `generic_answer:${tokens[0]}`,
      value: `question="${q.slice(0, 120)}" answer="${ans}"`,
    }];
  }
  return [];
}



function collectObservationViolations(
  index: number,
  name: string | null,
  mc: MiniChallenge | undefined,
  source: Record<string, unknown> | undefined | null,
): Violation[] {
  if (!mc || mc.type !== "observation") return [];
  if (!sourceHasRichData(source)) return [];
  const value = `type=observation interdit : riddle_*/must_see_details/challenge non vide. Produis short_answer (correct_answer issue de riddle_easy/medium/hard) ou mcq avec choices+correct_answer.`;
  return [{
    order: index, name,
    field: "mini_challenge.type",
    term: "vague_observation_when_validable",
    value,
  }];
}

const HISTORICAL_PATTERNS = [
  "quelle était", "quelles étaient", "quel était", "quels étaient",
  "en quelle année", "à quelle époque", "quel sultan", "quelle dynastie",
  "quel siècle", "à quelle date",
];

function collectUnsourcedHistoricalViolations(
  index: number,
  name: string | null,
  mc: MiniChallenge | undefined,
  source: Record<string, unknown> | undefined | null,
): Violation[] {
  if (!mc) return [];
  const blob = `${mc.question ?? ""} ${mc.instruction ?? ""} ${mc.title ?? ""}`.toLowerCase();
  const hits = HISTORICAL_PATTERNS.filter((p) => blob.includes(p));
  if (hits.length === 0) return [];
  // Tolérance : si la correct_answer est littéralement présente dans une source rich, on accepte.
  const answer = (mc.correct_answer ?? "").toString().toLowerCase().trim();
  if (answer && source) {
    const sourceBlob = RICH_SOURCE_KEYS
      .map((k) => (typeof source[k] === "string" ? (source[k] as string).toLowerCase() : ""))
      .join(" ");
    if (sourceBlob.includes(answer)) return [];
  }
  return hits.map((h) => ({
    order: index, name,
    field: "mini_challenge.question",
    term: `unsourced_historical:${h}`,
    value: blob,
  }));
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


// ─────────────────────────────────────────────────────────────
// V2 — Missions terrain canoniques (déterministe, pré-IA)
// ─────────────────────────────────────────────────────────────
const LEGACY_MISSION_STUB_V2: Mission = {
  enabled: false, title: "", objective: "", instruction: "", reward_text: "",
};

type CanonicalMission = {
  key: string;
  matchers: RegExp[]; // matched against POI name (lowercased, accents stripped)
  mc: MiniChallenge;
};

function nameKey(s: unknown): string {
  return typeof s === "string"
    ? s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    : "";
}

const CANONICAL_MISSIONS_V2: CanonicalMission[] = [
  {
    key: "jemaa_el_fna",
    matchers: [/jemaa\s*el[\s\-]?fna/i, /jamaa\s*el[\s\-]?fna/i, /place\s+jemaa/i],
    mc: {
      enabled: true,
      type: "photo",
      title: "Mission : stand vitaminé",
      instruction:
        "Vous avez 3 minutes. Trouvez un stand de jus d'orange. Demandez poliment si vous pouvez prendre une photo du stand. Bonus si un membre du groupe apparaît avec un pouce levé devant les oranges. Si le vendeur refuse, prenez seulement les oranges ou choisissez un autre stand.",
      time_limit_sec: 180,
      requires_photo: true,
      consent_required: true,
      hints: [
        "Les stands jaunes alignés sur la place sont les plus visibles.",
        "Un sourire et 'salam' suffisent souvent pour obtenir l'accord.",
      ],
      success_message: "Mission validée — vitamine C en poche !",
      failure_message: "Pas grave, gardez l'énergie pour le prochain stop.",
      required: false,
    },
  },
  {
    key: "souk_semmarine",
    matchers: [/souk\s+semmarine/i, /semmarine/i],
    mc: {
      enabled: true,
      type: "photo",
      title: "Mission : couleur cachée du souk",
      instruction:
        "Vous avez 3 minutes. Choisissez une couleur avant de regarder autour de vous : rouge, bleu, vert ou doré. Trouvez un objet typique du souk dans cette couleur : babouche, tissu, cuir, métal, poterie ou épices. Photo obligatoire avec un membre du groupe qui pointe l'objet. Pas d'achat obligatoire.",
      time_limit_sec: 180,
      requires_photo: true,
      consent_required: true,
      hints: [
        "Annoncez la couleur à voix haute avant de lever les yeux.",
        "Les babouches et les tissus offrent les couleurs les plus pures.",
      ],
      success_message: "Couleur capturée — œil de chineur validé !",
      failure_message: "Pas trouvée ? Retentez avec une autre couleur au prochain stop.",
      required: false,
    },
  },
  {
    key: "rahba_kedima",
    matchers: [/rahba\s+kedima/i, /place\s+des\s+[ée]pices/i, /rahba/i],
    mc: {
      enabled: true,
      type: "photo",
      title: "Mission : rouge Aker Fassi",
      instruction:
        "Vous avez 3 minutes. Cherchez un objet rouge traditionnel : poudre, épice, poterie, textile ou Aker Fassi si vous en voyez. Prenez une photo ou écrivez le nom de l'objet trouvé. Demandez l'accord avant de photographier un stand.",
      time_limit_sec: 180,
      requires_photo: false,
      consent_required: true,
      hints: [
        "L'Aker Fassi est une poudre rouge naturelle utilisée comme cosmétique.",
        "Les coopératives de femmes en exposent souvent en pots ouverts.",
      ],
      success_message: "Rouge repéré — bien vu !",
      failure_message: "Pas vu de rouge ? Repassez plus tard, la place change toute la journée.",
      required: false,
    },
  },
  {
    key: "koutoubia",
    matchers: [/koutoubia/i, /kutubiyya/i],
    mc: {
      enabled: true,
      type: "photo",
      title: "Mission : minaret géant",
      instruction:
        "Vous avez 2 minutes. Faites une photo où un membre du groupe essaie de \"toucher\" le sommet du minaret avec son doigt par effet de perspective. Restez à l'extérieur, aucune entrée nécessaire.",
      time_limit_sec: 120,
      requires_photo: true,
      consent_required: false,
      hints: [
        "Reculez de quelques mètres pour cadrer le sommet et la main dans le même axe.",
        "Le photographe se baisse légèrement pour aligner la perspective.",
      ],
      success_message: "Perspective réussie — Koutoubia en main !",
      failure_message: "Pas d'angle ? Faites le tour, le minaret se laisse photographier depuis tous les côtés.",
      required: false,
    },
  },
  {
    key: "jardin_secret",
    matchers: [/jardin\s+secret/i],
    mc: {
      enabled: true,
      type: "self_check",
      title: "Mission : détail secret",
      instruction:
        "Vous avez 2 minutes. Sans entrer si l'entrée n'est pas prévue, trouvez un détail discret autour du lieu : porte, motif, ombre, plante, couleur ou carreau. Chaque membre propose un détail, puis le groupe choisit le plus \"secret\".",
      time_limit_sec: 120,
      requires_photo: false,
      consent_required: false,
      hints: [
        "Regardez les détails que personne d'autre ne photographie.",
        "Une ombre ou un reflet compte autant qu'un motif sculpté.",
      ],
      success_message: "Détail élu — l'œil du groupe est aiguisé.",
      failure_message: "Pas de consensus ? Choisissez à la majorité.",
      required: false,
    },
  },
  {
    key: "dar_el_bacha",
    matchers: [/dar\s+el[\s\-]?bacha/i, /dar\s+bacha/i],
    mc: {
      enabled: true,
      type: "photo",
      title: "Mission : porte de palais",
      instruction:
        "Vous avez 2 minutes. Trouvez le plus beau détail de porte ou de façade. Un membre du groupe doit poser comme s'il était le gardien du palais. Restez dehors, aucune entrée payante nécessaire.",
      time_limit_sec: 120,
      requires_photo: true,
      consent_required: false,
      hints: [
        "Cherchez les clous de bronze ou les motifs sculptés dans le bois.",
        "Posez bras croisés, sérieux, comme un vrai gardien.",
      ],
      success_message: "Pose royale validée !",
      failure_message: "Trop timide ? Un autre membre du groupe peut reprendre la pose.",
      required: false,
    },
  },
];

const DARIJA_MISSION: MiniChallenge = {
  enabled: true,
  type: "text",
  title: "Mission : première traduction darija",
  instruction:
    "Vous avez 2 minutes. Essayez de comprendre cette phrase : « فين كاين جامع الفنا؟ ». Le premier qui trouve la traduction gagne la mission. Vous pouvez demander à quelqu'un poliment, utiliser Google Traduction ou deviner en groupe. Écrivez la traduction en français.",
  expected_answer_hint: "La phrase demande où se trouve Jemaa el-Fna.",
  time_limit_sec: 120,
  requires_photo: false,
  consent_required: false,
  hints: [
    "« فين » veut dire « où ».",
    "« كاين » veut dire « se trouve / il y a ».",
  ],
  success_message: "Bravo — première phrase darija décodée !",
  failure_message: "Pas grave, vous retiendrez « fin kayn » pour la suite du voyage.",
  required: false,
};

const FALLBACK_MISSION_SELF_CHECK: MiniChallenge = {
  enabled: true,
  type: "self_check",
  title: "Mission : preuve locale",
  instruction:
    "Vous avez 2 minutes. Trouvez un détail qui prouve que vous êtes à Marrakech : couleur ocre, motif, porte, enseigne, artisanat, plante, carreau ou ombre. Le groupe choisit le détail le plus original.",
  time_limit_sec: 120,
  requires_photo: false,
  consent_required: false,
  hints: [
    "L'ocre est partout, mais les nuances changent selon l'heure.",
    "Une enseigne manuscrite vaut mieux qu'une enseigne imprimée.",
  ],
  success_message: "Preuve locale validée !",
  failure_message: "Le groupe vote : le détail le plus original gagne.",
  required: false,
};

const FALLBACK_MISSION_TEXT: MiniChallenge = {
  enabled: true,
  type: "text",
  title: "Mission : mot du lieu",
  instruction:
    "Vous avez 2 minutes. Chacun propose un mot qui décrit l'ambiance autour de vous : odeur, couleur, son, matière. Le groupe choisit le mot le plus juste et l'écrit ici.",
  expected_answer_hint: "Un mot court qui décrit l'ambiance du lieu (ex. ocre, cuir, menthe, brouhaha).",
  time_limit_sec: 120,
  requires_photo: false,
  consent_required: false,
  hints: [
    "Fermez les yeux 5 secondes avant de proposer.",
    "Un mot sensoriel vaut mieux qu'un mot abstrait.",
  ],
  success_message: "Mot retenu — ambiance capturée !",
  failure_message: "Pas d'accord ? Notez les deux mots favoris.",
  required: false,
};

function matchCanonicalMission(poiName: unknown, stopName: unknown): MiniChallenge | null {
  const blob = `${nameKey(poiName)} ${nameKey(stopName)}`;
  for (const c of CANONICAL_MISSIONS_V2) {
    if (c.matchers.some((re) => re.test(blob))) {
      return JSON.parse(JSON.stringify(c.mc)) as MiniChallenge;
    }
  }
  return null;
}

/**
 * V2 — Enforce variation rules across the whole tour:
 *  - max 3 photo missions on 6 stops
 *  - at least 1 text and 1 self_check when targets >= 4
 *  - no two identical titles
 * Converts excess photo missions (fallback or generic only) to self_check / text.
 */
function enforceVariationV2(
  targets: number[],
  byOrder: Map<number, { mission: Mission; mini_challenge: MiniChallenge }>,
  canonicalOrders: Set<number>,
): { changes: Array<{ order: number; from: string; to: string; reason: string }> } {
  const changes: Array<{ order: number; from: string; to: string; reason: string }> = [];
  const total = targets.length;
  const photoBudget = Math.min(3, Math.max(1, Math.floor(total / 2)));

  // Pass 1 — anti-duplicate titles (only adjust non-canonical entries)
  const seenTitles = new Map<string, number>();
  for (const i of targets) {
    const r = byOrder.get(i);
    if (!r) continue;
    const t = (r.mini_challenge.title ?? "").trim().toLowerCase();
    if (!t) continue;
    if (seenTitles.has(t) && !canonicalOrders.has(i)) {
      const before = r.mini_challenge.title ?? "";
      r.mini_challenge.title = `${before} (variante ${seenTitles.get(t)! + 1})`;
      changes.push({ order: i, from: before, to: r.mini_challenge.title, reason: "duplicate_title" });
      seenTitles.set(t, (seenTitles.get(t) ?? 1) + 1);
    } else {
      seenTitles.set(t, 1);
    }
  }

  // Pass 2 — photo budget
  const photoOrders = targets.filter((i) => byOrder.get(i)?.mini_challenge?.type === "photo");
  let excess = photoOrders.length - photoBudget;
  if (excess > 0) {
    // Convert from the end, skipping canonical photo stops (canonical wins).
    for (let k = photoOrders.length - 1; k >= 0 && excess > 0; k--) {
      const i = photoOrders[k];
      if (canonicalOrders.has(i)) continue;
      const r = byOrder.get(i)!;
      const beforeType = r.mini_challenge.type;
      // Alternate target: prefer self_check, then text
      const hasText = targets.some((j) => byOrder.get(j)?.mini_challenge?.type === "text");
      const replacement = hasText ? FALLBACK_MISSION_SELF_CHECK : FALLBACK_MISSION_TEXT;
      r.mini_challenge = JSON.parse(JSON.stringify(replacement));
      changes.push({ order: i, from: beforeType, to: r.mini_challenge.type, reason: "photo_budget_exceeded" });
      excess--;
    }
  }

  // Pass 3 — ensure at least 1 text and 1 self_check when total >= 4
  if (total >= 4) {
    const ensureType = (wanted: "text" | "self_check", template: MiniChallenge) => {
      const has = targets.some((i) => byOrder.get(i)?.mini_challenge?.type === wanted);
      if (has) return;
      // Pick the last non-canonical photo or short_answer stop to convert
      const candidate = [...targets].reverse().find((i) => {
        if (canonicalOrders.has(i)) return false;
        const t = byOrder.get(i)?.mini_challenge?.type;
        return t === "photo" || t === "short_answer" || t === "observation" || t === "mcq";
      });
      if (candidate == null) return;
      const r = byOrder.get(candidate)!;
      const beforeType = r.mini_challenge.type;
      r.mini_challenge = JSON.parse(JSON.stringify(template));
      changes.push({ order: candidate, from: beforeType, to: wanted, reason: `ensure_${wanted}` });
    };
    ensureType("self_check", FALLBACK_MISSION_SELF_CHECK);
    ensureType("text", FALLBACK_MISSION_TEXT);
  }

  return { changes };
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
        "id, name, name_en, category, category_ai, description_short, history_context, history_context_en, local_anecdote, local_anecdote_fr, local_anecdote_en, fun_fact_fr, must_see_details, must_try, must_visit_nearby, photo_tip, riddle_easy, riddle_medium, riddle_hard, challenge, opening_hours, price_info, poi_quality_score"
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

        // ── B.bis V4.0 — Force mission en stub legacy désactivé (déterministe) ──
        // Les "missions" sont dépréciées côté produit : QRP n'affiche plus MissionActionBlock.
        // On garantit ici qu'aucun contenu mission n'est persisté, quoi que le LLM ait renvoyé.
        const LEGACY_MISSION_STUB: Mission = {
          enabled: false,
          title: "",
          objective: "",
          instruction: "",
          reward_text: "",
        };
        for (const i of targets) {
          const r = byOrder.get(i);
          if (!r) continue;
          byOrder.set(i, { mission: { ...LEGACY_MISSION_STUB }, mini_challenge: r.mini_challenge });
        }

        // ── C. Banned terms (re-scan after sanitization) ──

        const scanAll = () => {
          const v: Violation[] = [];
          for (const i of targets) {
            const r = byOrder.get(i);
            if (!r) continue;
            const src = sourceCtxByOrder.get(i) ?? {};
            v.push(...collectBannedTermsInStop(i, stops[i]?.name ?? null, r.mission, r.mini_challenge));
            // V4.1 — interdire observation vague si données validables disponibles
            v.push(...collectObservationViolations(i, stops[i]?.name ?? null, r.mini_challenge, src));
            // V4.1 — interdire questions historiques non sourcées
            v.push(...collectUnsourcedHistoricalViolations(i, stops[i]?.name ?? null, r.mini_challenge, src));
            // V4.2 — mesures exactes non sourcées (hauteur/mètres/longueur)
            v.push(...collectUnverifiableMeasureViolations(i, stops[i]?.name ?? null, r.mini_challenge, src));
            // V4.2 — questions historiques risquées (sultan/dynastie/fondé/donna son nom)
            v.push(...collectRiskyHistoricalViolations(i, stops[i]?.name ?? null, r.mini_challenge, src));
            // V4.2 — cohérence interne question / hint / failure
            v.push(...collectInternalConsistencyViolations(i, stops[i]?.name ?? null, r.mini_challenge, src));
            // V4.2 — réponse générique sur "nom de l'endroit/lieu"
            v.push(...collectGenericAnswerViolations(i, stops[i]?.name ?? null, r.mini_challenge));
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
