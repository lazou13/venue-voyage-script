import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Sparkles } from 'lucide-react';

const AUDIENCE_OPTIONS = ['family', 'couple', 'expert', 'group'] as const;
const INTERACTION_OPTIONS = ['observation', 'challenge', 'story', 'puzzle'] as const;

export interface POIFeatures {
  audience: string[];
  difficulty: number;
  walking_effort: number;
  architectural_value: number;
  historical_value: number;
  visual_impact: number;
  interaction_type: string;
}

export const emptyFeatures: POIFeatures = {
  audience: [],
  difficulty: 3,
  walking_effort: 3,
  architectural_value: 5,
  historical_value: 5,
  visual_impact: 5,
  interaction_type: '',
};

interface Props {
  features: POIFeatures;
  onChange: (features: POIFeatures) => void;
  onBlur: () => void;
}

function SliderField({ label, value, max, onChange, onBlur }: {
  label: string; value: number; max: number;
  onChange: (v: number) => void; onBlur: () => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs font-mono text-muted-foreground">{value}/{max}</span>
      </div>
      <Slider
        min={1} max={max} step={1}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        onValueCommit={onBlur}
      />
    </div>
  );
}

export default function POIFeaturesSection({ features, onChange, onBlur }: Props) {
  const set = <K extends keyof POIFeatures>(key: K, value: POIFeatures[K]) =>
    onChange({ ...features, [key]: value });

  const toggleAudience = (tag: string) => {
    const next = features.audience.includes(tag)
      ? features.audience.filter((t) => t !== tag)
      : [...features.audience, tag];
    onChange({ ...features, audience: next });
    // auto-save on toggle
    setTimeout(onBlur, 0);
  };

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5" /> Caractéristiques
      </h3>

      {/* Audience */}
      <div className="space-y-1">
        <Label className="text-xs">Audience</Label>
        <div className="flex flex-wrap gap-1">
          {AUDIENCE_OPTIONS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleAudience(tag)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                features.audience.includes(tag)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted text-muted-foreground border-border hover:bg-accent'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Interaction type */}
      <div className="space-y-1">
        <Label className="text-xs">Type d'interaction</Label>
        <Select
          value={features.interaction_type}
          onValueChange={(v) => { set('interaction_type', v); setTimeout(onBlur, 0); }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Choisir…" />
          </SelectTrigger>
          <SelectContent>
            {INTERACTION_OPTIONS.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Sliders */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <SliderField label="Difficulté" value={features.difficulty} max={5} onChange={(v) => set('difficulty', v)} onBlur={onBlur} />
        <SliderField label="Effort marche" value={features.walking_effort} max={5} onChange={(v) => set('walking_effort', v)} onBlur={onBlur} />
        <SliderField label="Valeur archi." value={features.architectural_value} max={10} onChange={(v) => set('architectural_value', v)} onBlur={onBlur} />
        <SliderField label="Valeur hist." value={features.historical_value} max={10} onChange={(v) => set('historical_value', v)} onBlur={onBlur} />
        <SliderField label="Impact visuel" value={features.visual_impact} max={10} onChange={(v) => set('visual_impact', v)} onBlur={onBlur} />
      </div>
    </div>
  );
}
