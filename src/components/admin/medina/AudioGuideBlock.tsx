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

type SlotKey = 'history_fr' | 'history_en' | 'anecdote_fr' | 'anecdote_en';

interface Slot {
  key: SlotKey;
  label: string;
  field: 'audio_url_fr' | 'audio_url_en' | 'anecdote_audio_url_fr' | 'anecdote_audio_url_en';
  sourceField: 'history_context' | 'history_context_en' | 'local_anecdote_fr' | 'local_anecdote_en';
  lang: 'fr' | 'en';
  category: 'history' | 'anecdote';
}

const SLOTS: Slot[] = [
  { key: 'history_fr',  label: 'Histoire FR',  field: 'audio_url_fr',           sourceField: 'history_context',     lang: 'fr', category: 'history' },
  { key: 'history_en',  label: 'Histoire EN',  field: 'audio_url_en',           sourceField: 'history_context_en',  lang: 'en', category: 'history' },
  { key: 'anecdote_fr', label: 'Anecdote FR',  field: 'anecdote_audio_url_fr',  sourceField: 'local_anecdote_fr',   lang: 'fr', category: 'anecdote' },
  { key: 'anecdote_en', label: 'Anecdote EN',  field: 'anecdote_audio_url_en',  sourceField: 'local_anecdote_en',   lang: 'en', category: 'anecdote' },
];

export function AudioGuideBlock({ poi, onRefresh }: Props) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState<SlotKey | null>(null);

  // 🔒 GEL Premium Main: TTS bloqué tant que la revue humaine n'a pas posé le flag de validation texte
  const isPremiumMain = !!(poi as any).is_main_visit;
  const textValidatedAt =
    ((poi as any).metadata as Record<string, unknown> | null | undefined)?.[
      'premium_main_text_validated_at'
    ] as string | null | undefined;
  const ttsLocked = isPremiumMain && !textValidatedAt;

  const generate = async (slot: Slot) => {
    if (ttsLocked) {
      toast({
        title: 'TTS verrouillé (Premium Main)',
        description:
          "Validez d'abord le texte (history_context FR + local_anecdote_fr) puis posez metadata.premium_main_text_validated_at.",
        variant: 'destructive',
      });
      return;
    }
    const text = ((poi as any)[slot.sourceField] as string | null | undefined)?.trim();
    if (!text) {
      toast({
        title: `Texte source manquant (${slot.label})`,
        description: slot.lang === 'en'
          ? "Traduisez d'abord en anglais le champ correspondant."
          : `Renseignez d'abord le champ "${slot.category === 'history' ? 'Contexte historique' : 'Anecdote locale'}".`,
        variant: 'destructive',
      });
      return;
    }

    const ts = Date.now();
    const storage_path = `medina/${poi.id}/${slot.key}_v${ts}.mp3`;

    setGenerating(slot.key);
    try {
      const { error } = await supabase.functions.invoke('generate-poi-audio', {
        body: { poi_id: poi.id, field: slot.field, text, storage_path, language: slot.lang },
      });
      if (error) throw error;
      toast({ title: `Audio "${slot.label}" généré ✓` });
      onRefresh();
    } catch (err) {
      toast({ title: 'Erreur génération audio', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setGenerating(null);
    }
  };

  const renderSlot = (slot: Slot) => {
    const url = (poi as any)[slot.field] as string | null | undefined;
    const isGen = generating === slot.key;
    return (
      <div key={slot.key} className="space-y-2 p-3 rounded-md border border-border bg-background">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">{slot.label}</Label>
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> Ouvrir
            </a>
          ) : null}
        </div>
        {url ? (
          <audio controls src={url} className="w-full h-8" />
        ) : (
          <p className="text-[11px] text-muted-foreground italic">Aucun audio</p>
        )}
        <Button
          size="sm"
          variant={url ? 'outline' : 'default'}
          className="w-full h-7 text-xs"
          disabled={isGen || ttsLocked}
          onClick={() => generate(slot)}
          title={ttsLocked ? 'Verrouillé : validez le texte Premium Main avant TTS' : undefined}
        >
          {isGen ? (
            <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Génération… (~30s)</>
          ) : ttsLocked ? (
            <><Mic className="w-3 h-3 mr-1" /> Verrouillé (Premium Main)</>
          ) : url ? (
            <><RotateCw className="w-3 h-3 mr-1" /> Régénérer</>
          ) : (
            <><Mic className="w-3 h-3 mr-1" /> Générer</>
          )}
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-4 bg-card">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Mic className="w-4 h-4" /> Guides audio (4 pistes)
      </h3>
      <p className="text-[11px] text-muted-foreground -mt-1">
        Pistes séparées par type narratif. Source TTS = texte brut du champ correspondant.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {SLOTS.map(renderSlot)}
      </div>
    </div>
  );
}
