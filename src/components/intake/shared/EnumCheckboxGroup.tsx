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
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
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
              className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors select-none ${
                isChecked
                  ? 'bg-primary/10 border-primary'
                  : 'bg-background hover:bg-muted'
              } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <Checkbox
                checked={isChecked}
                disabled={isDisabled}
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
                onCheckedChange={() => {}}
              />
              <span className="text-sm">
                {labelText as string}
                {isRequired && <span className="text-destructive ml-1">*</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
