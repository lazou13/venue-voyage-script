import type { QuestConfig, StepConfig, ScoringConfig } from '@/types/intake';

export interface QuestPreset {
  id: string;
  name: string;
  description: string;
  icon: 'qr' | 'gps' | 'family';
  questConfig: Partial<QuestConfig>;
  stepDefaults: Partial<StepConfig>;
}

// Default scoring config - canonical snake_case keys
const DEFAULT_SCORING: ScoringConfig = {
  points: 10,
  hint_penalty: 2,
  fail_penalty: 5,
};

// Preset: Hotel Indoor QR
const hotelIndoorQR: QuestPreset = {
  id: 'hotel_indoor_qr',
  name: 'QR Intérieur Hôtel',
  description: 'Chasse au trésor en intérieur avec validation QR',
  icon: 'qr',
  questConfig: {
    questType: 'sequential',
    targetAudience: 'family',
    teamConfig: { enabled: false },
    scoring: { ...DEFAULT_SCORING },
    hintRules: { maxHints: 3, autoRevealAfterSec: 120 },
  },
  stepDefaults: {
    possible_step_types: ['enigme'],
    possible_validation_modes: ['qr_code'],
    scoring: { ...DEFAULT_SCORING },
    hints: ['Indice 1', 'Indice 2', 'Indice 3'],
  },
};

// Preset: Outdoor Terrain (GPS removed)
const outdoorTerrain: QuestPreset = {
  id: 'outdoor_terrain',
  name: 'Terrain Extérieur',
  description: 'Exploration en extérieur avec validation terrain',
  icon: 'gps',
  questConfig: {
    questType: 'exploration',
    targetAudience: 'family',
    teamConfig: { enabled: false },
    scoring: {
      points: 15,
      hint_penalty: 3,
      fail_penalty: 5,
      time_bonus: 10,
    },
    hintRules: { maxHints: 2, autoRevealAfterSec: 180 },
  },
  stepDefaults: {
    possible_step_types: ['terrain', 'photo'],
    possible_validation_modes: ['manual', 'photo'],
    scoring: {
      points: 15,
      hint_penalty: 3,
      fail_penalty: 5,
    },
    hints: ['Cherchez près de...', 'C\'est dans la direction...'],
  },
};

// Preset: Family Friendly
const familyFriendly: QuestPreset = {
  id: 'family_friendly',
  name: 'Familles',
  description: 'Facile et amusant pour toute la famille',
  icon: 'family',
  questConfig: {
    questType: 'sequential',
    targetAudience: 'family',
    teamConfig: { enabled: true, competitionMode: 'score', maxTeams: 4, maxPlayersPerTeam: 6 },
    scoring: {
      points: 10,
      hint_penalty: 0,
      fail_penalty: 0,
    },
    hintRules: { maxHints: 5, autoRevealAfterSec: 60 },
  },
  stepDefaults: {
    possible_step_types: ['mcq', 'enigme'],
    possible_validation_modes: ['manual'],
    scoring: {
      points: 10,
      hint_penalty: 0,
      fail_penalty: 0,
    },
    hints: ['Indice facile 1', 'Indice facile 2', 'Indice facile 3'],
  },
};

export const QUEST_PRESETS: QuestPreset[] = [hotelIndoorQR, outdoorTerrain, familyFriendly];

export function getPresetById(id: string): QuestPreset | undefined {
  return QUEST_PRESETS.find(p => p.id === id);
}
