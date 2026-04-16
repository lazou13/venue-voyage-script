import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
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
    const [poisRes, logsRes, audioRes] = await Promise.all([
      supabase.from("medina_pois").select("status, enrichment_status, poi_quality_score, audio_url_fr, audio_url_en, category_ai").not("status", "in", '("filtered","merged")'),
      supabase.from("agent_logs").select("phase, action, result, created_at").order("created_at", { ascending: false }).limit(10),
      supabase.from("medina_pois").select("id").eq("status", "validated").is("audio_url_fr", null).limit(200),
    ]);

    const pois = poisRes.data ?? [];
    const total = pois.length;
    const validated = pois.filter((p: any) => p.status === "validated").length;
    const enriched = pois.filter((p: any) => p.enrichment_status === "enriched" || p.status === "enriched").length;
    const withAudioFr = pois.filter((p: any) => p.audio_url_fr).length;
    const withAudioEn = pois.filter((p: any) => p.audio_url_en).length;
    const missingAudioFr = total - withAudioFr;
    const missingAudioEn = total - withAudioEn;
    const avgScore = total > 0
      ? (pois.reduce((s: number, p: any) => s + (p.poi_quality_score ?? 0), 0) / total).toFixed(1)
      : "–";
    const categories: Record<string, number> = {};
    for (const p of pois) {
      if ((p as any).category_ai) categories[(p as any).category_ai] = (categories[(p as any).category_ai] ?? 0) + 1;
    }
    const topCats = Object.entries(categories).sort(([,a],[,b]) => b - a).slice(0, 8).map(([k, v]) => `${k}:${v}`).join(", ");

    const lastLogs = (logsRes.data ?? []).map((l: any) => {
      const d = new Date(l.created_at);
      const ago = Math.round((Date.now() - d.getTime()) / 60000);
      const result = l.result ? JSON.stringify(l.result).slice(0, 120) : "";
      return `[${ago}min ago] ${l.phase} / ${l.action} → ${result}`;
    }).join("\n");

    const context = `
## État actuel de la base HPP (Hunt Planner Pro)

**POIs actifs:** ${total} (${validated} validés, ${enriched} enrichis)
**Score moyen qualité:** ${avgScore}/10
**Audio FR:** ${withAudioFr}/${total} (manquants: ${missingAudioFr})
**Audio EN:** ${withAudioEn}/${total} (manquants: ${missingAudioEn})
**Top catégories:** ${topCats}

**Derniers logs agent:**
${lastLogs || "Aucun log récent"}
`.trim();

    const systemPrompt = `Tu es l'assistant IA de Hunt Planner Pro, le back-office de gestion des POIs de la médina de Marrakech.

Tu as accès à l'état en temps réel de la base de données. Tu peux répondre à des questions sur les POIs, les statistiques, les audios manquants, les syncs, etc.

Tu peux aussi exécuter des actions si l'utilisateur le demande. Pour déclencher une action, inclus dans ta réponse une ligne JSON spéciale au format :
ACTION:{"type":"run_agent"} — pour lancer poi-auto-agent
ACTION:{"type":"run_sync"} — pour lancer la sync HPP→TTT uniquement

Réponds toujours en français. Sois concis et direct.

${context}`;

    // Detect action request in message
    const msgLower = message.toLowerCase();
    let actionResult: string | null = null;

    const wantsAgent = msgLower.includes("lance l'agent") || msgLower.includes("lancer l'agent") || msgLower.includes("forcer l'agent") || msgLower.includes("exécute l'agent") || msgLower.includes("run agent");
    const wantsSync = msgLower.includes("lance la sync") || msgLower.includes("lancer la sync") || msgLower.includes("synchronise") || msgLower.includes("sync hpp");

    if (wantsAgent) {
      try {
        const { data, error } = await supabase.functions.invoke("poi-auto-agent");
        if (error) throw error;
        const logSummary = (data?.logs ?? []).slice(0, 8).join("\n");
        actionResult = `✅ Agent exécuté :\n${logSummary}`;
      } catch (e) {
        actionResult = `❌ Erreur agent : ${e instanceof Error ? e.message : "inconnue"}`;
      }
    } else if (wantsSync) {
      actionResult = "Sync HPP→TTT déclenchée via prochain cycle agent (Phase 3).";
    }

    // Build conversation for AI
    const messages = [
      { role: "system", content: systemPrompt },
      ...(history as { role: string; content: string }[]).slice(-10),
      { role: "user", content: actionResult ? `${message}\n\n[ACTION EXÉCUTÉE]\n${actionResult}` : message },
    ];

    const aiRes = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 1024,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!aiRes.ok) {
      return json({ error: `AI error: ${aiRes.status}` }, 500);
    }

    const aiData = await aiRes.json();
    const reply = aiData.choices?.[0]?.message?.content ?? "Pas de réponse.";

    return json({ reply, action_taken: actionResult ?? null });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erreur inconnue" }, 500);
  }
});
