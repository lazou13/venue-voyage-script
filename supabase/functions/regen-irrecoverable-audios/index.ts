// LOT-AUD-4 — Régénération CIBLÉE des audios marqués irrécupérables (audio_irrecoverable.needs_regeneration = true).
// Périmètre strict : ne traite QUE les lignes déjà marquées dans audio_irrecoverable.
// Pour chaque cas :
//   1) sélectionne le texte source selon field_name (FR -> history_context, EN -> history_context_en,
//      AR -> history_context (FR) — pas de texte AR séparé en base aujourd'hui),
//      anecdote_*_fr -> local_anecdote_fr, anecdote_*_en -> local_anecdote_en
//   2) génère via ElevenLabs (mêmes settings que generate-poi-audio)
//   3) upload sur HPP bucket `audio-guides` au chemin medina/<poi_id>/<field>_v<ts>.mp3
//   4) réécrit le champ audio sur medina_pois
//   5) marque la ligne audio_irrecoverable comme traitée (needs_regeneration=false, regenerated_at=now())
// Idempotence : si needs_regeneration=false, on saute. Aucun audio n'est régénéré ailleurs.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "audio-guides";

// Doit refléter generate-poi-audio (mémoire mem://technical/tts-generation-settings)
const VOICE_ID = "JdwJ7jL68CWmQZuo7KgG";
const MODEL_ID = "eleven_multilingual_v2";
const VOICE_SETTINGS = {
  stability: 0.3,
  similarity_boost: 0.9,
  style: 0.85,
  use_speaker_boost: true,
  speed: 0.75,
};

type Field =
  | "audio_url_fr"
  | "audio_url_en"
  | "audio_url_ar"
  | "anecdote_audio_url_fr"
  | "anecdote_audio_url_en";

// Mapping field -> colonne texte source en base.
// Pour l'AR, il n'existe pas de colonne `history_context_ar` dans medina_pois ;
// on utilise `history_context` (FR) comme texte d'entrée, le moteur multilingue v2
// gère la lecture multilingue. Politique conforme à mem://features/poi-library/english-enrichment-strategy
function sourceColumnFor(field: Field): string {
  switch (field) {
    case "audio_url_fr": return "history_context";
    case "audio_url_en": return "history_context_en";
    case "audio_url_ar": return "history_context"; // fallback FR (pas de colonne AR)
    case "anecdote_audio_url_fr": return "local_anecdote_fr";
    case "anecdote_audio_url_en": return "local_anecdote_en";
  }
}

async function generateTTS(text: string): Promise<Uint8Array> {
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set");
  const resp = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: MODEL_ID, voice_settings: VOICE_SETTINGS }),
    },
  );
  if (!resp.ok) throw new Error(`TTS failed: ${resp.status} ${await resp.text()}`);
  return new Uint8Array(await resp.arrayBuffer());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry_run") === "1";

  // BLOC 1 — Sélection STRICTE
  const { data: rows, error: rowsErr } = await supabase
    .from("audio_irrecoverable")
    .select("id, poi_id, field_name, original_url, http_status, needs_regeneration, regenerated_at")
    .eq("needs_regeneration", true);

  if (rowsErr) {
    return new Response(JSON.stringify({ error: rowsErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results = {
    dry_run: dryRun,
    selected: rows?.length ?? 0,
    regenerated: 0,
    skipped_already_done: 0,
    skipped_no_source_text: 0,
    errors: [] as Array<{ irr_id: string; poi_id: string; field: string; error: string }>,
    cases: [] as Array<{
      irr_id: string;
      poi_id: string;
      name: string | null;
      field: string;
      old_url: string;
      new_url: string | null;
      source_column: string;
      source_chars: number;
      status: "regenerated" | "dry_run" | "skipped" | "error";
      detail?: string;
    }>,
  };

  for (const r of rows ?? []) {
    const field = r.field_name as Field;
    const srcCol = sourceColumnFor(field);

    // BLOC 1bis — récupérer le texte source + name + URL actuelle
    const { data: poi, error: poiErr } = await supabase
      .from("medina_pois")
      .select(`id, name, ${field}, ${srcCol}`)
      .eq("id", r.poi_id)
      .maybeSingle();

    if (poiErr || !poi) {
      results.errors.push({ irr_id: r.id, poi_id: r.poi_id, field, error: poiErr?.message ?? "POI not found" });
      results.cases.push({
        irr_id: r.id, poi_id: r.poi_id, name: null, field,
        old_url: r.original_url, new_url: null, source_column: srcCol, source_chars: 0,
        status: "error", detail: poiErr?.message ?? "POI not found",
      });
      continue;
    }

    const text = ((poi as Record<string, unknown>)[srcCol] as string | null | undefined)?.trim() ?? "";
    const currentUrl = ((poi as Record<string, unknown>)[field] as string | null | undefined) ?? r.original_url;

    if (!text) {
      results.skipped_no_source_text++;
      results.cases.push({
        irr_id: r.id, poi_id: r.poi_id, name: (poi as { name?: string }).name ?? null, field,
        old_url: currentUrl, new_url: null, source_column: srcCol, source_chars: 0,
        status: "skipped", detail: `No source text in column ${srcCol}`,
      });
      continue;
    }

    if (dryRun) {
      results.cases.push({
        irr_id: r.id, poi_id: r.poi_id, name: (poi as { name?: string }).name ?? null, field,
        old_url: currentUrl, new_url: "(dry_run)", source_column: srcCol, source_chars: text.length,
        status: "dry_run",
      });
      continue;
    }

    try {
      // BLOC 2 — Régénération ciblée
      const audio = await generateTTS(text);
      const path = `medina/${r.poi_id}/${field}_v${Date.now()}.mp3`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, audio, {
        contentType: "audio/mpeg", upsert: false,
      });
      if (upErr) throw new Error(`upload: ${upErr.message}`);

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const newUrl = pub.publicUrl;

      const { error: updErr } = await supabase
        .from("medina_pois")
        .update({ [field]: newUrl })
        .eq("id", r.poi_id);
      if (updErr) throw new Error(`update poi: ${updErr.message}`);

      const { error: markErr } = await supabase
        .from("audio_irrecoverable")
        .update({
          needs_regeneration: false,
          regenerated_at: new Date().toISOString(),
          notes: `Regenerated via regen-irrecoverable-audios (LOT-AUD-4). New HPP URL: ${newUrl}`,
        })
        .eq("id", r.id);
      if (markErr) throw new Error(`mark irrecoverable: ${markErr.message}`);

      results.regenerated++;
      results.cases.push({
        irr_id: r.id, poi_id: r.poi_id, name: (poi as { name?: string }).name ?? null, field,
        old_url: currentUrl, new_url: newUrl, source_column: srcCol, source_chars: text.length,
        status: "regenerated",
      });
    } catch (e) {
      const msg = (e as Error).message;
      results.errors.push({ irr_id: r.id, poi_id: r.poi_id, field, error: msg });
      results.cases.push({
        irr_id: r.id, poi_id: r.poi_id, name: (poi as { name?: string }).name ?? null, field,
        old_url: currentUrl, new_url: null, source_column: srcCol, source_chars: text.length,
        status: "error", detail: msg,
      });
    }
  }

  // BLOC 3 — Contrôle final de complétude
  const FIELDS: Field[] = ["audio_url_fr","audio_url_en","audio_url_ar","anecdote_audio_url_fr","anecdote_audio_url_en"];
  const completeness: Record<string, number> = {};
  for (const f of FIELDS) {
    const { count } = await supabase
      .from("medina_pois")
      .select("id", { count: "exact", head: true })
      .not(f, "is", null)
      .not(f, "ilike", "%dtwqmrmtzfhczvjggmct%");
    completeness[`${f}_off_hpp`] = count ?? 0;
  }

  const { count: stillIrr } = await supabase
    .from("audio_irrecoverable")
    .select("id", { count: "exact", head: true })
    .eq("needs_regeneration", true);

  const offTotal = Object.values(completeness).reduce((a, b) => a + b, 0);

  return new Response(JSON.stringify({
    ...results,
    completeness,
    still_irrecoverable: stillIrr ?? 0,
    hpp_audio_autonomous: offTotal === 0 && (stillIrr ?? 0) === 0,
  }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
