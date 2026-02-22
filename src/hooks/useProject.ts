import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Project, POI, WifiZone, ForbiddenZone, ValidationResult, QuestConfig, I18nText, StepConfig } from '@/types/intake';
import type { Json } from '@/integrations/supabase/types';
import { normalizeStepConfig } from '@/lib/normalizeStepConfig';
import { isDuplicatedFromRecon } from '@/lib/mapMarkerToPOI';

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

  // Determine if project is route_recon for conditional query
  const projectType = projectQuery.data?.quest_config?.project_type;
  const isRouteRecon = projectType === 'route_recon';

  // Route traces query - only enabled for route_recon projects
  const tracesQuery = useQuery({
    queryKey: ['route_traces', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('route_traces')
        .select('id, geojson, distance_meters, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId && isRouteRecon,
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
    // Optimistic update for instant UI feedback
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ['project', projectId] });
      const previousProject = queryClient.getQueryData<Project>(['project', projectId]);
      
      queryClient.setQueryData<Project | null>(['project', projectId], (old) => {
        if (!old) return old;
        // Deep merge quest_config if present
        const mergedQuestConfig = updates.quest_config 
          ? { ...old.quest_config, ...updates.quest_config }
          : old.quest_config;
        return { 
          ...old, 
          ...updates,
          quest_config: mergedQuestConfig,
          title_i18n: updates.title_i18n ?? old.title_i18n,
          story_i18n: updates.story_i18n ?? old.story_i18n,
        };
      });
      
      return { previousProject };
    },
    onError: (_err, _updates, context) => {
      if (context?.previousProject) {
        queryClient.setQueryData(['project', projectId], context.previousProject);
      }
    },
    onSettled: () => {
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

    // Play mode is required
    if (!project?.quest_config?.play_mode) {
      errors.push('Mode de jeu requis');
    }

    // Conditional blocking errors based on project type
    if (!isRouteRecon) {
      // Standard projects: require map, min POIs, forbidden zones
      if (!project?.map_url) {
        errors.push('Aucune carte uploadée');
      }
      if (pois.length < 10) {
        errors.push(`Étapes insuffisantes: ${pois.length}/10 minimum`);
      }
      if (forbiddenZones.length === 0) {
        errors.push('Zones interdites non définies');
      }
    } else {
      // Route recon projects: validate on trace presence
      // Don't push errors while loading to avoid flicker
      if (tracesQuery.isError) {
        errors.push('Erreur chargement traces GPS');
      } else if (!tracesQuery.isLoading) {
        const traces = tracesQuery.data || [];
        const hasValidTrace = traces.some(t => {
          const coords = (t.geojson as any)?.coordinates || [];
          return coords.length >= 2;
        });
        if (!hasValidTrace) {
          errors.push('Aucune trace GPS valide (min 2 points)');
        }
      }
    }

    if (!project?.title_i18n?.fr) {
      errors.push('Titre (FR) obligatoire');
    }
    if (!project?.story_i18n?.fr) {
      errors.push('Histoire (FR) obligatoire');
    }

    // Play mode specific validation
    const playMode = project?.quest_config?.play_mode;
    const teamConfig = project?.quest_config?.teamConfig;
    const multiSoloConfig = project?.quest_config?.multiSoloConfig;

    if (playMode === 'team') {
      if (!teamConfig?.maxTeams) {
        errors.push('Team: nombre max d\'équipes requis');
      }
      if (!teamConfig?.maxPlayersPerTeam) {
        errors.push('Team: joueurs max par équipe requis');
      }
      if (teamConfig?.competitionMode === 'timed' && !teamConfig?.timeLimitMinutes) {
        warnings.push('Team: temps limite recommandé pour mode chronométré');
      }
    }

    if (playMode === 'multi_solo') {
      if (!multiSoloConfig?.maxPlayers) {
        warnings.push('Multi-solo: nombre max de joueurs recommandé');
      }
    }

    // Decisions validated warning (non-blocking, only for non-route_recon)
    const projectType = project?.quest_config?.project_type;
    const decisionsValidated = project?.quest_config?.decisions_validated || {};
    if (projectType && projectType !== 'route_recon') {
      const hasAnyDecision = Object.values(decisionsValidated).some(v => v === true);
      if (!hasAnyDecision) {
        warnings.push('Aucune décision client validée');
      }
    }

    // Storytelling validation (blocking if enabled without narrator)
    const storytelling = project?.quest_config?.storytelling;
    if (storytelling?.enabled === true && !storytelling.narrator?.avatar_id) {
      errors.push('Avatar narrateur requis');
    }

    // Step-specific validations (contentI18n is NOT required)
    pois.forEach((poi, index) => {
      const config = poi.step_config || {};
      const stepNum = index + 1;
      const isFromRecon = isDuplicatedFromRecon(config);
      
      // Duplicated POIs from route recon: only warnings, no blocking errors for missing config
      if (isFromRecon) {
        // Check if still unconfigured - warn only
        if (!config.possible_step_types?.length && !config.stepType) {
          warnings.push(`Étape ${stepNum}: type d'étape à configurer (importé)`);
        }
        if (!config.possible_validation_modes?.length && !config.validationMode) {
          warnings.push(`Étape ${stepNum}: mode de validation à configurer (importé)`);
        }
        if (!config.contentI18n?.fr) {
          warnings.push(`Étape ${stepNum}: contenu FR manquant (importé)`);
        }
        return; // Skip blocking validations for duplicated POIs
      }
      
      // Must have at least one possible step type
      if (!config.possible_step_types || config.possible_step_types.length === 0) {
        // Fallback to legacy stepType
        if (!config.stepType) {
          errors.push(`Étape ${stepNum}: type d'étape requis`);
        }
      }
      
      // Must have at least one possible validation mode
      if (!config.possible_validation_modes || config.possible_validation_modes.length === 0) {
        // Fallback to legacy validationMode
        if (!config.validationMode) {
          errors.push(`Étape ${stepNum}: mode de validation requis`);
        }
      }
      
      // QR code validation - value is optional now
      
      // Photo validation requirements
      const hasPhotoMode = config.possible_validation_modes?.includes('photo') || config.validationMode === 'photo';
      if (hasPhotoMode && config.photoValidation?.type) {
        const photoType = config.photoValidation?.type;
        if (photoType === 'reference' && !config.photoValidation?.referenceUrl) {
          errors.push(`Étape ${stepNum}: URL référence photo requise`);
        }
        // QR code value is optional
      }
      
      // Photo reference required validation
      if (config.photo_reference_required && !config.reference_image_url) {
        errors.push(`Étape ${stepNum}: photo de référence requise (uploader une image)`);
      }
      
      // contentI18n is now OPTIONAL - just a warning if missing
      if (!config.contentI18n?.fr) {
        warnings.push(`Étape ${stepNum}: contenu FR manquant`);
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
    traces: tracesQuery.data || [],
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
