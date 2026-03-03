import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Props {
  zones: string[];
  categories: string[];
  selectedZone: string;
  selectedCategories: string[];
  onZone: (z: string) => void;
  onToggleCategory: (c: string) => void;
  labels: { categories_title: string; categories_hint: string };
}

export function StepZone({ zones, categories, selectedZone, selectedCategories, onZone, onToggleCategory, labels }: Props) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Zone</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {zones.map((z) => (
            <motion.button
              key={z}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onZone(z)}
              className={cn(
                'p-3 rounded-xl border-2 text-center text-sm font-medium transition-colors',
                selectedZone === z
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/30'
              )}
            >
              {z}
            </motion.button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selectedZone && categories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <h3 className="text-lg font-semibold text-foreground mb-2">{labels.categories_title}</h3>
            <p className="text-sm text-muted-foreground mb-4">{labels.categories_hint}</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => {
                const selected = selectedCategories.includes(c);
                return (
                  <motion.button
                    key={c}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onToggleCategory(c)}
                    className={cn(
                      'px-4 py-2 rounded-full border text-sm font-medium transition-colors',
                      selected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-muted-foreground border-border hover:border-primary/40'
                    )}
                  >
                    {c}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
