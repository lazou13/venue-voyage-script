import { AlertCircle, CheckCircle, Sparkles } from 'lucide-react';
import type { ValidationResult } from '@/types/intake';
import { cn } from '@/lib/utils';

interface ValidationPanelProps {
  validation: ValidationResult;
}

export function ValidationPanel({ validation }: ValidationPanelProps) {
  if (validation.isValid) {
    return (
      <div className="flex items-center gap-3 p-4 bg-success/10 rounded-2xl border border-success/20 animate-fade-in">
        <div className="w-10 h-10 rounded-xl bg-success/20 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-success" />
        </div>
        <div>
          <span className="text-foreground text-sm font-semibold block">
            Prêt pour génération
          </span>
          <span className="text-success/80 text-xs">
            Toutes les données sont complètes
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-warning/10 rounded-2xl border border-warning/20 animate-fade-in">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center">
          <AlertCircle className="w-5 h-5 text-warning" />
        </div>
        <div>
          <span className="text-foreground text-sm font-semibold block">
            Validation incomplète
          </span>
          <span className="text-warning/80 text-xs">
            {validation.errors.length} élément{validation.errors.length > 1 ? 's' : ''} à compléter
          </span>
        </div>
      </div>
      <div className="ml-13 space-y-1.5">
        {validation.errors.slice(0, 5).map((error, i) => (
          <div 
            key={i} 
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-warning/60" />
            <span>{error}</span>
          </div>
        ))}
        {validation.errors.length > 5 && (
          <div className="text-xs text-muted-foreground/70 pl-3.5">
            ... et {validation.errors.length - 5} autre{validation.errors.length - 5 > 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
