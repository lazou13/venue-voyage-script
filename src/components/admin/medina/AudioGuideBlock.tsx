import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Mic, Loader2, RotateCw, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { MedinaPOI } from '@/hooks/useMedinaPOIs';

interface Props {
  poi: MedinaPOI;
  onRefresh: () => void;
}

export function AudioGuideBlock({ poi, onRefresh }: Props) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState<'fr' | 'en' | null>(null);

  const generate = async (lang: 'fr' | 'en') => {
    const sourceText = lang === 'fr'
      ? [poi.history_context, poi.local_anecdote_fr].filter(Boolean).join('\n\n')
      : [poi.history_context_en, poi.local_anecdote_en].filter(Boolean).join('\n\n');

    if (!sourceText.trim()) {
      toast({
        title: lang === 'en' ? 'Texte EN manquant' : 'Texte FR manquant',
        description: lang === 'en' ? "Traduisez d'abord en anglais." : 'Renseignez le contexte historique ou l\'anecdote.',
        variant: 'destructive',
      });
      return;
    }

    setGenerating(lang);
    try {
      const { data, error } = await supabase.functions.invoke('generate-poi-audio', {
        body: { poi_id: poi.id, language: lang, text: sourceText },
      });
      if (error) throw error;
      toast({ title: `Audio ${lang.toUpperCase()} généré` });
      onRefresh();
    } catch (err) {
      toast({ title: 'Erreur génération audio', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setGenerating(null);
    }
  };

  const renderLang = (lang: 'fr' | 'en') => {
    const url = lang === 'fr' ? poi.audio_url_fr : poi.audio_url_en;
    const isGen = generating === lang;
    const label = lang === 'fr' ? 'Français' : 'English';
    return (
      <div className="space-y-2 p-3 rounded-md border border-border bg-background">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">{label}</Label>
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> Ouvrir
            </a>
          ) : null}
        </div>
        {url ? (
          <audio controls src={url} className="w-full h-8" />
        ) : (
          <p className="text-xs text-muted-foreground italic">Aucun audio</p>
        )}
        <Button
          size="sm"
          variant={url ? 'outline' : 'default'}
          className="w-full h-7 text-xs"
          disabled={isGen}
          onClick={() => generate(lang)}
        >
          {isGen ? (
            <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Génération… (~30s)</>
          ) : url ? (
            <><RotateCw className="w-3 h-3 mr-1" /> Régénérer {label}</>
          ) : (
            <><Mic className="w-3 h-3 mr-1" /> Générer {label}</>
          )}
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-4 bg-card">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Mic className="w-4 h-4" /> Guides audio
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {renderLang('fr')}
        {renderLang('en')}
      </div>
    </div>
  );
}
