import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 10;
const DELAY_MS = 1500;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const limit = body.limit ?? 50;

    // Fetch enriched POIs that are missing practical details
    const { data: pois, error } = await supabase
      .from("medina_pois")
      .select("id, name, name_fr, name_en, category, category_ai, district, address, description_short, history_context, website, rating")
      .eq("enrichment_status", "enriched")
      .is("price_info", null)
      .not("status", "in", "(filtered,merged)")
      .order("poi_quality_score", { ascending: false })
      .limit(limit);

    if (error) throw error;
    if (!pois || pois.length === 0) {
      return new Response(JSON.stringify({ message: "Aucun POI à backfill", processed: 0, updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const logs: string[] = [`📦 ${pois.length} POIs à backfill`];
    let updated = 0;

    for (let i = 0; i < pois.length; i += BATCH_SIZE) {
      const batch = pois.slice(i, i + BATCH_SIZE);

      for (const poi of batch) {
        try {
          const displayName = poi.name_fr || poi.name_en || poi.name;
          const category = poi.category_ai || poi.category || "lieu";
          const district = poi.district || "médina de Marrakech";

          const prompt = `Tu es un expert en tourisme à Marrakech. Pour le lieu suivant, génère des informations pratiques RÉALISTES et SPÉCIFIQUES à ce lieu.

Lieu: "${displayName}"
Catégorie: ${category}
Quartier: ${district}
Adresse: ${poi.address || "non connue"}
Description: ${poi.description_short || "non disponible"}
Contexte historique: ${poi.history_context || "non disponible"}
Note Google: ${poi.rating || "non disponible"}

Réponds UNIQUEMENT avec un JSON valide contenant ces champs:
{
  "price_info": "Fourchette de prix ou 'Gratuit' ou 'Prix variable' — spécifique à ce type de lieu",
  "must_see_details": "Ce qu'il ne faut pas manquer dans ce lieu spécifiquement (1-2 phrases)",
  "must_try": "Ce qu'il faut essayer/goûter/faire ici (1-2 phrases, spécifique au lieu)",
  "must_visit_nearby": "Un lieu intéressant à proximité dans la médina (nom + pourquoi)",
  "is_photo_spot": true/false,
  "photo_tip": "Conseil photo spécifique à ce lieu (angle, moment, lumière)",
  "ruelle_etroite": true/false,
  "opening_hours_text": "Horaires typiques ou 'Accessible en permanence'"
}

IMPORTANT: Chaque réponse doit être UNIQUE et SPÉCIFIQUE à "${displayName}". Ne donne PAS de réponses génériques.`;

          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: "Tu es un expert en tourisme marocain. Réponds uniquement en JSON valide, sans markdown." },
                { role: "user", content: prompt },
              ],
            }),
          });

          if (!aiResp.ok) {
            const errText = await aiResp.text();
            logs.push(`⚠️ AI error for ${displayName}: ${aiResp.status} ${errText.substring(0, 100)}`);
            if (aiResp.status === 429) {
              logs.push("⏳ Rate limited, waiting 10s...");
              await sleep(10000);
            }
            continue;
          }

          const aiData = await aiResp.json();
          const content = aiData.choices?.[0]?.message?.content || "";

          // Parse JSON from response (handle markdown code blocks)
          let jsonStr = content;
          const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) jsonStr = jsonMatch[1];
          // Also try to find raw JSON object
          const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
          if (braceMatch) jsonStr = braceMatch[0];

          let parsed: any;
          try {
            parsed = JSON.parse(jsonStr);
          } catch {
            logs.push(`⚠️ JSON parse error for ${displayName}`);
            continue;
          }

          const update: Record<string, any> = {};
          if (parsed.price_info) update.price_info = String(parsed.price_info).substring(0, 300);
          if (parsed.must_see_details) update.must_see_details = String(parsed.must_see_details).substring(0, 500);
          if (parsed.must_try) update.must_try = String(parsed.must_try).substring(0, 500);
          if (parsed.must_visit_nearby) update.must_visit_nearby = String(parsed.must_visit_nearby).substring(0, 500);
          if (parsed.photo_tip) update.photo_tip = String(parsed.photo_tip).substring(0, 300);
          if (typeof parsed.is_photo_spot === "boolean") update.is_photo_spot = parsed.is_photo_spot;
          if (typeof parsed.ruelle_etroite === "boolean") update.ruelle_etroite = parsed.ruelle_etroite;
          if (parsed.opening_hours_text) {
            update.opening_hours = { text: String(parsed.opening_hours_text).substring(0, 200) };
          }

          // Only update if we got at least price_info
          if (update.price_info) {
            const { error: updErr } = await supabase
              .from("medina_pois")
              .update(update)
              .eq("id", poi.id);

            if (updErr) {
              logs.push(`❌ DB error for ${displayName}: ${updErr.message}`);
            } else {
              updated++;
              logs.push(`✅ ${displayName}`);
            }
          } else {
            logs.push(`⚠️ No price_info for ${displayName}, skipping`);
          }
        } catch (e) {
          logs.push(`❌ Error: ${e instanceof Error ? e.message : "unknown"}`);
        }
      }

      // Delay between batches
      if (i + BATCH_SIZE < pois.length) {
        await sleep(DELAY_MS);
      }
    }

    logs.push(`📊 Résultat: ${updated}/${pois.length} POIs mis à jour`);

    return new Response(JSON.stringify({ processed: pois.length, updated, logs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
