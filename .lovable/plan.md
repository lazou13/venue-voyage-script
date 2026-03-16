

## Plan : Mode conversationnel IA + correction d'identification GPS

### Problèmes identifiés

1. **GPS imprécis → mauvaise identification** : L'IA reçoit les coordonnées GPS et devine le lieu. Mais le GPS mobile en médina (ruelles étroites, murs épais) peut avoir 50-100m d'erreur, ce qui fait confondre des lieux proches. L'IA n'a **aucun moyen d'être corrigée** car `custom_instruction` est ignoré dans le code backend (ligne 434 : seuls `photo_url, audio_url, lat, lng, note, existing_pois, nearby_markers` sont extraits).

2. **Pas de conversation** : Chaque appel repart de zéro. L'utilisateur ne peut pas dire "non c'est Medina Mall, pas les Tombeaux Saadiens".

### Corrections

#### 1. Edge function `analyze-marker` — accepter `custom_instruction` + `previous_analysis`

**Fichier : `supabase/functions/analyze-marker/index.ts`**

- Ligne 434 : ajouter `custom_instruction` et `previous_analysis` à la destructuration du body
- Si `previous_analysis` existe :
  - Injecter un message `assistant` avec le JSON de l'analyse précédente
  - Puis un message `user` avec la correction humaine (`custom_instruction`)
  - Cela crée un historique conversationnel : système → analyse initiale → correction → nouvelle analyse
- Si `custom_instruction` seule (sans previous) : l'ajouter au prompt utilisateur principal
- Ajouter au prompt système une instruction : "Si l'utilisateur te corrige, accepte sa correction comme vérité terrain et ajuste toute ton analyse en conséquence."

#### 2. Frontend `MarkerDetailSheet` — envoyer le contexte conversationnel

**Fichier : `src/components/intake/MarkerDetailSheet.tsx`**

- Dans `handleEnrichAI(customPrompt)` : si `analysis` existe et `customPrompt` fourni, envoyer `previous_analysis: analysis` dans le body
- Rendre le champ de conversation toujours visible quand une analyse existe (plus besoin de cliquer "Demander une modification")
- Afficher le `location_guess` de l'IA en badge visible pour que l'utilisateur voie immédiatement l'erreur
- Placeholder dynamique : "Ce n'est pas ça, c'est en fait..." quand analyse présente

#### 3. Prompt système — instruction de correction

Ajouter au `SYSTEM_PROMPT` :
```
## CORRECTION HUMAINE
Si l'utilisateur te corrige sur l'identification du lieu, accepte sa correction comme VÉRITÉ ABSOLUE.
Ne répète jamais une identification erronée après correction. Réanalyse entièrement avec le bon lieu.
```

### Résultat

```
Avant : GPS imprécis → IA dit "Tombeaux Saadiens" → utilisateur tape correction → RIEN ne se passe
Après : GPS imprécis → IA dit "Tombeaux Saadiens" → utilisateur tape "c'est medina mall" → IA reçoit sa propre erreur + correction → produit analyse correcte de Medina Mall
```

