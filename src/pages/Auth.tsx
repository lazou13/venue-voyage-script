import { useState, useEffect, Component, ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Mail, LogIn, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

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

const loginSchema = z.object({
  email: z.string().trim().email({ message: "Email invalide" }),
  password: z.string().min(6, { message: "Mot de passe trop court (min. 6 caractères)" }),
});
const forgotSchema = z.object({
  email: z.string().trim().email({ message: "Email invalide" }),
});

type AuthMode = 'login' | 'forgot';

function AuthInner() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isReady, signIn } = useAuthContext();

  const modeParam = (searchParams.get('mode') || 'login') as AuthMode;
  const mode = ['login', 'forgot'].includes(modeParam) ? modeParam : 'login';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Administration</CardTitle>
          <CardDescription>
            {mode === 'login' ? 'Connectez-vous pour accéder à la configuration' : 'Réinitialisez votre mot de passe'}
          </CardDescription>
        </CardHeader>
        <CardContent>
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
