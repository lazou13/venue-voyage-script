import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Save, Globe, GlobeLock, Plus, Trash2 } from 'lucide-react';

type PageConfig = {
  hero: { title: string; subtitle: string; cta_label: string; benefits: { icon: string; text: string }[] };
  steps: { id: string; title: string; subtitle: string }[];
  modes: { key: string; emoji: string; label: string; desc: string }[];
  durations: { value: number; label: string; desc: string }[];
  labels: Record<string, string>;
  unavailable_message: string;
};

export default function AdminExperiencePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rowId, setRowId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('draft');
  const [config, setConfig] = useState<PageConfig | null>(null);
  const [jsonMode, setJsonMode] = useState(false);
  const [rawJson, setRawJson] = useState('');

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('app_configs')
        .select('id, created_at, updated_at, key, status, version, payload')
        .eq('key', 'experience_page_config')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setRowId(data.id);
        setStatus(data.status);
        const p = data.payload as unknown as PageConfig;
        setConfig(p);
        setRawJson(JSON.stringify(p, null, 2));
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      let payload = config;
      if (jsonMode) {
        payload = JSON.parse(rawJson);
        setConfig(payload);
      }
      if (rowId) {
        const { error } = await supabase.from('app_configs').update({ payload: payload as any, updated_at: new Date().toISOString() }).eq('id', rowId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('app_configs').insert({ key: 'experience_page_config', status: 'draft', payload: payload as any }).select('id').single();
        if (error) throw error;
        setRowId(data.id);
        setStatus('draft');
      }
      toast({ title: 'Sauvegardé' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!rowId) return;
    const newStatus = status === 'published' ? 'draft' : 'published';
    const { error } = await supabase.from('app_configs').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', rowId);
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    setStatus(newStatus);
    toast({ title: newStatus === 'published' ? 'Publié ✓' : 'Dépublié' });
  };

  const upd = (fn: (c: PageConfig) => PageConfig) => {
    if (!config) return;
    const next = fn({ ...config });
    setConfig(next);
    setRawJson(JSON.stringify(next, null, 2));
  };

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;

  if (!config) return <div className="p-6"><p className="text-muted-foreground">Aucune configuration trouvée. Lancez la migration seed.</p></div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Page Expérience</h1>
          <Badge variant={status === 'published' ? 'default' : 'secondary'} className="mt-1">
            {status === 'published' ? 'Publié' : 'Brouillon'}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setJsonMode(!jsonMode)}>
            {jsonMode ? 'Éditeur' : 'JSON'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleTogglePublish} disabled={!rowId}>
            {status === 'published' ? <><GlobeLock className="w-4 h-4 mr-1" /> Dépublier</> : <><Globe className="w-4 h-4 mr-1" /> Publier</>}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> {saving ? '...' : 'Sauvegarder'}
          </Button>
        </div>
      </div>

      {jsonMode ? (
        <Card>
          <CardContent className="pt-6">
            <Textarea value={rawJson} onChange={(e) => setRawJson(e.target.value)} rows={30} className="font-mono text-xs" />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Hero */}
          <Card>
            <CardHeader><CardTitle>Hero</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Titre</Label>
                <Input value={config.hero.title} onChange={(e) => upd(c => ({ ...c, hero: { ...c.hero, title: e.target.value } }))} />
              </div>
              <div className="space-y-2">
                <Label>Sous-titre</Label>
                <Input value={config.hero.subtitle} onChange={(e) => upd(c => ({ ...c, hero: { ...c.hero, subtitle: e.target.value } }))} />
              </div>
              <div className="space-y-2">
                <Label>CTA</Label>
                <Input value={config.hero.cta_label} onChange={(e) => upd(c => ({ ...c, hero: { ...c.hero, cta_label: e.target.value } }))} />
              </div>
              <div className="space-y-2">
                <Label>Avantages</Label>
                {config.hero.benefits.map((b, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input className="w-24" placeholder="icon" value={b.icon} onChange={(e) => upd(c => {
                      const benefits = [...c.hero.benefits];
                      benefits[i] = { ...benefits[i], icon: e.target.value };
                      return { ...c, hero: { ...c.hero, benefits } };
                    })} />
                    <Input placeholder="texte" value={b.text} onChange={(e) => upd(c => {
                      const benefits = [...c.hero.benefits];
                      benefits[i] = { ...benefits[i], text: e.target.value };
                      return { ...c, hero: { ...c.hero, benefits } };
                    })} />
                    <Button variant="ghost" size="icon" onClick={() => upd(c => ({ ...c, hero: { ...c.hero, benefits: c.hero.benefits.filter((_, j) => j !== i) } }))}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => upd(c => ({ ...c, hero: { ...c.hero, benefits: [...c.hero.benefits, { icon: 'star', text: '' }] } }))}>
                  <Plus className="w-4 h-4 mr-1" /> Ajouter
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Modes */}
          <Card>
            <CardHeader><CardTitle>Modes</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {config.modes.map((m, i) => (
                <div key={i} className="grid grid-cols-4 gap-2">
                  <Input placeholder="key" value={m.key} onChange={(e) => upd(c => { const modes = [...c.modes]; modes[i] = { ...modes[i], key: e.target.value }; return { ...c, modes }; })} />
                  <Input placeholder="emoji" value={m.emoji} onChange={(e) => upd(c => { const modes = [...c.modes]; modes[i] = { ...modes[i], emoji: e.target.value }; return { ...c, modes }; })} />
                  <Input placeholder="label" value={m.label} onChange={(e) => upd(c => { const modes = [...c.modes]; modes[i] = { ...modes[i], label: e.target.value }; return { ...c, modes }; })} />
                  <Input placeholder="desc" value={m.desc} onChange={(e) => upd(c => { const modes = [...c.modes]; modes[i] = { ...modes[i], desc: e.target.value }; return { ...c, modes }; })} />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Durations */}
          <Card>
            <CardHeader><CardTitle>Durées</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {config.durations.map((d, i) => (
                <div key={i} className="grid grid-cols-3 gap-2">
                  <Input type="number" placeholder="minutes" value={d.value} onChange={(e) => upd(c => { const durations = [...c.durations]; durations[i] = { ...durations[i], value: Number(e.target.value) }; return { ...c, durations }; })} />
                  <Input placeholder="label" value={d.label} onChange={(e) => upd(c => { const durations = [...c.durations]; durations[i] = { ...durations[i], label: e.target.value }; return { ...c, durations }; })} />
                  <Input placeholder="desc" value={d.desc} onChange={(e) => upd(c => { const durations = [...c.durations]; durations[i] = { ...durations[i], desc: e.target.value }; return { ...c, durations }; })} />
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => upd(c => ({ ...c, durations: [...c.durations, { value: 60, label: '1h', desc: '' }] }))}>
                <Plus className="w-4 h-4 mr-1" /> Ajouter
              </Button>
            </CardContent>
          </Card>

          {/* Labels */}
          <Card>
            <CardHeader><CardTitle>Labels</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(config.labels).map(([key, val]) => (
                <div key={key} className="grid grid-cols-3 gap-2 items-center">
                  <Label className="text-xs text-muted-foreground col-span-1">{key}</Label>
                  <Input className="col-span-2" value={val} onChange={(e) => upd(c => ({ ...c, labels: { ...c.labels, [key]: e.target.value } }))} />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Unavailable message */}
          <Card>
            <CardHeader><CardTitle>Message indisponible</CardTitle></CardHeader>
            <CardContent>
              <Input value={config.unavailable_message} onChange={(e) => upd(c => ({ ...c, unavailable_message: e.target.value }))} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
