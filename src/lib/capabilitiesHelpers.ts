/**
 * Helper functions to work with capabilities from the backend registry.
 * These provide backward-compatible Record<string, string> types from EnumItem[].
 */

import type { EnumItem, CapabilitiesPayload } from '@/hooks/useCapabilities';

// Convert EnumItem[] to Record<id, label>
export function enumArrayToRecord<T extends string>(items: EnumItem[] | undefined): Record<T, string> {
  if (!items) return {} as Record<T, string>;
  return items.reduce((acc, item) => {
    acc[item.id as T] = item.label;
    return acc;
  }, {} as Record<T, string>);
}

// Get labels record from capabilities
export function getStepTypeLabels(caps: CapabilitiesPayload | null) {
  return enumArrayToRecord(caps?.enums.step_types);
}

export function getValidationModeLabels(caps: CapabilitiesPayload | null) {
  return enumArrayToRecord(caps?.enums.validation_modes);
}

export function getTargetAudienceLabels(caps: CapabilitiesPayload | null) {
  return enumArrayToRecord(caps?.enums.target_audiences);
}

export function getPlayModeLabels(caps: CapabilitiesPayload | null) {
  return enumArrayToRecord(caps?.enums.play_modes);
}

export function getQuestTypeLabels(caps: CapabilitiesPayload | null) {
  return enumArrayToRecord(caps?.enums.quest_types);
}

export function getLanguageLabels(caps: CapabilitiesPayload | null) {
  return enumArrayToRecord(caps?.enums.languages);
}

export function getProjectTypeLabels(caps: CapabilitiesPayload | null) {
  return enumArrayToRecord(caps?.enums.project_types);
}

export function getAvatarStyleLabels(caps: CapabilitiesPayload | null) {
  return enumArrayToRecord(caps?.enums.avatar_styles);
}

export function getAvatarAgeLabels(caps: CapabilitiesPayload | null) {
  return enumArrayToRecord(caps?.enums.avatar_ages);
}

export function getAvatarPersonaLabels(caps: CapabilitiesPayload | null) {
  return enumArrayToRecord(caps?.enums.avatar_personas);
}

export function getAvatarOutfitLabels(caps: CapabilitiesPayload | null) {
  return enumArrayToRecord(caps?.enums.avatar_outfits);
}

export function getDifficultyLevelLabels(caps: CapabilitiesPayload | null) {
  return enumArrayToRecord(caps?.enums.difficulty_levels);
}

export function getRiskLevelLabels(caps: CapabilitiesPayload | null) {
  return enumArrayToRecord(caps?.enums.risk_levels);
}

export function getWifiStrengthLabels(caps: CapabilitiesPayload | null) {
  return enumArrayToRecord(caps?.enums.wifi_strengths);
}

export function getCompetitionModeLabels(caps: CapabilitiesPayload | null) {
  return enumArrayToRecord(caps?.enums.competition_modes);
}

export function getPhotoValidationTypeLabels(caps: CapabilitiesPayload | null) {
  return enumArrayToRecord(caps?.enums.photo_validation_types);
}

// Get decisions as Record
export function getDecisionsLabels(caps: CapabilitiesPayload | null): Record<string, string> {
  if (!caps?.decisions) return {};
  return caps.decisions.reduce((acc, item) => {
    acc[item.id] = item.label;
    return acc;
  }, {} as Record<string, string>);
}

// Get scoring defaults
export function getScoringDefaults(caps: CapabilitiesPayload | null) {
  return caps?.fields?.scoring_defaults || { points: 10, hint_penalty: 2, fail_penalty: 5 };
}

// Get hint rules defaults
export function getHintRulesDefaults(caps: CapabilitiesPayload | null) {
  return caps?.fields?.hint_rules_defaults || { maxHints: 5, autoRevealAfterSec: 60 };
}
