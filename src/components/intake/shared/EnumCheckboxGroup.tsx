import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

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
  const handleToggle = (key: T, checked: boolean) => {
    if (requiredValues.includes(key)) return; // Can't uncheck required values
    
    if (checked) {
      onChange([...values, key]);
    } else {
      onChange(values.filter((v) => v !== key));
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <div className="flex flex-wrap gap-3">
        {Object.entries(options).map(([key, labelText]) => {
          const isRequired = requiredValues.includes(key as T);
          const isChecked = values.includes(key as T);
          
          return (
            <label
              key={key}
              className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
                isChecked
                  ? 'bg-primary/10 border-primary'
                  : 'bg-background hover:bg-muted'
              } ${disabled || isRequired ? 'opacity-75' : ''}`}
            >
              <Checkbox
                checked={isChecked}
                onCheckedChange={(checked) => handleToggle(key as T, !!checked)}
                disabled={disabled || isRequired}
              />
              <span className="text-sm">
                {labelText as string}
                {isRequired && <span className="text-destructive ml-1">*</span>}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
