import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';
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
  
  const handleChange = (lang: SupportedLanguage, text: string) => {
    onChange({ ...value, [lang]: text });
  };

  const getMissingTranslations = (): SupportedLanguage[] => {
    return languages.filter((lang) => lang !== 'fr' && !value[lang]);
  };

  const missingTranslations = getMissingTranslations();
  const isFrEmpty = frRequired && !value.fr;

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
          const isEmpty = !value[lang];
          const isRequired = lang === 'fr' && frRequired;
          
          return (
            <button
              key={lang}
              type="button"
              onClick={() => setActiveTab(lang)}
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
      <div>
        {multiline ? (
          <Textarea
            value={value[activeTab] || ''}
            onChange={(e) => handleChange(activeTab, e.target.value)}
            rows={rows}
            placeholder={placeholder || `Contenu en ${LANGUAGE_LABELS[activeTab]}...`}
            className={isFrEmpty && activeTab === 'fr' ? 'border-destructive' : ''}
          />
        ) : (
          <Input
            value={value[activeTab] || ''}
            onChange={(e) => handleChange(activeTab, e.target.value)}
            placeholder={placeholder || `Texte en ${LANGUAGE_LABELS[activeTab]}...`}
            className={isFrEmpty && activeTab === 'fr' ? 'border-destructive' : ''}
          />
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
