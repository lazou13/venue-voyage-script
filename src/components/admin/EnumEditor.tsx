import { useState } from 'react';
import { Plus, Trash2, AlertCircle, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { EnumItem } from '@/hooks/useCapabilities';

interface ExtraFieldDef {
  key: string;
  label: string;
  placeholder: string;
}

interface EnumEditorProps {
  title: string;
  description?: string;
  items: EnumItem[];
  onChange: (items: EnumItem[]) => void;
  accentColor?: string;
  extraField?: ExtraFieldDef;
}

const SNAKE_CASE_REGEX = /^[a-z][a-z0-9_]*$/;

export function EnumEditor({ 
  title, 
  description, 
  items, 
  onChange,
  accentColor = 'hsl(var(--primary))',
  extraField,
}: EnumEditorProps) {
  const [newId, setNewId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [idError, setIdError] = useState<string | null>(null);

  const validateId = (id: string): string | null => {
    if (!id) return 'ID requis';
    if (!SNAKE_CASE_REGEX.test(id)) {
      return 'ID doit être snake_case (ex: my_value)';
    }
    if (items.some(item => item.id === id)) {
      return 'Cet ID existe déjà';
    }
    return null;
  };

  const [newExtraValue, setNewExtraValue] = useState('');

  const handleAddItem = () => {
    const error = validateId(newId);
    if (error) {
      setIdError(error);
      return;
    }
    if (!newLabel.trim()) {
      setIdError('Label requis');
      return;
    }

    const newItem: EnumItem = { id: newId, label: newLabel.trim() };
    if (extraField && newExtraValue.trim()) {
      (newItem as any)[extraField.key] = newExtraValue.trim();
    }
    onChange([...items, newItem]);
    setNewId('');
    setNewLabel('');
    setNewExtraValue('');
    setIdError(null);
  };

  const handleRemoveItem = (idToRemove: string) => {
    onChange(items.filter(item => item.id !== idToRemove));
  };

  const handleUpdateLabel = (id: string, newLabel: string) => {
    onChange(items.map(item => 
      item.id === id ? { ...item, label: newLabel } : item
    ));
  };

  const handleUpdateExtra = (id: string, value: string) => {
    if (!extraField) return;
    onChange(items.map(item => 
      item.id === id ? { ...item, [extraField.key]: value } : item
    ));
  };

  const handleIdChange = (value: string) => {
    // Auto-convert to lowercase snake_case
    const normalized = value.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
    setNewId(normalized);
    if (normalized) {
      setIdError(validateId(normalized));
    } else {
      setIdError(null);
    }
  };

  return (
    <Card className="border-l-4" style={{ borderLeftColor: accentColor }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
          <Badge variant="secondary" className="text-xs">
            {items.length} valeur{items.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Existing items */}
        <div className="space-y-2">
          {items.map((item) => (
            <div 
              key={item.id} 
              className="flex items-center gap-2 p-2 rounded-md bg-muted/50 group"
            >
              <GripVertical className="w-4 h-4 text-muted-foreground/50 cursor-grab" />
              
              <div className={`flex-1 grid gap-2 ${extraField ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {item.id}
                  </Badge>
                </div>
                <Input
                  value={item.label}
                  onChange={(e) => handleUpdateLabel(item.id, e.target.value)}
                  className="h-8 text-sm"
                  placeholder="Label..."
                />
                {extraField && (
                  <Input
                    value={(item as any)[extraField.key] || ''}
                    onChange={(e) => handleUpdateExtra(item.id, e.target.value)}
                    className="h-8 text-sm"
                    placeholder={extraField.placeholder}
                  />
                )}
              </div>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer cette valeur ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Êtes-vous sûr de vouloir supprimer <strong>{item.id}</strong> ({item.label}) ?
                      Cette action ne peut pas être annulée.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => handleRemoveItem(item.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
          
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune valeur. Ajoutez-en une ci-dessous.
            </p>
          )}
        </div>
        
        {/* Add new item */}
        <div className="pt-2 border-t border-border">
          <Label className="text-xs text-muted-foreground mb-2 block">
            Ajouter une valeur
          </Label>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Input
                value={newId}
                onChange={(e) => handleIdChange(e.target.value)}
                placeholder="id_snake_case"
                className={`h-9 font-mono text-sm ${idError ? 'border-destructive' : ''}`}
              />
              {idError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {idError}
                </p>
              )}
            </div>
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Label affiché"
              className="flex-1 h-9 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
            />
            {extraField && (
              <Input
                value={newExtraValue}
                onChange={(e) => setNewExtraValue(e.target.value)}
                placeholder={extraField.placeholder}
                className="flex-1 h-9 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
              />
            )}
            <Button 
              onClick={handleAddItem} 
              size="sm" 
              className="h-9"
              disabled={!!idError || !newId || !newLabel.trim()}
            >
              <Plus className="w-4 h-4 mr-1" />
              Ajouter
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
