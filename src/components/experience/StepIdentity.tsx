import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
}

export function StepIdentity({ email, name, partySize, honeypot, onEmail, onName, onPartySize, onHoneypot, labels, emailError }: Props) {
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
        <Label htmlFor="party_size">{labels.party_size_label}</Label>
        <Input
          id="party_size"
          type="number"
          min={1}
          max={20}
          value={partySize}
          onChange={(e) => onPartySize(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
        />
      </div>

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
