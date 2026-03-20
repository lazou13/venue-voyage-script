import { useState } from 'react';
import { Loader2, Plus, Pencil, Trash2, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { useAppConfigContext } from '@/contexts/AppConfigContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

// Types
interface RuleCondition {
  path: string;
  eq?: any;
  neq?: any;
  exists?: boolean;
}

interface Rule {
  id: string;
  enabled?: boolean;
  when: RuleCondition;
  require?: { path: string };
  level: 'error' | 'warning' | 'info';
  message: string;
}

const LEVEL_CONFIG = {
  error: { icon: AlertCircle, color: 'text-destructive', bgColor: 'bg-destructive/10', label: 'Erreur' },
  warning: { icon: AlertTriangle, color: 'text-yellow-600', bgColor: 'bg-yellow-500/10', label: 'Avertissement' },
  info: { icon: Info, color: 'text-blue-600', bgColor: 'bg-blue-500/10', label: 'Info' },
};

const DEFAULT_RULE: Omit<Rule, 'id'> = {
  enabled: true,
  when: { path: '', eq: true },
  require: { path: '' },
  level: 'error',
  message: '',
};

export default function AdminRules() {
  const { draftPayload, isLoading, updateDraft } = useAppConfigContext();
  const { toast } = useToast();
  
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [whenJson, setWhenJson] = useState('');
  const [requireJson, setRequireJson] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const rules: Rule[] = ((draftPayload as unknown as Record<string, unknown>)?.rules as Rule[] | undefined) || [];

  const handleAddRule = () => {
    const newRule: Rule = {
      ...DEFAULT_RULE,
      id: `rule_${Date.now()}`,
    };
    setEditingRule(newRule);
    setWhenJson(JSON.stringify(newRule.when, null, 2));
    setRequireJson(JSON.stringify(newRule.require || {}, null, 2));
    setJsonError(null);
    setIsDialogOpen(true);
  };

  const handleEditRule = (rule: Rule) => {
    setEditingRule({ ...rule });
    setWhenJson(JSON.stringify(rule.when, null, 2));
    setRequireJson(JSON.stringify(rule.require || {}, null, 2));
    setJsonError(null);
    setIsDialogOpen(true);
  };

  const handleSaveRule = () => {
    if (!editingRule) return;
    
    // Validate ID
    if (!/^[a-z][a-z0-9_]*$/.test(editingRule.id)) {
      toast({ title: 'Erreur', description: 'ID invalide (snake_case requis)', variant: 'destructive' });
      return;
    }
    
    // Validate JSON
    try {
      const parsedWhen = JSON.parse(whenJson);
      const parsedRequire = requireJson.trim() ? JSON.parse(requireJson) : undefined;
      editingRule.when = parsedWhen;
      editingRule.require = parsedRequire;
    } catch (e) {
      setJsonError('JSON invalide');
      return;
    }
    
    if (!editingRule.message.trim()) {
      toast({ title: 'Erreur', description: 'Message requis', variant: 'destructive' });
      return;
    }
    
    updateDraft((prev) => {
      const currentRules: Rule[] = ((prev as unknown as Record<string, unknown>).rules as Rule[] | undefined) || [];
      const existingIndex = currentRules.findIndex(r => r.id === editingRule.id);

      let newRules: Rule[];
      if (existingIndex >= 0) {
        newRules = [...currentRules];
        newRules[existingIndex] = editingRule;
      } else {
        newRules = [...currentRules, editingRule];
      }

      return { ...prev, rules: newRules } as typeof prev;
    });
    
    setIsDialogOpen(false);
    setEditingRule(null);
    toast({ title: 'Règle sauvegardée' });
  };

  const handleDeleteRule = (ruleId: string) => {
    if (!confirm('Supprimer cette règle ?')) return;
    
    updateDraft((prev) => {
      const currentRules: Rule[] = ((prev as unknown as Record<string, unknown>).rules as Rule[] | undefined) || [];
      return { ...prev, rules: currentRules.filter(r => r.id !== ruleId) } as typeof prev;
    });
    
    toast({ title: 'Règle supprimée' });
  };

  const handleToggleEnabled = (ruleId: string, enabled: boolean) => {
    updateDraft((prev) => {
      const currentRules: Rule[] = ((prev as unknown as Record<string, unknown>).rules as Rule[] | undefined) || [];
      return {
        ...prev,
        rules: currentRules.map(r => r.id === ruleId ? { ...r, enabled } : r),
      } as typeof prev;
    });
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
          <h2 className="text-xl font-semibold">Règles de validation</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Définissez les règles conditionnelles pour bloquer/avertir lors de l'export.
          </p>
        </div>
        <Button onClick={handleAddRule} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Ajouter
        </Button>
      </div>

      {rules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Aucune règle configurée.</p>
            <Button onClick={handleAddRule} variant="outline" className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Créer la première
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rules.map((rule) => {
            const levelConfig = LEVEL_CONFIG[rule.level] || LEVEL_CONFIG.error;
            const IconComponent = levelConfig.icon;
            const isEnabled = rule.enabled !== false;
            
            return (
              <Card key={rule.id} className={!isEnabled ? 'opacity-50' : ''}>
                <CardHeader className="py-4 px-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg ${levelConfig.bgColor} flex items-center justify-center`}>
                      <IconComponent className={`w-5 h-5 ${levelConfig.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono">
                          {rule.id}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {levelConfig.label}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="truncate mt-1">
                        {rule.message}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) => handleToggleEnabled(rule.id, checked)}
                      />
                      <Button variant="ghost" size="icon" onClick={() => handleEditRule(rule)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteRule(rule.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule && rules.some(r => r.id === editingRule.id) ? 'Modifier' : 'Nouvelle'} règle
            </DialogTitle>
            <DialogDescription>
              Définissez une condition et l'action à entreprendre.
            </DialogDescription>
          </DialogHeader>

          {editingRule && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rule-id">ID (snake_case)</Label>
                  <Input
                    id="rule-id"
                    value={editingRule.id}
                    onChange={(e) => setEditingRule({ ...editingRule, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                    placeholder="story_narrator_required"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rule-level">Niveau</Label>
                  <Select
                    value={editingRule.level}
                    onValueChange={(value) => setEditingRule({ ...editingRule, level: value as Rule['level'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="error">Erreur (bloquant)</SelectItem>
                      <SelectItem value="warning">Avertissement</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rule-message">Message</Label>
                <Input
                  id="rule-message"
                  value={editingRule.message}
                  onChange={(e) => setEditingRule({ ...editingRule, message: e.target.value })}
                  placeholder="Avatar narrateur requis si storytelling activé"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rule-when">Condition "when" (JSON)</Label>
                <Textarea
                  id="rule-when"
                  value={whenJson}
                  onChange={(e) => {
                    setWhenJson(e.target.value);
                    setJsonError(null);
                  }}
                  className="font-mono text-xs min-h-[100px]"
                  placeholder='{"path": "quest_config.storytelling.enabled", "eq": true}'
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rule-require">Champ requis "require" (JSON, optionnel)</Label>
                <Textarea
                  id="rule-require"
                  value={requireJson}
                  onChange={(e) => {
                    setRequireJson(e.target.value);
                    setJsonError(null);
                  }}
                  className="font-mono text-xs min-h-[80px]"
                  placeholder='{"path": "quest_config.storytelling.narrator.avatar_id"}'
                />
              </div>

              {jsonError && (
                <p className="text-sm text-destructive">{jsonError}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveRule}>
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
