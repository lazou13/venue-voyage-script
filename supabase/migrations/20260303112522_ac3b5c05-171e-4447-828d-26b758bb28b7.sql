
INSERT INTO public.app_configs (key, status, version, payload)
VALUES (
  'experience_page_config',
  'published',
  1,
  '{
    "hero": {
      "title": "Créez votre expérience sur mesure",
      "subtitle": "Parcours unique dans la médina, personnalisé selon vos envies",
      "cta_label": "Commencer",
      "benefits": [
        { "icon": "clock", "text": "4h de validité" },
        { "icon": "smartphone", "text": "100% autonome" },
        { "icon": "camera", "text": "Médias premium" }
      ]
    },
    "steps": [
      { "id": "mode", "title": "Type & Durée", "subtitle": "Choisissez votre aventure" },
      { "id": "zone", "title": "Zone & Intérêts", "subtitle": "Où explorer ?" },
      { "id": "options", "title": "Options", "subtitle": "Personnalisez" },
      { "id": "identity", "title": "Vos infos", "subtitle": "Pour recevoir l''expérience" }
    ],
    "modes": [
      { "key": "visit", "emoji": "🚶", "label": "Visite guidée", "desc": "Découverte à votre rythme" },
      { "key": "game", "emoji": "🎮", "label": "Jeu / Quête", "desc": "Énigmes et défis" }
    ],
    "durations": [
      { "value": 120, "label": "2h", "desc": "Classique" },
      { "value": 180, "label": "3h", "desc": "Immersif" },
      { "value": 240, "label": "4h", "desc": "Grand tour" }
    ],
    "labels": {
      "pause_label": "Pause café / thé incluse",
      "email_label": "Email *",
      "email_placeholder": "jean@example.com",
      "name_label": "Nom (optionnel)",
      "name_placeholder": "Jean Dupont",
      "party_size_label": "Nombre de participants",
      "submit_label": "Créer mon expérience",
      "pricing_title": "Récapitulatif",
      "total_label": "Total",
      "next_label": "Suivant",
      "prev_label": "Retour",
      "categories_title": "Centres d''intérêt",
      "categories_hint": "Optionnel — laissez vide pour un parcours varié",
      "success_title": "C''est parti !",
      "success_desc": "Redirection vers votre expérience..."
    },
    "unavailable_message": "Cette page est temporairement indisponible. Revenez bientôt !"
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;
