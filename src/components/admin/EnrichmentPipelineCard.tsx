import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Rocket, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

const STEPS = [
  { key: "wikidata", label: "Wikidata IDs", estimatedMs: 15000 },
  { key: "poi_enricher", label: "Enrichissement Wikidata", estimatedMs: 25000 },
  { key: "photo", label: "Photos Wikimedia", estimatedMs: 12000 },
  { key: "wiki_name", label: "Wikipedia noms", estimatedMs: 10000 },
  { key: "anecdote", label: "Anecdotes IA", estimatedMs: 30000 },
  { key: "riddle", label: "Énigmes IA", estimatedMs: 35000 },
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
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const launch = async () => {
    setRunning(true);
    setLogs([]);
    setSummary(null);

    const initialSteps: StepState[] = STEPS.map(s => ({ key: s.key, label: s.label, status: "pending" }));
    setSteps(initialSteps);
    setProgress(0);

    // Simulate sequential progress
    let cumulativeMs = 0;
    STEPS.forEach((s, i) => {
      const startAt = cumulativeMs;
      timersRef.current.push(setTimeout(() => {
        setSteps(prev => prev.map((st, idx) => idx === i ? { ...st, status: "running" } : st));
        setProgress(Math.round((i / STEPS.length) * 100));
      }, startAt));
      cumulativeMs += s.estimatedMs;
    });

    try {
      const { data, error } = await supabase.functions.invoke("enrichment-pipeline", {
        body: { steps: STEPS.map(s => s.key) },
      });

      clearTimers();

      if (error) throw error;

      const results = (data?.results ?? {}) as Record<string, Record<string, unknown>>;
      const log = (data?.log ?? []) as string[];

      setLogs(log);
      setSummary(results);

      setSteps(prev => prev.map(st => {
        const r = results[st.key] ?? results[st.key.replace("_", "-")] ?? results[mapResultKey(st.key)];
        const hasError = r && (r as any)?.error;
        return { ...st, status: hasError ? "error" : "success", detail: hasError ? String((r as any).error) : formatResult(r) };
      }));
      setProgress(100);
    } catch (e) {
      clearTimers();
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setLogs(prev => [...prev, `❌ ${msg}`]);
      setSteps(prev => prev.map(st => st.status === "running" ? { ...st, status: "error", detail: msg } : st));
    } finally {
      setRunning(false);
    }
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
    anecdote: "anecdote_enricher",
    riddle: "riddle_generator",
  };
  return map[key] ?? key;
}

function formatResult(r: unknown): string {
  if (!r || typeof r !== "object") return "";
  const entries = Object.entries(r as Record<string, unknown>);
  return entries.map(([k, v]) => `${k}: ${v}`).join(", ");
}
