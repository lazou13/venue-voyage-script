import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin, Brain, Route, Rocket, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

type StepKey = "extract" | "enrich" | "proximity" | "all";

export default function AdminPOIPipeline() {
  const { toast } = useToast();
  const [running, setRunning] = useState<StepKey | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Stats query
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["poi-pipeline-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medina_pois")
        .select("enrichment_status");
      if (error) throw error;
      const counts: Record<string, number> = { pending: 0, raw: 0, enriched: 0, error: 0, total: 0 };
      for (const row of data ?? []) {
        const s = (row as any).enrichment_status ?? "pending";
        counts[s] = (counts[s] ?? 0) + 1;
        counts.total++;
      }
      return counts;
    },
  });

  const runStep = async (step: StepKey) => {
    setRunning(step);
    setLogs([`▶ Lancement: ${step}...`]);

    try {
      const { data, error } = await supabase.functions.invoke(
        step === "all" ? "poi-pipeline" : `poi-${step}`,
        { body: step === "all" ? { step: "all", limit: 500, batch_size: 5 } : step === "extract" ? { limit: 100 } : step === "enrich" ? { batch_size: 10 } : {} }
      );

      if (error) throw error;

      const allLogs: string[] = [];
      if (data?.logs) allLogs.push(...data.logs);
      if (data?.results) {
        for (const [k, v] of Object.entries(data.results)) {
          allLogs.push(`=== ${k} ===`);
          if ((v as any)?.logs) allLogs.push(...(v as any).logs);
        }
      }
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
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Pipeline POI Google Places</h2>
        <p className="text-muted-foreground">Extraction, enrichissement IA et calcul de proximité des POI de la médina.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {["total", "pending", "raw", "enriched", "error"].map(key => (
          <Card key={key}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{stats?.[key] ?? 0}</p>
              <Badge className={statusColors[key] ?? ""} variant="secondary">
                {key}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Extraire
            </CardTitle>
            <CardDescription>Google Places Nearby Search + Details</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => runStep("extract")} disabled={!!running} className="w-full">
              {running === "extract" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Lancer l'extraction
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="w-4 h-4" /> Enrichir IA
            </CardTitle>
            <CardDescription>Classification, histoire, énigmes</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => runStep("enrich")} disabled={!!running} className="w-full">
              {running === "enrich" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Enrichir les POI bruts
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Route className="w-4 h-4" /> Proximités
            </CardTitle>
            <CardDescription>5 restaurants + 5 POI proches</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => runStep("proximity")} disabled={!!running} className="w-full">
              {running === "proximity" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Calculer proximités
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Rocket className="w-4 h-4" /> Pipeline complet
            </CardTitle>
            <CardDescription>Extract → Enrich → Proximity</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => runStep("all")} disabled={!!running} variant="default" className="w-full">
              {running === "all" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Tout lancer
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Refresh */}
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
            <div className="bg-muted rounded-md p-3 max-h-80 overflow-y-auto font-mono text-xs space-y-0.5">
              {logs.map((line, i) => (
                <div key={i} className={line.startsWith("✗") || line.startsWith("❌") ? "text-destructive" : line.startsWith("✓") || line.startsWith("✅") ? "text-green-600 dark:text-green-400" : "text-foreground"}>
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
