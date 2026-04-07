

## Constat

Votre compte admin `contact@questrides.com` est déjà créé en base avec le rôle admin. Deux autres comptes test existent aussi. L'inscription n'a plus lieu d'être — il suffit de la retirer.

## Plan

### 1. Supprimer l'inscription de la page Auth
- **Fichier** : `src/pages/Auth.tsx`
- Retirer le mode `signup`, le formulaire d'inscription, et le bouton "Inscription" du switcher
- Ne garder que **Connexion** et **Mot de passe oublié**
- Supprimer les imports et variables liés au signup (`adminCode`, `signupSchema`, `KeyRound`, `UserPlus`)

### 2. Nettoyer les comptes test (optionnel)
- Supprimer les 2 comptes test (`test-admin@questrides.com`, `admin-test-2@questrides.com`) via une migration pour garder la base propre

### 3. Résultat
- Sur `huntplanerpro.questrides.com/auth` : uniquement un formulaire de connexion
- Personne ne peut s'inscrire
- Vous seul pouvez vous connecter avec `contact@questrides.com`

### Fichiers modifiés
| Fichier | Changement |
|---------|-----------|
| `src/pages/Auth.tsx` | Retirer signup, garder login + forgot uniquement |

