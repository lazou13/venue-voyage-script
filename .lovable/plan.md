
# Plan : Corriger les checkboxes multi-sélection qui ne fonctionnent pas

## Problème identifié

Le composant `EnumCheckboxGroup` utilise un `<label>` HTML natif qui entoure le `Checkbox` de Radix UI. Cela crée un conflit d'événements :

1. Le `<label>` natif intercepte le clic et tente de toggler l'input interne
2. Le `Checkbox` de Radix gère également le clic via `onCheckedChange`
3. Ces deux comportements entrent en conflit, causant un double-toggle (le checkbox revient à son état initial) ou aucune action

## Solution

Remplacer le `<label>` HTML natif par un `<div>` avec un gestionnaire `onClick` explicite, et gérer le toggle manuellement sans dépendre du comportement natif label/input.

## Fichier à modifier

### src/components/intake/shared/EnumCheckboxGroup.tsx

**Changements :**

1. Remplacer `<label>` par `<div>` avec `role="button"` pour l'accessibilité
2. Ajouter un `onClick` sur le conteneur qui appelle `handleToggle`
3. Passer `onClick={(e) => e.stopPropagation()}` sur le `Checkbox` pour éviter le double-toggle
4. Garder le `Checkbox` comme indicateur visuel uniquement (contrôlé par l'état parent)

**Code final :**

```tsx
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
```

## Changements clés

| Avant | Après |
|-------|-------|
| `<label>` HTML natif | `<div role="button">` |
| Toggle via `onCheckedChange` | Toggle via `onClick` sur le conteneur |
| Conflit label/Radix | Checkbox comme indicateur visuel seul |
| `cursor-pointer` sur label | `cursor-pointer` conditionnel selon `disabled` |

## Vérification après implémentation

1. Ouvrir l'onglet Terrain sur le projet "Nouvel Hôtel"
2. Cliquer sur "Modifier" pour l'étape 2
3. Dans "Possibilités d'étape", cliquer sur "QCM" → doit cocher
4. Cliquer sur "Photo" → doit cocher (maintenant 3 options cochées)
5. Cliquer sur "Énigme" → doit décocher
6. Fermer et rouvrir → vérifier que les sélections persistent
7. Dans "Possibilités de validation", répéter le test avec "QR Code" et "Photo"
