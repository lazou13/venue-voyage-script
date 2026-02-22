import { useMemo } from 'react';
import type { Project, POI } from '@/types/intake';

export interface CrossTabStats {
  // From Terrain (POIs)
  poiCount: number;
  poisWithPhoto: number;
  poisWithoutPhoto: number;
  totalMinutesFromPrev: number;
  autoDurationMin: number;

  // From Étapes (step config)
  configuredSteps: number;
  unconfiguredSteps: number;
  stepsWithContent: number;
  stepsWithoutContent: number;

  // From Core
  durationMin: number | undefined;
  difficulty: number | undefined;
  languages: string[];
  projectType: string;
  questType: string | undefined;
  playMode: string | undefined;

  // From Parcours (traces)
  totalDistanceMeters: number;
  traceCount: number;

  // Coherence alerts
  coherenceAlerts: { type: 'warning' | 'info'; message: string }[];
}

export function useCrossTabStats(
  project: Project | null | undefined,
  pois: POI[],
  traces?: { distance_meters: number | null; geojson: any }[]
): CrossTabStats {
  return useMemo(() => {
    const questConfig = project?.quest_config || {};
    const coreDetails = questConfig.core || {};
    const languages = coreDetails.languages || questConfig.languages || ['fr'];
    const projectType = questConfig.project_type || 'establishment';
    const questType = questConfig.questType;
    const playMode = questConfig.play_mode;
    const durationMin = coreDetails.duration_min;
    const difficulty = coreDetails.difficulty;

    // POI stats
    const poiCount = pois.length;
    const poisWithPhoto = pois.filter(p => p.photo_url).length;
    const poisWithoutPhoto = poiCount - poisWithPhoto;
    const totalMinutesFromPrev = pois.reduce((sum, p) => sum + (p.minutes_from_prev || 0), 0);
    const autoDurationMin = totalMinutesFromPrev;

    // Step config stats
    const configuredSteps = pois.filter(p => {
      const cfg = p.step_config || {};
      return (cfg.possible_step_types?.length || cfg.stepType) && 
             (cfg.possible_validation_modes?.length || cfg.validationMode);
    }).length;
    const unconfiguredSteps = poiCount - configuredSteps;

    const stepsWithContent = pois.filter(p => p.step_config?.contentI18n?.fr).length;
    const stepsWithoutContent = poiCount - stepsWithContent;

    // Traces stats
    const traceCount = traces?.length || 0;
    const totalDistanceMeters = traces?.reduce((sum, t) => sum + (t.distance_meters || 0), 0) || 0;

    // Coherence alerts
    const coherenceAlerts: { type: 'warning' | 'info'; message: string }[] = [];

    if (projectType === 'route_recon' && traceCount === 0) {
      coherenceAlerts.push({ type: 'warning', message: 'Type route_recon sans aucune trace GPS dans Parcours' });
    }

    const effectiveDuration = durationMin || autoDurationMin;
    if (poiCount > 0 && effectiveDuration > 0) {
      const avgMinPerStep = effectiveDuration / poiCount;
      if (avgMinPerStep < 1.5) {
        coherenceAlerts.push({ type: 'warning', message: `${poiCount} étapes pour ${effectiveDuration} min — risque de rythme trop rapide` });
      }
    }

    const extraLangs = languages.filter((l: string) => l !== 'fr');
    if (extraLangs.length > 0 && poiCount > 0) {
      const missingI18n = pois.filter(p => {
        const content = p.step_config?.contentI18n || {};
        return extraLangs.some((lang: string) => !content[lang as keyof typeof content]);
      }).length;
      if (missingI18n > 0) {
        coherenceAlerts.push({ type: 'info', message: `${missingI18n} étape(s) sans traduction pour ${extraLangs.map((l: string) => l.toUpperCase()).join(', ')}` });
      }
    }

    return {
      poiCount,
      poisWithPhoto,
      poisWithoutPhoto,
      totalMinutesFromPrev,
      autoDurationMin,
      configuredSteps,
      unconfiguredSteps,
      stepsWithContent,
      stepsWithoutContent,
      durationMin,
      difficulty,
      languages,
      projectType,
      questType,
      playMode,
      totalDistanceMeters,
      traceCount,
      coherenceAlerts,
    };
  }, [project, pois, traces]);
}
