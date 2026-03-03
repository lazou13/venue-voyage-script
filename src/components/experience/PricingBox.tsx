import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import type { PricingResult } from '@/lib/calculatePrice';

interface Props {
  pricing: PricingResult | null;
  labels: { pricing_title: string; total_label: string; submit_label: string };
  onSubmit: () => void;
  submitting: boolean;
  canSubmit: boolean;
  isMobile: boolean;
}

export function PricingBox({ pricing, labels, onSubmit, submitting, canSubmit, isMobile }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!pricing) return null;

  const isGroup = pricing.pricing_model === 'group';

  const breakdown = (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-muted-foreground">
          {isGroup ? 'Prix groupe' : 'Base'}
        </span>
        <span className="text-foreground">{pricing.base_price} {pricing.currency}</span>
      </div>
      {!isGroup && pricing.duration_multiplier !== 1 && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">×{pricing.duration_multiplier}</span>
          <span className="text-foreground">{Math.round(pricing.base_price * pricing.duration_multiplier)} {pricing.currency}</span>
        </div>
      )}
      {pricing.party_supplement > 0 && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Groupe</span>
          <span className="text-foreground">+{pricing.party_supplement} {pricing.currency}</span>
        </div>
      )}
      {pricing.pause_supplement > 0 && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Pause</span>
          <span className="text-foreground">+{pricing.pause_supplement} {pricing.currency}</span>
        </div>
      )}
      {pricing.add_ons_detail.map((a) => (
        <div key={a.key} className="flex justify-between">
          <span className="text-muted-foreground">{a.label}</span>
          <span className="text-foreground">+{a.price} {pricing.currency}</span>
        </div>
      ))}

      {/* Pricing model label */}
      {pricing.price_label && (
        <div className="text-xs text-muted-foreground italic">
          {pricing.price_label}
        </div>
      )}

      {/* Device info */}
      {isGroup && pricing.devices_allowed === 1 && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
          <Smartphone className="w-3.5 h-3.5" />
          <span>1 téléphone pour le groupe</span>
        </div>
      )}

      {pricing.party_size_max && isGroup && (
        <div className="text-xs text-muted-foreground">
          Jusqu'à {pricing.party_size_max} participants
        </div>
      )}

      <div className="border-t border-border pt-2 flex justify-between font-bold text-base">
        <span>{labels.total_label}</span>
        <span className="text-primary">{pricing.total} {pricing.currency}</span>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom">
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden px-4 pt-4"
            >
              {breakdown}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-sm font-semibold text-foreground">
            <span>{pricing.total} {pricing.currency}</span>
            <ChevronUp className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
          <Button onClick={onSubmit} disabled={!canSubmit || submitting} size="sm" className="rounded-full">
            {submitting ? '...' : labels.submit_label}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="sticky top-8 bg-card border border-border rounded-2xl p-6 shadow-lg">
      <h3 className="font-semibold text-foreground mb-4">{labels.pricing_title}</h3>
      {breakdown}
      <Button onClick={onSubmit} disabled={!canSubmit || submitting} className="w-full mt-4 rounded-full" size="lg">
        {submitting ? '...' : labels.submit_label}
      </Button>
    </div>
  );
}
