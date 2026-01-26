import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Project, POI, WifiZone, ForbiddenZone, ValidationResult } from '@/types/intake';

export function useProject(projectId: string | undefined) {
  const queryClient = useQueryClient();

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .maybeSingle();
      if (error) throw error;
      return data as Project | null;
    },
    enabled: !!projectId,
  });

  const poisQuery = useQuery({
    queryKey: ['pois', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('pois')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order');
      if (error) throw error;
      return data as POI[];
    },
    enabled: !!projectId,
  });

  const wifiZonesQuery = useQuery({
    queryKey: ['wifi_zones', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('wifi_zones')
        .select('*')
        .eq('project_id', projectId);
      if (error) throw error;
      return data as WifiZone[];
    },
    enabled: !!projectId,
  });

  const forbiddenZonesQuery = useQuery({
    queryKey: ['forbidden_zones', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('forbidden_zones')
        .select('*')
        .eq('project_id', projectId);
      if (error) throw error;
      return data as ForbiddenZone[];
    },
    enabled: !!projectId,
  });

  const updateProject = useMutation({
    mutationFn: async (updates: Partial<Project>) => {
      if (!projectId) throw new Error('No project ID');
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });

  const validate = (): ValidationResult => {
    const errors: string[] = [];
    const project = projectQuery.data;
    const pois = poisQuery.data || [];
    const forbiddenZones = forbiddenZonesQuery.data || [];

    if (!project?.map_url) {
      errors.push('Aucune carte uploadée');
    }
    if (pois.length < 10) {
      errors.push(`POIs insuffisants: ${pois.length}/10 minimum`);
    }
    if (forbiddenZones.length === 0) {
      errors.push('Zones interdites non définies');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  return {
    project: projectQuery.data,
    pois: poisQuery.data || [],
    wifiZones: wifiZonesQuery.data || [],
    forbiddenZones: forbiddenZonesQuery.data || [],
    isLoading: projectQuery.isLoading,
    updateProject,
    validate,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['pois', projectId] });
      queryClient.invalidateQueries({ queryKey: ['wifi_zones', projectId] });
      queryClient.invalidateQueries({ queryKey: ['forbidden_zones', projectId] });
    },
  };
}
