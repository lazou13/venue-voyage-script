import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, AlertCircle, FileJson, Copy, RefreshCw, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { CapabilitiesPayload } from '@/hooks/useCapabilities';

interface AppConfig {
  id: string;
  key: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  payload: CapabilitiesPayload;
  created_at: string;
  updated_at: string;
}

interface ValidationError {
  path: string;
  message: string;
}

// Check if admin mode is enabled (simple flag for now)
const isAdminMode = () => {
  return import.meta.env.VITE_ADMIN_MODE === 'true' || 
         localStorage.getItem('admin_mode') === 'true';
};

export default function AdminConfig() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'published' | 'draft'>('published');
  const [publishedConfig, setPublishedConfig] = useState<AppConfig | null>(null);
  const [draftConfig, setDraftConfig] = useState<AppConfig | null>(null);
  const [draftJson, setDraftJson] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Load configs
  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setIsLoading(true);
    try {
      // Fetch published
      const { data: published } = await supabase
        .from('app_configs')
        .select('*')
        .eq('key', 'capabilities')
        .eq('status', 'published')
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (published) {
        setPublishedConfig(published as unknown as AppConfig);
      }
      
      // Fetch draft
      const { data: draft } = await supabase
        .from('app_configs')
        .select('*')
        .eq('key', 'capabilities')
        .eq('status', 'draft')
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (draft) {
        setDraftConfig(draft as unknown as AppConfig);
        setDraftJson(JSON.stringify(draft.payload, null, 2));
      } else if (published) {
        // Initialize draft from published
        setDraftJson(JSON.stringify(published.payload, null, 2));
      }
    } catch (e) {
      console.error('Failed to load configs:', e);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les configurations',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Validate JSON
  const validatePayload = (jsonStr: string): ValidationError[] => {
    const errors: ValidationError[] = [];
    
    // Try to parse JSON
    let payload: unknown;
    try {
      payload = JSON.parse(jsonStr);
    } catch (e) {
      errors.push({ path: 'root', message: 'JSON invalide: ' + (e as Error).message });
      return errors;
    }
    
    if (!payload || typeof payload !== 'object') {
      errors.push({ path: 'root', message: 'Le payload doit être un objet' });
      return errors;
    }
    
    const p = payload as Record<string, unknown>;
    
    // Check required top-level keys
    if (!p.enums || typeof p.enums !== 'object') {
      errors.push({ path: 'enums', message: 'Clé "enums" requise (objet)' });
    }
    if (!p.decisions || !Array.isArray(p.decisions)) {
      errors.push({ path: 'decisions', message: 'Clé "decisions" requise (tableau)' });
    }
    if (!p.fields || typeof p.fields !== 'object') {
      errors.push({ path: 'fields', message: 'Clé "fields" requise (objet)' });
    }
    
    if (errors.length > 0) return errors;
    
    // Check enum structure
    const enums = p.enums as Record<string, unknown>;
    const requiredEnumKeys = [
      'step_types', 'validation_modes', 'target_audiences', 'play_modes',
      'quest_types', 'languages', 'project_types'
    ];
    
    for (const key of requiredEnumKeys) {
      if (!Array.isArray(enums[key])) {
        errors.push({ path: `enums.${key}`, message: `Enum "${key}" requis (tableau)` });
        continue;
      }
      
      const items = enums[key] as unknown[];
      const seenIds = new Set<string>();
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i] as Record<string, unknown> | null;
        if (!item || typeof item !== 'object') {
          errors.push({ path: `enums.${key}[${i}]`, message: 'Item invalide' });
          continue;
        }
        
        if (typeof item.id !== 'string' || !item.id) {
          errors.push({ path: `enums.${key}[${i}].id`, message: 'ID requis (string)' });
        } else {
          // Check ASCII snake_case
          if (!/^[a-z][a-z0-9_]*$/.test(item.id)) {
            errors.push({ 
              path: `enums.${key}[${i}].id`, 
              message: `ID "${item.id}" doit être snake_case ASCII (a-z, 0-9, _)` 
            });
          }
          // Check unique
          if (seenIds.has(item.id)) {
            errors.push({ path: `enums.${key}[${i}].id`, message: `ID "${item.id}" dupliqué` });
          }
          seenIds.add(item.id);
        }
        
        if (typeof item.label !== 'string' || !item.label) {
          errors.push({ path: `enums.${key}[${i}].label`, message: 'Label requis (string)' });
        }
      }
    }
    
    // Check decisions
    const decisions = p.decisions as unknown[];
    const seenDecisionIds = new Set<string>();
    for (let i = 0; i < decisions.length; i++) {
      const item = decisions[i] as Record<string, unknown> | null;
      if (!item || typeof item !== 'object') {
        errors.push({ path: `decisions[${i}]`, message: 'Item invalide' });
        continue;
      }
      if (typeof item.id !== 'string' || !item.id) {
        errors.push({ path: `decisions[${i}].id`, message: 'ID requis' });
      } else {
        if (!/^[a-z][a-z0-9_]*$/.test(item.id)) {
          errors.push({ path: `decisions[${i}].id`, message: `ID "${item.id}" invalide` });
        }
        if (seenDecisionIds.has(item.id)) {
          errors.push({ path: `decisions[${i}].id`, message: `ID "${item.id}" dupliqué` });
        }
        seenDecisionIds.add(item.id);
      }
    }
    
    return errors;
  };

  const handleValidate = () => {
    const errors = validatePayload(draftJson);
    setValidationErrors(errors);
    
    if (errors.length === 0) {
      toast({ title: '✅ Validation réussie', description: 'Le JSON est valide' });
    } else {
      toast({ 
        title: '❌ Erreurs de validation', 
        description: `${errors.length} erreur(s) trouvée(s)`,
        variant: 'destructive'
      });
    }
  };

  const handleSaveDraft = async () => {
    const errors = validatePayload(draftJson);
    if (errors.length > 0) {
      setValidationErrors(errors);
      toast({ title: 'Erreur', description: 'Corrigez les erreurs avant de sauvegarder', variant: 'destructive' });
      return;
    }
    
    setIsSaving(true);
    try {
      const payload = JSON.parse(draftJson);
      const nextVersion = (publishedConfig?.version || 0) + 1;
      
      if (draftConfig) {
        // Update existing draft
        const { error } = await supabase
          .from('app_configs')
          .update({ payload, updated_at: new Date().toISOString() })
          .eq('id', draftConfig.id);
        
        if (error) throw error;
      } else {
        // Create new draft
        const { error } = await supabase
          .from('app_configs')
          .insert({
            key: 'capabilities',
            version: nextVersion,
            status: 'draft',
            payload,
          });
        
        if (error) throw error;
      }
      
      toast({ title: 'Draft sauvegardé' });
      await loadConfigs();
    } catch (e) {
      console.error('Failed to save draft:', e);
      toast({ title: 'Erreur', description: 'Échec de la sauvegarde', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    const errors = validatePayload(draftJson);
    if (errors.length > 0) {
      setValidationErrors(errors);
      toast({ title: 'Erreur', description: 'Corrigez les erreurs avant de publier', variant: 'destructive' });
      return;
    }
    
    setIsPublishing(true);
    try {
      const payload = JSON.parse(draftJson);
      const nextVersion = (publishedConfig?.version || 0) + 1;
      
      // Archive old published version
      if (publishedConfig) {
        await supabase
          .from('app_configs')
          .update({ status: 'archived' })
          .eq('id', publishedConfig.id);
      }
      
      // Delete draft if exists
      if (draftConfig) {
        await supabase
          .from('app_configs')
          .delete()
          .eq('id', draftConfig.id);
      }
      
      // Create new published version
      const { error } = await supabase
        .from('app_configs')
        .insert({
          key: 'capabilities',
          version: nextVersion,
          status: 'published',
          payload,
        });
      
      if (error) throw error;
      
      toast({ title: '🚀 Publié!', description: `Version ${nextVersion} en production` });
      await loadConfigs();
      setActiveTab('published');
    } catch (e) {
      console.error('Failed to publish:', e);
      toast({ title: 'Erreur', description: 'Échec de la publication', variant: 'destructive' });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopyFromPublished = () => {
    if (publishedConfig) {
      setDraftJson(JSON.stringify(publishedConfig.payload, null, 2));
      setValidationErrors([]);
      toast({ title: 'Copié depuis la version publiée' });
    }
  };

  // Access gate
  if (!isAdminMode()) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Accès restreint
            </CardTitle>
            <CardDescription>
              Cette page est réservée aux administrateurs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour au dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="font-semibold text-foreground flex items-center gap-2">
                  <FileJson className="w-5 h-5" />
                  Configuration Admin
                </h1>
                <p className="text-xs text-muted-foreground">Registre des capacités</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={loadConfigs}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Rafraîchir
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'published' | 'draft')}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="published" className="gap-2">
              <Check className="w-4 h-4" />
              Publié (v{publishedConfig?.version || 0})
            </TabsTrigger>
            <TabsTrigger value="draft" className="gap-2">
              <FileJson className="w-4 h-4" />
              Brouillon
            </TabsTrigger>
          </TabsList>

          <TabsContent value="published">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Version publiée</span>
                  {publishedConfig && (
                    <Badge variant="default">v{publishedConfig.version}</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Configuration actuellement en production (lecture seule)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {publishedConfig ? (
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Dernière mise à jour: {new Date(publishedConfig.updated_at).toLocaleString('fr-FR')}
                    </div>
                    <Textarea
                      value={JSON.stringify(publishedConfig.payload, null, 2)}
                      readOnly
                      className="font-mono text-xs min-h-[400px] bg-muted"
                    />
                  </div>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Aucune configuration publiée</AlertTitle>
                    <AlertDescription>
                      Créez et publiez une configuration depuis l'onglet Brouillon.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="draft">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Éditeur de brouillon</span>
                  <div className="flex gap-2">
                    {publishedConfig && (
                      <Button variant="outline" size="sm" onClick={handleCopyFromPublished}>
                        <Copy className="w-4 h-4 mr-2" />
                        Copier depuis publié
                      </Button>
                    )}
                  </div>
                </CardTitle>
                <CardDescription>
                  Modifiez le JSON et validez avant de publier
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={draftJson}
                  onChange={(e) => {
                    setDraftJson(e.target.value);
                    setValidationErrors([]);
                  }}
                  className="font-mono text-xs min-h-[400px]"
                  placeholder="Entrez le JSON de configuration..."
                />

                {validationErrors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erreurs de validation ({validationErrors.length})</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                        {validationErrors.map((err, i) => (
                          <li key={i}>
                            <code className="bg-destructive/20 px-1 rounded">{err.path}</code>: {err.message}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={handleValidate}>
                    <Check className="w-4 h-4 mr-2" />
                    Valider
                  </Button>
                  <Button variant="secondary" onClick={handleSaveDraft} disabled={isSaving}>
                    {isSaving ? 'Sauvegarde...' : 'Sauvegarder brouillon'}
                  </Button>
                  <Button onClick={handlePublish} disabled={isPublishing}>
                    {isPublishing ? 'Publication...' : '🚀 Publier'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
