import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { PricingConfig } from '@/lib/calculatePrice';

interface Props {
  pause: boolean;
  onPause: (v: boolean) => void;
  addOns: string[];
  onToggleAddOn: (key: string) => void;
  pricingConfig: PricingConfig | null;
  labels: { pause_label: string };
  locale: string;
}

export function StepOptions({ pause, onPause, addOns, onToggleAddOn, pricingConfig, labels, locale }: Props) {
  const availableAddOns = pricingConfig?.add_ons ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
        <Checkbox
          id="pause"
          checked={pause}
          onCheckedChange={(v) => onPause(v === true)}
        />
        <Label htmlFor="pause" className="text-sm font-medium cursor-pointer">
          ☕ {labels.pause_label}
          {pricingConfig && pricingConfig.pause_supplement > 0 && (
            <span className="text-muted-foreground ml-2">
              (+{pricingConfig.pause_supplement} {pricingConfig.currency})
            </span>
          )}
        </Label>
      </div>

      {availableAddOns.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">Add-ons</h3>
          {availableAddOns.map((ao) => {
            const label = ao.label_i18n[locale] ?? ao.label_i18n.fr ?? ao.key;
            return (
              <div key={ao.key} className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
                <Checkbox
                  id={`addon-${ao.key}`}
                  checked={addOns.includes(ao.key)}
                  onCheckedChange={() => onToggleAddOn(ao.key)}
                />
                <Label htmlFor={`addon-${ao.key}`} className="text-sm font-medium cursor-pointer flex-1">
                  {label}
                  <span className="text-muted-foreground ml-2">
                    (+{ao.price} {pricingConfig?.currency})
                  </span>
                </Label>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
