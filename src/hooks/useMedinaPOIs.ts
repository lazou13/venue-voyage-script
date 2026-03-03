import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface MedinaPOI {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  zone: string;
  category: string;
  lat: number | null;
  lng: number | null;
  radius_m: number;
  step_config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  is_active: boolean;
}

export type MedinaPOIInsert = Omit<MedinaPOI, 'id' | 'created_at' | 'updated_at'>;

const QUERY_KEY = ['medina_pois'];

export function useMedinaPOIs() {
  const qc = useQueryClient();

  const listQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('medina_pois')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data ?? []) as MedinaPOI[];
    },
  });

  const create = useMutation({
    mutationFn: async (poi: Partial<MedinaPOIInsert>) => {
      const { data, error } = await supabase
        .from('medina_pois')
        .insert({
          name: poi.name ?? 'Nouveau POI',
          zone: poi.zone ?? '',
          category: poi.category ?? 'generic',
          lat: poi.lat,
          lng: poi.lng,
          radius_m: poi.radius_m ?? 30,
          step_config: (poi.step_config ?? {}) as Json,
          metadata: (poi.metadata ?? {}) as Json,
          is_active: poi.is_active ?? true,
        })
        .select()
        .single();
      if (error) throw error;
      return data as MedinaPOI;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MedinaPOI> & { id: string }) => {
      const payload: Record<string, unknown> = { ...updates };
      if (updates.step_config) payload.step_config = updates.step_config as Json;
      if (updates.metadata) payload.metadata = updates.metadata as Json;
      const { data, error } = await supabase
        .from('medina_pois')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as MedinaPOI;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('medina_pois').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return {
    pois: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    error: listQuery.error,
    create,
    update,
    remove,
  };
}
