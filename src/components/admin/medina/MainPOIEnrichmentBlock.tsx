import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Sparkles, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { MedinaPOI } from '@/hooks/useMedinaPOIs';

interface Props {
  poi: MedinaPOI;
  onRefresh: () => void;
}

export function MainPOIEnrichmentBlock({ poi, onRefresh }: Props) {
  const { toast } = useToast();
  const [mode, setMode] = useState<'fill_empty' | 'regenerate'>('fill_empty');
  const [incText, setIncText] = useState(true);
  const [incPhotos, setIncPhotos] = useState(true);
  const [incVideos, setIncVideos] = useState(true);
  const [incFunFacts, setIncFunFacts] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const lastAt = poi.last_enriched_at ? new Date(poi.last_enriched_at) : null;
  const ago = lastAt ? Math.round((Date.now() - lastAt.getTime()) / 60000) : null;

  const run = async () => {
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
      if ((data as any)?.error) throw new Error((data as any).error);
      setLastResult(data);
      toast({
        title: 'Enrichissement terminé ✓',
        description: `${(data as any)?.text_fields_written ?? 0} champs FR, ${(data as any)?.en_fields_written ?? 0} traductions EN, ${(data as any)?.videos_added ?? 0} vidéos, ${(data as any)?.photos_suggested ?? 0} photos suggérées.`,
      });
      onRefresh();
    } catch (err) {
      toast({ title: 'Erreur enrichissement', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

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
      <p className="text-[11px] text-muted-foreground -mt-1">
        Cible : ce POI uniquement. Écrit en français puis traduit automatiquement en anglais.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs">Mode</Label>
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="space-y-1">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="fill_empty" id="m-fill" />
              <Label htmlFor="m-fill" className="text-xs font-normal cursor-pointer">Compléter les champs vides</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="regenerate" id="m-regen" />
              <Label htmlFor="m-regen" className="text-xs font-normal cursor-pointer">Régénérer tout (versionne l'ancien)</Label>
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

      <Button onClick={run} disabled={running} className="w-full" size="sm">
        {running ? (
          <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Enrichissement en cours… (~30 s)</>
        ) : (
          <><Sparkles className="w-4 h-4 mr-2" /> Lancer l'enrichissement</>
        )}
      </Button>

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
    </div>
  );
}
