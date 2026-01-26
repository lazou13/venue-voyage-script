

# Création du Premier Administrateur

## Problème

Le système est configuré en mode "admin-only" sans inscription publique. Mais aucun utilisateur n'existe encore dans `auth.users`, donc impossible de se connecter.

---

## Solution

Créer le premier utilisateur admin via une **Edge Function sécurisée** qui utilise le Service Role pour :
1. Créer l'utilisateur dans `auth.users`
2. Lui assigner le rôle `admin` dans `user_roles`

---

## Implémentation

### 1. Edge Function : `create-first-admin`

Créer `supabase/functions/create-first-admin/index.ts` :

- **Sécurité** : Vérifier qu'aucun admin n'existe (bootstrap only)
- **Action** : Créer l'utilisateur avec l'email et mot de passe fournis
- **Auto-assign** : Insérer automatiquement le rôle `admin`

```typescript
// Pseudo-code
if (existingAdmins.count > 0) {
  return error("Un admin existe déjà");
}
const { user } = await supabaseAdmin.auth.admin.createUser({
  email, password, email_confirm: true
});
await supabaseAdmin.from('user_roles').insert({ user_id: user.id, role: 'admin' });
```

### 2. Appel unique

Après déploiement, appeler la fonction une seule fois avec :
```bash
curl -X POST https://[project].supabase.co/functions/v1/create-first-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@questrides.com","password":"votre_mot_de_passe"}'
```

Ou via l'interface : je peux ajouter un bouton temporaire "Créer le premier admin" visible uniquement si `user_roles` est vide.

---

## Alternative Simple (sans Edge Function)

Si vous préférez éviter la complexité, je peux :

1. **Ajouter temporairement** un formulaire d'inscription sur `/auth`
2. Vous créez votre compte
3. Je lance la requête SQL pour vous assigner le rôle admin
4. **Supprimer** le formulaire d'inscription

---

## Fichiers impactés

| Fichier | Action |
|---------|--------|
| `supabase/functions/create-first-admin/index.ts` | Créer |
| OU `src/pages/Auth.tsx` | Modifier temporairement |

---

## Recommandation

L'**Edge Function** est plus propre et sécurisée (se désactive automatiquement après le premier admin). Mais l'**ajout temporaire du signup** est plus rapide à implémenter.

