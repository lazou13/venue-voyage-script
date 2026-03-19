

## Plan: Integrate QuestBuilder + QuestResult into AdminMedinaCustomBuilder

**File modified:** `src/pages/admin/AdminMedinaCustomBuilder.tsx` only (299 lines -> ~370 lines)

### Step 1 — Add imports (top of file, after line 13)

Add 3 imports:
- `QuestBuilder` from `@/components/quest/QuestBuilder`
- `QuestResultDisplay` from `@/components/quest/QuestResult` (aliased to avoid naming clash with existing `result` state)
- `type QuestResult` from `@/hooks/useQuestEngine`
- `Sparkles` icon from `lucide-react` (for the toggle button)

### Step 2 — Add state (after line 35)

Add 2 new `useState`:
- `questResult: QuestResult | null` (initially `null`)
- `showNewEngine: boolean` (initially `false`)

### Step 3 — Add "New Engine" toggle card (after the hub selector, around line 212, before the existing Generate button)

A Card with:
- Title: "✨ Nouveau moteur QuestEngine v3.0"
- Description: "Génère chasse au trésor ET visite guidée depuis ce hub."
- Button: "Utiliser le nouveau moteur →" that sets `showNewEngine=true` and `questResult=null`
- Only visible when `!showNewEngine` and a hub is selected (`startHub !== null`)

### Step 4 — Add new engine UI blocks (before the closing `</div>` at line 297)

Two conditional blocks:

1. **QuestBuilder view** (`showNewEngine && !questResult`): Card wrapper with title "QuestEngine v3.0", a back button, and the `QuestBuilder` component receiving `startHub.lat`, `startHub.lng`, `startHub.name` as props. Falls back to `0, 0` if no hub.

2. **QuestResult view** (`showNewEngine && questResult`): The `QuestResultDisplay` component with `onRestart` resetting `questResult` to null.

### What stays untouched
- All existing imports, state, functions (`handleGenerate`, `handleCreate`, `toggleCategory`)
- The legacy flow (zone selector, category badges, old generate button, preview panel)
- No other files modified

