import { useState, useEffect, Component, ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Mail, LogIn, AlertCircle, UserPlus, KeyRound, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

// ---------- Error Boundary ----------
class AuthErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <CardTitle>Erreur d'affichage</CardTitle>
              <CardDescription>Un problème est survenu. Rechargez la page.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => window.location.reload()}>Recharger</Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------- Schemas ----------
const loginSchema = z.object({
  email: z.string().trim().email({ message: "Email invalide" }),
  password: z.string().min(6, { message: "Mot de passe trop court (min. 6 caractères)" }),
});
const signupSchema = z.object({
  email: z.string().trim().email({ message: "Email invalide" }),
  password: z.string().min(6, { message: "Mot de passe trop court (min. 6 caractères)" }),
  adminCode: z.string().min(1, { message: "Code admin requis" }),
});
const forgotSchema = z.object({
  email: z.string().trim().email({ message: "Email invalide" }),
});

type AuthMode = 'login' | 'signup' | 'forgot';

// ---------- Main ----------
function AuthInner() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isReady, signIn } = useAuthContext();

  const modeParam = (searchParams.get('mode') || 'login') as AuthMode;
  const mode = ['login', 'signup', 'forgot'].includes(modeParam) ? modeParam : 'login';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isReady && user) navigate('/admin', { replace: true });
  }, [user, isReady, navigate]);

  const setMode = (m: AuthMode) => {
    setSearchParams({ mode: m }, { replace: true });
    setEmail('');
    setPassword('');
    setAdminCode('');
    setError(null);
    setSuccess(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const v = loginSchema.safeParse({ email, password });
    if (!v.success) { setError(v.error.errors[0].message); return; }
    setIsSubmitting(true);
    const { error: err } = await signIn(email, password);
    if (err) {
      setError(err.message.includes('Invalid login') ? 'Identifiants invalides'
        : err.message.includes('Email not confirmed') ? 'Email non confirmé' : err.message);
    }
    setIsSubmitting(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const v = signupSchema.safeParse({ email, password, adminCode });
    if (!v.success) { setError(v.error.errors[0].message); return; }
    setIsSubmitting(true);
    try {
      const res = await supabase.functions.invoke('admin-signup', { body: { email, password, adminCode } });
      if (res.data?.error) { setError(res.data.error); setIsSubmitting(false); return; }
      if (res.error) { setError(res.error.message || "Erreur lors de l'inscription"); setIsSubmitting(false); return; }
      setSuccess('Compte créé ! Connexion en cours...');
      const { error: signInErr } = await signIn(email, password);
      if (signInErr) { setSuccess(null); setError('Compte créé mais erreur de connexion. Essayez de vous connecter.'); }
    } catch { setError('Erreur serveur inattendue'); }
    setIsSubmitting(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null);
    const v = forgotSchema.safeParse({ email });
    if (!v.success) { setError(v.error.errors[0].message); return; }
    setIsSubmitting(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (err) { setError(err.message); } else { setSuccess('Email envoyé ! Vérifiez votre boîte de réception.'); }
    } catch { setError("Erreur lors de l'envoi de l'email"); }
    setIsSubmitting(false);
  };

  if (!isReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  const descriptions: Record<AuthMode, string> = {
    login: 'Connectez-vous pour accéder à la configuration',
    signup: 'Créez un compte administrateur',
    forgot: 'Réinitialisez votre mot de passe',
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Administration</CardTitle>
          <CardDescription>{descriptions[mode]}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Mode switcher */}
          <div className="grid grid-cols-2 gap-1 mb-6 p-1 bg-muted rounded-lg">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                mode === 'login' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                mode === 'signup' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Inscription
            </button>
          </div>

          {/* Error / Success alerts */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="border-primary/20 bg-primary/5 mb-4">
              <CheckCircle className="h-4 w-4 text-primary" />
              <AlertDescription className="text-primary">{success}</AlertDescription>
            </Alert>
          )}

          {/* LOGIN */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="login-email" type="email" placeholder="admin@example.com" value={email}
                    onChange={e => setEmail(e.target.value)} className="pl-10" disabled={isSubmitting} autoComplete="email" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="login-password" type="password" placeholder="••••••••" value={password}
                    onChange={e => setPassword(e.target.value)} className="pl-10" disabled={isSubmitting} autoComplete="current-password" />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Connexion...' : <><LogIn className="w-4 h-4 mr-2" />Se connecter</>}
              </Button>
              <div className="text-center">
                <button type="button" onClick={() => setMode('forgot')}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Mot de passe oublié ?
                </button>
              </div>
            </form>
          )}

          {/* SIGNUP */}
          {mode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="signup-email" type="email" placeholder="admin@example.com" value={email}
                    onChange={e => setEmail(e.target.value)} className="pl-10" disabled={isSubmitting} autoComplete="email" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="signup-password" type="password" placeholder="••••••••" value={password}
                    onChange={e => setPassword(e.target.value)} className="pl-10" disabled={isSubmitting} autoComplete="new-password" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-code">Code administrateur</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="admin-code" type="password" placeholder="Code secret" value={adminCode}
                    onChange={e => setAdminCode(e.target.value)} className="pl-10" disabled={isSubmitting} autoComplete="off" />
                </div>
                <p className="text-xs text-muted-foreground">Code requis pour créer un compte administrateur</p>
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Création...' : <><UserPlus className="w-4 h-4 mr-2" />Créer le compte</>}
              </Button>
            </form>
          )}

          {/* FORGOT */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="forgot-email" type="email" placeholder="admin@example.com" value={email}
                    onChange={e => setEmail(e.target.value)} className="pl-10" disabled={isSubmitting} autoComplete="email" />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Envoi...' : 'Envoyer le lien de réinitialisation'}
              </Button>
              <div className="text-center">
                <button type="button" onClick={() => setMode('login')}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Retour à la connexion
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Auth() {
  return (
    <AuthErrorBoundary>
      <AuthInner />
    </AuthErrorBoundary>
  );
}
