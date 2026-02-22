import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { I18nText, SupportedLanguage } from '@/types/intake';
import { LANGUAGE_LABELS } from '@/types/intake';

interface I18nInputProps {
  label: string;
  value: I18nText;
  onChange: (value: I18nText) => void;
  languages: SupportedLanguage[];
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  frRequired?: boolean;
}

export function I18nInput({
  label,
  value,
  onChange,
  languages,
  multiline = false,
  rows = 3,
  placeholder,
  frRequired = true,
}: I18nInputProps) {
  const [activeTab, setActiveTab] = useState<SupportedLanguage>('fr');
  const [localValue, setLocalValue] = useState<I18nText>(value);
  const [isTranslating, setIsTranslating] = useState(false);
  const [autoTranslated, setAutoTranslated] = useState<Set<SupportedLanguage>>(new Set());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (lang: SupportedLanguage, text: string) => {
    const newValue = { ...localValue, [lang]: text };
    setLocalValue(newValue);
    // Remove auto-translated badge if user edits
    if (autoTranslated.has(lang)) {
      setAutoTranslated(prev => {
        const next = new Set(prev);
        next.delete(lang);
        return next;
      });
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      onChange(newValue);
    }, 500);
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleTabClick = async (lang: SupportedLanguage) => {
    setActiveTab(lang);

    // Auto-translate if: not french, target empty, french filled
    if (lang !== 'fr' && !localValue[lang] && localValue.fr?.trim()) {
      setIsTranslating(true);
      try {
        const { data, error } = await supabase.functions.invoke('translate', {
          body: { text: localValue.fr, from: 'fr', to: lang },
        });

        if (error) throw error;
        if (data?.translated) {
          const newValue = { ...localValue, [lang]: data.translated };
          setLocalValue(newValue);
          onChange(newValue);
          setAutoTranslated(prev => new Set(prev).add(lang));
        }
      } catch (e: any) {
        console.error('Translation error:', e);
        toast({
          title: 'Erreur de traduction',
          description: e?.message || 'Impossible de traduire automatiquement.',
          variant: 'destructive',
        });
      } finally {
        setIsTranslating(false);
      }
    }
  };

  const getMissingTranslations = (): SupportedLanguage[] => {
    return languages.filter((lang) => lang !== 'fr' && !localValue[lang]);
  };

  const missingTranslations = getMissingTranslations();
  const isFrEmpty = frRequired && !localValue.fr;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">
          {label}
          {frRequired && <span className="text-destructive ml-1">*</span>}
        </Label>
        {missingTranslations.length > 0 && (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            {missingTranslations.length} traduction(s) manquante(s)
          </Badge>
        )}
      </div>

      {/* Language tabs */}
      <div className="flex gap-1 border-b">
        {languages.map((lang) => {
          const isEmpty = !localValue[lang];
          const isRequired = lang === 'fr' && frRequired;

          return (
            <button
              key={lang}
              type="button"
              onClick={() => handleTabClick(lang)}
              className={`px-3 py-1.5 text-sm border-b-2 transition-colors ${
                activeTab === lang
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {LANGUAGE_LABELS[lang]}
              {isEmpty && !isRequired && (
                <span className="ml-1 text-muted-foreground">○</span>
              )}
              {isEmpty && isRequired && (
                <span className="ml-1 text-destructive">●</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Input for active language */}
      <div className="relative">
        {isTranslating ? (
          <div className="flex items-center gap-2 p-4 rounded-md border border-border bg-muted/30 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Traduction en cours...</span>
          </div>
        ) : (
          <>
            {multiline ? (
              <Textarea
                value={localValue[activeTab] || ''}
                onChange={(e) => handleChange(activeTab, e.target.value)}
                rows={rows}
                placeholder={placeholder || `Contenu en ${LANGUAGE_LABELS[activeTab]}...`}
                className={isFrEmpty && activeTab === 'fr' ? 'border-destructive' : ''}
              />
            ) : (
              <Input
                value={localValue[activeTab] || ''}
                onChange={(e) => handleChange(activeTab, e.target.value)}
                placeholder={placeholder || `Texte en ${LANGUAGE_LABELS[activeTab]}...`}
                className={isFrEmpty && activeTab === 'fr' ? 'border-destructive' : ''}
              />
            )}
            {autoTranslated.has(activeTab) && (
              <div className="flex items-center gap-1 mt-1">
                <Badge variant="secondary" className="text-xs gap-1">
                  <Sparkles className="w-3 h-3" />
                  Traduction auto — modifiable
                </Badge>
              </div>
            )}
          </>
        )}
        {isFrEmpty && activeTab === 'fr' && (
          <p className="text-xs text-destructive mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Le français est obligatoire
          </p>
        )}
      </div>
    </div>
  );
}
