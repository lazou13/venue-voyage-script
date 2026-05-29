// Missions terrain V2 — templates canoniques, fallback variés, anti-répétition.
// Utilisé par poi-auto-agent (insertion de nouvelles visites quest_library)
// pour garantir que chaque stop expose un mini_challenge V2 :
//   { enabled, type, title, instruction, time_limit_sec, requires_photo,
//     consent_required, expected_answer_hint?, hints[], success_message,
//     failure_message, required:false }
//
// INTERDIT côté ce module :
//   - aucun écrasement d'un mini_challenge existant
//   - aucun touch QRP / quest-proxy / player
//   - aucun appel AI, aucun secret
//   - aucune écriture DB

export type MissionType = "photo" | "text" | "self_check" | "timed_action";

export interface MiniChallengeV2 {
  enabled: true;
  type: MissionType;
  title: string;
  instruction: string;
  time_limit_sec: number;
  requires_photo: boolean;
  consent_required: boolean;
  expected_answer_hint?: string;
  hints: string[];
  success_message: string;
  failure_message: string;
  required: false;
}

interface CanonicalEntry {
  key: string;
  matchers: RegExp[];
  mc: MiniChallengeV2;
}

const KOUTOUBIA: MiniChallengeV2 = {
  enabled: true, type: "photo",
  title: "Mission : minaret géant",
  instruction:
    "Vous avez 2 minutes. Faites une photo où un membre du groupe essaie de « toucher » le sommet du minaret avec son doigt par effet de perspective. Restez à l'extérieur, aucune entrée nécessaire.",
  time_limit_sec: 120, requires_photo: true, consent_required: false,
  hints: [
    "Reculez de quelques mètres pour cadrer le sommet et la main dans le même axe.",
    "Le photographe se baisse légèrement pour aligner la perspective.",
  ],
  success_message: "Perspective réussie — Koutoubia en main !",
  failure_message: "Pas d'angle ? Faites le tour, le minaret se laisse photographier depuis tous les côtés.",
  required: false,
};

const JEMAA: MiniChallengeV2 = {
  enabled: true, type: "photo",
  title: "Mission : stand vitaminé",
  instruction:
    "Vous avez 3 minutes. Trouvez un stand de jus d'orange. Demandez poliment si vous pouvez prendre une photo du stand. Bonus si un membre du groupe apparaît avec un pouce levé devant les oranges. Si le vendeur refuse, prenez seulement les oranges ou choisissez un autre stand.",
  time_limit_sec: 180, requires_photo: true, consent_required: true,
  hints: [
    "Les stands jaunes alignés sur la place sont les plus visibles.",
    "Un sourire et « salam » suffisent souvent pour obtenir l'accord.",
  ],
  success_message: "Mission validée — vitamine C en poche !",
  failure_message: "Pas grave, gardez l'énergie pour le prochain stop.",
  required: false,
};

const SEMMARINE: MiniChallengeV2 = {
  enabled: true, type: "photo",
  title: "Mission : couleur cachée du souk",
  instruction:
    "Vous avez 3 minutes. Choisissez une couleur avant de regarder autour de vous : rouge, bleu, vert ou doré. Trouvez un objet typique du souk dans cette couleur : babouche, tissu, cuir, métal, poterie ou épices. Photo obligatoire avec un membre du groupe qui pointe l'objet. Pas d'achat obligatoire.",
  time_limit_sec: 180, requires_photo: true, consent_required: true,
  hints: [
    "Annoncez la couleur à voix haute avant de lever les yeux.",
    "Les babouches et les tissus offrent les couleurs les plus pures.",
  ],
  success_message: "Couleur capturée — œil de chineur validé !",
  failure_message: "Pas trouvée ? Retentez avec une autre couleur au prochain stop.",
  required: false,
};

const RAHBA: MiniChallengeV2 = {
  enabled: true, type: "text",
  title: "Mission : rouge Aker Fassi",
  instruction:
    "Vous avez 3 minutes. Cherchez un objet rouge traditionnel : poudre, épice, poterie, textile ou Aker Fassi si vous en voyez. Écrivez le nom de l'objet trouvé. Demandez l'accord avant de photographier un stand.",
  expected_answer_hint: "Aker Fassi, poterie de Safi, tapis de Glaoua, étoffe teinte au henné…",
  time_limit_sec: 180, requires_photo: false, consent_required: true,
  hints: [
    "L'Aker Fassi est une poudre rouge naturelle utilisée comme cosmétique.",
    "Les coopératives de femmes en exposent souvent en pots ouverts.",
  ],
  success_message: "Rouge repéré — bien vu !",
  failure_message: "Pas vu de rouge ? Repassez plus tard, la place change toute la journée.",
  required: false,
};

const JARDIN_SECRET: MiniChallengeV2 = {
  enabled: true, type: "self_check",
  title: "Mission : détail secret",
  instruction:
    "Vous avez 2 minutes. Sans entrer si l'entrée n'est pas prévue, trouvez un détail discret autour du lieu : porte, motif, ombre, plante, couleur ou carreau. Chaque membre propose un détail, puis le groupe choisit le plus « secret ».",
  time_limit_sec: 120, requires_photo: false, consent_required: false,
  hints: [
    "Regardez les détails que personne d'autre ne photographie.",
    "Une ombre ou un reflet compte autant qu'un motif sculpté.",
  ],
  success_message: "Détail élu — l'œil du groupe est aiguisé.",
  failure_message: "Pas de consensus ? Choisissez à la majorité.",
  required: false,
};

const DAR_EL_BACHA: MiniChallengeV2 = {
  enabled: true, type: "self_check",
  title: "Mission : porte de palais",
  instruction:
    "Vous avez 2 minutes. Trouvez le plus beau détail de porte ou de façade. Un membre du groupe doit poser comme s'il était le gardien du palais. Restez dehors, aucune entrée payante nécessaire.",
  time_limit_sec: 120, requires_photo: false, consent_required: false,
  hints: [
    "Cherchez les clous de bronze ou les motifs sculptés dans le bois.",
    "Posez bras croisés, sérieux, comme un vrai gardien.",
  ],
  success_message: "Pose royale validée !",
  failure_message: "Trop timide ? Un autre membre du groupe peut reprendre la pose.",
  required: false,
};

const MEDERSA_BEN_YOUSSEF: MiniChallengeV2 = {
  enabled: true, type: "text",
  title: "Mission : mot du lieu",
  instruction:
    "Vous avez 2 minutes. Trouvez ou devinez la signification du mot « médersa ». Écrivez votre réponse en quelques mots.",
  expected_answer_hint: "Une médersa est une école traditionnelle d'enseignement religieux.",
  time_limit_sec: 120, requires_photo: false, consent_required: false,
  hints: [
    "Pensez à un lieu d'apprentissage.",
    "Le mot vient de l'arabe « darasa » : étudier.",
  ],
  success_message: "Bonne définition — médersa = école !",
  failure_message: "Pas grave, vous le saurez pour la suite du voyage.",
  required: false,
};

const DARIJA_FALLBACK: MiniChallengeV2 = {
  enabled: true, type: "text",
  title: "Mission : première traduction darija",
  instruction:
    "Vous avez 2 minutes. Essayez de comprendre cette phrase : « فين كاين جامع الفنا؟ ». Le premier qui trouve la traduction gagne la mission. Vous pouvez demander poliment, utiliser Google Traduction ou deviner en groupe. Écrivez la traduction en français.",
  expected_answer_hint: "La phrase demande où se trouve Jemaa el-Fna.",
  time_limit_sec: 120, requires_photo: false, consent_required: false,
  hints: [
    "« فين » veut dire « où ».",
    "« كاين » veut dire « se trouve / il y a ».",
  ],
  success_message: "Bravo — première phrase darija décodée !",
  failure_message: "Pas grave, vous retiendrez « fin kayn » pour la suite du voyage.",
  required: false,
};

const FALLBACK_SELF_CHECK: MiniChallengeV2 = {
  enabled: true, type: "self_check",
  title: "Mission : preuve locale",
  instruction:
    "Vous avez 2 minutes. Trouvez un détail qui prouve que vous êtes à Marrakech : couleur ocre, motif, porte, enseigne, artisanat, plante, carreau ou ombre. Le groupe choisit le détail le plus original.",
  time_limit_sec: 120, requires_photo: false, consent_required: false,
  hints: [
    "L'ocre est partout, mais les nuances changent selon l'heure.",
    "Une enseigne manuscrite vaut mieux qu'une enseigne imprimée.",
  ],
  success_message: "Preuve locale validée !",
  failure_message: "Le groupe vote : le détail le plus original gagne.",
  required: false,
};

export const CANONICAL_MISSIONS_V2: CanonicalEntry[] = [
  { key: "koutoubia",         matchers: [/koutoubia/i, /kutubiyya/i],                                      mc: KOUTOUBIA },
  { key: "jemaa_el_fna",      matchers: [/jemaa\s*el[\s\-]?fna/i, /jamaa\s*el[\s\-]?fna/i, /place\s+jemaa/i], mc: JEMAA },
  { key: "souk_semmarine",    matchers: [/souk\s+semmarine/i, /semmarine/i],                               mc: SEMMARINE },
  { key: "rahba_kedima",      matchers: [/rahba\s+kedima/i, /place\s+des\s+[ée]pices/i, /rahba/i],         mc: RAHBA },
  { key: "jardin_secret",     matchers: [/jardin\s+secret/i],                                              mc: JARDIN_SECRET },
  { key: "dar_el_bacha",      matchers: [/dar\s+el[\s\-]?bacha/i, /dar\s+bacha/i],                         mc: DAR_EL_BACHA },
  { key: "medersa_ben_youssef", matchers: [/m[ée]dersa.*ben\s*youssef/i, /ben\s*youssef.*m[ée]dersa/i, /m[ée]dersa/i], mc: MEDERSA_BEN_YOUSSEF },
];

function norm(s: unknown): string {
  return typeof s === "string"
    ? s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    : "";
}

function matchCanonical(poiName: unknown): MiniChallengeV2 | null {
  const blob = norm(poiName);
  if (!blob) return null;
  for (const c of CANONICAL_MISSIONS_V2) {
    if (c.matchers.some((re) => re.test(blob))) {
      return JSON.parse(JSON.stringify(c.mc)) as MiniChallengeV2;
    }
  }
  return null;
}

// Sélecteur fallback déterministe : alterne self_check / text / darija
// pour garantir la variation des types sur la route.
function pickFallback(index: number): MiniChallengeV2 {
  const rotation = [FALLBACK_SELF_CHECK, DARIJA_FALLBACK, FALLBACK_SELF_CHECK];
  return JSON.parse(JSON.stringify(rotation[index % rotation.length])) as MiniChallengeV2;
}

// Blacklist boutiques privées génériques (rugs, carpets, tapis…).
// N'exclut PAS les souks ni les artisans du parcours culturel.
const PRIVATE_BOUTIQUE_BLACKLIST = [
  /fine\s+moroccan\s+rugs/i,
  /\brugs?\b/i,
  /\bcarpets?\b/i,
  /\btapis\b/i,
];

export function isPrivateBoutiqueBlacklisted(name: unknown): boolean {
  const n = typeof name === "string" ? name : "";
  if (!n) return false;
  return PRIVATE_BOUTIQUE_BLACKLIST.some((re) => re.test(n));
}

interface StopLike {
  name?: unknown;
  mini_challenge?: unknown;
}

/**
 * Attache un mini_challenge V2 à chaque stop qui n'en a pas.
 * Ne touche jamais un mini_challenge existant.
 * Applique ensuite les règles anti-répétition :
 *   - max 3 photo
 *   - au moins 1 text et 1 self_check si total >= 4
 *   - aucun titre dupliqué
 */
export function attachMissionsV2<T extends StopLike>(stops: T[]): T[] {
  if (!Array.isArray(stops) || stops.length === 0) return stops;

  const canonicalIdx = new Set<number>();
  const out = stops.map((s, i) => {
    if (s.mini_challenge && typeof s.mini_challenge === "object") return s;
    const canon = matchCanonical(s.name);
    if (canon) {
      canonicalIdx.add(i);
      return { ...s, mini_challenge: canon };
    }
    return { ...s, mini_challenge: pickFallback(i) };
  });

  // Anti-doublon de titres (n'altère pas les canoniques)
  const seen = new Map<string, number>();
  for (let i = 0; i < out.length; i++) {
    const mc = out[i].mini_challenge as MiniChallengeV2 | undefined;
    if (!mc?.title) continue;
    const k = mc.title.trim().toLowerCase();
    if (seen.has(k) && !canonicalIdx.has(i)) {
      const n = (seen.get(k) ?? 1) + 1;
      out[i] = { ...out[i], mini_challenge: { ...mc, title: `${mc.title} (variante ${n})` } };
      seen.set(k, n);
    } else {
      seen.set(k, 1);
    }
  }

  // Budget photo : max 3
  const isType = (i: number, t: MissionType) => (out[i].mini_challenge as MiniChallengeV2 | undefined)?.type === t;
  const photoIdx = out.map((_, i) => i).filter((i) => isType(i, "photo"));
  let excess = photoIdx.length - 3;
  for (let k = photoIdx.length - 1; k >= 0 && excess > 0; k--) {
    const i = photoIdx[k];
    if (canonicalIdx.has(i)) continue;
    out[i] = { ...out[i], mini_challenge: JSON.parse(JSON.stringify(FALLBACK_SELF_CHECK)) };
    excess--;
  }

  // Garantir 1 text et 1 self_check si total >= 4
  if (out.length >= 4) {
    const ensure = (wanted: MissionType, tpl: MiniChallengeV2) => {
      if (out.some((_, i) => isType(i, wanted))) return;
      for (let i = out.length - 1; i >= 0; i--) {
        if (canonicalIdx.has(i)) continue;
        if (isType(i, "photo") || isType(i, "self_check") || isType(i, "text")) {
          out[i] = { ...out[i], mini_challenge: JSON.parse(JSON.stringify(tpl)) };
          return;
        }
      }
    };
    ensure("self_check", FALLBACK_SELF_CHECK);
    ensure("text", DARIJA_FALLBACK);
  }

  return out;
}
