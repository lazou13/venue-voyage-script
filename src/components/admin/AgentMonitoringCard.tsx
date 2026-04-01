import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Bot, BookOpen, MapPin, Users, Utensils, Camera, Accessibility, Clock } from "lucide-react";

const AUDIENCE_LABELS: Record<string, { label: string; icon: typeof Users }> = {
  family: { label: "Familles", icon: Users },
  young_adults: { label: "Jeunes adultes", icon: Users },
  accessible: { label: "PMR", icon: Accessibility },
  foodies: { label: "Foodies", icon: Utensils },
  instagrammers: { label: "Instagrammers", icon: Camera },
};

const HUB_LABELS: Record<string, string> = {
  koutoubia: "Koutoubia",
  jemaa_el_fna: "Jemaa el-Fna",
  mellah: "Mellah",
};

export default function AgentMonitoringCard() {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [agentLogs, setAgentLogs] = useState<string[]>([]);

  // Agent enrichment stats
  const { data: agentStats } = useQuery({
    queryKey: ["agent-stats"],
    refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medina_pois")
        .select("agent_enriched_at, audience_tags, street_food_spot, instagram_score")
        .not("status", "in", '("filtered","merged")');
      if (error) throw error;

      let enriched = 0, withAudience = 0, streetFood = 0, withInstagram = 0, total = 0;
      for (const row of data ?? []) {
        total++;
        if ((row as any).agent_enriched_at) enriched++;
        if (((row as any).audience_tags || []).length > 0) withAudience++;
        if ((row as any).street_food_spot) streetFood++;
        if ((row as any).instagram_score) withInstagram++;
      }
      return { total, enriched, withAudience, streetFood, withInstagram };
    },
  });

  // Library visits
  const { data: visits, refetch: refetchVisits } = useQuery({
    queryKey: ["quest-library"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quest_library")
        .select("*")
        .order("start_hub")
        .order("audience");
      if (error) throw error;
      return data ?? [];
    },
  });

  const runAgent = async () => {
    setRunning(true);
    setAgentLogs(["▶ Lancement de l'agent autonome..."]);

    try {
      const { data, error } = await supabase.functions.invoke("poi-auto-agent", { body: { turbo: true } });
      if (error) throw error;
      if (data?.logs) setAgentLogs(prev => [...prev, ...data.logs]);
      setAgentLogs(prev => [...prev, "✅ Agent terminé"]);
      toast({ title: "Agent exécuté", description: "L'agent a terminé son cycle." });
      refetchVisits();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setAgentLogs(prev => [...prev, `❌ ${msg}`]);
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const totalVisitsPossible = 3 * 5 * 2; // 3 hubs × 5 audiences × 2 modes
  const visitCount = visits?.length ?? 0;
  const pctEnrichedAgent = (agentStats?.total ?? 0) > 0 ? Math.round((agentStats?.enriched ?? 0) / (agentStats?.total ?? 1) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Agent Status Card */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Agent Autonome 24/7</CardTitle>
            </div>
            <Button onClick={runAgent} disabled={running} size="sm" className="gap-1">
              {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
              Forcer une exécution
            </Button>
          </div>
          <CardDescription>Enrichit les POIs et génère la bibliothèque de visites automatiquement (cron horaire)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div className="text-center p-2 bg-muted rounded-md">
              <p className="text-xl font-bold text-foreground">{pctEnrichedAgent}%</p>
              <p className="text-muted-foreground text-xs">Enrichis (agent)</p>
            </div>
            <div className="text-center p-2 bg-muted rounded-md">
              <p className="text-xl font-bold text-foreground">{agentStats?.withAudience ?? 0}</p>
              <p className="text-muted-foreground text-xs">Avec audience</p>
            </div>
            <div className="text-center p-2 bg-muted rounded-md">
              <p className="text-xl font-bold text-foreground">{agentStats?.streetFood ?? 0}</p>
              <p className="text-muted-foreground text-xs">Street food</p>
            </div>
            <div className="text-center p-2 bg-muted rounded-md">
              <p className="text-xl font-bold text-foreground">{agentStats?.withInstagram ?? 0}</p>
              <p className="text-muted-foreground text-xs">Score Instagram</p>
            </div>
            <div className="text-center p-2 bg-muted rounded-md">
              <p className="text-xl font-bold text-foreground">{visitCount}/{totalVisitsPossible}</p>
              <p className="text-muted-foreground text-xs">Visites générées</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agent Logs */}
      {agentLogs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Logs Agent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-md p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-0.5">
              {agentLogs.map((line, i) => (
                <div key={i} className={line.startsWith("❌") ? "text-destructive" : line.startsWith("✅") ? "text-green-600 dark:text-green-400" : "text-foreground"}>
                  {line}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Library Visits */}
      {visits && visits.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Bibliothèque de Visites ({visitCount})</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(HUB_LABELS).map(([hubKey, hubLabel]) => {
                const hubVisits = visits.filter((v: any) => v.start_hub === hubKey);
                if (hubVisits.length === 0) return null;

                return (
                  <div key={hubKey}>
                    <div className="flex items-center gap-1 mb-2">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{hubLabel}</span>
                      <Badge variant="secondary" className="text-xs">{hubVisits.length}</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 ml-4">
                      {hubVisits.map((v: any) => {
                        const audienceInfo = AUDIENCE_LABELS[v.audience] || { label: v.audience, icon: Users };
                        const Icon = audienceInfo.icon;
                        return (
                          <div key={v.id} className="p-2 border rounded-md bg-card text-sm">
                            <div className="flex items-start justify-between gap-1">
                              <p className="font-medium text-foreground text-xs leading-tight">{v.title_fr || "Sans titre"}</p>
                              {v.quality_score && (
                                <Badge variant="outline" className="text-xs shrink-0">{v.quality_score}/10</Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              <Badge variant="secondary" className="text-xs gap-0.5">
                                <Icon className="w-2.5 h-2.5" /> {audienceInfo.label}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {v.mode === "guided_tour" ? "Visite" : "Chasse"}
                              </Badge>
                              {v.duration_min && (
                                <Badge variant="outline" className="text-xs gap-0.5">
                                  <Clock className="w-2.5 h-2.5" /> {v.duration_min}min
                                </Badge>
                              )}
                            </div>
                            {v.description_fr && (
                              <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{v.description_fr}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
