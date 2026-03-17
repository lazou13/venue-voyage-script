

# Plan : Chat conversationnel IA dans MarkerDetailSheet

## Objectif
Remplacer le champ de correction one-shot par un vrai panneau de chat avec historique de messages, comme une conversation ChatGPT. L'utilisateur peut discuter librement avec l'IA : corriger, demander des recherches approfondies, poser des questions, etc.

## Architecture

### Layout 3 colonnes (desktop)
```text
┌────────────────────────────────────────────────────────────┐
│  Détail du marqueur                                        │
├──────────┬───────────────────┬─────────────────────────────┤
│ LEFT     │ CENTER            │ RIGHT                       │
│ 260px    │ flex-1            │ 340px                       │
│ GPS      │ Contenu marqueur  │ 💬 Chat IA                  │
│ Photo    │ (textarea)        │ ┌─────────────────────────┐ │
│ Audio    │                   │ │ 🧠 Analyse initiale...  │ │
│          │                   │ │                         │ │
│ Bouton   │                   │ │ 👤 C'est la maison des  │ │
│ Enrichir │                   │ │    cigognes             │ │
│          │                   │ │                         │ │
│          │                   │ │ 🧠 Compris ! Voici la   │ │
│          │                   │ │    nouvelle analyse...  │ │
│          │                   │ └─────────────────────────┘ │
│          │                   │ [Recherche approfondie]     │
│          │                   │ [Corrige le nom] [+ détails]│
│          │                   │ [__________________] [>]    │
├──────────┴───────────────────┴─────────────────────────────┤
│ Supprimer          Fermer  Enregistrer  Approuver          │
└────────────────────────────────────────────────────────────┘
```

### Fichier 1 : `src/components/intake/MarkerDetailSheet.tsx`

1. **State `chatMessages`** : `{role: 'user'|'assistant', content: string}[]`, reset quand marker.id change
2. **Panneau chat** (colonne droite) :
   - ScrollArea avec bulles user/assistant stylisees differemment
   - Quand l'analyse initiale arrive, ajouter un message assistant resume
   - Input + bouton envoyer en bas
   - Chips d'actions rapides au-dessus de l'input : "Recherche approfondie", "Corrige le nom du lieu", "Plus de details historiques", "Restaurants proches", "Site web"
3. **Logique d'envoi** : 
   - Ajoute le message user au chat
   - Appelle `analyze-marker` avec `chat_history` (tout l'historique) au lieu de `custom_instruction`
   - A la reception, ajoute la reponse assistant ET met a jour la note enrichie
4. **Suppression** de l'ancien textarea de correction et du bouton "Donner un indice"
5. **Dialog passe a `max-w-6xl`** pour accommoder 3 colonnes
6. **Responsive** : sur mobile, le chat passe sous le contenu

### Fichier 2 : `supabase/functions/analyze-marker/index.ts`

1. **Nouveau parametre `chat_history`** : `{role: string, content: string}[]`
2. Quand `chat_history` est fourni :
   - Injecter le premier echange (analyse initiale) comme message assistant resume (seulement `location_guess`, `category`, `guide_narration.fr`, `historical_anecdote`)
   - Ajouter les messages user/assistant suivants
   - Le dernier message user est la nouvelle instruction
3. Garde le mode `custom_instruction` comme fallback pour compatibilite
4. **Alleger `previous_analysis`** dans les messages : ne garder que les champs cles pour eviter les erreurs 400

## Fichiers impactes
- `src/components/intake/MarkerDetailSheet.tsx` (refonte layout + panneau chat)
- `supabase/functions/analyze-marker/index.ts` (support `chat_history` multi-turn)

