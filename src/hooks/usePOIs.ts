import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { POI, StepConfig, ScoringConfig } from '@/types/intake';
import type { Json } from '@/integrations/supabase/types';

// Default step configuration for new steps - multi-select arrays
export const DEFAULT_STEP_CONFIG: StepConfig = {
  possible_step_types: ['enigme'],
  possible_validation_modes: ['manual'],
  final_step_type: null,
  final_validation_mode: null,
  scoring: {
    points: 10,
    hint_penalty: 2,
    fail_penalty: 5,
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
    // Optimistic update for instant UI feedback
    onMutate: async ({ id, step_config, ...updates }) => {
      await queryClient.cancelQueries({ queryKey: ['pois', projectId] });
      const previousPois = queryClient.getQueryData<POI[]>(['pois', projectId]);
      
      queryClient.setQueryData<POI[]>(['pois', projectId], (old) => {
        if (!old) return old;
        return old.map((poi) => {
          if (poi.id !== id) return poi;
          // Merge step_config if present
          const mergedStepConfig = step_config 
            ? { ...poi.step_config, ...step_config }
            : poi.step_config;
          return { ...poi, ...updates, step_config: mergedStepConfig };
        });
      });
      
      return { previousPois };
    },
    onError: (_err, _updates, context) => {
      if (context?.previousPois) {
        queryClient.setQueryData(['pois', projectId], context.previousPois);
      }
    },
    onSettled: () => {
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

  // Selective apply - only updates checked fields where missing
  const applySelectiveDefaults = useMutation({
    mutationFn: async (params: {
      defaults: Partial<StepConfig>;
      fields: { stepType?: boolean; validationMode?: boolean; scoring?: boolean; hints?: boolean };
    }) => {
      if (!projectId) throw new Error('No project ID');
      
      const { data: allPois, error: fetchError } = await supabase
        .from('pois')
        .select('id, step_config')
        .eq('project_id', projectId);
      if (fetchError) throw fetchError;
      
      let updatedCount = 0;
      for (const poi of allPois || []) {
        const config = (poi.step_config || {}) as StepConfig;
        const updatedConfig: StepConfig = { ...config };
        let needsUpdate = false;
        
        // Only apply checked fields where value is missing
        if (params.fields.stepType && !config.stepType && params.defaults.stepType) {
          updatedConfig.stepType = params.defaults.stepType;
          needsUpdate = true;
        }
        if (params.fields.validationMode && !config.validationMode && params.defaults.validationMode) {
          updatedConfig.validationMode = params.defaults.validationMode;
          needsUpdate = true;
        }
        if (params.fields.scoring && !config.scoring && params.defaults.scoring) {
          updatedConfig.scoring = params.defaults.scoring;
          needsUpdate = true;
        }
        if (params.fields.hints && (!config.hints || config.hints.length === 0) && params.defaults.hints) {
          updatedConfig.hints = params.defaults.hints;
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          const { error } = await supabase
            .from('pois')
            .update({ step_config: updatedConfig as unknown as Json })
            .eq('id', poi.id);
          if (error) throw error;
          updatedCount++;
        }
      }
      return updatedCount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pois', projectId] });
    },
  });

  // Legacy - kept for backwards compat
  const applyDefaultsToAll = useMutation({
    mutationFn: async (defaults: { stepType: StepConfig['stepType']; validationMode: StepConfig['validationMode']; scoring: StepConfig['scoring'] }) => {
      if (!projectId) throw new Error('No project ID');
      
      const { data: allPois, error: fetchError } = await supabase
        .from('pois')
        .select('id, step_config')
        .eq('project_id', projectId);
      if (fetchError) throw fetchError;
      
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
    applySelectiveDefaults,
  };
}
