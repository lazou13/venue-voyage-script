import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useMedinaPOIs } from '@/hooks/useMedinaPOIs';
import { supabase } from '@/integrations/supabase/client';
import { generateMedinaItinerary } from '@/lib/generateMedinaItinerary';
import { toast } from 'sonner';
import { Copy, Wand2, Loader2, ExternalLink, Check } from 'lucide-react';

const DURATION_MAP: Record<number, number> = { 60: 6, 90: 8, 120: 10 };

export default function AdminMedinaCustomBuilder() {
  const { pois: medinaPois, isLoading: loadingPois } = useMedinaPOIs();

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [mode, setMode] = useState<'visit' | 'game'>('visit');
  const [duration, setDuration] = useState(60);
  const [zone, setZone] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [pause, setPause] = useState(false);

  // Generated state
  const [previewIds, setPreviewIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ token: string; projectId: string } | null>(null);

  // Derived lists
  const zones = useMemo(() => [...new Set(medinaPois.filter(p => p.zone).map(p => p.zone))].sort(), [medinaPois]);
  const categories = useMemo(() => [...new Set(medinaPois.filter(p => p.category).map(p => p.category))].sort(), [medinaPois]);

  const previewPois = useMemo(
    () => previewIds.map(id => medinaPois.find(p => p.id === id)).filter(Boolean),
    [previewIds, medinaPois],
  );

  const count = DURATION_MAP[duration] ?? 6;

  function handleGenerate() {
    if (!zone) { toast.error('Sélectionnez une zone'); return; }
    const ids = generateMedinaItinerary(medinaPois, {
      zone,
      categories: selectedCategories,
      pause,
      count,
      seed: customerEmail || String(Date.now()),
    });
    setPreviewIds(ids);
    setResult(null);
    if (ids.length < count) {
      toast.warning(`Seulement ${ids.length}/${count} POIs disponibles dans cette zone`);
    }
  }

  async function handleCreate() {
    if (!customerName.trim()) { toast.error('Nom du client requis'); return; }
    if (previewIds.length === 0) { toast.error('Générez d\'abord un itinéraire'); return; }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-custom-quest', {
        body: {
          customer_name: customerName,
          customer_email: customerEmail || undefined,
          experience_mode: mode,
          duration_minutes: duration,
          ttl_minutes: 240,
          medina_poi_ids: previewIds,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult({ token: data.access_token, projectId: data.project_id });
      toast.success('Quête sur-mesure créée (1 appel) !');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  }

  function toggleCategory(cat: string) {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat],
    );
  }

  const playUrl = result ? `${window.location.origin}/play?token=${result.token}` : '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sur-mesure Médina</h1>
        <p className="text-muted-foreground text-sm">Générer une quête personnalisée à partir de la bibliothèque Médina</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <CardHeader><CardTitle className="text-base">Préférences client</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nom client *</Label>
                <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Jean Dupont" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="jean@example.com" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Mode</Label>
                <Select value={mode} onValueChange={v => setMode(v as 'visit' | 'game')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="visit">Visite</SelectItem>
                    <SelectItem value="game">Jeu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Durée</Label>
                <Select value={String(duration)} onValueChange={v => setDuration(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60">60 min (6 POIs)</SelectItem>
                    <SelectItem value="90">90 min (8 POIs)</SelectItem>
                    <SelectItem value="120">120 min (10 POIs)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Zone</Label>
              <Select value={zone} onValueChange={setZone}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une zone" /></SelectTrigger>
                <SelectContent>
                  {zones.map(z => (
                    <SelectItem key={z} value={z}>{z}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Catégories (optionnel)</Label>
              <div className="flex flex-wrap gap-2">
                {categories.map(cat => (
                  <Badge
                    key={cat}
                    variant={selectedCategories.includes(cat) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleCategory(cat)}
                  >
                    {cat}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="pause" checked={pause} onCheckedChange={v => setPause(v === true)} />
              <Label htmlFor="pause" className="cursor-pointer">Inclure une pause café/resto</Label>
            </div>

            <Button onClick={handleGenerate} disabled={loadingPois || !zone} className="w-full">
              <Wand2 className="w-4 h-4 mr-2" /> Générer l'itinéraire ({count} POIs)
            </Button>
          </CardContent>
        </Card>

        {/* Preview + Create */}
        <Card>
          <CardHeader><CardTitle className="text-base">Aperçu itinéraire</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {previewPois.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                Remplissez les préférences et cliquez "Générer"
              </p>
            ) : (
              <>
                <div className="space-y-1">
                  {previewPois.map((poi, idx) => (
                    <div key={poi!.id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded hover:bg-muted">
                      <span className="text-muted-foreground w-5 text-right">{idx + 1}.</span>
                      <span className="flex-1 font-medium">{poi!.name}</span>
                      <Badge variant="secondary" className="text-xs">{poi!.category}</Badge>
                      <span className="text-xs text-muted-foreground">{poi!.zone}</span>
                    </div>
                  ))}
                </div>

                {!result && (
                  <Button onClick={handleCreate} disabled={creating || !customerName.trim()} className="w-full">
                    {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                    Créer projet + commande + instance
                  </Button>
                )}

                {result && (
                  <div className="space-y-3 p-3 rounded-lg bg-muted">
                    <p className="text-sm font-medium text-primary">✅ Quête créée avec succès !</p>
                    <div className="space-y-1">
                      <Label className="text-xs">Token d'accès</Label>
                      <div className="flex gap-2">
                        <Input value={result.token} readOnly className="font-mono text-xs" />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => { navigator.clipboard.writeText(result.token); toast.success('Token copié'); }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Lien joueur</Label>
                      <div className="flex gap-2">
                        <Input value={playUrl} readOnly className="text-xs" />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => { navigator.clipboard.writeText(playUrl); toast.success('Lien copié'); }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="outline" asChild>
                          <a href={playUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
