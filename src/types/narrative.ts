// Narrative Layer — Phase 2 "Série interactive géolocalisée"
// Couche additive lue depuis step_config.narrative_layer.
// Aucune migration DB requise : portée par le jsonb step_config existant.

export interface NarrativeMission {
  title?: string;
  instruction?: string;
  caption?: string;
  photo_required?: boolean;
  respect_rules?: string;
}

export interface NarrativeEpisode {
  number?: number;
  total?: number;
  title?: string;
  emotion?: string;
  hook?: string;
  scene?: string[];
  secret?: string;
  mission?: NarrativeMission;
  revelation?: string;
  cliffhanger?: string;
  transition_to_next?: string;
}

export interface NarrativeSeries {
  title?: string;
  format?: string;
  red_thread?: string;
  visitor_transformation?: string;
  guide_tone_arc?: string[];
}

export interface NarrativeGuide {
  persona?: string;
  arrival_script?: string;
  faq_context?: unknown[];
}

export interface NarrativeAudio {
  series_audio_fr?: string | null;
  series_audio_en?: string | null;
}

export interface NarrativeLayer {
  version?: string;
  product_type: "geo_series" | string;
  series?: NarrativeSeries;
  episode?: NarrativeEpisode;
  guide?: NarrativeGuide;
  audio?: NarrativeAudio;
}

/** Lecture sûre depuis un step_config inconnu. Retourne null si non valide. */
export function extractNarrativeLayer(stepConfig: unknown): NarrativeLayer | null {
  if (!stepConfig || typeof stepConfig !== "object") return null;
  const raw = (stepConfig as Record<string, unknown>).narrative_layer;
  if (!raw || typeof raw !== "object") return null;
  const nl = raw as Record<string, unknown>;
  if (nl.product_type !== "geo_series") return null;
  return nl as unknown as NarrativeLayer;
}
