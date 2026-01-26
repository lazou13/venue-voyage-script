import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { POI, InteractionType, RiskLevel } from '@/types/intake';

export function usePOIs(projectId: string | undefined) {
  const queryClient = useQueryClient();

  const addPOI = useMutation({
    mutationFn: async (poi: Omit<POI, 'id' | 'created_at' | 'project_id'>) => {
      if (!projectId) throw new Error('No project ID');
      const { data, error } = await supabase
        .from('pois')
        .insert({ ...poi, project_id: projectId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pois', projectId] });
    },
  });

  const updatePOI = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<POI> & { id: string }) => {
      const { data, error } = await supabase
        .from('pois')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pois', projectId] });
    },
  });

  const deletePOI = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pois').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pois', projectId] });
    },
  });

  const reorderPOIs = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) => ({
        id,
        sort_order: index,
      }));
      
      for (const update of updates) {
        const { error } = await supabase
          .from('pois')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pois', projectId] });
    },
  });

  return {
    addPOI,
    updatePOI,
    deletePOI,
    reorderPOIs,
  };
}
