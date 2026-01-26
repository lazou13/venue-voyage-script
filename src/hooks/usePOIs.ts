import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { POI, StepConfig, ScoringConfig } from '@/types/intake';
import type { Json } from '@/integrations/supabase/types';

// Default step configuration for new steps - canonical keys
export const DEFAULT_STEP_CONFIG: StepConfig = {
  stepType: 'enigme',
  validationMode: 'manual',
  scoring: {
    points: 10,
    hintPenalty: 2,
    failPenalty: 5,
  },
  hints: [],
  contentI18n: {},
};

// Export for use in StepsBuilderStep
export const DEFAULT_SCORING: ScoringConfig = DEFAULT_STEP_CONFIG.scoring!;

export function usePOIs(projectId: string | undefined) {
  const queryClient = useQueryClient();

  const addPOI = useMutation({
    mutationFn: async (poi: Omit<POI, 'id' | 'created_at' | 'project_id'>) => {
      if (!projectId) throw new Error('No project ID');
      const { step_config, ...rest } = poi;
      // Merge with defaults
      const mergedConfig: StepConfig = {
        ...DEFAULT_STEP_CONFIG,
        ...(step_config || {}),
        scoring: {
          ...DEFAULT_STEP_CONFIG.scoring,
          ...(step_config?.scoring || {}),
        },
      };
      const { data, error } = await supabase
        .from('pois')
        .insert({ 
          ...rest, 
          project_id: projectId,
          step_config: mergedConfig as unknown as Json
        })
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
    mutationFn: async ({ id, step_config, ...updates }: Partial<POI> & { id: string }) => {
      const updateData: Record<string, unknown> = { ...updates };
      if (step_config !== undefined) {
        updateData.step_config = step_config as unknown as Json;
      }
      const { data, error } = await supabase
        .from('pois')
        .update(updateData)
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

  const duplicatePOI = useMutation({
    mutationFn: async (poi: POI) => {
      if (!projectId) throw new Error('No project ID');
      
      // Get current max sort_order for steps after this one
      const { data: allPois } = await supabase
        .from('pois')
        .select('id, sort_order')
        .eq('project_id', projectId)
        .gt('sort_order', poi.sort_order)
        .order('sort_order', { ascending: false });
      
      // Shift all subsequent steps down by 1
      if (allPois && allPois.length > 0) {
        for (const p of allPois) {
          await supabase
            .from('pois')
            .update({ sort_order: p.sort_order + 1 })
            .eq('id', p.id);
        }
      }
      
      // Insert duplicate right after original
      const { step_config, ...rest } = poi;
      const { data, error } = await supabase
        .from('pois')
        .insert({
          name: `${poi.name} (copie)`,
          zone: poi.zone,
          interaction: poi.interaction,
          risk: poi.risk,
          minutes_from_prev: poi.minutes_from_prev,
          notes: poi.notes,
          project_id: projectId,
          sort_order: poi.sort_order + 1,
          step_config: (step_config || {}) as unknown as Json,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pois', projectId] });
    },
  });

  const applyDefaultsToAll = useMutation({
    mutationFn: async (defaults: { stepType: StepConfig['stepType']; validationMode: StepConfig['validationMode']; scoring: StepConfig['scoring'] }) => {
      if (!projectId) throw new Error('No project ID');
      
      // Fetch all POIs
      const { data: allPois, error: fetchError } = await supabase
        .from('pois')
        .select('id, step_config')
        .eq('project_id', projectId);
      if (fetchError) throw fetchError;
      
      // Update each POI that has missing values
      for (const poi of allPois || []) {
        const config = (poi.step_config || {}) as StepConfig;
        const needsUpdate = !config.stepType || !config.validationMode || !config.scoring;
        
        if (needsUpdate) {
          const updatedConfig: StepConfig = {
            ...config,
            stepType: config.stepType || defaults.stepType,
            validationMode: config.validationMode || defaults.validationMode,
            scoring: config.scoring || defaults.scoring,
            hints: config.hints || [],
          };
          
          const { error } = await supabase
            .from('pois')
            .update({ step_config: updatedConfig as unknown as Json })
            .eq('id', poi.id);
          if (error) throw error;
        }
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
    duplicatePOI,
    applyDefaultsToAll,
  };
}
