

# Plan : Page Admin Agent Chat

## Résumé
Créer une page `/admin/agent-chat` avec une interface chat conversationnelle qui appelle une Edge Function `agent-chat` via `supabase.functions.invoke`. Ajouter la route, le lazy import, et l'entrée sidebar.

## Fichiers à créer/modifier

### 1. Créer `supabase/functions/agent-chat/index.ts`
- Edge Function utilisant Lovable AI Gateway (`google/gemini-2.5-flash`)
- System prompt spécialisé : expert POI Medina, pilotage enrichissement, état de la base
- Accepte `{ messages }` et retourne une réponse SSE streamée
- CORS headers, gestion erreurs 429/402

### 2. Créer `src/pages/admin/AdminAgentChat.tsx`
- Interface chat complète avec :
  - Liste de messages scrollable (user/assistant) avec rendu Markdown (`react-markdown`)
  - Input + bouton d'envoi
  - Streaming token-by-token via fetch SSE vers `agent-chat`
  - État loading avec indicateur de frappe
  - Historique conversation en mémoire (pas de persistance DB)

### 3. Modifier `src/App.tsx`
- Ajouter lazy import : `const AdminAgentChat = lazy(() => import("./pages/admin/AdminAgentChat"))`
- Ajouter route : `<Route path="agent-chat" element={<AdminAgentChat />} />`

### 4. Modifier `src/components/admin/AdminSidebar.tsx`
- Ajouter entrée : `{ to: '/admin/agent-chat', label: 'Agent Chat', icon: Bot }` (Bot déjà importé dans d'autres composants)

## Détails techniques
- Streaming SSE avec parsing ligne par ligne, flush final, gestion `[DONE]`
- Pas de persistance des messages — session uniquement
- `react-markdown` pour le rendu des réponses IA
- Installation de `react-markdown` si absent

