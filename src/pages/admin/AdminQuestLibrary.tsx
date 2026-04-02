import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { MapPin, Clock, Route, Users, Star, ChevronRight, Play } from 'lucide-react';

const HUB_LABELS: Record<string, string> = {
  koutoubia: "Mosquée Koutoubia",
  jemaa_el_fna: "Place Jemaa el-Fna",
  mellah: "Quartier du Mellah",
};

export default function AdminQuestLibrary() {
  const [hubFilter, setHubFilter] = useState<string>('all');
  const [audienceFilter, setAudienceFilter] = useState<string>('all');

  const { data: quests, isLoading } = useQuery({
    queryKey: ['quest-library'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quest_library')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const hubs = [...new Set(quests?.map(q => q.start_hub) ?? [])];
  const audiences = [...new Set(quests?.map(q => q.audience) ?? [])];

  const filtered = quests?.filter(q => {
    if (hubFilter !== 'all' && q.start_hub !== hubFilter) return false;
    if (audienceFilter !== 'all' && q.audience !== audienceFilter) return false;
    return true;
  }) ?? [];

  const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, q) => {
    (acc[q.start_hub] ??= []).push(q);
    return acc;
  }, {});

  if (isLoading) return <div className="p-6 text-muted-foreground">Chargement…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Bibliothèque de Visites</h2>
          <p className="text-sm text-muted-foreground">{quests?.length ?? 0} visites générées par l'agent</p>
        </div>
        <div className="flex gap-2">
          <Select value={hubFilter} onValueChange={setHubFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Hub" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les hubs</SelectItem>
              {hubs.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={audienceFilter} onValueChange={setAudienceFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Audience" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les audiences</SelectItem>
              {audiences.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {Object.entries(grouped).map(([hub, visits]) => (
        <div key={hub} className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            {hub}
            <Badge variant="secondary">{visits.length}</Badge>
          </h3>

          <Accordion type="multiple" className="space-y-2">
            {visits.map(q => (
              <AccordionItem key={q.id} value={q.id} className="border rounded-lg bg-card">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-4 text-left w-full mr-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{q.title_fr || q.title_en || 'Sans titre'}</p>
                      <p className="text-xs text-muted-foreground truncate">{q.description_fr?.slice(0, 100)}…</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{q.duration_min}min</span>
                      <span className="flex items-center gap-1"><Route className="w-3 h-3" />{q.distance_m}m</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{q.audience}</span>
                      {q.quality_score && (
                        <span className="flex items-center gap-1"><Star className="w-3 h-3" />{Number(q.quality_score).toFixed(1)}</span>
                      )}
                      <Badge variant="outline" className="text-[10px]">{q.difficulty}</Badge>
                      <Badge className="text-[10px]">{q.mode}</Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm font-medium text-foreground mb-1">Description</p>
                      <p className="text-sm text-muted-foreground">{q.description_fr || q.description_en || '—'}</p>
                    </div>
                    <div className="space-y-2">
                      {q.best_time && (
                        <div>
                          <p className="text-xs font-medium text-foreground">Meilleur moment</p>
                          <p className="text-xs text-muted-foreground">{q.best_time}</p>
                        </div>
                      )}
                      {q.highlights && (q.highlights as string[]).length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-foreground">Points forts</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(q.highlights as string[]).map((h, i) => (
                              <Badge key={i} variant="secondary" className="text-[10px]">{h}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {q.stops_data && Array.isArray(q.stops_data) && (q.stops_data as any[]).length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-foreground mb-2">Arrêts ({(q.stops_data as any[]).length})</p>
                      <div className="space-y-1">
                        {(q.stops_data as any[]).map((stop: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 p-2 rounded bg-muted/50 text-sm">
                            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                              {i + 1}
                            </span>
                            <span className="font-medium text-foreground">{stop.name || stop.poi_name || `Arrêt ${i + 1}`}</span>
                            {stop.duration_min && <span className="text-xs text-muted-foreground ml-auto">{stop.duration_min}min</span>}
                            <ChevronRight className="w-3 h-3 text-muted-foreground" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      ))}

      {filtered.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Aucune visite trouvée. L'agent autonome en génère automatiquement.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
