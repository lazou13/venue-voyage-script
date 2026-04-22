// LOT-AUD-1 — Audio inventory scanner (HPP)
// Scans 5 audio fields across medina_pois, performs HEAD probes, persists to audio_inventory_snapshot.
// Read-only on medina_pois. No deletion, no repatriation, no audio generation.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const HPP_REF = "dtwqmrmtzfhczvjggmct";
const QUESTRIDES_REF = "brhckhyrbpjfnieexggq";

const FIELDS = [
  "audio_url_fr",
  "audio_url_en",
  "audio_url_ar",
  "anecdote_audio_url_fr",
  "anecdote_audio_url_en",
] as const;

function deriveOwner(host: string | null): string {
  if (!host) return "unknown";
  if (host.includes(HPP_REF)) return "hpp";
  if (host.includes(QUESTRIDES_REF)) return "questrides";
  if (host.includes(".supabase.co") || host.includes(".supabase.in")) return "supabase_other";
  if (host.includes("googleusercontent") || host.includes("storage.googleapis.com")) return "gcs";
  if (host.includes("amazonaws.com") || host.endsWith(".s3.amazonaws.com")) return "s3";
  if (host.includes("cloudfront.net")) return "cloudfront";
  return "third_party";
}

async function probe(url: string): Promise<{
  http_status: number | null;
  content_length: number | null;
  content_type: string | null;
  last_modified: string | null;
  error: string | null;
}> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    let res: Response;
    try {
      res = await fetch(url, { method: "HEAD", signal: ctrl.signal, redirect: "follow" });
      // Some hosts (GCS) reject HEAD with 405 — fallback to ranged GET
      if (res.status === 405 || res.status === 403) {
        res = await fetch(url, {
          method: "GET",
          signal: ctrl.signal,
          redirect: "follow",
          headers: { Range: "bytes=0-0" },
        });
      }
    } finally {
      clearTimeout(t);
    }
    const cl = res.headers.get("content-length");
    return {
      http_status: res.status,
      content_length: cl ? Number(cl) : null,
      content_type: res.headers.get("content-type"),
      last_modified: res.headers.get("last-modified"),
      error: null,
    };
  } catch (e) {
    return {
      http_status: null,
      content_length: null,
      content_type: null,
      last_modified: null,
      error: (e as Error).message,
    };
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
  const limit = Number(url.searchParams.get("limit") ?? "0"); // 0 = no limit

  const cols = ["id", "name", ...FIELDS].join(",");
  let q = supabase.from("medina_pois").select(cols);
  // We want only rows that have at least one non-null audio
  q = q.or(FIELDS.map((f) => `${f}.not.is.null`).join(","));
  if (limit > 0) q = q.limit(limit);
  const { data: pois, error } = await q;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const run_id = crypto.randomUUID();
  const rows: Record<string, unknown>[] = [];
  for (const p of (pois ?? []) as Record<string, unknown>[]) {
    for (const field of FIELDS) {
      const u = p[field] as string | null | undefined;
      if (!u) continue;
      let host: string | null = null;
      try { host = new URL(u).host; } catch { host = null; }
      const probed = await probe(u);
      rows.push({
        run_id,
        poi_id: p.id,
        name: p.name,
        field_name: field,
        url: u,
        host,
        storage_owner_guess: deriveOwner(host),
        ...probed,
      });
    }
  }

  // Bulk insert by chunks of 200
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error: insErr } = await supabase.from("audio_inventory_snapshot").insert(chunk);
    if (insErr) {
      return new Response(
        JSON.stringify({ error: insErr.message, run_id, inserted, total: rows.length }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    inserted += chunk.length;
  }

  return new Response(
    JSON.stringify({ ok: true, run_id, total_urls: rows.length, inserted }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
