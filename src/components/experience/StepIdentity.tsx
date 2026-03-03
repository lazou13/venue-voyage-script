import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Smartphone, Users } from 'lucide-react';
import type { PricingModelConfig } from '@/lib/calculatePrice';

interface Props {
  email: string;
  name: string;
  partySize: number;
  honeypot: string;
  onEmail: (v: string) => void;
  onName: (v: string) => void;
  onPartySize: (v: number) => void;
  onHoneypot: (v: string) => void;
  labels: Record<string, string>;
  emailError: string | null;
  pricingModelConfig?: PricingModelConfig;
}

export function StepIdentity({ email, name, partySize, honeypot, onEmail, onName, onPartySize, onHoneypot, labels, emailError, pricingModelConfig }: Props) {
  const isGroup = pricingModelConfig?.pricing_model === 'group';
  const maxParty = isGroup ? (pricingModelConfig?.party_size_max ?? 20) : 20;

  return (
    <div className="space-y-6 max-w-md">
      <div className="space-y-2">
        <Label htmlFor="email">{labels.email_label}</Label>
        <Input
          id="email"
          type="email"
          placeholder={labels.email_placeholder}
          value={email}
          onChange={(e) => onEmail(e.target.value)}
          className={emailError ? 'border-destructive' : ''}
        />
        {emailError && <p className="text-xs text-destructive">{emailError}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">{labels.name_label}</Label>
        <Input
          id="name"
          placeholder={labels.name_placeholder}
          value={name}
          onChange={(e) => onName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="party_size">
          {labels.party_size_label}
          {isGroup && (
            <span className="text-muted-foreground text-xs ml-1">
              (max {maxParty} — n'affecte pas le prix)
            </span>
          )}
        </Label>
        <Input
          id="party_size"
          type="number"
          min={1}
          max={maxParty}
          value={partySize}
          onChange={(e) => onPartySize(Math.max(1, Math.min(maxParty, Number(e.target.value) || 1)))}
        />
      </div>

      {/* Group mode info */}
      {isGroup && (
        <div className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-muted/50 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            <span>1 seul téléphone pour tout le groupe</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>Jusqu'à {maxParty} participants</span>
          </div>
        </div>
      )}

      {/* Honeypot */}
      <div className="sr-only" aria-hidden="true">
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => onHoneypot(e.target.value)}
        />
      </div>
    </div>
  );
}
