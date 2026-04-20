import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings2, Plus, X } from 'lucide-react';
import type { MedinaPOI } from '@/hooks/useMedinaPOIs';

const HUB_THEMES = [
  { value: 'histoire', label: 'Histoire' },
  { value: 'architecture', label: 'Architecture' },
  { value: 'artisanat', label: 'Artisanat' },
  { value: 'gastronomie', label: 'Gastronomie' },
  { value: 'spiritualite', label: 'Spiritualité' },
  { value: 'jardins', label: 'Jardins' },
  { value: 'vie_locale', label: 'Vie locale' },
  { value: 'photographie', label: 'Photographie' },
  { value: 'panorama', label: 'Panorama' },
];

const INTERACTION_TYPES = [
  { value: 'audio_guide', label: '🎧 Audio guide' },
  { value: 'quiz',        label: '❓ Quiz' },
  { value: 'riddle',      label: '🧩 Énigme' },
  { value: 'photo_check', label: '📸 Photo check' },
  { value: 'free_visit',  label: '🚶 Visite libre' },
];

interface Props {
  poi: MedinaPOI;
  onSave: (patch: Partial<MedinaPOI>) => Promise<void> | void;
}

export function VisitSettingsBlock({ poi, onSave }: Props) {
  const [hubTheme, setHubTheme] = useState(poi.hub_theme ?? '');
  const [interactionType, setInteractionType] = useState<string>(
    ((poi.step_config as any)?.interaction_type as string) ?? 'audio_guide'
  );
  const [audienceTags, setAudienceTags] = useState<string[]>(((poi as any).audience_tags as string[]) ?? []);
  const [routeTags, setRouteTags] = useState<string[]>(((poi as any).route_tags as string[]) ?? []);
  const [newAudience, setNewAudience] = useState('');
  const [newRoute, setNewRoute] = useState('');

  useEffect(() => {
    setHubTheme(poi.hub_theme ?? '');
    setInteractionType(((poi.step_config as any)?.interaction_type as string) ?? 'audio_guide');
    setAudienceTags(((poi as any).audience_tags as string[]) ?? []);
    setRouteTags(((poi as any).route_tags as string[]) ?? []);
  }, [poi.id]);

  const saveTheme = (v: string) => {
    setHubTheme(v);
    onSave({ hub_theme: v || null });
  };

  const saveInteraction = (v: string) => {
    setInteractionType(v);
    const sc = { ...(poi.step_config as Record<string, unknown> ?? {}), interaction_type: v };
    onSave({ step_config: sc });
  };

  const addTag = (kind: 'audience' | 'route', value: string) => {
    const v = value.trim().toLowerCase().replace(/\s+/g, '_');
    if (!v) return;
    if (kind === 'audience') {
      const next = Array.from(new Set([...audienceTags, v]));
      setAudienceTags(next);
      setNewAudience('');
      onSave({ audience_tags: next } as any);
    } else {
      const next = Array.from(new Set([...routeTags, v]));
      setRouteTags(next);
      setNewRoute('');
      onSave({ route_tags: next } as any);
    }
  };

  const removeTag = (kind: 'audience' | 'route', tag: string) => {
    if (kind === 'audience') {
      const next = audienceTags.filter((t) => t !== tag);
      setAudienceTags(next);
      onSave({ audience_tags: next } as any);
    } else {
      const next = routeTags.filter((t) => t !== tag);
      setRouteTags(next);
      onSave({ route_tags: next } as any);
    }
  };

  const renderTags = (kind: 'audience' | 'route', tags: string[], value: string, setValue: (v: string) => void, placeholder: string) => (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {tags.length === 0 && <span className="text-[11px] text-muted-foreground italic">Aucun tag</span>}
        {tags.map((t) => (
          <Badge key={t} variant="secondary" className="text-[10px] gap-1 pr-1">
            {t}
            <button type="button" onClick={() => removeTag(kind, t)} className="hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-1">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(kind, value); } }}
          placeholder={placeholder}
          className="h-7 text-xs"
        />
        <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={() => addTag(kind, value)}>
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 rounded-lg border border-border p-4 bg-card">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Settings2 className="w-4 h-4" /> Visite — paramètres
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Thème</Label>
          <Select value={hubTheme || ''} onValueChange={saveTheme}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Choisir un thème" /></SelectTrigger>
            <SelectContent>
              {HUB_THEMES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            value={hubTheme}
            onChange={(e) => setHubTheme(e.target.value)}
            onBlur={() => saveTheme(hubTheme)}
            placeholder="…ou saisir un thème libre"
            className="h-7 text-[11px]"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Type d'interaction par défaut</Label>
          <Select value={interactionType} onValueChange={saveInteraction}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {INTERACTION_TYPES.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Tags audience</Label>
          {renderTags('audience', audienceTags, newAudience, setNewAudience, 'famille, couple…')}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Tags parcours</Label>
          {renderTags('route', routeTags, newRoute, setNewRoute, 'incontournable, panorama…')}
        </div>
      </div>
    </div>
  );
}
