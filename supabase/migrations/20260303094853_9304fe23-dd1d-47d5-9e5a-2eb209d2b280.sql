INSERT INTO public.app_configs (key, status, version, payload)
VALUES (
  'pricing',
  'published',
  1,
  '{
    "currency": "MAD",
    "base_prices": {
      "visit": 25,
      "game": 35
    },
    "duration_multipliers": {
      "60": 1.0,
      "90": 1.3,
      "120": 1.6
    },
    "party_thresholds": [
      { "min": 1, "max": 2, "supplement": 0 },
      { "min": 3, "max": 5, "supplement": 10 },
      { "min": 6, "max": 10, "supplement": 25 }
    ],
    "pause_supplement": 5,
    "add_ons": [
      { "key": "photo_pack", "label_i18n": { "fr": "Pack photo", "en": "Photo pack" }, "price": 5 },
      { "key": "audio_guide", "label_i18n": { "fr": "Audio guide", "en": "Audio guide" }, "price": 5 },
      { "key": "private_guide", "label_i18n": { "fr": "Guide privé", "en": "Private guide" }, "price": 50 }
    ]
  }'::jsonb
)
ON CONFLICT DO NOTHING;