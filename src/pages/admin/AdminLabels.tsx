import { useState } from 'react';
import { Loader2, Plus, Trash2, Globe } from 'lucide-react';
import { useAppConfigContext } from '@/contexts/AppConfigContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

// Types
type UILabels = Record<string, Record<string, string>>;

const DEFAULT_LABEL_KEYS = [
  'save_draft',
  'publish',
  'presets',
  'enums',
  'fields',
  'rules',
  'labels',
  'cancel',
  'confirm',
  'delete',
  'edit',
  'add',
  'search',
  'loading',
  'error',
  'success',
];

const LANGUAGE_NAMES: Record<string, string> = {
  fr: 'Français',
  en: 'English',
  ar: 'العربية',
  es: 'Español',
};

export default function AdminLabels() {
  const { draftPayload, isLoading, updateDraft } = useAppConfigContext();
  const { toast } = useToast();
  
  const [newKey, setNewKey] = useState('');
  const [selectedLang, setSelectedLang] = useState('fr');

  const uiLabels: UILabels = (draftPayload as any)?.ui_labels || {};
  const languages = Object.keys(uiLabels).length > 0 ? Object.keys(uiLabels) : ['fr', 'en'];
  
  // Get all unique keys across all languages
  const allKeys = new Set<string>();
  Object.values(uiLabels).forEach(langLabels => {
    Object.keys(langLabels).forEach(key => allKeys.add(key));
  });
  DEFAULT_LABEL_KEYS.forEach(key => allKeys.add(key));
  const sortedKeys = Array.from(allKeys).sort();

  const handleUpdateLabel = (lang: string, key: string, value: string) => {
    updateDraft((prev) => {
      const currentLabels: UILabels = (prev as any).ui_labels || {};
      return {
        ...prev,
        ui_labels: {
          ...currentLabels,
          [lang]: {
            ...currentLabels[lang],
            [key]: value,
          },
        },
      } as any;
    });
  };

  const handleAddKey = () => {
    const sanitizedKey = newKey.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!sanitizedKey) {
      toast({ title: 'Erreur', description: 'Clé invalide', variant: 'destructive' });
      return;
    }
    
    if (allKeys.has(sanitizedKey)) {
      toast({ title: 'Erreur', description: 'Cette clé existe déjà', variant: 'destructive' });
      return;
    }
    
    // Add empty value for all languages
    updateDraft((prev) => {
      const currentLabels: UILabels = (prev as any).ui_labels || {};
      const newLabels = { ...currentLabels };
      
      languages.forEach(lang => {
        newLabels[lang] = {
          ...newLabels[lang],
          [sanitizedKey]: '',
        };
      });
      
      return { ...prev, ui_labels: newLabels } as any;
    });
    
    setNewKey('');
    toast({ title: 'Clé ajoutée' });
  };

  const handleDeleteKey = (key: string) => {
    if (!confirm(`Supprimer la clé "${key}" de toutes les langues ?`)) return;
    
    updateDraft((prev) => {
      const currentLabels: UILabels = (prev as any).ui_labels || {};
      const newLabels = { ...currentLabels };
      
      Object.keys(newLabels).forEach(lang => {
        const { [key]: _, ...rest } = newLabels[lang];
        newLabels[lang] = rest;
      });
      
      return { ...prev, ui_labels: newLabels } as any;
    });
    
    toast({ title: 'Clé supprimée' });
  };

  const handleAddLanguage = () => {
    const newLang = prompt('Code de langue (ex: de, it, pt):');
    if (!newLang || !/^[a-z]{2,3}$/.test(newLang)) {
      toast({ title: 'Erreur', description: 'Code de langue invalide', variant: 'destructive' });
      return;
    }
    
    if (languages.includes(newLang)) {
      toast({ title: 'Erreur', description: 'Cette langue existe déjà', variant: 'destructive' });
      return;
    }
    
    updateDraft((prev) => {
      const currentLabels: UILabels = (prev as any).ui_labels || {};
      return {
        ...prev,
        ui_labels: {
          ...currentLabels,
          [newLang]: {},
        },
      } as any;
    });
    
    setSelectedLang(newLang);
    toast({ title: 'Langue ajoutée' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Labels UI</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Traduisez les textes de l'interface utilisateur.
          </p>
        </div>
        <Button onClick={handleAddLanguage} variant="outline" size="sm">
          <Globe className="w-4 h-4 mr-2" />
          Ajouter langue
        </Button>
      </div>

      <Tabs value={selectedLang} onValueChange={setSelectedLang}>
        <TabsList>
          {languages.map(lang => (
            <TabsTrigger key={lang} value={lang} className="gap-2">
              <span className="font-mono text-xs">{lang.toUpperCase()}</span>
              <span className="text-muted-foreground">
                {LANGUAGE_NAMES[lang] || lang}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {languages.map(lang => (
          <TabsContent key={lang} value={lang} className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  {LANGUAGE_NAMES[lang] || lang}
                </CardTitle>
                <CardDescription>
                  {Object.keys(uiLabels[lang] || {}).length} traductions définies
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Add new key */}
                <div className="flex gap-2 pb-4 border-b border-border">
                  <Input
                    placeholder="nouvelle_cle"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    className="font-mono text-sm flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddKey()}
                  />
                  <Button onClick={handleAddKey} size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter
                  </Button>
                </div>

                {/* Labels list */}
                <div className="space-y-2">
                  {sortedKeys.map(key => (
                    <div key={key} className="flex items-center gap-3 py-1">
                      <code className="text-xs bg-muted px-2 py-1 rounded font-mono min-w-[140px]">
                        {key}
                      </code>
                      <Input
                        value={uiLabels[lang]?.[key] || ''}
                        onChange={(e) => handleUpdateLabel(lang, key, e.target.value)}
                        placeholder={`Traduction ${lang.toUpperCase()}...`}
                        className="text-sm flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteKey(key)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
