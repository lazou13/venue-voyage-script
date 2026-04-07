import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Check, X, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

type DbField = 'history_context' | 'local_anecdote_fr' | 'fun_fact_fr' | 'riddle_easy' | 'wikipedia_summary';

interface Props {
  field: DbField;
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PAGE_SIZE = 50;

export default function EnrichmentDrilldown({ field, label, open, onOpenChange }: Props) {
  const [showFilled, setShowFilled] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['enrichment-drilldown', field, showFilled, search, page],
    queryFn: async () => {
      let query = supabase
        .from('medina_pois')
        .select('id, name, category, zone, ' + field, { count: 'exact' })
        .eq('is_active', true)
        .order('name');

      if (showFilled) {
        query = query.neq(field, null).neq(field, '');
      } else {
        query = query.or(`${field}.is.null,${field}.eq.`);
      }

      if (search) {
        query = query.ilike('name', `%${search}%`);
      }

      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data: rows, count, error } = await query;
      if (error) throw error;
      return { rows: rows ?? [], total: count ?? 0 };
    },
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      const { error } = await supabase
        .from('medina_pois')
        .update({ [field]: value || null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Sauvegardé');
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ['enrichment-drilldown'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
    },
    onError: () => toast.error('Erreur de sauvegarde'),
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const startEdit = (id: string, currentValue: string | null) => {
    setEditingId(id);
    setEditValue(currentValue ?? '');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {label}
            <Badge variant={showFilled ? 'default' : 'destructive'} className="text-xs">
              {total} {showFilled ? 'remplis' : 'manquants'}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un POI..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9"
            />
          </div>
          <Button
            variant={showFilled ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setShowFilled(!showFilled); setPage(0); }}
          >
            {showFilled ? '✅ Remplis' : '❌ Manquants'}
          </Button>
        </div>

        <div className="flex-1 overflow-auto mt-3 border rounded-md">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-muted-foreground p-8">Aucun POI trouvé</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Nom</TableHead>
                  <TableHead className="w-[100px]">Catégorie</TableHead>
                  <TableHead>Contenu</TableHead>
                  <TableHead className="w-[80px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row: any) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium text-sm">{row.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{row.category}</Badge>
                    </TableCell>
                    <TableCell>
                      {editingId === row.id ? (
                        <Textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="min-h-[80px] text-sm"
                          autoFocus
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {row[field] || <span className="italic text-destructive">— vide —</span>}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === row.id ? (
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            disabled={saveMutation.isPending}
                            onClick={() => saveMutation.mutate({ id: row.id, value: editValue })}
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(row.id, row[field])}
                        >
                          Éditer
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Page {page + 1} / {totalPages} — {total} POIs
            </p>
            <div className="flex gap-1">
              <Button size="icon" variant="outline" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
