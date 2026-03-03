import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModeItem { key: string; emoji: string; label: string; desc: string; }
interface DurationItem { value: number; label: string; desc: string; }

interface Props {
  modes: ModeItem[];
  durations: DurationItem[];
  selectedMode: string;
  selectedDuration: number;
  onMode: (key: string) => void;
  onDuration: (val: number) => void;
}

export function StepMode({ modes, durations, selectedMode, selectedDuration, onMode, onDuration }: Props) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Mode</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {modes.map((m) => (
            <motion.button
              key={m.key}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onMode(m.key)}
              className={cn(
                'relative p-6 rounded-2xl border-2 text-left transition-colors',
                selectedMode === m.key
                  ? 'border-primary bg-primary/5 shadow-md'
                  : 'border-border bg-card hover:border-primary/30'
              )}
            >
              {selectedMode === m.key && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                >
                  <Check className="w-4 h-4" />
                </motion.div>
              )}
              <span className="text-3xl mb-2 block">{m.emoji}</span>
              <p className="font-semibold text-foreground">{m.label}</p>
              <p className="text-sm text-muted-foreground">{m.desc}</p>
            </motion.button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Durée</h3>
        <div className="grid grid-cols-3 gap-3">
          {durations.map((d) => (
            <motion.button
              key={d.value}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onDuration(d.value)}
              className={cn(
                'p-4 rounded-xl border-2 text-center transition-colors',
                selectedDuration === d.value
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border bg-card hover:border-primary/30'
              )}
            >
              <p className="text-xl font-bold text-foreground">{d.label}</p>
              <p className="text-xs text-muted-foreground">{d.desc}</p>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
