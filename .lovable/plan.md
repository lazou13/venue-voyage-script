

## Plan : Marqueur auto-save, note vocale et ecran toujours actif

### Changements demandes

1. **Marqueur auto-save** : Quand on clique "Marqueur rapide" et qu'on prend une photo, le marqueur s'enregistre directement sans bouton "Enregistrer". La note texte reste optionnelle et editable avant la photo.
2. **Note vocale** : Ajouter la possibilite d'enregistrer une note audio via le micro, uploadee dans le storage puis attachee au marqueur.
3. **Bouton REC** : Conserver le bouton REC tel quel (pas de demarrage automatique).
4. **Ecran actif** : Utiliser l'API Wake Lock du navigateur pour empecher la tablette de mettre l'ecran en veille pendant l'enregistrement.

---

### Fichiers a modifier

#### 1. `src/hooks/useWakeLock.ts` (nouveau)

Un hook simple qui :
- Appelle `navigator.wakeLock.request('screen')` quand `active = true`
- Relache le lock quand `active = false` ou au demontage
- Gere silencieusement les navigateurs qui ne supportent pas l'API

#### 2. `src/hooks/useVoiceRecorder.ts` (nouveau)

Un hook pour enregistrer de l'audio via MediaRecorder :
- `startRecording()` : demande le micro, demarre l'enregistrement
- `stopRecording()` : arrete et retourne un `Blob` audio (webm)
- Expose `isRecording`, `duration` (compteur en secondes)
- Limite a 60 secondes max (auto-stop)

#### 3. `src/components/intake/RouteReconStep.tsx`

**Wake Lock** :
- Importer `useWakeLock` et l'activer quand `isRecording` est vrai

**Marqueur rapide - auto-save** :
- Supprimer le bouton "Enregistrer" et le bouton "Annuler"
- Quand l'utilisateur prend une photo : l'upload se fait, puis des que l'URL est obtenue le marqueur est sauvegarde automatiquement (avec la note texte si elle a ete remplie)
- Si pas de photo : ajouter un petit bouton "Valider sans photo" pour sauvegarder juste avec la note
- Feedback visuel : afficher brievement un check vert quand le marqueur est sauvegarde

**Note vocale** :
- Ajouter un bouton micro a cote du bouton photo dans le drawer du marqueur rapide
- Quand on appuie : enregistrement audio demarre (bouton devient rouge avec compteur)
- Quand on re-appuie : enregistrement s'arrete, le fichier audio est uploade dans le bucket `fieldwork` sous `voice-notes/{projectId}/`
- L'URL audio est stockee dans le champ `note` du marqueur avec un prefixe special `[audio]url` pour le differencier du texte
- Alternative : ajouter une colonne `audio_url` a la table `route_markers`

#### 4. Migration SQL (nouveau)

Ajouter la colonne `audio_url` a `route_markers` :

```text
ALTER TABLE route_markers ADD COLUMN audio_url text;
```

Cela permet de stocker la note vocale separement de la note texte.

#### 5. `src/integrations/supabase/types.ts`

Sera mis a jour automatiquement apres la migration.

---

### Details techniques

**Wake Lock** :
- L'API Wake Lock est supportee par Chrome, Edge, Safari 16.4+
- Si non supportee, le hook ne fait rien (degradation gracieuse)
- Le lock est automatiquement relache quand l'onglet perd le focus ; le hook le re-acquiert quand l'onglet revient au premier plan

**Auto-save du marqueur** :
- Le flux devient : clic "Marqueur rapide" > (optionnel: taper une note) > clic "Photo" > photo prise > upload > marqueur sauvegarde automatiquement > drawer se ferme avec toast de confirmation
- Si l'utilisateur veut juste une note sans photo : bouton "Valider" minimal

**Note vocale** :
- Format : WebM/Opus (natif MediaRecorder)
- Upload dans `fieldwork/voice-notes/{projectId}/{timestamp}.webm`
- Affichage dans la liste des marqueurs : icone audio avec lecteur mini
- Inclus dans le rapport interactif avec un player HTML5

**Rapport interactif** :
- Modifier `interactiveReportGenerator.ts` pour afficher un lecteur audio si `audio_url` est present sur un marqueur

