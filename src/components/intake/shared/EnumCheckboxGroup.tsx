import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface EnumCheckboxGroupProps<T extends string> {
  label: string;
  values: T[];
  onChange: (values: T[]) => void;
  options: Record<T, string>;
  disabled?: boolean;
  requiredValues?: T[];
}

export function EnumCheckboxGroup<T extends string>({
  label,
  values,
  onChange,
  options,
  disabled = false,
  requiredValues = [],
}: EnumCheckboxGroupProps<T>) {
  const handleToggle = (key: T) => {
    if (disabled || requiredValues.includes(key)) return;
    
    const isCurrentlyChecked = values.includes(key);
    if (isCurrentlyChecked) {
      onChange(values.filter((v) => v !== key));
    } else {
      onChange([...values, key]);
    }
  };

  return (
    <div className="space-y-2.5">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {Object.entries(options).map(([key, labelText]) => {
          const typedKey = key as T;
          const isRequired = requiredValues.includes(typedKey);
          const isChecked = values.includes(typedKey);
          const isDisabled = disabled || isRequired;
          
          return (
            <div
              key={key}
              role="button"
              tabIndex={isDisabled ? -1 : 0}
              onClick={() => handleToggle(typedKey)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleToggle(typedKey);
                }
              }}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all select-none",
                isChecked
                  ? 'bg-primary/10 border-primary text-primary shadow-soft'
                  : 'bg-background border-border/60 hover:border-primary/30 hover:bg-muted/30',
                isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]'
              )}
            >
              <div className={cn(
                "w-4 h-4 rounded-md border-2 flex items-center justify-center transition-colors",
                isChecked 
                  ? "bg-primary border-primary" 
                  : "border-muted-foreground/30 bg-transparent"
              )}>
                {isChecked && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
              </div>
              <span className="text-sm font-medium">
                {labelText as string}
                {isRequired && <span className="text-destructive ml-0.5">*</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
