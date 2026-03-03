import { motion } from 'framer-motion';
import { Clock, Smartphone, Camera, LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

const iconMap: Record<string, LucideIcon> = { clock: Clock, smartphone: Smartphone, camera: Camera };

interface Benefit { icon: string; text: string; }
interface HeroConfig { title: string; subtitle: string; cta_label: string; benefits: Benefit[]; }

export function ExperienceHero({ config, onCta }: { config: HeroConfig; onCta: () => void }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-accent to-primary/5 py-16 md:py-24">
      <div className="container mx-auto px-4 text-center max-w-3xl">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-3xl md:text-5xl font-bold text-foreground mb-4 leading-tight"
        >
          {config.title}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-lg text-muted-foreground mb-8"
        >
          {config.subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-wrap justify-center gap-4 mb-8"
        >
          {config.benefits.map((b, i) => {
            const Icon = iconMap[b.icon] || Clock;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border shadow-sm"
              >
                <Icon className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">{b.text}</span>
              </motion.div>
            );
          })}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Button size="lg" onClick={onCta} className="text-base px-8 py-3 rounded-full shadow-lg">
            {config.cta_label}
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
