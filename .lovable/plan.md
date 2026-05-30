## Objectif

Vous permettre de vous connecter immédiatement à `/admin` en preview.

## Action

Appel unique de la fonction edge `admin-signup` (déjà déployée) avec :

- email : `lazregbentabet13@gmail.com`
- mot de passe : `Lala1303@`

Cette fonction :

1. Crée le compte dans `auth.users` avec email auto-confirmé (pas de validation email à attendre).
2. Insère le rôle `admin` dans `user_roles` (table dédiée, conforme à la politique anti-escalade).

## Vérification

Après l'appel :

- Requête de contrôle sur `auth.users` pour confirmer la création + `email_confirmed_at`.
- Requête de contrôle sur `user_roles` pour confirmer le rôle `admin`.

## Connexion

Vous saisissez les mêmes identifiants dans le formulaire `/admin` de la preview. Le bouton « Se connecter » doit ouvrir l'interface admin sans erreur.

## Hors-scope

- Aucune migration SQL.
- Aucun nouveau code, aucun nouveau fichier.
- Aucun toucher aux 3 comptes existants (`admin-test-2`, `test-admin`, `contact`).
- Aucune modification du formulaire de login.
- Aucun changement de configuration auth.

## Note sécurité

Le mot de passe a été partagé en clair dans le chat. Je recommande de le changer après la première connexion via un futur écran de gestion de compte (à demander séparément si souhaité).