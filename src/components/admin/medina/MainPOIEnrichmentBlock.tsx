import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Sparkles, Loader2, ExternalLink, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { MedinaPOI } from '@/hooks/useMedinaPOIs';

interface Props {
  poi: MedinaPOI;
  onRefresh: () => void;
}

const TEXT_FIELDS_FR = [
  'history_context','local_anecdote_fr','must_see_details','must_try',
  'must_visit_nearby','photo_tip','best_time_visit','accessibility_notes',
] as const;

const FR_TO_EN: Record<string, string> = {
  history_context: 'history_context_en',
  local_anecdote_fr: 'local_anecdote_en',
  must_see_details: 'must_see_details_en',
  must_try: 'must_try_en',
  must_visit_nearby: 'must_visit_nearby_en',
  photo_tip: 'photo_tip_en',
  best_time_visit: 'best_time_visit_en',
  accessibility_notes: 'accessibility_notes_en',
};

export function MainPOIEnrichmentBlock({ poi, onRefresh }: Props) {
  const { toast } = useToast();
  const [mode, setMode] = useState<'fill_empty' | 'regenerate'>('fill_empty');
  const [incText, setIncText] = useState(true);
  const [incPhotos, setIncPhotos] = useState(true);
  const [incVideos, setIncVideos] = useState(true);
  const [incFunFacts, setIncFunFacts] = useState(true);
  const [running, setRunning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  // Local pre-audit (no network call) — based on the POI object already in state
  const audit = useMemo(() => {
    const has = (k: string) => {
      const v = (poi as any)[k];
      return typeof v === 'string' ? v.trim().length > 0 : !!v;
    };
    const missingFr = TEXT_FIELDS_FR.filter((f) => !has(f));
    const missingEn = Object.values(FR_TO_EN).filter((f) => !has(f));
    const funFacts = Array.isArray((poi as any).fun_facts_bilingual) && (poi as any).fun_facts_bilingual.length > 0;
    const videos = Array.isArray((poi as any).video_urls) && (poi as any).video_urls.length > 0;
    const audioSlots = {
      audio_url_fr: !!(poi as any).audio_url_fr,
      audio_url_en: !!(poi as any).audio_url_en,
      anecdote_audio_url_fr: !!(poi as any).anecdote_audio_url_fr,
      anecdote_audio_url_en: !!(poi as any).anecdote_audio_url_en,
    };
    const audiosFilled = Object.values(audioSlots).filter(Boolean).length;
    return { missingFr, missingEn, funFacts, videos, audioSlots, audiosFilled };
  }, [poi]);

  const lastAt = poi.last_enriched_at ? new Date(poi.last_enriched_at) : null;
  const ago = lastAt ? Math.round((Date.now() - lastAt.getTime()) / 60000) : null;

  // Estimate what fill_empty would actually do (cost guard)
  const wouldDoNothing =
    mode === 'fill_empty' &&
    (!incText || (audit.missingFr.length === 0 && audit.missingEn.length === 0)) &&
    (!incFunFacts || audit.funFacts) &&
    (!incVideos || audit.videos) &&
    !incPhotos;

  const performRun = async () => {
    setRunning(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('poi-enrich-single', {
        body: {
          poi_id: poi.id,
          mode,
          include: { text: incText, photos: incPhotos, videos: incVideos, fun_facts: incFunFacts },
        },
      });
      if (error) throw error;
      const d = data as any;
      if (d?.error) throw new Error(d.error);
      setLastResult(d);
      if (d?.skipped) {
        toast({
          title: 'Aucun appel IA effectué',
          description: d.reason === 'nothing_to_fill'
            ? 'Tous les champs ciblés sont déjà remplis. Aucun coût engagé.'
            : `Skipped: ${d.reason}`,
        });
      } else {
        toast({
          title: 'Enrichissement terminé ✓',
          description: `${d?.text_fields_written ?? 0} champs FR, ${d?.en_fields_written ?? 0} traductions EN, ${d?.videos_added ?? 0} vidéos, ${d?.photos_suggested ?? 0} photos suggérées.`,
        });
      }
      onRefresh();
    } catch (err) {
      toast({ title: 'Erreur enrichissement', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  const onClickRun = () => {
    if (mode === 'regenerate') setConfirmOpen(true);
    else performRun();
  };

  const Stat = ({ ok, label }: { ok: boolean; label: string }) => (
    <div className="flex items-center gap-1.5 text-[11px]">
      {ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-muted-foreground" />}
      <span className={ok ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </div>
  );

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" /> Agent d'enrichissement (Perplexity sonar-pro)
        </h3>
        {lastAt && (
          <span className="text-[11px] text-muted-foreground">
            Dernière exécution : il y a {ago != null && ago < 60 ? `${ago} min` : ago != null ? `${Math.round(ago / 60)} h` : '—'}
          </span>
        )}
      </div>

      {/* Pré-audit local — visible avant tout appel payant */}
      <div className="rounded-md border border-border bg-background/60 p-3 space-y-2">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">État actuel de la fiche</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-1">
          <Stat ok={audit.missingFr.length === 0} label={`Textes FR (${TEXT_FIELDS_FR.length - audit.missingFr.length}/${TEXT_FIELDS_FR.length})`} />
          <Stat ok={audit.missingEn.length === 0} label={`Traductions EN (${Object.keys(FR_TO_EN).length - audit.missingEn.length}/${Object.keys(FR_TO_EN).length})`} />
          <Stat ok={audit.funFacts} label="Fun facts bilingues" />
          <Stat ok={audit.videos} label="Vidéos YouTube" />
          <Stat ok={audit.audiosFilled === 4} label={`Audios (${audit.audiosFilled}/4)`} />
        </div>
        {audit.missingFr.length > 0 && (
          <div className="text-[10px] text-muted-foreground pt-1">
            Manquant FR : {audit.missingFr.join(', ')}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs">Mode</Label>
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="space-y-1">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="fill_empty" id="m-fill" />
              <Label htmlFor="m-fill" className="text-xs font-normal cursor-pointer">Compléter les champs vides (sûr)</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="regenerate" id="m-regen" />
              <Label htmlFor="m-regen" className="text-xs font-normal cursor-pointer text-amber-600">⚠️ Régénérer tout (écrase l'existant)</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Inclure</Label>
          <div className="grid grid-cols-2 gap-1">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Checkbox checked={incText} onCheckedChange={(v) => setIncText(!!v)} /> Texte
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Checkbox checked={incFunFacts} onCheckedChange={(v) => setIncFunFacts(!!v)} /> Fun facts
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Checkbox checked={incPhotos} onCheckedChange={(v) => setIncPhotos(!!v)} /> Photos suggérées
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Checkbox checked={incVideos} onCheckedChange={(v) => setIncVideos(!!v)} /> Vidéos YouTube
            </label>
          </div>
        </div>
      </div>

      {wouldDoNothing && (
        <div className="flex items-start gap-2 text-[11px] rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
          <span>Tous les champs ciblés sont déjà remplis. L'agent ne fera <strong>aucun appel payant</strong>.</span>
        </div>
      )}

      <Button onClick={onClickRun} disabled={running} className="w-full" size="sm" variant={mode === 'regenerate' ? 'destructive' : 'default'}>
        {running ? (
          <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Enrichissement en cours… (~30 s)</>
        ) : (
          <><Sparkles className="w-4 h-4 mr-2" /> {mode === 'regenerate' ? 'Régénérer (destructif)' : 'Compléter les vides'}</>
        )}
      </Button>

      {lastResult?.skipped && (
        <div className="text-[11px] text-emerald-600 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Dernier run : aucun appel IA ({lastResult.reason})
        </div>
      )}

      {lastResult?.citations?.length ? (
        <div className="text-[11px] text-muted-foreground space-y-1">
          <div className="font-medium">Sources ({lastResult.citations.length}) :</div>
          <ul className="space-y-0.5">
            {lastResult.citations.slice(0, 5).map((c: string, i: number) => (
              <li key={i} className="truncate">
                <a href={c} target="_blank" rel="noreferrer" className="hover:text-foreground inline-flex items-center gap-1">
                  <ExternalLink className="w-3 h-3 shrink-0" /> {c}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Régénération destructive
            </AlertDialogTitle>
            <AlertDialogDescription>
              Le mode <strong>Régénérer</strong> va écraser les champs déjà remplis (l'ancienne version est sauvegardée dans <code>metadata.previous_versions</code>).
              <br /><br />
              Cette action consomme l'API Perplexity (~30 s, payant). Confirmer ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmOpen(false); performRun(); }} className="bg-destructive hover:bg-destructive/90">
              Oui, régénérer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
