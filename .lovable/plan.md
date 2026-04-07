

## Créer un compte admin

### Situation
Le formulaire d'inscription sur `/auth` (onglet "Inscription") demande un **code administrateur** stocké dans le secret `ADMIN_SIGNUP_CODE`. Ce secret existe mais sa valeur est chiffrée et invisible.

### Deux options

**Option A — Vous connaissez le code admin**
1. Allez sur https://huntplanerpro.questrides.com/auth
2. Cliquez sur l'onglet **Inscription**
3. Entrez votre email, mot de passe, et le code admin
4. Le compte sera créé avec le rôle admin et vous serez connecté automatiquement

**Option B — Vous ne connaissez pas le code**
Je modifie temporairement la Edge Function `admin-signup` pour accepter un code connu (ex: un code que vous choisissez), vous créez votre compte, puis je remets le code original. Alternativement, je peux forcer le mot de passe d'un compte existant (`contact@questrides.com`) via la Edge Function `create-first-admin` en supprimant temporairement la vérification "admin déjà existant".

### Fichiers modifiés (Option B uniquement)
| Fichier | Action |
|---------|--------|
| Secret `ADMIN_SIGNUP_CODE` | Mise à jour temporaire via l'outil `update_secret` |

Aucune modification de code nécessaire si vous choisissez Option A.

