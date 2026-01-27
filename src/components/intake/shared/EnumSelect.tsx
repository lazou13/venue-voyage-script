import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface EnumSelectProps<T extends string> {
  label: string;
  value: T | undefined;
  onChange: (value: T) => void;
  options: Record<T, string>;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

export function EnumSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  placeholder = 'Sélectionner...',
  disabled = false,
  required = false,
}: EnumSelectProps<T>) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Select value={value || ''} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
        <SelectTrigger className={cn(
          "bg-background rounded-xl border-2 border-border/60 transition-colors",
          "hover:border-primary/30 focus:border-primary focus:ring-2 focus:ring-primary/20",
          disabled && "opacity-60"
        )}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-popover z-50 rounded-xl border-border/60 shadow-lg">
          {Object.entries(options).map(([key, labelText]) => (
            <SelectItem 
              key={key} 
              value={key}
              className="rounded-lg cursor-pointer"
            >
              {labelText as string}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
