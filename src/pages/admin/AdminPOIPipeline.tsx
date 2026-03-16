import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin, Brain, Route, Rocket, RefreshCw, Trash2, GitMerge } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

type StepKey = "extract" | "enrich" | "clean" | "merge" | "proximity" | "all";

export default function AdminPOIPipeline() {
  const { toast } = useToast();
  const [running, setRunning] = useState<StepKey | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["poi-pipeline-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medina_pois")
        .select("enrichment_status, status, category_ai, poi_quality_score");
      if (error) throw error;
      const counts: Record<string, number> = { total: 0, raw: 0, enriched: 0, error: 0, pending: 0, filtered: 0, merged: 0 };
      const categories: Record<string, number> = {};
      let totalScore = 0;
      let scoredCount = 0;
      for (const row of data ?? []) {
        const es = (row as any).enrichment_status ?? "pending";
        const st = (row as any).status ?? "draft";
        counts[es] = (counts[es] ?? 0) + 1;
        if (st === "filtered") counts.filtered++;
        if (st === "merged") counts.merged++;
        counts.total++;
        const cat = (row as any).category_ai;
        if (cat) categories[cat] = (categories[cat] ?? 0) + 1;
        const score = (row as any).poi_quality_score;
        if (score) { totalScore += Number(score); scoredCount++; }
      }
      return { counts, categories, avgScore: scoredCount > 0 ? (totalScore / scoredCount).toFixed(1) : "–" };
    },
  });

  const runStep = async (step: StepKey) => {
    setRunning(step);
    setLogs([`▶ Lancement: ${step}...`]);

    try {
      const fnName = step === "all" ? "poi-pipeline" : step === "clean" || step === "merge" ? "poi-pipeline" : `poi-${step}`;
      const fnBody = step === "all"
        ? { step: "all", limit: 500, batch_size: 5 }
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

  const statusColors: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    raw: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    enriched: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    error: "bg-destructive/10 text-destructive",
    filtered: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    merged: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Pipeline POI Médina</h2>
        <p className="text-muted-foreground">Extraction, classification IA, nettoyage, enrichissement et proximité.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {["total", "pending", "raw", "enriched", "error", "filtered", "merged"].map(key => (
          <Card key={key}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{stats?.counts?.[key] ?? 0}</p>
              <Badge className={statusColors[key] ?? ""} variant="secondary">{key}</Badge>
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

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4" /> Extraire</CardTitle>
            <CardDescription>Google Places (grille 5 points × 9 types)</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => runStep("extract")} disabled={!!running} className="w-full">
              {running === "extract" && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Lancer l'extraction
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Brain className="w-4 h-4" /> Classifier + Enrichir</CardTitle>
            <CardDescription>Classification IA, descriptions, énigmes, scores</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => runStep("enrich")} disabled={!!running} className="w-full">
              {running === "enrich" && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Enrichir les POI bruts
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Trash2 className="w-4 h-4" /> Nettoyer</CardTitle>
            <CardDescription>Filtrer POI faibles (&lt;10 avis, &lt;3.5★)</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => runStep("clean")} disabled={!!running} variant="outline" className="w-full">
              {running === "clean" && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Nettoyer la base
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><GitMerge className="w-4 h-4" /> Dédupliquer</CardTitle>
            <CardDescription>Fusionner doublons (&lt;15m, même nom)</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => runStep("merge")} disabled={!!running} variant="outline" className="w-full">
              {running === "merge" && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Fusionner doublons
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Route className="w-4 h-4" /> Proximités</CardTitle>
            <CardDescription>5 restaurants + 5 POI proches (&lt;120m)</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => runStep("proximity")} disabled={!!running} className="w-full">
              {running === "proximity" && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Calculer proximités
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Rocket className="w-4 h-4" /> Pipeline complet</CardTitle>
            <CardDescription>Extract → Enrich → Clean → Merge → Proximity</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => runStep("all")} disabled={!!running} variant="default" className="w-full">
              {running === "all" && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Tout lancer
            </Button>
          </CardContent>
        </Card>
      </div>

      <Button variant="outline" size="sm" onClick={() => refetchStats()}>
        <RefreshCw className="w-4 h-4 mr-2" /> Rafraîchir stats
      </Button>

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
