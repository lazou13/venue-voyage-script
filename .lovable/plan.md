
# Ajout Inscription et Mot de passe oublié - Page Auth

## Contexte

L'utilisateur `contact@questrides.com` existe dans `auth.users` avec le rôle admin, mais le mot de passe ne fonctionne pas (malgré les tentatives de reset via l'edge function). 

Vous souhaitez :
1. Ajouter un formulaire d'inscription (réservé admin avec code secret)
2. Ajouter "Mot de passe oublié" (envoi d'email à contact@questrides.com)

---

## Solution

### 1. Modifier la page Auth (`src/pages/Auth.tsx`)

Ajouter trois modes :
- **Login** (actuel)
- **Inscription** (avec code secret pour devenir admin)
- **Mot de passe oublié** (reset via email)

Structure du composant :

```text
┌────────────────────────────────────────┐
│           Administration               │
├────────────────────────────────────────┤
│  [Connexion] [Inscription]             │
├────────────────────────────────────────┤
│  Email: _______________                │
│  Mot de passe: _________               │
│  (si inscription) Code admin: ______   │
│                                        │
│  [Se connecter / S'inscrire]           │
│                                        │
│  Mot de passe oublié ?                 │
└────────────────────────────────────────┘
```

### 2. Logique d'inscription sécurisée

- Champ "Code admin" requis pour l'inscription
- Le code est vérifié côté serveur (Edge Function)
- Si le code est valide, l'utilisateur est créé ET reçoit le rôle `admin`
- Sans code valide, l'inscription échoue

### 3. Edge Function `admin-signup`

Créer `supabase/functions/admin-signup/index.ts` :

- Vérifie le code secret (stocké en variable d'environnement)
- Crée l'utilisateur via Service Role
- Assigne automatiquement le rôle `admin`

### 4. Mot de passe oublié

Utiliser `supabase.auth.resetPasswordForEmail()` qui envoie un email de réinitialisation via le système Supabase intégré.

### 5. Page de reset du mot de passe

Créer `src/pages/ResetPassword.tsx` pour gérer le lien de reset reçu par email.

---

## Fichiers à créer/modifier

| Fichier | Action |
|---------|--------|
| `src/pages/Auth.tsx` | Modifier - Ajouter tabs Login/Signup + lien reset |
| `supabase/functions/admin-signup/index.ts` | Créer - Inscription sécurisée avec code |
| `src/pages/ResetPassword.tsx` | Créer - Formulaire nouveau mot de passe |
| `src/App.tsx` | Modifier - Ajouter route `/reset-password` |
| `supabase/config.toml` | Modifier - Ajouter fonction admin-signup |

---

## Secret requis

Un secret `ADMIN_SIGNUP_CODE` sera nécessaire. Je vous demanderai de le définir (ex: `QuestRidesAdmin2024`).

---

## Flux utilisateur

### Inscription admin :
1. Aller sur `/auth` → onglet "Inscription"
2. Remplir email, mot de passe, code admin
3. Si code valide → compte créé avec rôle admin
4. Redirection vers `/admin/config`

### Mot de passe oublié :
1. Cliquer "Mot de passe oublié ?"
2. Entrer email
3. Recevoir email avec lien
4. Cliquer le lien → page `/reset-password`
5. Entrer nouveau mot de passe
6. Redirection vers `/auth` pour se connecter

---

## Détails techniques

### Auth.tsx - Structure des états

```typescript
type AuthMode = 'login' | 'signup' | 'forgot';

const [mode, setMode] = useState<AuthMode>('login');
const [adminCode, setAdminCode] = useState('');
```

### Admin Signup Edge Function

```typescript
// Pseudo-code
const ADMIN_CODE = Deno.env.get('ADMIN_SIGNUP_CODE');

if (providedCode !== ADMIN_CODE) {
  return error('Code admin invalide');
}

const { user } = await supabaseAdmin.auth.admin.createUser({
  email, password, email_confirm: true
});

await supabaseAdmin.from('user_roles').insert({
  user_id: user.id, role: 'admin'
});
```

### Reset Password Flow

```typescript
// Envoi email
await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/reset-password`
});

// Page reset-password
await supabase.auth.updateUser({ password: newPassword });
```

---

## Résultat attendu

Après implémentation :
- Vous pourrez créer un nouveau compte admin avec le code secret
- Ou réinitialiser le mot de passe de `contact@questrides.com` via email
- L'accès admin reste sécurisé (code requis pour inscription)
