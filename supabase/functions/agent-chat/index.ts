import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Execute a read-only SQL query via Supabase REST (PostgREST rpc not needed — use direct fetch)
async function execSQL(query: string, supabaseUrl: string, serviceKey: string): Promise<any> {
  // Security: only allow SELECT / WITH (read-only)
  const trimmed = query.trim().toUpperCase();
  if (!trimmed.startsWith("SELECT") && !trimmed.startsWith("WITH")) {
    throw new Error("Seules les requêtes SELECT/WITH sont autorisées");
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_agent_sql`, {
    method: "POST",
    headers: {
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SQL error: ${err}`);
  }

  return await res.json();
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "execute_sql",
      description: "Exécute une requête SQL SELECT sur la base HPP. Tables disponibles : medina_pois (id, name, status, enrichment_status, category_ai, lat, lng, poi_quality_score, audio_url_fr, audio_url_en, description_fr, description_en, created_at), agent_logs (id, phase, action, result, errors, created_at). Utilise pour trouver des doublons, des statistiques précises, des listes filtrées, etc.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "La requête SQL SELECT à exécuter (lecture seule)",
          },
        },
        required: ["query"],
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

    // Fetch context from DB
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
      ? (pois.reduce((s: number, p: any) => s + (p.poi_quality_score ?? 0), 0) / total).toFixed(1)
      : "–";
    const categories: Record<string, number> = {};
    for (const p of pois) {
      if ((p as any).category_ai) categories[(p as any).category_ai] = (categories[(p as any).category_ai] ?? 0) + 1;
    }
    const topCats = Object.entries(categories).sort(([,a],[,b]) => b - a).slice(0, 8).map(([k, v]) => `${k}:${v}`).join(", ");
    const lastLogs = (logsRes.data ?? []).map((l: any) => {
      const ago = Math.round((Date.now() - new Date(l.created_at).getTime()) / 60000);
      const result = l.result ? JSON.stringify(l.result).slice(0, 120) : "";
      return `[${ago}min ago] ${l.phase} / ${l.action} → ${result}`;
    }).join("\n");

    const context = `## État actuel de la base HPP
**POIs actifs:** ${total} (${validated} validés, ${enriched} enrichis)
**Score moyen qualité:** ${avgScore}/10
**Audio FR:** ${withAudioFr}/${total} (manquants: ${total - withAudioFr})
**Audio EN:** ${withAudioEn}/${total} (manquants: ${total - withAudioEn})
**Top catégories:** ${topCats}
**Derniers logs agent:**
${lastLogs || "Aucun log récent"}`;

    const systemPrompt = `Tu es l'assistant IA de Hunt Planner Pro, le back-office de gestion des POIs de la médina de Marrakech.

Tu as accès à l'état en temps réel de la base de données ET tu peux exécuter des requêtes SQL SELECT via l'outil execute_sql pour répondre à des questions précises (doublons, listes filtrées, statistiques avancées, etc.).

Pour déclencher des actions système, tu peux inclure dans ta réponse :
ACTION:{"type":"run_agent"} — pour lancer poi-auto-agent
ACTION:{"type":"run_sync"} — pour lancer la sync HPP→TTT

Réponds toujours en français. Sois concis et direct. Utilise l'outil SQL dès que la question nécessite des données précises non disponibles dans le contexte ci-dessous.

${context}`;

    // Detect manual action requests
    const msgLower = message.toLowerCase();
    let actionResult: string | null = null;

    if (msgLower.includes("lance l'agent") || msgLower.includes("lancer l'agent") || msgLower.includes("forcer l'agent") || msgLower.includes("exécute l'agent") || msgLower.includes("run agent")) {
      try {
        const { data, error } = await supabase.functions.invoke("poi-auto-agent");
        if (error) throw error;
        const logSummary = (data?.logs ?? []).slice(0, 8).join("\n");
        actionResult = `✅ Agent exécuté :\n${logSummary}`;
      } catch (e) {
        actionResult = `❌ Erreur agent : ${e instanceof Error ? e.message : "inconnue"}`;
      }
    } else if (msgLower.includes("lance la sync") || msgLower.includes("lancer la sync") || msgLower.includes("synchronise") || msgLower.includes("sync hpp")) {
      actionResult = "Sync HPP→TTT déclenchée via prochain cycle agent (Phase 3).";
    }

    // Build initial messages
    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...(history as { role: string; content: string }[]).slice(-10),
      { role: "user", content: actionResult ? `${message}\n\n[ACTION EXÉCUTÉE]\n${actionResult}` : message },
    ];

    // Agentic loop — max 4 iterations (tool calls)
    let reply = "Pas de réponse.";
    let iterations = 0;

    while (iterations < 4) {
      iterations++;

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
        signal: AbortSignal.timeout(30000),
      });

      if (!aiRes.ok) {
        return json({ error: `AI error: ${aiRes.status}` }, 500);
      }

      const aiData = await aiRes.json();
      const choice = aiData.choices?.[0];
      const assistantMsg = choice?.message;

      if (!assistantMsg) break;

      // Check for tool calls
      if (choice.finish_reason === "tool_calls" && assistantMsg.tool_calls?.length > 0) {
        // Add assistant message with tool_calls to conversation
        messages.push(assistantMsg);

        // Execute each tool call
        for (const toolCall of assistantMsg.tool_calls) {
          if (toolCall.function?.name === "execute_sql") {
            let toolResult: string;
            try {
              const args = JSON.parse(toolCall.function.arguments);
              const rows = await execSQL(args.query, SUPABASE_URL, SUPABASE_SERVICE_KEY);
              const rowCount = Array.isArray(rows) ? rows.length : 1;
              toolResult = JSON.stringify({ rows, count: rowCount });
            } catch (e) {
              toolResult = JSON.stringify({ error: e instanceof Error ? e.message : "Erreur SQL" });
            }

            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: toolResult,
            });
          }
        }
        // Continue loop to get final AI response
        continue;
      }

      // Final text response
      reply = assistantMsg.content ?? "Pas de réponse.";
      break;
    }

    return json({ reply, action_taken: actionResult ?? null });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erreur inconnue" }, 500);
  }
});
