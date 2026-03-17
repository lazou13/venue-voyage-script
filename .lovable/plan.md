

# Plan : Vrai LLM conversationnel + envoi de photos dans le chat

## Probleme racine

Le chat actuel n'est **pas un vrai LLM**. Chaque message force `tool_choice: analyze_marker`, ce qui oblige l'IA a produire un JSON structuré de 30+ champs au lieu de répondre naturellement. C'est lent, rigide, et ne permet pas de vraie conversation.

## Architecture cible

Deux modes dans l'edge function :
- **Mode `chat`** (nouveau, par défaut dans le chat) : l'IA répond librement en texte, comme ChatGPT. Rapide, conversationnel.
- **Mode `analyze`** (existant) : l'IA produit le JSON structuré complet. Déclenché uniquement par le bouton "Enrichir" ou un bouton "Réanalyser".

## Modifications

### 1. Edge function `analyze-marker/index.ts`

- Nouveau paramètre `mode: 'chat' | 'analyze'` (défaut: `analyze` pour compatibilité)
- Nouveau paramètre `chat_images: { url: string }[]` pour les photos envoyées dans le chat
- En mode `chat` :
  - Pas de `tools` ni `tool_choice` -- réponse libre
  - System prompt allégé : contexte médina + instruction "réponds naturellement, tu es un expert de la médina"
  - Retourne `{ reply: string }` au lieu de `{ analysis: {...} }`
  - Les images du chat sont incluses comme `image_url` dans le dernier message user
- En mode `analyze` : comportement actuel inchangé (tool_choice structuré)

### 2. `MarkerDetailSheet.tsx` -- Chat conversationnel

- **`handleSendChat`** appelle le mode `chat` (pas `analyze`) :
  - Envoie `mode: 'chat'`, `chat_history`, `chat_images`
  - Reçoit `data.reply` (texte libre) et l'affiche comme bulle assistant
  - Ne met PAS à jour la note/analyse automatiquement (c'est une conversation)
- **Envoi de photos dans le chat** :
  - Bouton 📷 dans la barre d'input du chat
  - Upload vers storage `fieldwork/chat-images/...`
  - Affiche la miniature dans la bulle user
  - Envoie l'URL au LLM via `chat_images`
- **Bouton "Réanalyser"** (nouveau chip) : déclenche le mode `analyze` classique pour mettre à jour le JSON structuré et la note
- Le bouton "Enrichir avec l'IA" (initial) reste en mode `analyze`

### 3. UX du chat

- Les photos envoyées dans le chat s'affichent comme miniatures dans les bulles user
- L'IA répond en texte libre, avec markdown (gras, listes, etc.)
- Un chip "🔄 Réanalyser" permet de forcer une nouvelle analyse structurée quand on est satisfait de la conversation

## Fichiers impactés
- `supabase/functions/analyze-marker/index.ts` (ajout mode chat)
- `src/components/intake/MarkerDetailSheet.tsx` (mode chat + upload photos dans chat)

