import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Execute a read-only SQL query via exec_agent_sql RPC
async function execSQL(query: string, supabaseUrl: string, serviceKey: string): Promise<any> {
  const trimmed = query.trim().toUpperCase();
  if (!trimmed.startsWith("SELECT") && !trimmed.startsWith("WITH")) {
    throw new Error("Seules les requêtes SELECT/WITH sont autorisées");
  }
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_agent_sql`, {
    method: "POST",
    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`SQL error: ${await res.text()}`);
  return await res.json();
}

// Pipeline step → edge function mapping
const PIPELINE_STEPS: Record<string, { fn: string; body: any; label: string }> = {
  extract:       { fn: "poi-extract",        body: { type_offset: 0, types_per_batch: 3 }, label: "Extraction OSM" },
  classify:      { fn: "poi-classify-worker", body: {},                                     label: "Classification IA" },
  enrich:        { fn: "poi-enricher",        body: { batch_size: 10 },                     label: "Enrichissement" },
  clean:         { fn: "admin-run-cleanup",   body: { action: "clean" },                    label: "Nettoyage" },
  merge:         { fn: "admin-run-cleanup",   body: { action: "merge" },                    label: "Fusion doublons" },
  proximity:     { fn: "poi-proximity",       body: {},                                     label: "Calcul proximité" },
  backfill:      { fn: "poi-backfill-details",body: { limit: 10 },                          label: "Backfill détails" },
  photos:        { fn: "poi-fetch-photos",    body: {},                                     label: "Photos Google" },
  anecdotes:     { fn: "anecdote-enricher",   body: { batch_size: 5 },                      label: "Anecdotes Perplexity" },
  fun_facts:     { fn: "n8n-proxy",           body: { action: "generate_fun_facts", batch_size: 5 }, label: "Fun facts" },
  translate_en:  { fn: "n8n-proxy",           body: { action: "translate_pois", batch_size: 5 },     label: "Traduction EN" },
  pull_audio:    { fn: "n8n-proxy",           body: { action: "pull_audio" },               label: "Pull Audio" },
  autopipeline:  { fn: "poi-auto-agent",      body: {},                                     label: "Autopipeline" },
};

const TOOLS = [
  {
    type: "function",
    function: {
      name: "execute_sql",
      description: "Exécute une requête SQL SELECT sur la base HPP. Tables : medina_pois (id, name, status, enrichment_status, category_ai, lat, lng, poi_quality_score, audio_url_fr, audio_url_en, description_fr, description_en, created_at), agent_logs (id, phase, action, result, errors, created_at). Utilise pour trouver doublons, statistiques précises, listes filtrées, etc.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Requête SQL SELECT (lecture seule)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "invoke_pipeline_step",
      description: `Exécute une étape du pipeline POI. Étapes disponibles :
- extract : Extrait POIs depuis OpenStreetMap
- classify : Classifie les POIs par catégorie IA et score qualité
- enrich : Enrichit avec descriptions et métadonnées
- clean : Supprime les POIs de faible qualité
- merge : Fusionne les POIs proches (doublons)
- proximity : Calcule les POIs voisins
- backfill : Récupère prix, horaires, infos pratiques
- photos : Télécharge photos Google Places
- anecdotes : Génère anecdotes via Perplexity
- fun_facts : Génère un fun fact court par POI
- translate_en : Traduit nom/description/histoire en anglais
- pull_audio : Récupère URLs audio FR/EN depuis Questride
- reclassify : Réinitialise toutes les classifications et relance
- rescore_riads : Réinitialise et reclassifie uniquement les riads
- autopipeline : Lance toutes les étapes automatiquement`,
      parameters: {
        type: "object",
        properties: {
          step: {
            type: "string",
            enum: ["extract","classify","enrich","clean","merge","proximity","backfill","photos","anecdotes","fun_facts","translate_en","pull_audio","reclassify","rescore_riads","autopipeline"],
            description: "Étape pipeline à exécuter",
          },
        },
        required: ["step"],
      },
    },
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { message, history = [] } = await req.json();
    if (!message) return json({ error: "message required" }, 400);
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY manquant" }, 500);

    // Live DB context
    const [poisRes, logsRes] = await Promise.all([
      supabase.from("medina_pois").select("status, enrichment_status, poi_quality_score, audio_url_fr, audio_url_en, category_ai").not("status", "in", '("filtered","merged")'),
      supabase.from("agent_logs").select("phase, action, result, created_at").order("created_at", { ascending: false }).limit(10),
    ]);

    const pois = poisRes.data ?? [];
    const total = pois.length;
    const validated = pois.filter((p: any) => p.status === "validated").length;
    const enriched = pois.filter((p: any) => p.enrichment_status === "enriched" || p.status === "enriched").length;
    const withAudioFr = pois.filter((p: any) => p.audio_url_fr).length;
    const withAudioEn = pois.filter((p: any) => p.audio_url_en).length;
    const avgScore = total > 0
      ? (pois.reduce((s: number, p: any) => s + (p.poi_quality_score ?? 0), 0) / total).toFixed(1) : "–";
    const categories: Record<string, number> = {};
    for (const p of pois) {
      if ((p as any).category_ai) categories[(p as any).category_ai] = (categories[(p as any).category_ai] ?? 0) + 1;
    }
    const topCats = Object.entries(categories).sort(([,a],[,b]) => b - a).slice(0, 8).map(([k,v]) => `${k}:${v}`).join(", ");
    const lastLogs = (logsRes.data ?? []).map((l: any) => {
      const ago = Math.round((Date.now() - new Date(l.created_at).getTime()) / 60000);
      return `[${ago}min ago] ${l.phase}/${l.action} → ${JSON.stringify(l.result ?? {}).slice(0, 100)}`;
    }).join("\n");

    const context = `## Base HPP — état temps réel
POIs actifs: ${total} (${validated} validés, ${enriched} enrichis)
Score qualité moyen: ${avgScore}/10
Audio FR: ${withAudioFr}/${total} (manquants: ${total - withAudioFr})
Audio EN: ${withAudioEn}/${total} (manquants: ${total - withAudioEn})
Top catégories: ${topCats}
Derniers logs agent:
${lastLogs || "Aucun log récent"}`;

    const systemPrompt = `Tu es l'agent IA autonome de Hunt Planner Pro (HPP), back-office de gestion des POIs de la médina de Marrakech.

Tu surveilles la base 24/7. Tu peux :
1. RÉPONDRE à des questions sur les POIs, statistiques, doublons, audios manquants, etc.
2. EXÉCUTER des requêtes SQL SELECT via l'outil execute_sql
3. LANCER n'importe quelle étape du pipeline via l'outil invoke_pipeline_step

Pipeline disponible : extract, classify, enrich, clean, merge, proximity, backfill, photos, anecdotes, fun_facts, translate_en, pull_audio, reclassify, rescore_riads, autopipeline.

Quand l'utilisateur te demande de lancer une étape, utilise TOUJOURS invoke_pipeline_step — ne te contente pas de dire "je vais lancer". Lance-le vraiment.
Quand l'utilisateur te demande des données précises (doublons, listes, stats), utilise execute_sql.

Réponds en français, sois concis et direct.

${context}`;

    // Legacy keyword detection for run_agent
    const msgLower = message.toLowerCase();
    let actionResult: string | null = null;
    if (msgLower.includes("lance l'agent autonome") || msgLower.includes("run agent")) {
      try {
        const { data, error } = await supabase.functions.invoke("poi-auto-agent");
        if (error) throw error;
        actionResult = `✅ Agent exécuté :\n${(data?.logs ?? []).slice(0, 8).join("\n")}`;
      } catch (e) {
        actionResult = `❌ Erreur agent : ${e instanceof Error ? e.message : "inconnue"}`;
      }
    }

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...(history as { role: string; content: string }[]).slice(-14),
      { role: "user", content: actionResult ? `${message}\n\n[ACTION EXÉCUTÉE]\n${actionResult}` : message },
    ];

    // Agentic loop — max 5 iterations
    let reply = "Pas de réponse.";

    for (let iter = 0; iter < 5; iter++) {
      const aiRes = await fetch(AI_GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
          tools: TOOLS,
          tool_choice: "auto",
          max_tokens: 2048,
        }),
        signal: AbortSignal.timeout(45000),
      });

      if (!aiRes.ok) return json({ error: `AI error: ${aiRes.status}` }, 500);

      const aiData = await aiRes.json();
      const choice = aiData.choices?.[0];
      const assistantMsg = choice?.message;
      if (!assistantMsg) break;

      if (choice.finish_reason === "tool_calls" && assistantMsg.tool_calls?.length > 0) {
        messages.push(assistantMsg);

        for (const toolCall of assistantMsg.tool_calls) {
          let toolResult: string;

          try {
            const args = JSON.parse(toolCall.function.arguments);

            if (toolCall.function?.name === "execute_sql") {
              const rows = await execSQL(args.query, SUPABASE_URL, SUPABASE_SERVICE_KEY);
              const count = Array.isArray(rows) ? rows.length : 1;
              toolResult = JSON.stringify({ rows, count });

            } else if (toolCall.function?.name === "invoke_pipeline_step") {
              const step = args.step as string;

              // reclassify: reset category_ai + poi_quality_score then classify
              if (step === "reclassify") {
                await supabase
                  .from("medina_pois")
                  .update({ category_ai: null, poi_quality_score: null } as any)
                  .not("status", "in", '("filtered","merged")');
                const { data } = await supabase.functions.invoke("poi-classify-worker", { body: {} });
                toolResult = JSON.stringify({ success: true, step, classified: data?.classified ?? 0, logs: (data?.logs ?? []).slice(0, 5) });

              // rescore_riads: reset riads then reclassify
              } else if (step === "rescore_riads") {
                await supabase
                  .from("medina_pois")
                  .update({ category_ai: null, poi_quality_score: null } as any)
                  .eq("category_ai", "riad");
                const { data } = await supabase.functions.invoke("poi-classify-worker", { body: {} });
                toolResult = JSON.stringify({ success: true, step, classified: data?.classified ?? 0, logs: (data?.logs ?? []).slice(0, 5) });

              } else {
                const config = PIPELINE_STEPS[step];
                if (!config) throw new Error(`Étape inconnue: ${step}`);
                const { data, error } = await supabase.functions.invoke(config.fn, { body: config.body });
                if (error) throw new Error(error.message);
                const logs = (data?.logs ?? []).slice(0, 8);
                toolResult = JSON.stringify({ success: true, step, label: config.label, logs, data: { ...data, logs: undefined } });
              }

            } else {
              toolResult = JSON.stringify({ error: `Outil inconnu: ${toolCall.function?.name}` });
            }
          } catch (e) {
            toolResult = JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" });
          }

          messages.push({ role: "tool", tool_call_id: toolCall.id, content: toolResult });
        }
        continue;
      }

      reply = assistantMsg.content ?? "Pas de réponse.";
      break;
    }

    return json({ reply, action_taken: actionResult ?? null });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erreur inconnue" }, 500);
  }
});
