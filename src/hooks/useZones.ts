import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { WifiZone, ForbiddenZone, WifiStrength } from '@/types/intake';

export function useZones(projectId: string | undefined) {
  const queryClient = useQueryClient();

  const addWifiZone = useMutation({
    mutationFn: async (zone: Omit<WifiZone, 'id' | 'project_id'>) => {
      if (!projectId) throw new Error('No project ID');
      const { data, error } = await supabase
        .from('wifi_zones')
        .insert({ ...zone, project_id: projectId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wifi_zones', projectId] });
    },
  });

  const updateWifiZone = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WifiZone> & { id: string }) => {
      const { data, error } = await supabase
        .from('wifi_zones')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wifi_zones', projectId] });
    },
  });

  const deleteWifiZone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('wifi_zones').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wifi_zones', projectId] });
    },
  });

  const addForbiddenZone = useMutation({
    mutationFn: async (zone: Omit<ForbiddenZone, 'id' | 'project_id'>) => {
      if (!projectId) throw new Error('No project ID');
      const { data, error } = await supabase
        .from('forbidden_zones')
        .insert({ ...zone, project_id: projectId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forbidden_zones', projectId] });
    },
  });

  const updateForbiddenZone = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ForbiddenZone> & { id: string }) => {
      const { data, error } = await supabase
        .from('forbidden_zones')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forbidden_zones', projectId] });
    },
  });

  const deleteForbiddenZone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('forbidden_zones').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forbidden_zones', projectId] });
    },
  });

  return {
    addWifiZone,
    updateWifiZone,
    deleteWifiZone,
    addForbiddenZone,
    updateForbiddenZone,
    deleteForbiddenZone,
  };
}
