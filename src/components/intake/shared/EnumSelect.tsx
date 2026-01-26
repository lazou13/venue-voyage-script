import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

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
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Select value={value || ''} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
        <SelectTrigger className="bg-background">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-popover z-50">
          {Object.entries(options).map(([key, labelText]) => (
            <SelectItem key={key} value={key}>
              {labelText as string}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
