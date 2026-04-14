import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Loader2, MapPin, Brain, Route, Rocket, RefreshCw, Trash2, GitMerge, Tags, Zap, CheckCircle2, Camera, Sparkles, Languages } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import EnrichmentPipelineCard from "@/components/admin/EnrichmentPipelineCard";
import AgentMonitoringCard from "@/components/admin/AgentMonitoringCard";

type StepKey = "extract" | "classify" | "enrich" | "clean" | "merge" | "proximity" | "all" | "worker" | "autopipeline" | "fetch-photos" | "backfill-details" | "reclassify" | "rescore-riads" | "anecdotes" | "fun-facts" | "translate-en" | "clean-arabic";

const invokeWithRetry = async (fnName: string, body: Record<string, unknown>, maxRetries = 3): Promise<{ data: any; error: any }> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const { data, error } = await supabase.functions.invoke(fnName, { body });
    if (!error) return { data, error: null };
    const msg = error?.message ?? '';
    const isTransient = msg.includes('Failed to send') || msg.includes('network') || msg.includes('timeout') || msg.includes('ECONNRESET');
    if (!isTransient || attempt === maxRetries) return { data, error };
    await new Promise(r => setTimeout(r, 2000 * attempt));
  }
  return { data: null, error: new Error('Max retries reached') };
};

export default function AdminPOIPipeline() {
  const { toast } = useToast();
  const [running, setRunning] = useState<StepKey | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [extractionProgress, setExtractionProgress] = useState<{ current: number; total: number } | null>(null);
  const [stepResult, setStepResult] = useState<Record<string, { processed: number; done: boolean }>>({});

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

  const runStepInner = async (step: StepKey) => {
    setStepResult(prev => ({ ...prev, [step]: { processed: 0, done: false } }));

    if (step === "autopipeline") return; // handled by runAutopipeline

    try {
      if (step === "extract") {
        let offset = 0;
        const perBatch = 3;
        const totalTypes = 26;
        let grandTotal = 0;

        while (true) {
          setExtractionProgress({ current: offset, total: totalTypes });
          setLogs(prev => [...prev, `📦 Extraction types ${offset + 1}–${Math.min(offset + perBatch, totalTypes)}/${totalTypes}...`]);

          const { data, error } = await supabase.functions.invoke("poi-extract", {
            body: { type_offset: offset, types_per_batch: perBatch },
          });

          if (error) throw error;
          if (data?.logs) setLogs(prev => [...prev, ...data.logs]);
          grandTotal += data?.total_inserted ?? 0;
          setStepResult(prev => ({ ...prev, extract: { processed: grandTotal, done: false } }));

          if (data?.next_offset != null) {
            offset = data.next_offset;
          } else {
            break;
          }
        }

        setExtractionProgress({ current: totalTypes, total: totalTypes });
        setLogs(prev => [...prev, `✅ Extraction terminée — ${grandTotal} POIs insérés au total`]);
        setStepResult(prev => ({ ...prev, extract: { processed: grandTotal, done: true } }));
        toast({ title: "Extraction terminée", description: `${grandTotal} POIs insérés.` });
        refetchStats();
        return;
      }

      if (step === "classify") {
        let totalClassified = 0;
        let round = 1;

        while (true) {
          setLogs(prev => [...prev, `📦 Classification batch ${round}...`]);

          const { data, error } = await supabase.functions.invoke("poi-classify-worker", { body: {} });
          if (error) throw error;
          if (data?.logs) setLogs(prev => [...prev, ...data.logs]);
          totalClassified += data?.classified ?? 0;
          setStepResult(prev => ({ ...prev, classify: { processed: totalClassified, done: false } }));

          if ((data?.classified ?? 0) === 0) break;
          round++;
        }

        setLogs(prev => [...prev, `✅ Classification terminée — ${totalClassified} POIs classifiés`]);
        setStepResult(prev => ({ ...prev, classify: { processed: totalClassified, done: true } }));
        toast({ title: "Classification terminée", description: `${totalClassified} POIs classifiés.` });
        refetchStats();
        return;
      }

      if (step === "reclassify") {
        setLogs(prev => [...prev, `🔄 Reset category_ai et poi_quality_score...`]);
        const { error } = await supabase
          .from("medina_pois")
          .update({ category_ai: null, poi_quality_score: null } as any)
          .not("status", "in", '("filtered","merged")');
        if (error) throw error;
        setLogs(prev => [...prev, `✅ Reset effectué. Relancez "Classifier" pour re-classifier.`]);
        setStepResult(prev => ({ ...prev, reclassify: { processed: 0, done: true } }));
        toast({ title: "Reset effectué", description: "Relancez la classification." });
        refetchStats();
        return;
      }

      if (step === "rescore-riads") {
        setLogs(prev => [...prev, `🏠 Reset score des riads pour reclassification...`]);
        const { error } = await supabase
          .from("medina_pois")
          .update({ category_ai: null, poi_quality_score: null } as any)
          .eq("category_ai", "riad");
        if (error) throw error;
        setLogs(prev => [...prev, `✅ Scores riads réinitialisés. Lancement classification...`]);

        let totalClassified = 0;
        let round = 1;
        while (true) {
          setLogs(prev => [...prev, `📦 Re-scoring riads batch ${round}...`]);
          const { data, error: classErr } = await supabase.functions.invoke("poi-classify-worker", { body: {} });
          if (classErr) throw classErr;
          if (data?.logs) setLogs(prev => [...prev, ...data.logs]);
          totalClassified += data?.classified ?? 0;
          setStepResult(prev => ({ ...prev, "rescore-riads": { processed: totalClassified, done: false } }));
          if ((data?.classified ?? 0) === 0) break;
          round++;
        }

        setLogs(prev => [...prev, `✅ Re-scoring riads terminé — ${totalClassified} POIs reclassifiés`]);
        setStepResult(prev => ({ ...prev, "rescore-riads": { processed: totalClassified, done: true } }));
        toast({ title: "Riads re-scorés", description: `${totalClassified} riads reclassifiés avec le nouveau prompt.` });
        refetchStats();
        return;
      }

      if (step === "backfill-details") {
        let totalUpdated = 0;
        let round = 1;

        while (true) {
          setExtractionProgress({ current: totalUpdated, total: active });
          setLogs(prev => [...prev, `📦 Backfill batch ${round}...`]);

          const { data, error } = await supabase.functions.invoke("poi-backfill-details", {
            body: { limit: 10 },
          });

          if (error) throw error;
          if (data?.logs) setLogs(prev => [...prev, ...data.logs]);
          totalUpdated += data?.updated ?? 0;
          setStepResult(prev => ({ ...prev, "backfill-details": { processed: totalUpdated, done: false } }));

          if ((data?.processed ?? 0) === 0 || (data?.updated ?? 0) === 0) break;
          round++;
        }

        setExtractionProgress({ current: totalUpdated, total: active });
        setLogs(prev => [...prev, `✅ Backfill terminé — ${totalUpdated} POIs mis à jour`]);
        setStepResult(prev => ({ ...prev, "backfill-details": { processed: totalUpdated, done: true } }));
        toast({ title: "Backfill terminé", description: `${totalUpdated} POIs enrichis.` });
        refetchStats();
        return;
      }

      if (step === "fetch-photos") {
        let totalFetched = 0;
        let round = 1;

        while (true) {
          setLogs(prev => [...prev, `📷 Photos batch ${round}...`]);

          const { data, error } = await supabase.functions.invoke("poi-fetch-photos", { body: {} });
          if (error) throw error;
          if (data?.logs) setLogs(prev => [...prev, ...data.logs]);
          totalFetched += data?.fetched ?? 0;
          setStepResult(prev => ({ ...prev, "fetch-photos": { processed: totalFetched, done: false } }));

          const remaining = data?.remaining ?? 0;
          if (remaining > 0) {
            setExtractionProgress({ current: totalFetched, total: totalFetched + remaining });
          }

          if ((data?.fetched ?? 0) === 0) break;
          round++;
          await new Promise(r => setTimeout(r, 2000));
        }

        setExtractionProgress(null);
        setLogs(prev => [...prev, `✅ Photos terminé — ${totalFetched} photos récupérées`]);
        setStepResult(prev => ({ ...prev, "fetch-photos": { processed: totalFetched, done: true } }));
        toast({ title: "Photos terminé", description: `${totalFetched} photos Google récupérées.` });
        refetchStats();
        return;
      }

      if (step === "anecdotes") {
        let totalProcessed = 0;
        let round = 1;
        let consecutiveErrors = 0;

        while (true) {
          setLogs(prev => [...prev, `📖 Anecdotes batch ${round}...`]);

          const { data, error } = await invokeWithRetry("anecdote-enricher", { batch_size: 5 });

          if (error) {
            consecutiveErrors++;
            setLogs(prev => [...prev, `⚠️ Erreur batch ${round}: ${error.message}`]);
            if (consecutiveErrors >= 3) { setLogs(prev => [...prev, `❌ 3 erreurs consécutives — arrêt`]); break; }
            await new Promise(r => setTimeout(r, 3000));
            continue;
          }
          consecutiveErrors = 0;
          if (data?.error) { setLogs(prev => [...prev, `⚠️ ${data.error}`]); break; }

          const processed = data?.updated ?? 0;
          const remaining = data?.remaining ?? 0;
          totalProcessed += processed;
          setStepResult(prev => ({ ...prev, "anecdotes": { processed: totalProcessed, done: false } }));
          if (remaining > 0) setExtractionProgress({ current: totalProcessed, total: totalProcessed + remaining });

          if (processed === 0) break;
          round++;
          await new Promise(r => setTimeout(r, 2000));
        }

        setExtractionProgress(null);
        setLogs(prev => [...prev, `✅ Anecdotes terminé — ${totalProcessed} POIs enrichis`]);
        setStepResult(prev => ({ ...prev, "anecdotes": { processed: totalProcessed, done: true } }));
        toast({ title: "Anecdotes générées", description: `${totalProcessed} POIs enrichis.` });
        refetchStats();
        return;
      }

      if (step === "fun-facts") {
        let totalProcessed = 0;
        let round = 1;
        let consecutiveErrors = 0;

        while (true) {
          setLogs(prev => [...prev, `✨ Fun facts batch ${round}...`]);

          const { data, error } = await invokeWithRetry("n8n-proxy", { action: "generate_fun_facts", batch_size: 5 });

          if (error) {
            consecutiveErrors++;
            setLogs(prev => [...prev, `⚠️ Erreur batch ${round}: ${error.message}`]);
            if (consecutiveErrors >= 3) { setLogs(prev => [...prev, `❌ 3 erreurs consécutives — arrêt`]); break; }
            await new Promise(r => setTimeout(r, 3000));
            continue;
          }
          consecutiveErrors = 0;
          if (data?.error) { setLogs(prev => [...prev, `⚠️ ${data.error}`]); break; }

          const processed = data?.generated ?? 0;
          const remaining = data?.total_remaining ?? 0;
          totalProcessed += processed;
          setStepResult(prev => ({ ...prev, "fun-facts": { processed: totalProcessed, done: false } }));
          if (remaining > 0) setExtractionProgress({ current: totalProcessed, total: totalProcessed + remaining });

          if (processed === 0) break;
          round++;
          await new Promise(r => setTimeout(r, 2000));
        }

        setExtractionProgress(null);
        setLogs(prev => [...prev, `✅ Fun facts terminé — ${totalProcessed} POIs enrichis`]);
        setStepResult(prev => ({ ...prev, "fun-facts": { processed: totalProcessed, done: true } }));
        toast({ title: "Fun facts générés", description: `${totalProcessed} POIs enrichis.` });
        refetchStats();
        return;
      }

      if (step === "translate-en") {
        let totalProcessed = 0;
        let round = 1;

        while (true) {
          setLogs(prev => [...prev, `🌐 Traduction batch ${round}...`]);

          const { data, error } = await supabase.functions.invoke("n8n-proxy", {
            body: { action: "translate_pois", batch_size: 5 },
          });

          if (error) throw error;
          if (data?.logs) setLogs(prev => [...prev, ...data.logs]);
          const processed = data?.translated ?? data?.processed ?? data?.updated ?? 0;
          totalProcessed += processed;
          setStepResult(prev => ({ ...prev, "translate-en": { processed: totalProcessed, done: false } }));

          if (processed === 0) break;
          round++;
          await new Promise(r => setTimeout(r, 2000));
        }

        setLogs(prev => [...prev, `✅ Traduction terminée — ${totalProcessed} POIs traduits`]);
        setStepResult(prev => ({ ...prev, "translate-en": { processed: totalProcessed, done: true } }));
        toast({ title: "Traduction terminée", description: `${totalProcessed} POIs traduits en anglais.` });
        refetchStats();
        return;
      }

      if (step === "clean-arabic") {
        setLogs(prev => [...prev, `🔤 Recherche des POIs avec noms en arabe...`]);
        
        // Fetch POIs with Arabic names
        const { data: arabicPois, error: fetchErr } = await supabase
          .from("medina_pois")
          .select("id, name, name_ar, name_fr")
          .filter("name", "like", "%") // get all, filter client-side for regex
          ;
        if (fetchErr) throw fetchErr;
        
        const arabicRegex = /[\u0600-\u06FF]/;
        const hasLatin = /[a-zA-ZÀ-ÿ]/;
        const toTranslate = (arabicPois ?? []).filter((p: any) => arabicRegex.test(p.name));
        
        if (toTranslate.length === 0) {
          setLogs(prev => [...prev, `✅ Aucun nom arabe trouvé — rien à faire`]);
          setStepResult(prev => ({ ...prev, "clean-arabic": { processed: 0, done: true } }));
          return;
        }
        
        setLogs(prev => [...prev, `📋 ${toTranslate.length} POIs avec noms arabes trouvés`]);
        let translated = 0;
        let cleaned = 0;
        
        for (const poi of toTranslate) {
          const name = (poi as any).name as string;
          
          if (hasLatin.test(name)) {
            // Mixed: strip Arabic, keep Latin
            const latinOnly = name.replace(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]+/g, '').replace(/\s+/g, ' ').trim();
            const { error: upErr } = await supabase
              .from("medina_pois")
              .update({ name: latinOnly, name_ar: (poi as any).name_ar || name } as any)
              .eq("id", (poi as any).id);
            if (!upErr) cleaned++;
            setLogs(prev => [...prev, `🧹 "${name}" → "${latinOnly}"`]);
          } else {
            // Pure Arabic: translate via edge function
            try {
              const { data: trData, error: trErr } = await supabase.functions.invoke("translate", {
                body: { text: name, from: "ar", to: "fr" },
              });
              if (trErr) throw trErr;
              const frName = trData?.translated?.trim();
              if (frName) {
                const { error: upErr } = await supabase
                  .from("medina_pois")
                  .update({ name: frName, name_fr: frName, name_ar: (poi as any).name_ar || name } as any)
                  .eq("id", (poi as any).id);
                if (!upErr) translated++;
                setLogs(prev => [...prev, `🌐 "${name}" → "${frName}"`]);
              }
            } catch (e) {
              setLogs(prev => [...prev, `⚠️ Échec traduction: "${name}"`]);
            }
            await new Promise(r => setTimeout(r, 500)); // rate limit
          }
          setStepResult(prev => ({ ...prev, "clean-arabic": { processed: cleaned + translated, done: false } }));
        }
        
        setLogs(prev => [...prev, `✅ Nettoyage terminé — ${cleaned} nettoyés, ${translated} traduits`]);
        setStepResult(prev => ({ ...prev, "clean-arabic": { processed: cleaned + translated, done: true } }));
        toast({ title: "Noms arabes nettoyés", description: `${cleaned} nettoyés, ${translated} traduits.` });
        refetchStats();
        return;
      }

      const fnName = step === "worker" ? "poi-worker"
        : step === "all" ? "poi-pipeline"
        : step === "clean" || step === "merge" ? "poi-pipeline"
        : `poi-${step}`;
      const fnBody = step === "worker" ? {}
        : step === "all" ? { step: "all", limit: 500, batch_size: 5 }
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
      throw e; // re-throw for autopipeline to catch
    }
  };

  const runStep = async (step: StepKey) => {
    if (step === "autopipeline") return runAutopipeline();
    setRunning(step);
    setLogs([`▶ Lancement: ${step}...`]);
    setExtractionProgress(null);
    try {
      await runStepInner(step);
      toast({ title: "Terminé", description: `Étape "${step}" exécutée avec succès.` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setRunning(null);
      setExtractionProgress(null);
    }
  };

  const runAutopipeline = async () => {
    const pipelineSteps: StepKey[] = [
      "extract", "classify", "enrich", "clean", "merge",
      "proximity", "backfill-details", "fetch-photos",
      "anecdotes", "fun-facts", "translate-en",
    ];
    setRunning("autopipeline");
    setLogs(["🚀 Autopipeline démarré..."]);
    setStepResult(prev => ({ ...prev, autopipeline: { processed: 0, done: false } }));
    let completedSteps = 0;

    for (const step of pipelineSteps) {
      setLogs(prev => [...prev, `\n🔄 Autopipeline — étape: ${step}...`]);
      try {
        await runStepInner(step);
        completedSteps++;
        setStepResult(prev => ({ ...prev, autopipeline: { processed: completedSteps, done: false } }));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erreur";
        setLogs(prev => [...prev, `⚠️ ${step} échoué: ${msg} — passage à la suite`]);
      }
    }

    setRunning(null);
    setExtractionProgress(null);
    setStepResult(prev => ({ ...prev, autopipeline: { processed: completedSteps, done: true } }));
    toast({ title: "Autopipeline terminé", description: `${completedSteps}/${pipelineSteps.length} étapes réussies.` });
    refetchStats();
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

      <AgentMonitoringCard />

      <EnrichmentPipelineCard />

      {/* Extraction Progress */}
      {extractionProgress && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground font-medium">Extraction en cours…</span>
              <span className="font-medium text-foreground">{extractionProgress.current}/{extractionProgress.total} types</span>
            </div>
            <Progress value={Math.round(extractionProgress.current / extractionProgress.total * 100)} className="h-2" />
          </CardContent>
        </Card>
      )}

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
          <CardDescription>Le pipeline tourne automatiquement. Ces boutons permettent de forcer une étape dans l'ordre.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {([
              { key: "extract" as StepKey, icon: MapPin, label: "Extraire", desc: "Extrait les POIs depuis OpenStreetMap par types (monuments, restaurants, etc.)", variant: "outline" as const },
              { key: "classify" as StepKey, icon: Tags, label: "Classifier", desc: "Classifie chaque POI par catégorie IA et attribue un score qualité", variant: "outline" as const },
              { key: "worker" as StepKey, icon: Brain, label: "Enrichir", desc: "Enrichit les POIs avec descriptions, contexte historique et métadonnées", variant: "outline" as const },
              { key: "clean" as StepKey, icon: Trash2, label: "Nettoyer", desc: "Supprime les doublons et POIs de faible qualité", variant: "outline" as const },
              { key: "merge" as StepKey, icon: GitMerge, label: "Fusionner", desc: "Fusionne les POIs proches qui désignent le même lieu", variant: "outline" as const },
              { key: "proximity" as StepKey, icon: Route, label: "Proximité", desc: "Calcule les POIs voisins pour chaque point d'intérêt", variant: "outline" as const },
              { key: "backfill-details" as StepKey, icon: Rocket, label: "Backfill", desc: "Récupère prix, horaires et infos pratiques manquantes", variant: "default" as const },
              { key: "fetch-photos" as StepKey, icon: Camera, label: "Photos Google", desc: "Télécharge les photos Google Places pour chaque POI", variant: "secondary" as const },
              { key: "anecdotes" as StepKey, icon: Sparkles, label: "Anecdotes", desc: "Génère anecdotes complètes via Perplexity (history, anecdote FR/EN, accessibilité)", variant: "secondary" as const },
              { key: "fun-facts" as StepKey, icon: Sparkles, label: "Fun facts", desc: "Génère un fait surprenant court (1 phrase) via IA", variant: "secondary" as const },
              { key: "translate-en" as StepKey, icon: Languages, label: "Traduire EN", desc: "Traduit nom, description et histoire en anglais", variant: "secondary" as const },
              { key: "clean-arabic" as StepKey, icon: Languages, label: "Nettoyer arabes", desc: "Supprime les noms arabes et les traduit en français", variant: "destructive" as const },
            ] as const).map(({ key, icon: Icon, label, desc, variant }) => {
              const result = stepResult[key];
              return (
                <div key={key} className="flex items-center gap-3">
                  <Button onClick={() => runStep(key)} disabled={!!running} variant={variant} size="sm" className="gap-1 w-[180px] shrink-0 justify-start">
                    {running === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
                    {label}
                  </Button>
                  <span className="text-sm text-muted-foreground flex-1 min-w-0 truncate">{desc}</span>
                  {result && (
                    <div className="flex items-center gap-2 shrink-0 w-[160px]">
                      {result.done ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {result.processed} traités
                        </span>
                      ) : (
                        <>
                          <Progress value={undefined} className="h-1.5 w-[80px] animate-pulse" />
                          <span className="text-xs text-muted-foreground font-medium">{result.processed} traités</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <Separator className="my-2" />

            {/* Destructive / reset actions */}
            {([
              { key: "reclassify" as StepKey, icon: RefreshCw, label: "Re-classifier", desc: "Réinitialise toutes les classifications pour recommencer", variant: "destructive" as const },
              { key: "rescore-riads" as StepKey, icon: RefreshCw, label: "Re-scorer riads", desc: "Réinitialise et reclassifie uniquement les riads", variant: "secondary" as const },
            ] as const).map(({ key, icon: Icon, label, desc, variant }) => {
              const result = stepResult[key];
              return (
                <div key={key} className="flex items-center gap-3">
                  <Button onClick={() => runStep(key)} disabled={!!running} variant={variant} size="sm" className="gap-1 w-[180px] shrink-0 justify-start">
                    {running === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
                    {label}
                  </Button>
                  <span className="text-sm text-muted-foreground flex-1 min-w-0 truncate">{desc}</span>
                  {result?.done && (
                    <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Terminé
                    </span>
                  )}
                </div>
              );
            })}

            <Separator className="my-2" />

            {/* Global actions */}
            <div className="flex items-center gap-3">
              <Button onClick={() => runStep("autopipeline")} disabled={!!running} size="sm" className="gap-1 w-[180px] shrink-0 justify-start">
                {running === "autopipeline" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                Autopipeline
              </Button>
              <span className="text-sm text-muted-foreground flex-1">Lance toutes les étapes automatiquement dans l'ordre</span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => refetchStats()} className="gap-1 w-[180px] shrink-0 justify-start">
                <RefreshCw className="w-3 h-3" /> Rafraîchir
              </Button>
              <span className="text-sm text-muted-foreground flex-1">Met à jour les statistiques affichées</span>
            </div>
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
