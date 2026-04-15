import { useState } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { Lock, Mail, LogIn, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

function InlineLoginForm() {
  const { signIn } = useAuthContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) { setError('Email et mot de passe requis'); return; }
    setIsSubmitting(true);
    const { error: err } = await signIn(email, password);
    if (err) {
      setError(err.message.includes('Invalid login') ? 'Identifiants invalides'
        : err.message.includes('Email not confirmed') ? 'Email non confirmé' : err.message);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-3 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <CardTitle className="text-lg">Connexion requise</CardTitle>
          <CardDescription className="text-xs">Connectez-vous pour continuer</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-3 py-2">
              <AlertCircle className="h-3 w-3" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="inline-email" className="text-xs">Email</Label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input id="inline-email" type="email" placeholder="admin@example.com" value={email}
                  onChange={e => setEmail(e.target.value)} className="pl-8 h-9 text-sm" disabled={isSubmitting} autoComplete="email" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="inline-password" className="text-xs">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input id="inline-password" type="password" placeholder="••••••••" value={password}
                  onChange={e => setPassword(e.target.value)} className="pl-8 h-9 text-sm" disabled={isSubmitting} autoComplete="current-password" />
              </div>
            </div>
            <Button type="submit" className="w-full h-9 text-sm" disabled={isSubmitting}>
              {isSubmitting ? 'Connexion...' : <><LogIn className="w-3.5 h-3.5 mr-1.5" />Se connecter</>}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProtectedRoute({ children, requireAdmin = false }: Props) {
  const { user, isReady, isAdmin, isAdminLoading } = useAuthContext();

  if (!isReady || (user && requireAdmin && isAdminLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <InlineLoginForm />;
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center p-4">
        <h1 className="text-2xl font-bold text-destructive">Accès refusé</h1>
        <p className="text-muted-foreground">Vous n'avez pas les permissions administrateur.</p>
        <a href="/" className="text-primary hover:underline">Retour à l'accueil</a>
      </div>
    );
  }

  return <>{children}</>;
}
