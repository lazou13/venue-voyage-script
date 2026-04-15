import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

const QUESTRIDE_URL = "https://brhckhyrbpjfnieexggq.supabase.co";
const AUDIO_FIELDS = "name,name_fr,name_en,lat,lng,audio_url_fr,audio_url_en,audio_url_ar,anecdote_audio_url_fr,anecdote_audio_url_en";

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalize(s: string | null): string {
  return (s || "").toLowerCase().trim().replace(/[''ʼ]/g, "'").replace(/\s+/g, " ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const QUESTRIDE_ANON_KEY = Deno.env.get("QUESTRIDE_ANON_KEY");
    if (!QUESTRIDE_ANON_KEY) throw new Error("QUESTRIDE_ANON_KEY not configured");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Fetch Questride POIs that have at least one audio URL
    const qrPois: any[] = [];
    let offset = 0;
    const pageSize = 500;

    while (true) {
      const res = await fetch(
        `${QUESTRIDE_URL}/rest/v1/medina_pois?select=${AUDIO_FIELDS}&or=(audio_url_fr.not.is.null,audio_url_en.not.is.null,audio_url_ar.not.is.null,anecdote_audio_url_fr.not.is.null,anecdote_audio_url_en.not.is.null)&limit=${pageSize}&offset=${offset}`,
        {
          headers: {
            apikey: QUESTRIDE_ANON_KEY,
            Authorization: `Bearer ${QUESTRIDE_ANON_KEY}`,
          },
        },
      );
      if (!res.ok) throw new Error(`Questride fetch failed: ${res.status} ${await res.text()}`);
      const data = await res.json();
      if (!data || data.length === 0) break;
      qrPois.push(...data);
      if (data.length < pageSize) break;
      offset += pageSize;
    }

    if (qrPois.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No audio POIs found in Questride", matched: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Fetch HPP POIs (id, name, name_fr, name_en, lat, lng)
    const hppPois: any[] = [];
    let hppOffset = 0;
    while (true) {
      const { data, error } = await sb
        .from("medina_pois")
        .select("id,name,name_fr,name_en,lat,lng")
        .eq("is_active", true)
        .range(hppOffset, hppOffset + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      hppPois.push(...data);
      if (data.length < pageSize) break;
      hppOffset += pageSize;
    }

    // 3. Match and update
    let matched = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const qr of qrPois) {
      // Has at least one audio?
      const hasAudio = qr.audio_url_fr || qr.audio_url_en || qr.audio_url_ar || qr.anecdote_audio_url_fr || qr.anecdote_audio_url_en;
      if (!hasAudio) { skipped++; continue; }

      // Match by name_fr or name_en (exact normalized), then by GPS proximity (50m)
      const qrNameFr = normalize(qr.name_fr || qr.name);
      const qrNameEn = normalize(qr.name_en);

      let bestMatch: any = null;

      for (const hpp of hppPois) {
        const hppNameFr = normalize(hpp.name_fr || hpp.name);
        const hppNameEn = normalize(hpp.name_en);

        if (qrNameFr && hppNameFr && qrNameFr === hppNameFr) {
          bestMatch = hpp;
          break;
        }
        if (qrNameEn && hppNameEn && qrNameEn === hppNameEn) {
          bestMatch = hpp;
          break;
        }
      }

      // Fallback: GPS proximity
      if (!bestMatch && qr.lat && qr.lng) {
        let minDist = Infinity;
        for (const hpp of hppPois) {
          if (!hpp.lat || !hpp.lng) continue;
          const dist = haversine(qr.lat, qr.lng, hpp.lat, hpp.lng);
          if (dist < 50 && dist < minDist) {
            minDist = dist;
            bestMatch = hpp;
          }
        }
      }

      if (!bestMatch) { skipped++; continue; }

      matched++;

      // Build update payload (only set non-null audio fields)
      const updateData: Record<string, string> = {};
      if (qr.audio_url_fr) updateData.audio_url_fr = qr.audio_url_fr;
      if (qr.audio_url_en) updateData.audio_url_en = qr.audio_url_en;
      if (qr.audio_url_ar) updateData.audio_url_ar = qr.audio_url_ar;
      if (qr.anecdote_audio_url_fr) updateData.anecdote_audio_url_fr = qr.anecdote_audio_url_fr;
      if (qr.anecdote_audio_url_en) updateData.anecdote_audio_url_en = qr.anecdote_audio_url_en;

      if (Object.keys(updateData).length === 0) { skipped++; continue; }

      const { error } = await sb
        .from("medina_pois")
        .update(updateData)
        .eq("id", bestMatch.id);

      if (error) {
        errors.push(`${bestMatch.name}: ${error.message}`);
      } else {
        updated++;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        questride_audio_pois: qrPois.length,
        hpp_pois: hppPois.length,
        matched,
        updated,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
