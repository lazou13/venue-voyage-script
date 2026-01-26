-- Create app_configs table for backend-configurable capabilities registry
CREATE TABLE public.app_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(key, version)
);

-- Enable RLS
ALTER TABLE public.app_configs ENABLE ROW LEVEL SECURITY;

-- Allow read for all (public access for capabilities)
CREATE POLICY "Allow public read for app_configs"
  ON public.app_configs FOR SELECT
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_app_configs_updated_at
  BEFORE UPDATE ON public.app_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed capabilities config with all current registry values
INSERT INTO public.app_configs (key, version, status, payload)
VALUES (
  'capabilities',
  1,
  'published',
  '{
    "enums": {
      "step_types": [
        {"id": "story", "label": "Narration"},
        {"id": "information", "label": "Information"},
        {"id": "mcq", "label": "QCM"},
        {"id": "enigme", "label": "Énigme"},
        {"id": "code", "label": "Code secret"},
        {"id": "hangman", "label": "Pendu"},
        {"id": "memory", "label": "Memory"},
        {"id": "photo", "label": "Photo"},
        {"id": "terrain", "label": "Terrain"},
        {"id": "defi", "label": "Défi"}
      ],
      "validation_modes": [
        {"id": "qr_code", "label": "QR Code"},
        {"id": "photo", "label": "Photo"},
        {"id": "code", "label": "Code"},
        {"id": "manual", "label": "Manuel"},
        {"id": "free", "label": "Libre"}
      ],
      "target_audiences": [
        {"id": "family", "label": "Famille"},
        {"id": "couples", "label": "Couples"},
        {"id": "corporate", "label": "Corporate"},
        {"id": "teens", "label": "Ados"},
        {"id": "seniors", "label": "Seniors"},
        {"id": "kids", "label": "Enfants"},
        {"id": "friends", "label": "Amis"}
      ],
      "play_modes": [
        {"id": "solo", "label": "Solo"},
        {"id": "team", "label": "Équipes"},
        {"id": "one_vs_one", "label": "1 vs 1"},
        {"id": "multi_solo", "label": "Multi-joueurs (classement)"}
      ],
      "quest_types": [
        {"id": "exploration", "label": "Exploration libre"},
        {"id": "sequential", "label": "Séquentiel"},
        {"id": "timed_race", "label": "Course chronométrée"},
        {"id": "collaborative", "label": "Collaboratif"},
        {"id": "team_competition", "label": "Compétition équipes"}
      ],
      "languages": [
        {"id": "fr", "label": "Français"},
        {"id": "en", "label": "English"},
        {"id": "ar", "label": "العربية"},
        {"id": "es", "label": "Español"},
        {"id": "ary", "label": "Darija"}
      ],
      "project_types": [
        {"id": "establishment", "label": "Établissement"},
        {"id": "tourist_spot", "label": "Site Touristique"},
        {"id": "route_recon", "label": "Reconnaissance Parcours"}
      ],
      "avatar_styles": [
        {"id": "cartoon", "label": "Cartoon"},
        {"id": "realistic", "label": "Réaliste"},
        {"id": "semi_realistic", "label": "Semi-réaliste"},
        {"id": "anime", "label": "Anime"},
        {"id": "minimal", "label": "Minimal"}
      ],
      "avatar_ages": [
        {"id": "child", "label": "Enfant"},
        {"id": "teen", "label": "Ado"},
        {"id": "adult", "label": "Adulte"},
        {"id": "senior", "label": "Senior"}
      ],
      "avatar_personas": [
        {"id": "guide_host", "label": "Guide/Hôte"},
        {"id": "detective", "label": "Détective"},
        {"id": "explorer", "label": "Explorateur"},
        {"id": "historian", "label": "Historien"},
        {"id": "local_character", "label": "Personnage local"},
        {"id": "mascot", "label": "Mascotte"},
        {"id": "ai_assistant", "label": "Assistant IA"},
        {"id": "villain_light", "label": "Villain léger"}
      ],
      "avatar_outfits": [
        {"id": "traditional", "label": "Traditionnel"},
        {"id": "modern", "label": "Moderne"},
        {"id": "luxury", "label": "Luxe"},
        {"id": "adventure", "label": "Aventure"}
      ],
      "difficulty_levels": [
        {"id": "easy", "label": "Facile"},
        {"id": "medium", "label": "Moyen"},
        {"id": "hard", "label": "Difficile"}
      ],
      "risk_levels": [
        {"id": "low", "label": "Faible"},
        {"id": "medium", "label": "Moyen"},
        {"id": "high", "label": "Élevé"}
      ],
      "wifi_strengths": [
        {"id": "ok", "label": "OK"},
        {"id": "weak", "label": "Faible"},
        {"id": "dead", "label": "Mort"}
      ],
      "competition_modes": [
        {"id": "race", "label": "Course"},
        {"id": "score", "label": "Score"},
        {"id": "timed", "label": "Temps limité"}
      ],
      "photo_validation_types": [
        {"id": "free", "label": "Libre"},
        {"id": "reference", "label": "Référence"},
        {"id": "qr_code", "label": "QR Code"}
      ]
    },
    "decisions": [
      {"id": "qr_allowed", "label": "QR codes autorisés"},
      {"id": "photo_challenges_allowed", "label": "Défis photo autorisés"},
      {"id": "staff_involved", "label": "Staff impliqué"},
      {"id": "prizes_gifts", "label": "Prix / cadeaux prévus"},
      {"id": "kids_mode", "label": "Mode enfants activé"},
      {"id": "multilingual", "label": "Contenu multilingue"},
      {"id": "restricted_zones_confirmed", "label": "Zones restreintes confirmées"},
      {"id": "avatar_style_approved", "label": "Style avatar approuvé"},
      {"id": "story_theme_approved", "label": "Thème histoire approuvé"},
      {"id": "schedule_window_confirmed", "label": "Créneau horaire confirmé"}
    ],
    "fields": {
      "scoring_defaults": {
        "points": 10,
        "hint_penalty": 2,
        "fail_penalty": 5
      },
      "hint_rules_defaults": {
        "maxHints": 5,
        "autoRevealAfterSec": 60
      }
    }
  }'::jsonb
);