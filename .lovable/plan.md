

# Plan : Ajouter les checkboxes multi-sélection dans l'onglet Terrain

## Contexte
Actuellement, l'architecture sépare la création des étapes (onglet Terrain) de leur configuration détaillée (onglet Étapes). L'utilisateur souhaite pouvoir cocher plusieurs possibilités directement dans le formulaire de l'onglet Terrain.

## Solution proposée

Intégrer les sections multi-sélection "Possibilités d'étape" et "Possibilités de validation" directement dans le composant POICard de FieldworkStep.

## Fichiers à modifier

### 1. src/components/intake/FieldworkStep.tsx

**Ajouts :**
- Import du composant `EnumCheckboxGroup`
- Import des types `StepType`, `ValidationMode` et leurs labels
- Ajout des sections multi-sélection dans le formulaire d'édition POI (après le champ Notes)

```text
POICard (mode édition)
+------------------------------------+
| Nom          | Zone                |
+------------------------------------+
| Interaction  | Risque | Minutes    |
+------------------------------------+
| Notes                              |
+------------------------------------+
| Photo                              |
+------------------------------------+
| [NOUVEAU] Possibilités d'étape     |
|   [ ] Narration  [ ] QCM  [ ] ... |
+------------------------------------+
| [NOUVEAU] Possibilités validation  |
|   [ ] QR Code  [ ] Photo  [ ] ... |
+------------------------------------+
```

**Modifications nécessaires :**

1. **Lignes 1-15** : Ajouter les imports
   - `EnumCheckboxGroup` depuis `./shared/EnumCheckboxGroup`
   - `StepType`, `ValidationMode`, `StepConfig`, `STEP_TYPE_LABELS`, `VALIDATION_MODE_LABELS` depuis `@/types/intake`

2. **Interface POICardProps** : Déjà compatible (onUpdate accepte Partial<POI>)

3. **Fonction POICard (lignes 268-437)** : Ajouter après le bloc "Photo" (ligne 417) :
   ```tsx
   {/* Multi-select: Step Types */}
   <EnumCheckboxGroup<StepType>
     label="Possibilités d'étape"
     values={poi.step_config?.possible_step_types || []}
     onChange={(values) => onUpdate({ 
       step_config: { 
         ...poi.step_config, 
         possible_step_types: values 
       } 
     })}
     options={STEP_TYPE_LABELS}
   />

   {/* Multi-select: Validation Modes */}
   <EnumCheckboxGroup<ValidationMode>
     label="Possibilités de validation"
     values={poi.step_config?.possible_validation_modes || []}
     onChange={(values) => onUpdate({ 
       step_config: { 
         ...poi.step_config, 
         possible_validation_modes: values 
       } 
     })}
     options={VALIDATION_MODE_LABELS}
   />
   ```

## Impact sur l'UX

- Les utilisateurs peuvent maintenant configurer les possibilités directement lors de la création/édition d'une étape
- L'onglet Étapes reste disponible pour une vue d'ensemble et les configurations avancées (décision finale, validation photo, contenu i18n)
- Aucune perte de données - les deux interfaces modifient le même champ `step_config`

## Vérification après implémentation

1. Ouvrir l'onglet Terrain
2. Cliquer sur "Modifier" sur une étape existante
3. Vérifier que les checkboxes apparaissent
4. Cocher plusieurs types (ex: Énigme + Défi + Photo)
5. Cocher plusieurs validations (ex: QR Code + Manuel)
6. Fermer et rouvrir - vérifier que les valeurs persistent
7. Aller dans l'onglet Étapes - vérifier que les mêmes valeurs sont affichées

