import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Languages, Loader2, Wand2, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { MedinaPOI } from '@/hooks/useMedinaPOIs';

const FIELDS: { fr: keyof MedinaPOI; en: keyof MedinaPOI; label: string; rows?: number }[] = [
  { fr: 'history_context', en: 'history_context_en', label: 'Contexte historique', rows: 4 },
  { fr: 'local_anecdote_fr', en: 'local_anecdote_en', label: 'Anecdote locale', rows: 3 },
  { fr: 'must_see_details', en: 'must_see_details_en', label: 'À voir (détails)', rows: 3 },
  { fr: 'must_try', en: 'must_try_en', label: 'À tester / goûter', rows: 2 },
  { fr: 'must_visit_nearby', en: 'must_visit_nearby_en', label: 'À voir à proximité', rows: 2 },
  { fr: 'photo_tip', en: 'photo_tip_en', label: 'Conseil photo', rows: 2 },
  { fr: 'price_info', en: 'price_info_en', label: 'Tarifs', rows: 1 },
  { fr: 'best_time_visit', en: 'best_time_visit_en', label: 'Meilleur moment', rows: 1 },
  { fr: 'accessibility_notes', en: 'accessibility_notes_en', label: 'Accessibilité', rows: 2 },
  { fr: 'wikipedia_summary', en: 'wikipedia_summary_en', label: 'Résumé Wikipédia', rows: 4 },
];

interface Props {
  poi: MedinaPOI;
  onSave: (patch: Partial<MedinaPOI>) => void;
}

export function BilingualNarrativeBlock({ poi, onSave }: Props) {
  const { toast } = useToast();
  const [local, setLocal] = useState<Partial<MedinaPOI>>({});
  const [translating, setTranslating] = useState<string | null>(null);
  const [translatingAll, setTranslatingAll] = useState(false);

  const get = (k: keyof MedinaPOI): string => {
    if (k in local) return (local[k] as string) ?? '';
    return (poi[k] as string) ?? '';
  };

  const setField = (k: keyof MedinaPOI, v: string) => {
    setLocal((p) => ({ ...p, [k]: v }));
  };

  const flushField = (k: keyof MedinaPOI) => {
    if (k in local) {
      onSave({ [k]: local[k] } as Partial<MedinaPOI>);
      setLocal((p) => {
        const { [k]: _, ...rest } = p;
        return rest;
      });
    }
  };

  const translate = async (frKey: keyof MedinaPOI, enKey: keyof MedinaPOI) => {
    const text = get(frKey);
    if (!text.trim()) {
      toast({ title: 'Champ FR vide', variant: 'destructive' });
      return;
    }
    setTranslating(String(enKey));
    try {
      const { data, error } = await supabase.functions.invoke('translate', {
        body: { text, source_lang: 'fr', target_lang: 'en' },
      });
      if (error) throw error;
      const translated = (data as any)?.translated_text || (data as any)?.translation || (data as any)?.text;
      if (!translated) throw new Error('Aucune traduction reçue');
      setField(enKey, translated);
      onSave({ [enKey]: translated } as Partial<MedinaPOI>);
      toast({ title: 'Traduit en anglais' });
    } catch (err) {
      toast({ title: 'Erreur traduction', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setTranslating(null);
    }
  };

  const translateAll = async () => {
    setTranslatingAll(true);
    let done = 0;
    let failed = 0;
    const patch: Partial<MedinaPOI> = {};
    for (const f of FIELDS) {
      const fr = get(f.fr);
      const en = get(f.en);
      if (fr.trim() && !en.trim()) {
        try {
          const { data, error } = await supabase.functions.invoke('translate', {
            body: { text: fr, source_lang: 'fr', target_lang: 'en' },
          });
          if (error) throw error;
          const t = (data as any)?.translated_text || (data as any)?.translation || (data as any)?.text;
          if (t) {
            patch[f.en] = t as any;
            setField(f.en, t);
            done++;
          }
        } catch {
          failed++;
        }
      }
    }
    if (Object.keys(patch).length) onSave(patch);
    setTranslatingAll(false);
    toast({ title: `Traductions: ${done} ok${failed ? `, ${failed} échec(s)` : ''}` });
  };

  return (
    <div className="space-y-4 rounded-lg border border-border p-4 bg-card">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Languages className="w-4 h-4" /> Contenu narratif bilingue
        </h3>
        <Button size="sm" variant="outline" onClick={translateAll} disabled={translatingAll}>
          {translatingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Wand2 className="w-3.5 h-3.5 mr-1" />}
          Tout retraduire FR → EN
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-2">
        Politique : écrire en français. L'anglais est généré par traduction du français.
      </p>

      <FunFactsBilingualEditor poi={poi} onSave={onSave} />


      {FIELDS.map((f) => {
        const frVal = get(f.fr);
        const enVal = get(f.en);
        const isTranslating = translating === String(f.en);
        return (
          <div key={String(f.fr)} className="space-y-1">
            <Label className="text-xs">{f.label}</Label>
            <div className="grid grid-cols-2 gap-2">
              <Textarea
                value={frVal}
                rows={f.rows ?? 2}
                placeholder="Français…"
                onChange={(e) => setField(f.fr, e.target.value)}
                onBlur={() => flushField(f.fr)}
                className="text-sm"
              />
              <div className="space-y-1">
                <Textarea
                  value={enVal}
                  rows={f.rows ?? 2}
                  placeholder={frVal.trim() ? 'English (traduction)…' : "Renseignez d'abord le FR"}
                  disabled={!frVal.trim()}
                  onChange={(e) => setField(f.en, e.target.value)}
                  onBlur={() => flushField(f.en)}
                  className="text-sm"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs w-full"
                  onClick={() => translate(f.fr, f.en)}
                  disabled={!frVal.trim() || isTranslating}
                >
                  {isTranslating ? (
                    <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Traduction…</>
                  ) : (
                    <><Languages className="w-3 h-3 mr-1" /> Traduire FR → EN</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Fun Facts bilingues ───────────────────────────────────
interface FFItem { fr: string; en: string }

function FunFactsBilingualEditor({ poi, onSave }: { poi: MedinaPOI; onSave: (patch: Partial<MedinaPOI>) => void }) {
  const { toast } = useToast();
  const initial: FFItem[] = Array.isArray((poi as any).fun_facts_bilingual)
    ? ((poi as any).fun_facts_bilingual as FFItem[])
    : [];
  const [items, setItems] = useState<FFItem[]>(initial);
  const [translatingIdx, setTranslatingIdx] = useState<number | null>(null);

  const flush = (next: FFItem[]) => {
    setItems(next);
    onSave({ fun_facts_bilingual: next } as any);
  };
  const update = (i: number, patch: Partial<FFItem>) =>
    setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const flushIdx = () => onSave({ fun_facts_bilingual: items } as any);
  const add = () => flush([...items, { fr: '', en: '' }]);
  const remove = (i: number) => flush(items.filter((_, idx) => idx !== i));

  const translate = async (i: number) => {
    const fr = items[i]?.fr?.trim();
    if (!fr) return;
    setTranslatingIdx(i);
    try {
      const { data, error } = await supabase.functions.invoke('translate', { body: { text: fr, from: 'fr', to: 'en' } });
      if (error) throw error;
      const t = (data as any)?.translated || (data as any)?.translation || (data as any)?.text;
      if (!t) throw new Error('Aucune traduction');
      flush(items.map((it, idx) => (idx === i ? { ...it, en: t } : it)));
    } catch (err) {
      toast({ title: 'Erreur traduction', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setTranslatingIdx(null);
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-dashed border-border p-3 bg-background/50">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">Fun facts (3-5 puces, FR + EN)</Label>
        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={add} disabled={items.length >= 5}>
          <Plus className="w-3 h-3 mr-1" /> Ajouter
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">Aucun fun fact. Cliquez "Ajouter" ou utilisez l'agent IA.</p>
      ) : (
        items.map((it, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start">
            <Input
              value={it.fr}
              onChange={(e) => update(i, { fr: e.target.value })}
              onBlur={flushIdx}
              placeholder="Fait FR (chiffre, date, détail précis)"
              className="h-8 text-xs"
            />
            <div className="space-y-1">
              <Input
                value={it.en}
                onChange={(e) => update(i, { en: e.target.value })}
                onBlur={flushIdx}
                disabled={!it.fr.trim()}
                placeholder={it.fr.trim() ? 'English' : "FR d'abord"}
                className="h-8 text-xs"
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-5 text-[10px] w-full"
                disabled={!it.fr.trim() || translatingIdx === i}
                onClick={() => translate(i)}
              >
                {translatingIdx === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Languages className="w-3 h-3 mr-1" /> Traduire</>}
              </Button>
            </div>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => remove(i)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        ))
      )}
    </div>
  );
}
