

# Correction du Compte Admin

## Diagnostic

L'analyse révèle un problème :
- Un rôle admin existe dans `user_roles` (user_id: `7abfcf3a-59dd-4790-9914-a177d88ef8a5`)
- Mais l'utilisateur correspondant dans `auth.users` n'a pas été créé correctement ou a un mot de passe différent
- Les logs auth montrent "Invalid login credentials" à chaque tentative

## Solution

### Étape 1 : Nettoyer l'entrée orpheline

Migration SQL pour supprimer le rôle admin orphelin :

```sql
DELETE FROM public.user_roles 
WHERE user_id = '7abfcf3a-59dd-4790-9914-a177d88ef8a5';
```

### Étape 2 : Recréer le premier admin

Appeler l'edge function `create-first-admin` avec les credentials souhaités :

```json
{
  "email": "contact@questrides.com",
  "password": "VotreNouveauMotDePasse"
}
```

## Alternative : Reset du mot de passe

Si l'utilisateur existe mais avec un mauvais mot de passe, je peux modifier l'edge function pour permettre un reset de mot de passe via le Service Role.

## Fichiers impactés

| Action | Détail |
|--------|--------|
| Migration SQL | Supprimer l'entrée orpheline |
| Appel Edge Function | Recréer l'admin proprement |

## Résultat attendu

Après ces étapes, vous pourrez vous connecter avec les nouveaux credentials sur `/auth`.

