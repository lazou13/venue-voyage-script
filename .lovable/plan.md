

# Plan : Suppression de photos dans la Médiathèque

## Approche

Ajouter un bouton "Supprimer" pour les photos sélectionnées, avec dialogue de confirmation. La suppression retire l'URL du tableau `photo_urls` du marqueur (ou vide `photo_url`). Si le marqueur n'a plus aucune photo, on le conserve (il peut avoir des notes/audio).

## Modifications dans `AdminMediaLibrary.tsx`

1. **Ajouter `useQueryClient`** pour invalider le cache après suppression
2. **Ajouter un state `isDeleting`** et une fonction `deleteSelected` qui :
   - Regroupe les URLs sélectionnées par `markerId`
   - Pour chaque marqueur, met à jour `photo_urls` en retirant les URLs supprimées (et vide `photo_url` si concerné)
   - Supprime aussi les fichiers du bucket `fieldwork` (extraction du path depuis l'URL)
   - Invalide la query `media-library-markers`
   - Vide la sélection
3. **Ajouter un `AlertDialog`** de confirmation avant suppression ("Supprimer X photos ? Cette action est irréversible.")
4. **Ajouter un bouton `Trash2`** à côté du bouton "Télécharger" quand des photos sont sélectionnées

## Fichiers impactés
- `src/pages/admin/AdminMediaLibrary.tsx` uniquement

