

# Plan : Corriger la sauvegarde dans EnrichmentDrilldown

## Diagnostic

Le problème n'est probablement pas que la sauvegarde échoue — c'est que après sauvegarde, la liste se rafraîchit en mode "Manquants" et le POI modifié disparaît (car il est maintenant "rempli"). L'utilisateur pense que rien n'a été enregistré.

Cependant, il peut aussi y avoir un vrai bug : le `.update({ [field]: value })` avec une clé dynamique peut être rejeté silencieusement par le client typé Supabase. Il faut sécuriser les deux cas.

## Corrections

### 1. Feedback visuel après sauvegarde (`EnrichmentDrilldown.tsx`)

- Après une sauvegarde réussie, afficher un toast explicite avec le nom du POI : `"Café Clock → Histoires sauvegardé ✓"`
- Ne pas basculer immédiatement la vue — garder le POI visible pendant 2 secondes avant invalidation, ou basculer automatiquement vers "Remplis" après sauvegarde

### 2. Forcer le cast pour l'update Supabase

- Caster le payload en `as any` pour éviter que le client typé rejette la clé dynamique :
  ```typescript
  .update({ [field]: value || null } as any)
  ```

### 3. Ajouter un log d'erreur détaillé

- Dans `onError`, logger l'erreur complète en console pour le debug :
  ```typescript
  onError: (err) => {
    console.error('Enrichment save error:', err);
    toast.error('Erreur de sauvegarde');
  }
  ```

### 4. Après sauvegarde réussie, basculer vers "Remplis"

- Dans `onSuccess`, si on est en mode "Manquants", basculer `showFilled` à `true` pour que l'utilisateur voie son POI modifié dans la liste des remplis.

## Fichier modifié

| Fichier | Changement |
|---|---|
| `src/components/admin/EnrichmentDrilldown.tsx` | Cast `as any`, meilleur feedback toast, bascule auto vers "Remplis" après save, log erreur |

