// LOT-AUD-3 — Rapatriement physique des audios externes vers le bucket HPP `audio-guides`.
// Idempotent : si l'URL pointe déjà vers HPP, on saute. Si le fichier existe déjà sur HPP, on ne ré-upload pas.
// Marque les irrécupérables dans `audio_irrecoverable` (ne tente AUCUNE régénération).
//
// Périmètre strict :
//  - lit `medina_pois` (5 champs audio)
//  - télécharge depuis URL externe (Questrides, supabase_other, GCS, etc.)
//  - upload dans bucket HPP `audio-guides`
//  - réécrit le champ audio du POI vers la nouvelle URL HPP
//  - NE supprime rien d'externe
//  - NE désactive PAS pull-audio-from-questride
//  - NE génère AUCUN audio

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const HPP_REF = "dtwqmrmtzfhczvjggmct";
const BUCKET = "audio-guides";

const FIELDS = [
  "audio_url_fr",
  "audio_url_en",
  "audio_url_ar",
  "anecdote_audio_url_fr",
  "anecdote_audio_url_en",
] as const;

type Field = typeof FIELDS[number];

function isHppUrl(u: string | null | undefined): boolean {
  if (!u) return false;
  try { return new URL(u).host.includes(HPP_REF); } catch { return false; }
}

function hostOf(u: string): string | null {
  try { return new URL(u).host; } catch { return null; }
}

// Storage path on HPP : medina/<poi_id>/<field>_v<ts>.mp3
function buildStoragePath(poiId: string, field: Field): string {
  return `medina/${poiId}/${field}_v${Date.now()}.mp3`;
}

async function fetchBytes(url: string, timeoutMs = 30000): Promise<{ bytes: Uint8Array; contentType: string } | { error: string; status: number | null }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow", signal: ctrl.signal });
    if (!res.ok) {
      return { error: `HTTP ${res.status}`, status: res.status };
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0) return { error: "empty body", status: res.status };
    const ct = res.headers.get("content-type") || "audio/mpeg";
    return { bytes: buf, contentType: ct };
  } catch (e) {
    return { error: (e as Error).message, status: null };
  } finally {
    clearTimeout(t);
  }
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
  const limit = Number(url.searchParams.get("limit") ?? "0");
  const onlyField = url.searchParams.get("field"); // optional filter
  const sourceHostFilter = url.searchParams.get("source_host"); // optional substring filter

  // 1. Lire les POIs avec au moins un champ audio non null
  const cols = ["id", "name", ...FIELDS].join(",");
  let q = supabase.from("medina_pois").select(cols)
    .or(FIELDS.map((f) => `${f}.not.is.null`).join(","));
  if (limit > 0) q = q.limit(limit);
  const { data: pois, error } = await q;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results = {
    dry_run: dryRun,
    scanned_pois: pois?.length ?? 0,
    skipped_already_hpp: 0,
    imported: 0,
    irrecoverable: 0,
    errors: [] as Array<{ poi_id: string; field: string; error: string }>,
    sample_imports: [] as Array<{ poi_id: string; field: string; old_url: string; new_url: string }>,
    sample_irrecoverable: [] as Array<{ poi_id: string; field: string; original_url: string; reason: string }>,
  };

  for (const p of (pois ?? []) as Record<string, unknown>[]) {
    for (const field of FIELDS) {
      if (onlyField && field !== onlyField) continue;
      const oldUrl = p[field] as string | null | undefined;
      if (!oldUrl) continue;

      // Idempotence : déjà sur HPP → skip
      if (isHppUrl(oldUrl)) {
        results.skipped_already_hpp++;
        continue;
      }

      const host = hostOf(oldUrl);
      if (sourceHostFilter && (!host || !host.includes(sourceHostFilter))) continue;

      // Tentative de téléchargement
      const got = await fetchBytes(oldUrl);
      if ("error" in got) {
        // Marqué irrécupérable
        if (!dryRun) {
          await supabase.from("audio_irrecoverable").upsert({
            poi_id: p.id as string,
            field_name: field,
            original_url: oldUrl,
            host,
            http_status: got.status,
            reason: got.error,
            needs_regeneration: true,
            notes: `Auto-detected during import-audio-to-hpp run`,
          }, { onConflict: "poi_id,field_name,original_url" });
        }
        results.irrecoverable++;
        if (results.sample_irrecoverable.length < 5) {
          results.sample_irrecoverable.push({
            poi_id: p.id as string, field, original_url: oldUrl, reason: got.error,
          });
        }
        continue;
      }

      if (dryRun) {
        results.imported++;
        if (results.sample_imports.length < 5) {
          results.sample_imports.push({
            poi_id: p.id as string, field, old_url: oldUrl, new_url: "(dry_run)",
          });
        }
        continue;
      }

      // Upload sur HPP
      const path = buildStoragePath(p.id as string, field);
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, got.bytes, {
          cacheControl: "3600",
          contentType: got.contentType.startsWith("audio/") ? got.contentType : "audio/mpeg",
          upsert: false,
        });
      if (upErr) {
        results.errors.push({ poi_id: p.id as string, field, error: `upload: ${upErr.message}` });
        continue;
      }

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const newUrl = pub.publicUrl;

      // Réécriture du POI
      const { error: updErr } = await supabase
        .from("medina_pois")
        .update({ [field]: newUrl })
        .eq("id", p.id as string);
      if (updErr) {
        results.errors.push({ poi_id: p.id as string, field, error: `update: ${updErr.message}` });
        continue;
      }

      results.imported++;
      if (results.sample_imports.length < 5) {
        results.sample_imports.push({
          poi_id: p.id as string, field, old_url: oldUrl, new_url: newUrl,
        });
      }
    }
  }

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
