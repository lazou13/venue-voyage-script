import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, Download, CheckCircle2, XCircle, Pencil, Shield, Lock } from "lucide-react";

const TAXONOMY = [
  "monument", "historic_site", "museum", "mosque", "palace", "garden",
  "fountain", "gate_bab", "riad", "souk", "fondouk", "artisan",
  "food_drink", "photo_spot", "viewpoint", "cafe", "restaurant", "place", "generic",
];

interface Proposal {
  poi_id: string;
  name_fr: string;
  current_category: string;
  proposed_category: string;
  confidence: number;
  reasoning?: string;
  human_decision: "accepted" | "rejected" | string | null; // 'modified_to:<cat>' allowed
}

interface RecatReport {
  id: string;
  run_at: string;
  total_pois: number;
  issues_detail: {
    report_kind?: string;
    batch?: string;
    status?: "pending" | "completed" | "failed" | string;
    error?: string;
    confidence_distribution?: { high: number; mid: number; low: number };
    proposals?: Proposal[];
  };
}

export default function RecatPilotPanel() {
  const { toast } = useToast();
  const [reports, setReports] = useState<RecatReport[]>([]);
  const [activeReport, setActiveReport] = useState<RecatReport | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({}); // poi_id -> recat_note (LOT 1B)
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [hubFlags, setHubFlags] = useState<Record<string, { is_start_hub: boolean; is_main_visit: boolean }>>({});
  const [pendingReportId, setPendingReportId] = useState<string | null>(null);
  const [lotMode, setLotMode] = useState<"lot1a_pilot" | "lot1b">("lot1b");
  const pollTimerRef = useRef<number | null>(null);
  const pollDeadlineRef = useRef<number>(0);

  const stopPolling = () => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setPendingReportId(null);
  };

  useEffect(() => () => stopPolling(), []);

  const fetchReports = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("poi_quality_reports")
      .select("*")
      .order("run_at", { ascending: false })
      .limit(20);
    const recat = (data ?? []).filter(
      (r: any) => r.issues_detail?.report_kind === "recat_proposal"
    ) as RecatReport[];
    setReports(recat);
    if (recat.length > 0 && !activeReport) selectReport(recat[0]);
    setLoading(false);
  };

  const selectReport = async (r: RecatReport) => {
    setActiveReport(r);
    const props = (r.issues_detail?.proposals ?? []) as Proposal[];
    setProposals(props);
    // Garde-fou: charger flags hub/main_visit pour chaque POI
    const ids = props.map((p) => p.poi_id);
    if (ids.length > 0) {
      const { data: pois } = await supabase
        .from("medina_pois")
        .select("id, is_start_hub, is_main_visit")
        .in("id", ids);
      const map: Record<string, { is_start_hub: boolean; is_main_visit: boolean }> = {};
      (pois ?? []).forEach((p: any) => {
        map[p.id] = { is_start_hub: !!p.is_start_hub, is_main_visit: !!p.is_main_visit };
      });
      setHubFlags(map);
    }
  };

  useEffect(() => { fetchReports(); }, []);

  const startPolling = (reportId: string) => {
    stopPolling();
    setPendingReportId(reportId);
    pollDeadlineRef.current = Date.now() + 5 * 60 * 1000; // 5 min max
    pollTimerRef.current = window.setInterval(async () => {
      if (Date.now() > pollDeadlineRef.current) {
        stopPolling();
        setGenerating(false);
        toast({ title: "Timeout polling", description: "Le rapport n'a pas terminé en 5 min.", variant: "destructive" });
        return;
      }
      const { data } = await supabase
        .from("poi_quality_reports")
        .select("*")
        .eq("id", reportId)
        .maybeSingle();
      const status = (data as any)?.issues_detail?.status;
      if (status === "completed") {
        stopPolling();
        setGenerating(false);
        const count = (data as any)?.issues_detail?.proposals?.length ?? 0;
        toast({ title: `Pilote généré: ${count} propositions` });
        await fetchReports();
        if (data) await selectReport(data as RecatReport);
      } else if (status === "failed") {
        stopPolling();
        setGenerating(false);
        const err = (data as any)?.issues_detail?.error ?? "erreur inconnue";
        toast({ title: "Échec génération pilote", description: err, variant: "destructive" });
        await fetchReports();
      }
      // sinon: pending, on continue
    }, 3000);
  };

  const computeNextLot1bLabel = async (): Promise<string> => {
    const { data } = await supabase
      .from("poi_quality_reports")
      .select("issues_detail")
      .order("run_at", { ascending: false })
      .limit(100);
    const used = new Set<number>();
    (data ?? []).forEach((r: any) => {
      const b = r?.issues_detail?.batch;
      const m = typeof b === "string" ? b.match(/^lot1b_batch(\d+)$/) : null;
      if (m) used.add(parseInt(m[1], 10));
    });
    let n = 1;
    while (used.has(n)) n++;
    return `lot1b_batch${String(n).padStart(2, "0")}`;
  };

  const generatePilot = async () => {
    setGenerating(true);
    try {
      const lotLabel = lotMode === "lot1b" ? await computeNextLot1bLabel() : "lot1a_pilot";
      const pilotSize = lotMode === "lot1b" ? 50 : 30;
      const { data, error } = await supabase.functions.invoke("poi-quality-agent", {
        body: { mode: "recat_propose", pilot_size: pilotSize, lot_label: lotLabel },
      });
      if (error) throw error;
      const reportId = (data as any)?.report_id;
      if (!reportId) throw new Error("report_id manquant dans la réponse");
      toast({ title: `Génération lancée (${lotLabel})`, description: `Traitement IA en arrière-plan (~120–180s)…` });
      startPolling(reportId);
    } catch (e: any) {
      setGenerating(false);
      toast({ title: "Erreur génération", description: e.message, variant: "destructive" });
    }
  };

  const setDecision = (idx: number, decision: Proposal["human_decision"]) => {
    setProposals((prev) => prev.map((p, i) => (i === idx ? { ...p, human_decision: decision } : p)));
  };

  const setModifiedTo = (idx: number, cat: string) => {
    setDecision(idx, `modified_to:${cat}` as any);
  };

  const setNote = (poiId: string, value: string) => {
    setNotes((prev) => ({ ...prev, [poiId]: value }));
  };

  const exportCsv = () => {
    if (!activeReport) return;
    const batchLabel = activeReport.issues_detail?.batch ?? "lot";
    const header = ["poi_id", "name_fr", "current_category", "proposed_category", "confidence", "human_decision", "recat_note", "reasoning"];
    const rows = proposals.map((p) =>
      [p.poi_id, p.name_fr, p.current_category, p.proposed_category, p.confidence, p.human_decision ?? "pending", (notes[p.poi_id] ?? "").replace(/[\n\r,;]/g, " "), (p.reasoning ?? "").replace(/[\n\r,;]/g, " ")]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${batchLabel}-preview-${activeReport.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Bloqués structurels exclus du compteur "tout décidé"
  const decidableProposals = proposals.filter(
    (p) => !(hubFlags[p.poi_id]?.is_start_hub || hubFlags[p.poi_id]?.is_main_visit)
  );
  const allDecided = decidableProposals.length > 0 && decidableProposals.every((p) => p.human_decision !== null);

  // Mappage human_decision -> recat_decision (canonical persisté en base)
  const toCanonicalDecision = (hd: string | null): "ok" | "modifier" | "rejected" | "conservé_generic" | null => {
    if (!hd) return null;
    if (hd === "accepted") return "ok";
    if (hd === "rejected") return "rejected";
    if (hd === "conservé_generic") return "conservé_generic";
    if (hd.startsWith("modified_to:")) return "modifier";
    return null;
  };

  const applyDecisions = async () => {
    if (!activeReport) return;
    if (!allDecided) {
      toast({ title: "Décision manquante", description: "Toutes les lignes décidables doivent avoir une décision.", variant: "destructive" });
      return;
    }
    const batchLabel = activeReport.issues_detail?.batch ?? "lot1a_pilot";
    setApplying(true);
    try {
      let applied = 0, skipped = 0, traced = 0;
      for (const p of proposals) {
        if (hubFlags[p.poi_id]?.is_start_hub || hubFlags[p.poi_id]?.is_main_visit) { skipped++; continue; }
        const decision = toCanonicalDecision(p.human_decision);
        if (!decision || decision === "rejected") { skipped++; continue; }

        let targetCat: string | null = null;
        if (decision === "ok") targetCat = p.proposed_category;
        else if (decision === "modifier" && typeof p.human_decision === "string" && p.human_decision.startsWith("modified_to:")) {
          targetCat = p.human_decision.slice("modified_to:".length);
        } else if (decision === "conservé_generic") {
          targetCat = p.current_category;
        }
        if (!targetCat || !TAXONOMY.includes(targetCat)) { skipped++; continue; }

        const { data: cur } = await supabase
          .from("medina_pois")
          .select("metadata, category")
          .eq("id", p.poi_id)
          .single();
        const note = (notes[p.poi_id] ?? "").trim();
        const newMeta: Record<string, unknown> = {
          ...((cur?.metadata as object) ?? {}),
          recat_applied_at: new Date().toISOString(),
          recat_from: cur?.category ?? p.current_category,
          recat_decision_id: activeReport.id,
          recat_confidence: p.confidence,
          recat_batch: batchLabel,
          recat_decision: decision, // 'ok' | 'modifier' | 'conservé_generic'  → persisté en base
        };
        if (note.length > 0) newMeta.recat_note = note; // persisté en base si renseigné

        const { error: upErr } = await supabase
          .from("medina_pois")
          .update({ category: targetCat, metadata: newMeta as any })
          .eq("id", p.poi_id);
        if (!upErr) {
          applied++;
          if (decision === "conservé_generic") traced++;
        } else skipped++;
      }
      toast({ title: `Application terminée`, description: `${applied} appliqués · ${traced} conservés · ${skipped} ignorés` });
      await fetchReports();
    } catch (e: any) {
      toast({ title: "Erreur application", description: e.message, variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  const conf = activeReport?.issues_detail?.confidence_distribution;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-lg">Recatégorisation — Pilote LOT 1A / LOT 1B</h2>
          {activeReport && <Badge variant="outline" className="text-xs">{proposals.length} POIs · {activeReport.issues_detail?.batch}</Badge>}
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Select value={lotMode} onValueChange={(v) => setLotMode(v as "lot1a_pilot" | "lot1b")}>
            <SelectTrigger className="w-[200px] h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="lot1b">LOT 1B (batch 50, priorisé)</SelectItem>
              <SelectItem value="lot1a_pilot">LOT 1A (pilote 30, legacy)</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={generatePilot} disabled={generating} className="gap-2">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {lotMode === "lot1b" ? "Générer batch (50)" : "Générer pilote (30)"}
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={!activeReport} className="gap-2">
            <Download className="w-4 h-4" /> Export CSV preview
          </Button>
        </div>
      </div>

      {reports.length > 1 && (
        <div className="flex gap-2 items-center text-sm">
          <span className="text-muted-foreground">Rapport :</span>
          <Select value={activeReport?.id ?? ""} onValueChange={(id) => {
            const r = reports.find((x) => x.id === id);
            if (r) selectReport(r);
          }}>
            <SelectTrigger className="w-[320px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {reports.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {new Date(r.run_at).toLocaleString("fr")} · {r.total_pois} POIs
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {conf && (
        <Card className="p-3 flex gap-4 text-sm">
          <div><span className="text-muted-foreground">Conf. ≥ 0.9 :</span> <strong>{conf.high}</strong></div>
          <div><span className="text-muted-foreground">0.7 – 0.9 :</span> <strong>{conf.mid}</strong></div>
          <div><span className="text-muted-foreground">&lt; 0.7 :</span> <strong>{conf.low}</strong></div>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : !activeReport ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Aucun pilote généré. Cliquez « Générer pilote » pour produire les propositions.
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0">
              <tr className="text-left">
                <th className="p-2">name_fr</th>
                <th className="p-2">category</th>
                <th className="p-2">proposed</th>
                <th className="p-2">conf.</th>
                <th className="p-2">reasoning</th>
                <th className="p-2 w-[260px]">décision</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p, idx) => {
                const blocked = !!(hubFlags[p.poi_id]?.is_start_hub || hubFlags[p.poi_id]?.is_main_visit);
                const decision = p.human_decision;
                return (
                  <tr key={p.poi_id} className="border-t">
                    <td className="p-2 align-top">
                      {blocked && <Shield className="w-3 h-3 inline mr-1 text-amber-500" aria-label="hub/main_visit" />}
                      <span className="font-medium">{p.name_fr}</span>
                    </td>
                    <td className="p-2 align-top text-muted-foreground">{p.current_category}</td>
                    <td className="p-2 align-top"><Badge variant="secondary">{p.proposed_category}</Badge></td>
                    <td className="p-2 align-top">
                      <span className={
                        p.confidence >= 0.9 ? "text-emerald-600 font-bold"
                          : p.confidence >= 0.7 ? "text-blue-600"
                          : "text-amber-600"
                      }>{p.confidence.toFixed(2)}</span>
                    </td>
                    <td className="p-2 align-top text-muted-foreground max-w-[280px]">{p.reasoning}</td>
                    <td className="p-2 align-top">
                      {blocked ? (
                        <span className="text-xs text-amber-600">Bloqué (hub/main_visit)</span>
                      ) : (
                        <div className="flex gap-1 items-center flex-wrap">
                          <Button size="sm" variant={decision === "accepted" ? "default" : "outline"} className="h-6 px-2 gap-1" onClick={() => setDecision(idx, "accepted")}>
                            <CheckCircle2 className="w-3 h-3" /> OK
                          </Button>
                          <Button size="sm" variant={decision === "rejected" ? "destructive" : "outline"} className="h-6 px-2 gap-1" onClick={() => setDecision(idx, "rejected")}>
                            <XCircle className="w-3 h-3" /> Non
                          </Button>
                          <Select value={typeof decision === "string" && decision.startsWith("modified_to:") ? decision.slice(12) : ""} onValueChange={(v) => setModifiedTo(idx, v)}>
                            <SelectTrigger className="h-6 px-2 text-xs w-[130px]"><Pencil className="w-3 h-3 mr-1" /><SelectValue placeholder="Modifier…" /></SelectTrigger>
                            <SelectContent>
                              {TAXONOMY.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {activeReport && (
        <div className="flex justify-end items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {proposals.filter((p) => p.human_decision !== null).length} / {proposals.length} décidés
          </span>
          <Button onClick={applyDecisions} disabled={applying || !allDecided} className="gap-2">
            {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Appliquer les décisions
          </Button>
        </div>
      )}
    </div>
  );
}
