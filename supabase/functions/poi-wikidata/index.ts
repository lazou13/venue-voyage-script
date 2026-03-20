import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Bbox de la médina de Marrakech (+ buffer quartiers proches)
const MEDINA_SW = { lat: 31.615, lng: -8.010 };
const MEDINA_NE = { lat: 31.645, lng: -7.970 };

// Mapping Wikidata instance → catégorie interne
const WIKIDATA_CATEGORY_MAP: Record<string, string> = {
  Q16970: "mosque",          // église/mosquée
  Q32815: "mosque",          // mosquée
  Q24398318: "mosque",       // bâtiment religieux
  Q483110: "fountain",       // fontaine
  Q811979: "historic",       // bâtiment architectural
  Q839954: "historic",       // site archéologique
  Q15243209: "historic",     // monument historique
  Q570116: "historic",       // palais
  Q16560: "palace",          // palais
  Q44539: "medersa",         // madrassa
  Q131734: "medersa",        // madrassa islamique
  Q2997104: "gate_bab",      // porte de ville
  Q12280: "bridge",          // pont
  Q1060829: "fountain",      // puits
  Q33506: "museum",          // musée
  Q182832: "museum",         // galerie d'art
  Q11315: "souk",            // marché
  Q61843226: "fondouk",      // caravansérail
  Q170208: "hammam",         // bain public
  Q2065736: "tomb",          // tombeau
  Q1785071: "tomb",          // mausolée
  Q35535: "garden",          // parc
  Q82117: "garden",          // jardin
};

interface WikidataItem {
  item: { value: string };
  itemLabel: { value: string };
  itemDescription?: { value: string };
  coord: { value: string };
  instanceLabel?: { value: string };
  instance?: { value: string };
  nameAr?: { value: string };
  nameFr?: { value: string };
  nameEn?: { value: string };
  image?: { value: string };
  inceptionLabel?: { value: string };
}

function parseWktPoint(wkt: string): { lat: number; lng: number } | null {
  // Format: "Point(-7.9811 31.6295)"
  const m = wkt.match(/Point\(([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)\)/i);
  if (!m) return null;
  return { lng: parseFloat(m[1]), lat: parseFloat(m[2]) };
}

function wikidataIdFromUrl(url: string): string {
  return url.replace("http://www.wikidata.org/entity/", "");
}

function instanceToCategory(instanceUrl: string | undefined): string {
  if (!instanceUrl) return "historic";
  const qid = wikidataIdFromUrl(instanceUrl);
  return WIKIDATA_CATEGORY_MAP[qid] ?? "historic";
}

async function fetchWikidataPOIs(): Promise<WikidataItem[]> {
  const sparql = `
SELECT DISTINCT ?item ?itemLabel ?itemDescription ?coord ?instance ?instanceLabel
  ?nameAr ?nameFr ?nameEn ?image ?inceptionLabel
WHERE {
  SERVICE wikibase:box {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerSouthWest "Point(${MEDINA_SW.lng} ${MEDINA_SW.lat})"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point(${MEDINA_NE.lng} ${MEDINA_NE.lat})"^^geo:wktLiteral .
  }
  OPTIONAL { ?item wdt:P31 ?instance . }
  OPTIONAL { ?item wdt:P571 ?inception . BIND(YEAR(?inception) AS ?inceptionLabel) }
  OPTIONAL { ?item wdt:P18 ?image . }
  OPTIONAL { ?item rdfs:label ?nameAr . FILTER(LANG(?nameAr) = "ar") }
  OPTIONAL { ?item rdfs:label ?nameFr . FILTER(LANG(?nameFr) = "fr") }
  OPTIONAL { ?item rdfs:label ?nameEn . FILTER(LANG(?nameEn) = "en") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en,ar" . }
  # Filtrer uniquement les items ayant une instance patrimoniale ou culturelle
  FILTER EXISTS {
    ?item wdt:P31 ?type .
    FILTER(?type IN (
      wd:Q32815, wd:Q16970, wd:Q24398318, wd:Q483110,
      wd:Q811979, wd:Q839954, wd:Q15243209, wd:Q570116,
      wd:Q16560, wd:Q44539, wd:Q131734, wd:Q2997104,
      wd:Q33506, wd:Q182832, wd:Q11315, wd:Q61843226,
      wd:Q170208, wd:Q2065736, wd:Q1785071, wd:Q35535,
      wd:Q82117, wd:Q12280, wd:Q1060829
    ))
  }
}
LIMIT 500
`;

  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
  const res = await fetch(url, {
    headers: { "User-Agent": "HuntPlannerPro/1.0 (marrakech-medina-quest)" },
  });
  if (!res.ok) throw new Error(`Wikidata SPARQL error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.results?.bindings ?? [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Log batch start
    const { data: batch } = await supabase
      .from("import_batches")
      .insert({
        source: "wikidata",
        status: "running",
        bbox: { sw: MEDINA_SW, ne: MEDINA_NE },
        started_at: new Date().toISOString(),
      })
      .select()
      .single();
    const batchId = batch?.id;

    const items = await fetchWikidataPOIs();
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of items) {
      const wikidataId = wikidataIdFromUrl(item.item.value);
      const coords = parseWktPoint(item.coord.value);
      if (!coords) { skipped++; continue; }

      const nameEn = item.nameEn?.value ?? item.itemLabel?.value ?? "";
      const nameFr = item.nameFr?.value ?? nameEn;
      const nameAr = item.nameAr?.value ?? null;
      const category = instanceToCategory(item.instance?.value);

      const description = item.itemDescription?.value ?? null;
      const imageUrl = item.image?.value ?? null;
      const inception = item.inceptionLabel?.value ? parseInt(item.inceptionLabel.value) : null;

      // Vérifier si déjà présent via wikidata_id
      const { data: existing } = await supabase
        .from("medina_pois")
        .select("id, name, data_sources")
        .eq("wikidata_id", wikidataId)
        .single();

      if (existing) {
        // Mettre à jour les champs manquants
        const sources: string[] = existing.data_sources ?? [];
        if (!sources.includes("wikidata")) sources.push("wikidata");
        await supabase
          .from("medina_pois")
          .update({
            name_fr: nameFr || existing.name,
            name_ar: nameAr,
            description_short: description,
            data_sources: sources,
            metadata: { wikidata_inception: inception, wikidata_image: imageUrl },
          })
          .eq("id", existing.id);
        updated++;
      } else {
        // Chercher un POI proche (< 30m) pour fusion
        const { data: nearbyPoi } = await supabase.rpc("nearby_pois", {
          p_lat: coords.lat,
          p_lng: coords.lng,
          p_radius_m: 30,
          p_category: null,
          p_limit: 1,
        });

        if (nearbyPoi && nearbyPoi.length > 0) {
          // Fusionner avec le POI existant le plus proche
          const existing2 = nearbyPoi[0];
          const sources: string[] = (existing2 as { data_sources?: string[] }).data_sources ?? [];
          if (!sources.includes("wikidata")) sources.push("wikidata");
          await supabase
            .from("medina_pois")
            .update({
              wikidata_id: wikidataId,
              name_fr: nameFr || (existing2 as { name_fr?: string }).name_fr,
              name_ar: nameAr || (existing2 as { name_ar?: string }).name_ar,
              description_short: description,
              data_sources: sources,
              metadata: { wikidata_inception: inception, wikidata_image: imageUrl },
            })
            .eq("id", (existing2 as { id: string }).id);
          updated++;
        } else {
          // Créer nouveau POI Wikidata
          const { error } = await supabase
            .from("medina_pois")
            .insert({
              name: nameFr || nameEn,
              name_fr: nameFr,
              name_ar: nameAr,
              name_en: nameEn,
              wikidata_id: wikidataId,
              lat: coords.lat,
              lng: coords.lng,
              category: category,
              category_ai: category,
              description_short: description,
              zone: "medina",
              is_active: true,
              status: "draft",
              enrichment_status: "classified",
              data_sources: ["wikidata"],
              metadata: {
                wikidata_inception: inception,
                wikidata_image: imageUrl,
                wikidata_instance: item.instanceLabel?.value,
              },
              poi_quality_score: 0.7, // Score de base pour POI Wikidata (fiable)
            });
          if (!error) inserted++;
          else skipped++;
        }
      }
    }

    // Finaliser le batch
    await supabase
      .from("import_batches")
      .update({
        status: "completed",
        pois_added: inserted,
        pois_updated: updated,
        completed_at: new Date().toISOString(),
      })
      .eq("id", batchId);

    return new Response(
      JSON.stringify({
        success: true,
        wikidata_items_fetched: items.length,
        inserted,
        updated,
        skipped,
        batch_id: batchId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("poi-wikidata error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
