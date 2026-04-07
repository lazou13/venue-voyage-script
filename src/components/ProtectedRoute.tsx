import { Navigate } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';

interface Props {
  children: React.ReactNode;
  requireAdmin?: boolean;
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
    return <Navigate to="/auth" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center p-4">
        <h1 className="text-2xl font-bold text-destructive">Accès refusé</h1>
        <p className="text-muted-foreground">Vous n'avez pas les permissions administrateur.</p>
        <a href="/auth" className="text-primary hover:underline">Retour à la connexion</a>
      </div>
    );
  }

  return <>{children}</>;
}
