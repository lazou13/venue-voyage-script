// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

interface EnrichBody {
  poi_id: string;
  mode?: "fill_empty" | "regenerate";
  include?: { text?: boolean; photos?: boolean; videos?: boolean; fun_facts?: boolean };
}

const TEXT_FIELDS_FR = [
  "history_context",
  "local_anecdote_fr",
  "must_see_details",
  "must_try",
  "must_visit_nearby",
  "photo_tip",
  "best_time_visit",
  "accessibility_notes",
] as const;

const FR_TO_EN: Record<string, string> = {
  history_context: "history_context_en",
  local_anecdote_fr: "local_anecdote_en",
  must_see_details: "must_see_details_en",
  must_try: "must_try_en",
  must_visit_nearby: "must_visit_nearby_en",
  photo_tip: "photo_tip_en",
  best_time_visit: "best_time_visit_en",
  accessibility_notes: "accessibility_notes_en",
};

async function callPerplexity(poi: any) {
  if (!PERPLEXITY_API_KEY) throw new Error("PERPLEXITY_API_KEY non configuré");

  const sys = `Tu es un historien-journaliste expert de Marrakech. Tu écris en français impeccable, sans clichés ("perle de l'Atlas", "magie", "authentique"), avec dates précises, noms propres et faits vérifiables. Réponse STRICTEMENT en JSON valide, sans markdown.`;

  const user = `POI : "${poi.name}" (catégorie : ${poi.category}, zone : ${poi.zone || "Médina de Marrakech"})${poi.address ? `, adresse : ${poi.address}` : ""}.

Produis un JSON avec EXACTEMENT cette structure :
{
  "history_context": "200-250 mots en français, dates précises, dynastie, fonction historique, évolutions",
  "local_anecdote_fr": "80-100 mots, UN fait surprenant et vérifiable",
  "fun_facts": ["3 à 5 puces courtes en français, chacune un chiffre/fait ponctuel et précis"],
  "must_see_details": "3-4 phrases en français : éléments architecturaux ou détails à observer",
  "must_try": "1-2 phrases en français : expérience à vivre sur place (spécifique souk/marché si applicable)",
  "must_visit_nearby": "1-2 phrases en français : 2-3 lieux pertinents à proximité immédiate",
  "photo_tip": "1 phrase en français : meilleur angle / heure pour la photo",
  "best_time_visit": "1 phrase en français : meilleur moment de la journée et de l'année",
  "accessibility_notes": "1 phrase en français : marches, ruelles étroites, fauteuil",
  "crowd_level": "low | medium | high",
  "suggested_photo_urls": ["3 à 5 URLs Wikimedia Commons ou sources libres de droits, vérifiées"],
  "suggested_youtube_videos": [{"youtube_id": "ID_11_chars", "title": "titre court", "source": "url"}]
}`;

  const resp = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      temperature: 0.3,
      max_tokens: 2200,
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Perplexity ${resp.status}: ${t.slice(0, 300)}`);
  }
  const data = await resp.json();
  const content: string = data.choices?.[0]?.message?.content || "";
  const citations: string[] = data.citations || [];

  const cleaned = content.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Réponse Perplexity non-JSON");
    parsed = JSON.parse(m[0]);
  }
  return { parsed, citations };
}

async function translateToEn(text: string): Promise<string | null> {
  if (!text?.trim()) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ text, from: "fr", to: "en" }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j.translated || null;
  } catch {
    return null;
  }
}

function buildAudit(poi: any) {
  const missing_text_fields = TEXT_FIELDS_FR.filter((f) => !((poi as any)[f] && String((poi as any)[f]).trim()));
  const missing_en_fields = Object.values(FR_TO_EN).filter((f) => !((poi as any)[f] && String((poi as any)[f]).trim()));
  const has_fun_facts = Array.isArray(poi.fun_facts_bilingual) && poi.fun_facts_bilingual.length > 0;
  const has_videos = Array.isArray(poi.video_urls) && poi.video_urls.length > 0;
  const audio_slots = {
    audio_url_fr: !!poi.audio_url_fr,
    audio_url_en: !!poi.audio_url_en,
    anecdote_audio_url_fr: !!poi.anecdote_audio_url_fr,
    anecdote_audio_url_en: !!poi.anecdote_audio_url_en,
  };
  const audio_slots_filled = Object.values(audio_slots).filter(Boolean).length;
  return { missing_text_fields, missing_en_fields, has_fun_facts, has_videos, audio_slots, audio_slots_filled };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as EnrichBody & { audit_only?: boolean };
    if (!body?.poi_id) return json({ error: "poi_id requis" }, 400);
    const mode = body.mode ?? "fill_empty";
    const include = { text: true, photos: true, videos: true, fun_facts: true, ...(body.include ?? {}) };

    const { data: poi, error: pErr } = await supabase.from("medina_pois").select("*").eq("id", body.poi_id).single();
    if (pErr || !poi) return json({ error: "POI introuvable" }, 404);

    const audit = buildAudit(poi);

    // Audit-only mode: return state without calling Perplexity
    if (body.audit_only) {
      return json({ ok: true, poi_id: poi.id, audit, skipped: true, reason: "audit_only" });
    }

    // Early-exit: in fill_empty mode, skip Perplexity entirely if nothing requested would be filled
    if (mode === "fill_empty") {
      const wantText = include.text && audit.missing_text_fields.length > 0;
      const wantEn = include.text && audit.missing_en_fields.length > 0;
      const wantFun = include.fun_facts && !audit.has_fun_facts;
      const wantVideos = include.videos && !audit.has_videos;
      const wantPhotos = include.photos; // photos are always additive
      if (!wantText && !wantEn && !wantFun && !wantVideos && !wantPhotos) {
        return json({ ok: true, poi_id: poi.id, skipped: true, reason: "nothing_to_fill", audit });
      }
    }

    const { parsed, citations } = await callPerplexity(poi);

    const patch: Record<string, any> = {};
    const previous: Record<string, any> = {};

    // Texte FR
    if (include.text) {
      for (const f of TEXT_FIELDS_FR) {
        const v = parsed[f];
        if (typeof v !== "string" || !v.trim()) continue;
        const cur = (poi as any)[f];
        if (mode === "fill_empty" && cur && String(cur).trim()) continue;
        if (cur) previous[f] = cur;
        patch[f] = v.trim();
      }
      if (typeof parsed.crowd_level === "string") {
        if (mode === "regenerate" || !poi.crowd_level) {
          if (poi.crowd_level) previous.crowd_level = poi.crowd_level;
          patch.crowd_level = parsed.crowd_level;
        }
      }
    }

    // Fun facts bilingues
    if (include.fun_facts && Array.isArray(parsed.fun_facts)) {
      const frItems: string[] = parsed.fun_facts.filter((s: any) => typeof s === "string" && s.trim()).slice(0, 5);
      const enItems = await Promise.all(frItems.map((s) => translateToEn(s)));
      const bilingual = frItems.map((fr, i) => ({ fr, en: enItems[i] || "" }));
      const cur = (poi as any).fun_facts_bilingual;
      if (mode === "regenerate" || !Array.isArray(cur) || cur.length === 0) {
        if (Array.isArray(cur) && cur.length) previous.fun_facts_bilingual = cur;
        patch.fun_facts_bilingual = bilingual;
      }
    }

    // Traduction EN des champs FR insérés
    if (include.text) {
      for (const [frKey, enKey] of Object.entries(FR_TO_EN)) {
        const frVal = patch[frKey] ?? (poi as any)[frKey];
        const curEn = (poi as any)[enKey];
        if (!frVal) continue;
        if (mode === "fill_empty" && curEn && String(curEn).trim()) continue;
        const en = await translateToEn(frVal);
        if (en) {
          if (curEn) previous[enKey] = curEn;
          patch[enKey] = en;
        }
      }
    }

    // Vidéos YouTube
    if (include.videos && Array.isArray(parsed.suggested_youtube_videos)) {
      const vids = parsed.suggested_youtube_videos
        .filter((v: any) => v && typeof v.youtube_id === "string" && /^[\w-]{8,15}$/.test(v.youtube_id))
        .slice(0, 3)
        .map((v: any) => ({ youtube_id: v.youtube_id, title: String(v.title || "").slice(0, 200), source: String(v.source || "") }));
      if (vids.length) {
        const cur = Array.isArray((poi as any).video_urls) ? (poi as any).video_urls : [];
        if (mode === "regenerate") {
          if (cur.length) previous.video_urls = cur;
          patch.video_urls = vids;
        } else {
          // merge unique by youtube_id
          const ids = new Set(cur.map((v: any) => v.youtube_id));
          const merged = [...cur];
          for (const v of vids) if (!ids.has(v.youtube_id)) merged.push(v);
          patch.video_urls = merged;
        }
      }
    }

    // Photos suggérées → poi_media (rôle ai_suggested, non publiées)
    let photosInserted = 0;
    if (include.photos && Array.isArray(parsed.suggested_photo_urls)) {
      const urls: string[] = parsed.suggested_photo_urls.filter((u: any) => typeof u === "string" && /^https?:\/\//.test(u)).slice(0, 5);
      for (const u of urls) {
        try {
          await supabase.from("poi_media").insert({
            medina_poi_id: poi.id,
            media_type: "photo",
            storage_bucket: "external",
            storage_path: u,
            role_tags: ["ai_suggested"],
            is_cover: false,
            extra: { source: "perplexity_single_v1", external_url: u },
          });
          photosInserted++;
        } catch (_e) { /* ignore dup */ }
      }
    }

    // Méta : versions, sources, last_enriched_at
    const meta = (poi.metadata && typeof poi.metadata === "object" ? poi.metadata : {}) as Record<string, any>;
    if (Object.keys(previous).length) {
      const versions = Array.isArray(meta.previous_versions) ? meta.previous_versions : [];
      versions.push({ at: new Date().toISOString(), agent: "poi-enrich-single", fields: previous });
      meta.previous_versions = versions.slice(-5);
    }
    meta.last_enrich_citations = citations.slice(0, 8);
    patch.metadata = meta;
    patch.last_enriched_at = new Date().toISOString();
    patch.enrichment_quality = "excellent";
    const ds = Array.isArray(poi.data_sources) ? poi.data_sources : [];
    if (!ds.includes("perplexity_single_v1")) patch.data_sources = [...ds, "perplexity_single_v1"];

    const { error: uErr } = await supabase.from("medina_pois").update(patch).eq("id", poi.id);
    if (uErr) throw uErr;

    return json({
      ok: true,
      poi_id: poi.id,
      mode,
      text_fields_written: Object.keys(patch).filter((k) => TEXT_FIELDS_FR.includes(k as any)).length,
      en_fields_written: Object.keys(patch).filter((k) => Object.values(FR_TO_EN).includes(k)).length,
      fun_facts_count: Array.isArray(patch.fun_facts_bilingual) ? patch.fun_facts_bilingual.length : 0,
      videos_added: Array.isArray(patch.video_urls) ? patch.video_urls.length : 0,
      photos_suggested: photosInserted,
      citations: citations.slice(0, 8),
    });
  } catch (e) {
    console.error("poi-enrich-single error:", e);
    return json({ error: e instanceof Error ? e.message : "Erreur inconnue" }, 500);
  }
});
