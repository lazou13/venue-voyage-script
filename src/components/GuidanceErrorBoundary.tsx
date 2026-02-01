import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  onClose: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GuidanceErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('GuidanceErrorBoundary caught error:', error, errorInfo);
  }

  handleClose = () => {
    this.setState({ hasError: false, error: null });
    this.props.onClose();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center p-6 animate-fade-in">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Le guidage a rencontré une erreur</h2>
              <p className="text-muted-foreground text-sm">
                Un problème technique empêche l'affichage de la carte. Veuillez réessayer ou contacter le support si le problème persiste.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 rounded-lg bg-muted text-xs text-left font-mono overflow-auto max-h-32">
                {this.state.error.message}
              </div>
            )}

            <Button
              onClick={this.handleClose}
              className="gap-2 rounded-full"
            >
              <X className="w-4 h-4" />
              Fermer le guidage
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
