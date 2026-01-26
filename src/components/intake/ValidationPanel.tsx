import { AlertCircle, CheckCircle } from 'lucide-react';
import type { ValidationResult } from '@/types/intake';

interface ValidationPanelProps {
  validation: ValidationResult;
}

export function ValidationPanel({ validation }: ValidationPanelProps) {
  if (validation.isValid) {
    return (
      <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
        <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
        <span className="text-foreground text-sm font-medium">
          Prêt pour génération
        </span>
      </div>
    );
  }

  return (
    <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
        <span className="text-foreground text-sm font-medium">
          Validation incomplète
        </span>
      </div>
      <ul className="text-muted-foreground text-xs space-y-1 ml-7">
        {validation.errors.map((error, i) => (
          <li key={i}>• {error}</li>
        ))}
      </ul>
    </div>
  );
}
