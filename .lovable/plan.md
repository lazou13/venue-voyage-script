

# Sécurisation Admin-Only pour la Configuration

## Résumé

Implémentation d'un système d'authentification simplifié **admin-only** :
- Page de login (pas d'inscription publique)
- Vérification du rôle admin côté serveur
- Les admins sont créés manuellement en base

---

## Changements Base de Données

### 1. Créer le système de rôles

```text
┌─────────────────┐       ┌─────────────────┐
│   auth.users    │       │   user_roles    │
├─────────────────┤       ├─────────────────┤
│ id (uuid, PK)   │◄──────│ user_id (FK)    │
│ email           │       │ role (app_role) │
└─────────────────┘       │ id (uuid, PK)   │
                          └─────────────────┘
```

**Migration SQL :**
- Créer enum `app_role` avec valeur unique `'admin'`
- Créer table `user_roles` (user_id, role)
- Créer fonction `has_role(_user_id, _role)` avec `SECURITY DEFINER`
- Mettre à jour les policies RLS de `app_configs` pour INSERT/UPDATE/DELETE → admins only

---

## Nouveaux Fichiers

### 2. `src/hooks/useAuth.ts`

Hook d'authentification simplifié :
- État : `user`, `session`, `isLoading`
- Méthodes : `signIn(email, password)`, `signOut()`
- Pas de `signUp` exposé (admins créés manuellement)

### 3. `src/hooks/useAdminRole.ts`

Vérification du rôle admin via RPC :

```typescript
export function useAdminRole(userId?: string) {
  // Appel à supabase.rpc('has_role', { _user_id: userId, _role: 'admin' })
  // Retourne { isAdmin, isLoading }
}
```

### 4. `src/pages/Auth.tsx`

Page de login minimaliste :
- Formulaire email/password
- Pas d'onglet inscription
- Redirection vers `/admin/config` après connexion
- Style cohérent avec le reste de l'app

---

## Modifications

### 5. `src/pages/AdminConfig.tsx`

Remplacer le check non sécurisé :

**Avant :**
```typescript
const isAdminMode = () => {
  return import.meta.env.VITE_ADMIN_MODE === 'true' || 
         localStorage.getItem('admin_mode') === 'true';
};
```

**Après :**
```typescript
const { user, isLoading: authLoading } = useAuth();
const { isAdmin, isLoading: roleLoading } = useAdminRole(user?.id);

// États UI :
// 1. Chargement → spinner
// 2. Non connecté → bouton "Se connecter" → /auth
// 3. Connecté mais pas admin → "Accès refusé"
// 4. Admin → interface complète
```

### 6. `src/App.tsx`

Ajouter route `/auth`

---

## Configuration Premier Admin

Après déploiement, créer le premier admin manuellement :

1. Créer un compte via `/auth` (si signup temporairement activé) ou directement en base
2. Exécuter dans "Run SQL" du backend :

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'ton.email@example.com';
```

---

## Fichiers Impactés

| Fichier | Action |
|---------|--------|
| `supabase/migrations/xxx_admin_roles.sql` | Créer |
| `src/hooks/useAuth.ts` | Créer |
| `src/hooks/useAdminRole.ts` | Créer |
| `src/pages/Auth.tsx` | Créer |
| `src/pages/AdminConfig.tsx` | Modifier |
| `src/App.tsx` | Modifier |

---

## Détails Techniques

### Migration SQL Complète

```sql
-- 1. Enum avec uniquement 'admin'
CREATE TYPE public.app_role AS ENUM ('admin');

-- 2. Table user_roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- 3. Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Fonction secure pour check role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 5. RLS pour user_roles (lecture propre, modif admin only)
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. Policies INSERT/UPDATE/DELETE pour app_configs
CREATE POLICY "Admins can insert app_configs"
  ON public.app_configs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update app_configs"
  ON public.app_configs FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete app_configs"
  ON public.app_configs FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
```

### Structure useAuth.ts

```typescript
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );
    
    // 2. Then get session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({ email, password });
  };

  const signOut = async () => {
    return await supabase.auth.signOut();
  };

  return { user, session, isLoading, signIn, signOut };
}
```

### Structure useAdminRole.ts

```typescript
export function useAdminRole(userId: string | undefined) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    supabase.rpc('has_role', { _user_id: userId, _role: 'admin' })
      .then(({ data, error }) => {
        setIsAdmin(data === true && !error);
        setIsLoading(false);
      });
  }, [userId]);

  return { isAdmin, isLoading };
}
```

---

## QA

1. **Utilisateur non connecté** → `/admin/config` → voit "Se connecter"
2. **Utilisateur connecté sans rôle admin** → voit "Accès refusé"
3. **Admin connecté** → voit l'interface complète
4. **localStorage hack** → ne fonctionne plus
5. **Écriture en base sans être admin** → bloqué par RLS

