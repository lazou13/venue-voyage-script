

# Plan: Page /creez-votre-experience + Admin

## Scope

Install `framer-motion`. Create a premium 4-step wizard page at `/creez-votre-experience` (fully functional, calls `public-generate-quest` and redirects to `/play`). Create admin page at `/admin/experience-page` to edit/publish/depublish the page config. Seed `experience_page_config` in `app_configs`. Zero hardcoded strings.

## Database

**Seed migration**: Insert into `app_configs` a row with `key='experience_page_config'`, `status='published'`, `version=1` containing the full JSON config (hero texts, step labels, modes, durations, labels, unavailable message). No schema change needed — `app_configs` already exists.

Also update `DURATION_TO_COUNT` in `public-generate-quest` to support 180 and 240 minute durations (currently only 60/90/120). Add mappings: `180: 12, 240: 15`.

## Config JSON (experience_page_config)

```json
{
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
    { "id": "identity", "title": "Vos infos", "subtitle": "Pour recevoir l'expérience" }
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
    "categories_title": "Centres d'intérêt",
    "categories_hint": "Optionnel — laissez vide pour un parcours varié",
    "success_title": "C'est parti !",
    "success_desc": "Redirection vers votre expérience..."
  },
  "unavailable_message": "Cette page est temporairement indisponible. Revenez bientôt !"
}
```

## Files to create (8)

1. **`src/pages/PublicExperienceWizard.tsx`** — Main page
   - Fetches `experience_page_config` (published) + pricing config + zones
   - If depublished → full-screen unavailable message from config
   - Hero → WizardProgress → AnimatePresence step transitions → PricingBox
   - Desktop: 2-col (wizard 2/3, pricing 1/3 sticky). Mobile: single col + fixed bottom pricing bar
   - On submit: calls `public-generate-quest` → redirect `/play?token=...`

2. **`src/components/experience/ExperienceHero.tsx`** — Hero with gradient, benefit chips, CTA scroll

3. **`src/components/experience/WizardProgress.tsx`** — Step indicator bar with motion layoutId

4. **`src/components/experience/StepMode.tsx`** — Mode cards + duration cards with whileHover/whileTap

5. **`src/components/experience/StepZone.tsx`** — Zone select + animated category badges

6. **`src/components/experience/StepOptions.tsx`** — Pause + add-ons + mini recap

7. **`src/components/experience/StepIdentity.tsx`** — Email + name + party size + honeypot

8. **`src/components/experience/PricingBox.tsx`** — Sticky sidebar / mobile bottom sheet with live pricing via `calculatePrice`

9. **`src/pages/admin/AdminExperiencePage.tsx`** — Load/edit/save/publish/depublish `experience_page_config` from `app_configs`. Structured form for hero, steps, modes, durations, labels. Same draft/publish pattern as existing admin pages.

## Files to modify (3)

1. **`src/App.tsx`** — Add routes:
   - `/creez-votre-experience` → `PublicExperienceWizard`
   - Admin child route `experience-page` → `AdminExperiencePage`

2. **`src/components/admin/AdminSidebar.tsx`** — Add nav item "Page Expérience" with Sparkles icon

3. **`supabase/functions/public-generate-quest/index.ts`** — Add duration mappings `180: 12, 240: 15` to `DURATION_TO_COUNT`, and add `180, 240` to the validation allowlist

## Technical details

- **Framer Motion**: `AnimatePresence mode="wait"` wrapping steps. Slide left/right based on navigation direction. `motion.div` with `whileHover={{ scale: 1.03 }}` on cards.
- **Icon mapping**: Simple object mapping config icon strings (`clock`, `smartphone`, `camera`) to lucide components.
- **Submit flow**: Real API call to `public-generate-quest` via `supabase.functions.invoke()`, then redirect to `/play?token=...` on success. Error handling with toast.
- **Admin page**: Standalone config management (not via global `useAppConfig` which is for `capabilities` key). Direct fetch/upsert on `app_configs` for key `experience_page_config`.
- **Mobile pricing**: Fixed bottom bar with total + expand toggle for full breakdown.
- **Validation**: Email required + format check before step 4 submit. Zone required before advancing past step 2.

