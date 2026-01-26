import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Outputs() {
  const navigate = useNavigate();

  // Redirect to intake form - outputs are now inline
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Page déplacée</h2>
        <p className="text-muted-foreground mb-4">
          Les outputs sont maintenant intégrés dans le formulaire d'intake.
        </p>
        <Button onClick={() => navigate('/')}>Retour au dashboard</Button>
      </div>
    </div>
  );
}
