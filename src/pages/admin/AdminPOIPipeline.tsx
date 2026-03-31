import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin, Brain, Route, Rocket, RefreshCw, Trash2, GitMerge, Tags, Zap, CheckCircle2, Camera } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import EnrichmentPipelineCard from "@/components/admin/EnrichmentPipelineCard";

type StepKey = "extract" | "classify" | "enrich" | "clean" | "merge" | "proximity" | "all" | "worker" | "autopipeline" | "fetch-photos" | "backfill-details";

export default function AdminPOIPipeline() {
  const { toast } = useToast();
  const [running, setRunning] = useState<StepKey | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["poi-pipeline-stats"],
    refetchInterval: 30000, // Auto-refresh every 30s
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medina_pois")
        .select("enrichment_status, status, category_ai, poi_quality_score, description_short, nearby_pois_data, riddle_easy, riddle_hard, price_info");
      if (error) throw error;

      const counts: Record<string, number> = { total: 0, raw: 0, enriched: 0, error: 0, pending: 0, filtered: 0, merged: 0, processing: 0 };
      const categories: Record<string, number> = {};
      let totalScore = 0;
      let scoredCount = 0;
      let classified = 0;
      let withDescription = 0;
      let withProximity = 0;
      let withRiddleEasy = 0;
      let withRiddleHard = 0;
      let withPriceInfo = 0;
      let active = 0;

      for (const row of data ?? []) {
        const es = (row as any).enrichment_status ?? "pending";
        const st = (row as any).status ?? "draft";
        counts[es] = (counts[es] ?? 0) + 1;
        if (st === "filtered") counts.filtered++;
        if (st === "merged") counts.merged++;
        counts.total++;

        const isActive = st !== "filtered" && st !== "merged";
        if (isActive) active++;

        const cat = (row as any).category_ai;
        if (cat) { categories[cat] = (categories[cat] ?? 0) + 1; if (isActive) classified++; }
        if ((row as any).description_short && isActive) withDescription++;
        if ((row as any).nearby_pois_data && isActive) withProximity++;
        if ((row as any).riddle_easy && isActive) withRiddleEasy++;
        if ((row as any).riddle_hard && isActive) withRiddleHard++;
        if ((row as any).price_info && isActive) withPriceInfo++;

        const score = (row as any).poi_quality_score;
        if (score) { totalScore += Number(score); scoredCount++; }
      }

      return {
        counts,
        categories,
        avgScore: scoredCount > 0 ? (totalScore / scoredCount).toFixed(1) : "–",
        active,
        classified,
        withDescription,
        withProximity,
        withRiddleEasy,
        withRiddleHard,
        withPriceInfo,
      };
    },
  });

  const runStep = async (step: StepKey) => {
    setRunning(step);
    setLogs([`▶ Lancement: ${step}...`]);

    try {
      const fnName = step === "worker" ? "poi-worker"
        : step === "classify" ? "poi-classify-worker"
        : step === "autopipeline" ? "poi-autopipeline"
        : step === "fetch-photos" ? "poi-fetch-photos"
        : step === "backfill-details" ? "poi-backfill-details"
        : step === "all" ? "poi-pipeline"
        : step === "clean" || step === "merge" ? "poi-pipeline"
        : `poi-${step}`;
      const fnBody = step === "worker" ? {}
        : step === "classify" ? {}
        : step === "autopipeline" ? {}
        : step === "fetch-photos" ? {}
        : step === "backfill-details" ? { limit: 10 }
        : step === "all" ? { step: "all", limit: 500, batch_size: 5 }
        : step === "extract" ? { limit: 500 }
        : step === "enrich" ? { batch_size: 10 }
        : step === "clean" ? { step: "clean" }
        : step === "merge" ? { step: "merge" }
        : {};

      const { data, error } = await supabase.functions.invoke(fnName, { body: fnBody });

      if (error) throw error;

      const allLogs: string[] = [];
      if (data?.logs) allLogs.push(...data.logs);
      if (data?.results) {
        for (const [k, v] of Object.entries(data.results)) {
          allLogs.push(`=== ${k} ===`);
          if ((v as any)?.logs) allLogs.push(...(v as any).logs);
          else allLogs.push(JSON.stringify(v));
        }
      }
      if (data?.stats) allLogs.push(`📊 Stats: ${JSON.stringify(data.stats)}`);
      setLogs(prev => [...prev, ...allLogs, "✅ Terminé"]);
      toast({ title: "Pipeline terminé", description: `Étape "${step}" exécutée avec succès.` });
      refetchStats();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setLogs(prev => [...prev, `❌ Erreur: ${msg}`]);
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setRunning(null);
    }
  };

  const active = stats?.active ?? 0;
  const pctClassified = active > 0 ? Math.round((stats?.classified ?? 0) / active * 100) : 0;
  const pctEnriched = active > 0 ? Math.round((stats?.withDescription ?? 0) / active * 100) : 0;
  const pctProximity = active > 0 ? Math.round((stats?.withProximity ?? 0) / active * 100) : 0;
  const pctPriceInfo = active > 0 ? Math.round((stats?.withPriceInfo ?? 0) / active * 100) : 0;
  const pipelineComplete = pctClassified === 100 && pctEnriched === 100 && pctProximity === 100;

  const statusColors: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    raw: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    processing: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    enriched: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    error: "bg-destructive/10 text-destructive",
    filtered: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    merged: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Pipeline POI Médina</h2>
          <p className="text-muted-foreground">
            Automatisé via cron (toutes les 2 min) — classify → enrich → clean → merge → proximity
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pipelineComplete ? (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 gap-1">
              <CheckCircle2 className="w-3 h-3" /> Pipeline complet
            </Badge>
          ) : (
            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 gap-1">
              <Zap className="w-3 h-3" /> En cours (cron actif)
            </Badge>
          )}
        </div>
      </div>

      <EnrichmentPipelineCard />

      {/* Pipeline Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Progression du pipeline</CardTitle>
          <CardDescription>{active} POI actifs dans la médina de Marrakech</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Classification IA</span>
              <span className="font-medium text-foreground">{stats?.classified ?? 0}/{active} ({pctClassified}%)</span>
            </div>
            <Progress value={pctClassified} className="h-2" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Enrichissement</span>
              <span className="font-medium text-foreground">{stats?.withDescription ?? 0}/{active} ({pctEnriched}%)</span>
            </div>
            <Progress value={pctEnriched} className="h-2" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Proximité</span>
              <span className="font-medium text-foreground">{stats?.withProximity ?? 0}/{active} ({pctProximity}%)</span>
            </div>
            <Progress value={pctProximity} className="h-2" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Infos pratiques (backfill)</span>
              <span className="font-medium text-foreground">{stats?.withPriceInfo ?? 0}/{active} ({pctPriceInfo}%)</span>
            </div>
            <Progress value={pctPriceInfo} className="h-2" />
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2 text-sm">
            <div><span className="text-muted-foreground">Énigmes faciles:</span> <span className="font-medium text-foreground">{stats?.withRiddleEasy ?? 0}/{active}</span></div>
            <div><span className="text-muted-foreground">Énigmes difficiles:</span> <span className="font-medium text-foreground">{stats?.withRiddleHard ?? 0}/{active}</span></div>
          </div>
        </CardContent>
      </Card>

      {/* Status counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {["total", "pending", "raw", "processing", "enriched", "error", "filtered", "merged"].map(key => (
          <Card key={key}>
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-foreground">{stats?.counts?.[key] ?? 0}</p>
              <Badge className={statusColors[key] ?? "bg-muted text-muted-foreground"} variant="secondary">{key}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Category breakdown */}
      {stats?.categories && Object.keys(stats.categories).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Catégories IA (score moyen: {stats.avgScore}/10)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.categories).sort(([,a],[,b]) => b - a).map(([cat, cnt]) => (
                <Badge key={cat} variant="outline" className="text-foreground">{cat}: {cnt}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Actions manuelles</CardTitle>
          <CardDescription>Le pipeline tourne automatiquement. Ces boutons permettent de forcer une étape.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button onClick={() => runStep("autopipeline")} disabled={!!running} size="sm" className="gap-1">
              {running === "autopipeline" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              Autopipeline
            </Button>
            <Button onClick={() => runStep("classify")} disabled={!!running} variant="outline" size="sm" className="gap-1">
              {running === "classify" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Tags className="w-3 h-3" />}
              Classifier
            </Button>
            <Button onClick={() => runStep("worker")} disabled={!!running} variant="outline" size="sm" className="gap-1">
              {running === "worker" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
              Enrichir
            </Button>
            <Button onClick={() => runStep("extract")} disabled={!!running} variant="outline" size="sm" className="gap-1">
              {running === "extract" ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
              Extraire
            </Button>
            <Button onClick={() => runStep("clean")} disabled={!!running} variant="outline" size="sm" className="gap-1">
              {running === "clean" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Nettoyer
            </Button>
            <Button onClick={() => runStep("merge")} disabled={!!running} variant="outline" size="sm" className="gap-1">
              {running === "merge" ? <Loader2 className="w-3 h-3 animate-spin" /> : <GitMerge className="w-3 h-3" />}
              Fusionner
            </Button>
            <Button onClick={() => runStep("proximity")} disabled={!!running} variant="outline" size="sm" className="gap-1">
              {running === "proximity" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Route className="w-3 h-3" />}
              Proximité
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetchStats()} className="gap-1">
              <RefreshCw className="w-3 h-3" /> Rafraîchir
            </Button>
            <Button onClick={() => runStep("fetch-photos")} disabled={!!running} variant="secondary" size="sm" className="gap-1">
              {running === "fetch-photos" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
              Fetch Google Photos
            </Button>
            <Button onClick={() => runStep("backfill-details")} disabled={!!running} variant="default" size="sm" className="gap-1 col-span-2">
              {running === "backfill-details" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Rocket className="w-3 h-3" />}
              Backfill détails pratiques ({stats?.withPriceInfo ?? 0}/{active})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-md p-3 max-h-96 overflow-y-auto font-mono text-xs space-y-0.5">
              {logs.map((line, i) => (
                <div key={i} className={line.startsWith("✗") || line.startsWith("❌") ? "text-destructive" : line.startsWith("✓") || line.startsWith("✅") ? "text-green-600 dark:text-green-400" : line.startsWith("⏳") ? "text-yellow-600 dark:text-yellow-400" : "text-foreground"}>
                  {line}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
