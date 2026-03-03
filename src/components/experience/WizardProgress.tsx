import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepDef { id: string; title: string; subtitle: string; }

export function WizardProgress({ steps, current }: { steps: StepDef[]; current: number }) {
  return (
    <div className="flex items-center justify-between w-full max-w-2xl mx-auto py-6">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-initial">
            <div className="flex flex-col items-center relative">
              <div className="relative">
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors',
                  done ? 'bg-primary border-primary text-primary-foreground' :
                  active ? 'border-primary text-primary bg-primary/10' :
                  'border-border text-muted-foreground bg-card'
                )}>
                  {done ? <Check className="w-5 h-5" /> : i + 1}
                </div>
                {active && (
                  <motion.div
                    layoutId="step-ring"
                    className="absolute inset-[-4px] rounded-full border-2 border-primary/40"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
              </div>
              <span className={cn(
                'hidden md:block text-xs mt-1.5 font-medium whitespace-nowrap',
                active ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {step.title}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 mx-2">
                <div className="h-0.5 bg-border rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary"
                    initial={{ width: '0%' }}
                    animate={{ width: done ? '100%' : '0%' }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
