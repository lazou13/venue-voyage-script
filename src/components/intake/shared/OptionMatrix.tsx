import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OptionMatrixProps {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  description?: string;
  className?: string;
}

export function OptionMatrix({ title, icon: Icon, children, description, className }: OptionMatrixProps) {
  return (
    <Card className={cn("overflow-hidden border-border/60 shadow-soft hover:shadow-medium transition-shadow", className)}>
      <CardHeader className="pb-3 bg-muted/30">
        <CardTitle className="flex items-center gap-2.5 text-lg font-semibold">
          {Icon && (
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon className="w-4 h-4 text-primary" />
            </div>
          )}
          {title}
        </CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground ml-10.5">{description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {children}
      </CardContent>
    </Card>
  );
}

interface OptionRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function OptionRow({ label, description, children, className }: OptionRowProps) {
  return (
    <div className={cn(
      "flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4 border border-border/60 rounded-xl bg-background transition-colors hover:bg-muted/30",
      className
    )}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="sm:w-48 flex-shrink-0">{children}</div>
    </div>
  );
}
