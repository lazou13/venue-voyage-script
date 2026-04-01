import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, Rocket, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

const STEPS = [
  { key: "wikidata", label: "Wikidata IDs" },
  { key: "poi_enricher", label: "Enrichissement Wikidata" },
  { key: "photo", label: "Photos Wikimedia" },
  { key: "wiki_name", label: "Wikipedia noms" },
  { key: "anecdote", label: "Anecdotes (Perplexity)" },
  { key: "riddle", label: "Énigmes IA" },
] as const;

type StepStatus = "pending" | "running" | "success" | "error";

interface StepState {
  key: string;
  label: string;
  status: StepStatus;
  detail?: string;
}

export default function EnrichmentPipelineCard() {
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<StepState[]>([]);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const abortRef = useRef(false);

  const updateStep = (key: string, patch: Partial<StepState>) => {
    setSteps(prev => prev.map(st => st.key === key ? { ...st, ...patch } : st));
  };

  const addLog = (line: string) => setLogs(prev => [...prev, line]);

  const runClientLoop = async (
    fnName: string,
    stepKey: string,
    body: Record<string, unknown>,
    maxIter: number,
    countField: string,
  ): Promise<number> => {
    let total = 0;
    for (let i = 0; i < maxIter; i++) {
      if (abortRef.current) break;
      const { data, error } = await supabase.functions.invoke(fnName, { body });
      if (error) {
        addLog(`  ⚠ ${error.message}`);
        break;
      }
      const errMsg = (data as any)?.error;
      if (errMsg) {
        addLog(`  ⚠ ${errMsg}`);
        break;
      }
      const count = (data as any)?.[countField] ?? 0;
      total += count;
      if (count > 0) {
        addLog(`  … ${fnName}: +${count} (total ${total})`);
        updateStep(stepKey, { detail: `${total} traités` });
      }
      if (count === 0) break;
      await new Promise(r => setTimeout(r, 500));
    }
    return total;
  };

  const launch = async () => {
    setRunning(true);
    abortRef.current = false;
    setLogs([]);
    setSummary(null);

    const initialSteps: StepState[] = STEPS.map(s => ({ key: s.key, label: s.label, status: "pending" }));
    setSteps(initialSteps);
    setProgress(0);

    const results: Record<string, unknown> = {};

    // Phase 1: orchestrator for steps 1-4
    const orchestratorSteps = ["wikidata", "poi_enricher", "photo", "wiki_name"];
    orchestratorSteps.forEach(k => updateStep(k, { status: "running" }));
    addLog("▶ Lancement orchestrateur (4 étapes)…");

    try {
      const { data, error } = await supabase.functions.invoke("enrichment-pipeline", {
        body: { steps: orchestratorSteps },
      });

      if (error) throw new Error(error.message);
      const orchResults = (data?.results ?? {}) as Record<string, Record<string, unknown>>;
      const orchLog = (data?.log ?? []) as string[];
      orchLog.forEach(l => addLog(l));
      Object.assign(results, orchResults);

      orchestratorSteps.forEach(k => {
        const r = orchResults[k] ?? orchResults[k.replace("_", "-")] ?? orchResults[mapResultKey(k)];
        const hasError = r && (r as any)?.error;
        updateStep(k, {
          status: hasError ? "error" : "success",
          detail: hasError ? String((r as any).error) : formatResult(r),
        });
      });
      setProgress(50);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      addLog(`❌ Orchestrateur: ${msg}`);
      orchestratorSteps.forEach(k => updateStep(k, { status: "error", detail: msg }));
      setRunning(false);
      return;
    }

    // Phase 2: client-side loops for anecdotes + riddles
    if (!abortRef.current) {
      updateStep("anecdote", { status: "running" });
      addLog("▶ anecdote-enricher (client-side)…");
      const anecTotal = await runClientLoop("anecdote-enricher", "anecdote", { batch_size: 5, min_score: 0 }, 80, "updated");
      results.anecdote_enricher = { updated: anecTotal };
      updateStep("anecdote", { status: "success", detail: `${anecTotal} anecdotes` });
      addLog(`  ✓ ${anecTotal} anecdotes générées`);
      setProgress(75);
    }

    if (!abortRef.current) {
      updateStep("riddle", { status: "running" });
      addLog("▶ riddle-generator (client-side)…");
      const riddleTotal = await runClientLoop("riddle-generator", "riddle", { batch_size: 10, min_score: 0 }, 40, "updated");
      results.riddle_generator = { updated: riddleTotal };
      updateStep("riddle", { status: "success", detail: `${riddleTotal} énigmes` });
      addLog(`  ✓ ${riddleTotal} énigmes générées`);
      setProgress(100);
    }

    setSummary(results);
    setRunning(false);
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Pipeline d'enrichissement complet</CardTitle>
            <CardDescription>6 étapes : Wikidata → Enrichissement → Photos → Wikipedia → Anecdotes → Énigmes</CardDescription>
          </div>
          <Button onClick={launch} disabled={running} className="gap-2">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
            {running ? "En cours…" : "Lancer l'enrichissement"}
          </Button>
        </div>
      </CardHeader>

      {steps.length > 0 && (
        <CardContent className="space-y-4">
          <Progress value={progress} className="h-2" />

          <div className="grid gap-2">
            {steps.map(st => (
              <div key={st.key} className="flex items-center gap-3 text-sm">
                <StepIcon status={st.status} />
                <span className={st.status === "error" ? "text-orange-500" : "text-foreground"}>{st.label}</span>
                {st.detail && <span className={`ml-auto text-xs ${st.status === "error" ? "text-orange-500" : "text-muted-foreground"}`}>{st.detail}</span>}
              </div>
            ))}
          </div>

          {logs.length > 0 && (
            <div className="bg-muted rounded-md p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-0.5">
              {logs.map((line, i) => (
                <div key={i} className={line.includes("⚠") || line.includes("❌") ? "text-orange-500" : line.includes("✓") || line.includes("✅") ? "text-green-600 dark:text-green-400" : "text-foreground"}>
                  {line}
                </div>
              ))}
            </div>
          )}

          {summary && !running && (
            <div className="rounded-md border p-3 space-y-1">
              <p className="text-sm font-medium text-foreground">Résumé</p>
              {Object.entries(summary).map(([k, v]) => (
                <p key={k} className="text-xs text-muted-foreground">{k}: {JSON.stringify(v)}</p>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "pending": return <Clock className="w-4 h-4 text-muted-foreground" />;
    case "running": return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
    case "success": return <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />;
    case "error": return <AlertTriangle className="w-4 h-4 text-orange-500" />;
  }
}

function mapResultKey(key: string): string {
  const map: Record<string, string> = {
    wikidata: "wikidata_finder",
    poi_enricher: "poi_enricher",
    photo: "photo_fetcher",
    wiki_name: "wiki_name",
  };
  return map[key] ?? key;
}

function formatResult(r: unknown): string {
  if (!r || typeof r !== "object") return "";
  const entries = Object.entries(r as Record<string, unknown>);
  return entries.map(([k, v]) => `${k}: ${v}`).join(", ");
}
