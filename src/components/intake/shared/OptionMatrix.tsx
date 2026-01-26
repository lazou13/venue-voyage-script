import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface OptionMatrixProps {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  description?: string;
}

export function OptionMatrix({ title, icon: Icon, children, description }: OptionMatrixProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {Icon && <Icon className="w-5 h-5 text-muted-foreground" />}
          {title}
        </CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
      </CardContent>
    </Card>
  );
}

interface OptionRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

export function OptionRow({ label, description, children }: OptionRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 border rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="sm:w-48 flex-shrink-0">{children}</div>
    </div>
  );
}
