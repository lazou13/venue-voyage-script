import type { StepConfig } from '@/types/intake';
import type { Json } from '@/integrations/supabase/types';

/**
 * Route marker input (from route_markers table)
 */
export interface MarkerInput {
  id?: string;
  note?: string | null;
  photo_url?: string | null;
  lat?: number;
  lng?: number;
  created_at?: string;
}

/**
 * POI insert structure for duplicating markers to a project
 */
export interface POIInsert {
  project_id: string;
  name: string;
  zone: string;
  notes: string | null;
  photo_url: string | null;
  sort_order: number;
  step_config: Json;
}

/**
 * Default step config for duplicated POIs - explicitly validation-safe.
 * All possibility arrays are empty (user chooses later).
 * Final values are null (not locked).
 */
export const DUPLICATED_POI_DEFAULT_CONFIG: StepConfig = {
  possible_step_types: [],
  possible_validation_modes: [],
  final_step_type: null,
  final_validation_mode: null,
  scoring: {
    points: 10,
    hint_penalty: 2,
    fail_penalty: 5,
  },
  hints: [],
  contentI18n: {},
  // Flag to indicate this is a duplicated POI (skips certain blocking validations)
  _duplicated_from_recon: true,
};

/**
 * Maps a route marker to a POI insert object.
 * Used when duplicating a route_recon track into a new project.
 * 
 * @param marker - The route marker to convert
 * @param index - Zero-based index of the marker
 * @param projectId - Target project ID
 * @returns POIInsert ready for database insertion
 */
export function mapMarkerToPOI(
  marker: MarkerInput,
  index: number,
  projectId: string
): POIInsert {
  const stepConfig: StepConfig = {
    ...DUPLICATED_POI_DEFAULT_CONFIG,
    // Store note in contentI18n.fr if present
    contentI18n: marker.note 
      ? { fr: marker.note }
      : {},
  };

  return {
    project_id: projectId,
    name: marker.note?.slice(0, 50) || `Marker ${index + 1}`,
    zone: 'route_recon',
    notes: marker.note || null,
    photo_url: marker.photo_url || null,
    sort_order: index,
    step_config: stepConfig as unknown as Json,
  };
}

/**
 * Check if a POI was duplicated from route recon (exempt from certain validations)
 */
export function isDuplicatedFromRecon(stepConfig: StepConfig | null | undefined): boolean {
  return stepConfig?._duplicated_from_recon === true;
}
