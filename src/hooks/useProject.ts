import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Project, POI, WifiZone, ForbiddenZone, ValidationResult, QuestConfig, I18nText, StepConfig } from '@/types/intake';
import type { Json } from '@/integrations/supabase/types';
import { normalizeStepConfig } from '@/lib/normalizeStepConfig';

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
      // Cast JSONB fields to proper types
      if (data) {
        return {
          ...data,
          quest_config: (data.quest_config || {}) as QuestConfig,
          title_i18n: (data.title_i18n || {}) as I18nText,
          story_i18n: (data.story_i18n || {}) as I18nText,
        } as Project;
      }
      return null;
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
      // Cast step_config to proper type and normalize legacy values
      return (data || []).map(poi => ({
        ...poi,
        step_config: normalizeStepConfig((poi.step_config || {}) as StepConfig),
      })) as POI[];
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
      // Handle JSONB fields
      const { quest_config, title_i18n, story_i18n, ...rest } = updates;
      const updateData: Record<string, unknown> = { ...rest };
      
      if (quest_config !== undefined) {
        updateData.quest_config = quest_config as unknown as Json;
      }
      if (title_i18n !== undefined) {
        updateData.title_i18n = title_i18n as unknown as Json;
      }
      if (story_i18n !== undefined) {
        updateData.story_i18n = story_i18n as unknown as Json;
      }
      
      const { data, error } = await supabase
        .from('projects')
        .update(updateData)
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
    const warnings: string[] = [];
    const project = projectQuery.data;
    const pois = poisQuery.data || [];
    const forbiddenZones = forbiddenZonesQuery.data || [];
    const wifiZones = wifiZonesQuery.data || [];

    // Project type is required
    if (!project?.quest_config?.project_type) {
      errors.push('Type de projet requis');
    }

    // Blocking errors
    if (!project?.map_url) {
      errors.push('Aucune carte uploadée');
    }
    if (pois.length < 10) {
      errors.push(`Étapes insuffisantes: ${pois.length}/10 minimum`);
    }
    if (forbiddenZones.length === 0) {
      errors.push('Zones interdites non définies');
    }
    if (!project?.title_i18n?.fr) {
      errors.push('Titre (FR) obligatoire');
    }
    if (!project?.story_i18n?.fr) {
      errors.push('Histoire (FR) obligatoire');
    }

    // Team config validation
    const teamConfig = project?.quest_config?.teamConfig;
    if (teamConfig?.enabled) {
      if (!teamConfig.maxTeams) {
        errors.push('Team: nombre max d\'équipes requis');
      }
      if (!teamConfig.maxPlayersPerTeam) {
        errors.push('Team: joueurs max par équipe requis');
      }
      if (teamConfig.competitionMode === 'timed' && !teamConfig.timeLimitMinutes) {
        errors.push('Team: temps limite requis pour mode chronométré');
      }
    }

    // Step-specific validations
    pois.forEach((poi, index) => {
      const config = poi.step_config || {};
      const stepNum = index + 1;
      
      // GPS validation required for auto_gps
      if (config.validationMode === 'auto_gps') {
        if (!config.gps?.lat) {
          errors.push(`Étape ${stepNum}: latitude GPS requise (auto_gps)`);
        }
        if (!config.gps?.lng) {
          errors.push(`Étape ${stepNum}: longitude GPS requise (auto_gps)`);
        }
        if (!config.gps?.radius) {
          errors.push(`Étape ${stepNum}: rayon GPS requis (auto_gps)`);
        }
      }
      
      // QR code validation required
      if (config.validationMode === 'qr_code') {
        if (!config.photoValidation?.qrExpectedValue) {
          errors.push(`Étape ${stepNum}: valeur QR attendue requise (qr_code)`);
        }
      }
      
      // Photo validation requirements
      if (config.validationMode === 'photo' || config.photoValidation?.type) {
        const photoType = config.photoValidation?.type;
        if (photoType === 'reference' && !config.photoValidation?.referenceUrl) {
          errors.push(`Étape ${stepNum}: URL référence photo requise`);
        }
        if (photoType === 'qr_code' && !config.photoValidation?.qrExpectedValue) {
          errors.push(`Étape ${stepNum}: valeur QR attendue requise (photo_validation)`);
        }
      }
      
      // FR content is REQUIRED for every step (blocker)
      if (!config.contentI18n?.fr) {
        errors.push(`Étape ${stepNum}: contenu FR obligatoire`);
      }
    });

    // Warnings
    const missingPhotos = pois.filter(p => !p.photo_url).length;
    if (missingPhotos > 0) {
      warnings.push(`${missingPhotos} étape(s) sans photo`);
    }
    
    const weakWifi = wifiZones.filter(wz => wz.strength === 'weak').length;
    if (weakWifi > 0) {
      warnings.push(`${weakWifi} zone(s) Wi-Fi faible`);
    }

    // Check for missing translations (non-blocking)
    const languages = project?.quest_config?.languages || ['fr'];
    languages.filter(l => l !== 'fr').forEach(lang => {
      if (!project?.title_i18n?.[lang]) {
        warnings.push(`Titre ${lang.toUpperCase()} manquant`);
      }
      if (!project?.story_i18n?.[lang]) {
        warnings.push(`Histoire ${lang.toUpperCase()} manquante`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
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
