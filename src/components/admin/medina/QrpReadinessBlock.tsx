import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { MedinaPOI } from '@/hooks/useMedinaPOIs';

const FAMILIES = [
  'monuments_historiques',
  'art_artisanat',
  'gastronomie',
  'spiritualite',
  'shopping_souks',
  'jardins_nature',
  'photo_spots',
  'street_food',
] as const;

const TIERS = ['premium', 'standard', 'mention'] as const;
type Tier = typeof TIERS[number];

interface ReadinessRow {
  poi_id: string;
  real_category: string | null;
  visit_families: string[] | null;
  tier_by_family: Record<string, string> | null;
  ready_by_family: Record<string, boolean> | null;
  enrichment_gaps_by_family: Record<string, string[]> | null;
}

interface Props {
  poi: MedinaPOI;
  realCategory: string | null;
  setRealCategory: (v: string) => void;
  saveRealCategory: () => void;
  setMeta: (key: string, value: unknown) => void;
  save: (overrides?: Partial<MedinaPOI>) => void;
}

export function QrpReadinessBlock({ poi, realCategory, setRealCategory, saveRealCategory, setMeta, save }: Props) {
  const meta = (poi.metadata ?? {}) as Record<string, unknown>;
  const visitFamilies: string[] = Array.isArray(meta.visit_families)
    ? (meta.visit_families as string[])
    : [];
  const tierByFamily: Record<string, string> = (meta.tier_by_family && typeof meta.tier_by_family === 'object')
    ? (meta.tier_by_family as Record<string, string>)
    : {};

  const [readiness, setReadiness] = useState<ReadinessRow | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (supabase.from('v_poi_qrp_readiness' as any) as any)
      .select('*')
      .eq('poi_id', poi.id)
      .maybeSingle()
      .then(({ data }: any) => {
        if (!cancelled) {
          setReadiness(data ?? null);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [poi.id, poi.updated_at]);

  const toggleFamily = (family: string, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...visitFamilies, family]))
      : visitFamilies.filter((f) => f !== family);
    const nextTiers = { ...tierByFamily };
    if (!checked) delete nextTiers[family];
    const nextMeta = { ...meta, visit_families: next, tier_by_family: nextTiers };
    setMeta('visit_families', next);
    setMeta('tier_by_family', nextTiers);
    save({ metadata: nextMeta });
  };

  const setTier = (family: string, tier: Tier) => {
    const nextTiers = { ...tierByFamily, [family]: tier };
    const nextMeta = { ...meta, tier_by_family: nextTiers };
    setMeta('tier_by_family', nextTiers);
    save({ metadata: nextMeta });
  };

  return (
    <div className="space-y-4 rounded-lg border border-border p-4 bg-card">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">QRP Readiness — Catégorisation produit</h3>
        {loading && <span className="text-xs text-muted-foreground">…</span>}
      </div>

      {/* Real category */}
      <div>
        <Label className="text-xs">Real category (ce que le lieu EST)</Label>
        <Input
          value={realCategory ?? ''}
          placeholder="ex: monument, mosque, museum, restaurant, shop, garden…"
          onChange={(e) => setRealCategory(e.target.value)}
          onBlur={saveRealCategory}
          className="mt-1"
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          Stable et éditable. Initialisé à la valeur de <code>category</code>.
          Différent de <code>category</code> (legacy) qui reste inchangé.
        </p>
      </div>

      {/* Visit families + tier */}
      <div>
        <Label className="text-xs">Familles de visite (où le lieu SERT) + tier produit</Label>
        <div className="mt-2 space-y-1.5">
          {FAMILIES.map((family) => {
            const active = visitFamilies.includes(family);
            const tier = tierByFamily[family] as Tier | undefined;
            const ready = readiness?.ready_by_family?.[family];
            const gaps = readiness?.enrichment_gaps_by_family?.[family] ?? [];
            return (
              <div key={family} className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={active}
                  onCheckedChange={(v) => toggleFamily(family, !!v)}
                  id={`vf-${family}`}
                />
                <label htmlFor={`vf-${family}`} className="flex-1 cursor-pointer">
                  {family}
                </label>
                {active && (
                  <>
                    <Select value={tier ?? ''} onValueChange={(v) => setTier(family, v as Tier)}>
                      <SelectTrigger className="h-7 w-28 text-xs">
                        <SelectValue placeholder="tier…" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIERS.map((t) => (
                          <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {ready === true && (
                      <Badge variant="outline" className="gap-1 border-green-500/50 text-green-600">
                        <CheckCircle2 className="w-3 h-3" /> ready
                      </Badge>
                    )}
                    {ready === false && (
                      <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-600" title={gaps.join(', ')}>
                        <AlertCircle className="w-3 h-3" /> {gaps.length} gap{gaps.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Read-only readiness summary */}
      {readiness && visitFamilies.length > 0 && (
        <details className="text-[11px] text-muted-foreground">
          <summary className="cursor-pointer">Détail v_poi_qrp_readiness</summary>
          <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto">
{JSON.stringify({
  ready_by_family: readiness.ready_by_family,
  enrichment_gaps_by_family: readiness.enrichment_gaps_by_family,
}, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
